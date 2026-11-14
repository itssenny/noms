-- Separate public profile identities from Supabase Auth users.
-- Apply after 022_recipe_time_type.sql. Existing recipe IDs and share codes stay intact.
begin;

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add column if not exists profile_type text not null default 'personal'
  check (profile_type in ('personal', 'brand', 'official'));
alter table public.profiles add column if not exists is_verified boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'official_profiles_are_public') then
    alter table public.profiles add constraint official_profiles_are_public
      check (profile_type not in ('brand', 'official') or is_private = false);
  end if;
end $$;

create table if not exists public.profile_memberships (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now(),
  primary key (profile_id, user_id)
);
create index if not exists profile_memberships_user_idx on public.profile_memberships(user_id, profile_id);
alter table public.profile_memberships enable row level security;
revoke all on public.profile_memberships from anon, authenticated;
grant select on public.profile_memberships to authenticated;
drop policy if exists "Users can read their profile memberships" on public.profile_memberships;
create policy "Users can read their profile memberships"
  on public.profile_memberships for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.can_manage_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.profile_memberships m
    where m.profile_id = p_profile_id and m.user_id = auth.uid()
  )
$$;
create or replace function public.owns_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.profile_memberships m
    where m.profile_id = p_profile_id and m.user_id = auth.uid() and m.role = 'owner'
  )
$$;
revoke all on function public.can_manage_profile(uuid) from public, anon;
revoke all on function public.owns_profile(uuid) from public, anon;
grant execute on function public.can_manage_profile(uuid) to authenticated;
grant execute on function public.owns_profile(uuid) to authenticated;

-- Fill any profile rows missing from older accounts before recipes reference profiles.
insert into public.profiles (id, display_name, created_at)
select u.id, coalesce(u.raw_user_meta_data ->> 'display_name', ''), u.created_at
from auth.users u
on conflict (id) do nothing;

-- Existing personal profiles retain their IDs; signup creates the matching owner membership.
insert into public.profile_memberships(profile_id, user_id, role)
select p.id, u.id, 'owner'
from public.profiles p join auth.users u on u.id = p.id
on conflict (profile_id, user_id) do nothing;

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, created_at)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), new.created_at)
  on conflict (id) do nothing;
  insert into public.profile_memberships (profile_id, user_id, role)
  values (new.id, new.id, 'owner')
  on conflict (profile_id, user_id) do nothing;
  return new;
end;
$$;
create or replace function public.delete_personal_profile_after_auth_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.profiles where id = old.id and profile_type = 'personal';
  return old;
end;
$$;
drop trigger if exists remove_personal_profile_after_auth_delete on auth.users;
create trigger remove_personal_profile_after_auth_delete after delete on auth.users
  for each row execute function public.delete_personal_profile_after_auth_delete();

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can create their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can read managed profiles"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.can_manage_profile(id));
create policy "Users can create personal profiles"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) and profile_type = 'personal');
create policy "Users can update managed profiles"
  on public.profiles for update to authenticated
  using ((id = (select auth.uid()) and profile_type = 'personal') or public.owns_profile(id))
  with check ((id = (select auth.uid()) and profile_type = 'personal') or public.owns_profile(id));
revoke insert, update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant insert (id, username, display_name, bio, avatar_url, diet_preference, cooking_level,
  favorite_cuisines, is_private, show_diet, show_cooking_level) on public.profiles to authenticated;
grant update (username, display_name, bio, avatar_url, diet_preference, cooking_level,
  favorite_cuisines, is_private, show_diet, show_cooking_level) on public.profiles to authenticated;

-- The existing column name is retained for compatibility; it now points to a profile identity.
alter table public.recipes drop constraint if exists recipes_user_id_fkey;
alter table public.recipes drop constraint if exists recipes_catalog_owner;

insert into public.profiles (id, username, display_name, bio, profile_type, is_verified, is_private)
values (gen_random_uuid(), 'noms', 'Noms', 'The official Noms kitchen.', 'official', true, false)
on conflict (username) do nothing;
do $$
begin
  if not exists (
    select 1 from public.profiles where username = 'noms' and profile_type = 'official'
  ) then
    raise exception 'The username @noms is already used by a non-official profile; resolve the username conflict before applying this migration.';
  end if;
end;
$$;

-- Reassign, do not recreate, the three existing starter recipes.
update public.recipes
set user_id = (select id from public.profiles where username = 'noms'), visibility = 'public'
where catalog_key is not null;
alter table public.recipes alter column user_id set not null;
alter table public.recipes add constraint recipes_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.recipes add constraint recipes_catalog_owner
  check (catalog_key is null or visibility = 'public');

drop policy if exists "Users can read their own recipes" on public.recipes;
drop policy if exists "Users can create their own recipes" on public.recipes;
drop policy if exists "Users can update their own recipes" on public.recipes;
drop policy if exists "Users can delete their own recipes" on public.recipes;
create policy "Members can read managed recipes"
  on public.recipes for select to authenticated
  using (public.can_manage_profile(user_id));
create policy "Members can create managed recipes"
  on public.recipes for insert to authenticated
  with check (public.can_manage_profile(user_id) and catalog_key is null);
create policy "Members can update managed recipes"
  on public.recipes for update to authenticated
  using (public.can_manage_profile(user_id))
  with check (public.can_manage_profile(user_id));
create policy "Members can delete managed recipes"
  on public.recipes for delete to authenticated
  using (public.can_manage_profile(user_id));

drop policy if exists "Users can read ingredients on their own recipes" on public.recipe_ingredients;
drop policy if exists "Users can add ingredients to their own recipes" on public.recipe_ingredients;
drop policy if exists "Users can update ingredients on their own recipes" on public.recipe_ingredients;
drop policy if exists "Users can delete ingredients from their own recipes" on public.recipe_ingredients;
create policy "Members can read managed recipe ingredients" on public.recipe_ingredients for select to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and public.can_manage_profile(r.user_id)));
create policy "Members can add managed recipe ingredients" on public.recipe_ingredients for insert to authenticated
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and public.can_manage_profile(r.user_id)));
create policy "Members can update managed recipe ingredients" on public.recipe_ingredients for update to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and public.can_manage_profile(r.user_id)))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and public.can_manage_profile(r.user_id)));
create policy "Members can delete managed recipe ingredients" on public.recipe_ingredients for delete to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and public.can_manage_profile(r.user_id)));

create or replace function public.can_view_recipe(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.recipes r join public.profiles p on p.id = r.user_id
    where r.id = p_id and (public.can_manage_profile(r.user_id) or (r.visibility = 'public' and not p.is_private))
  )
$$;

create or replace function public.recipe_public_document(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'user_id', r.user_id, 'profile_id', r.user_id, 'name', r.name, 'image_url', r.image_url,
    'visibility', r.visibility, 'share_code', r.share_code, 'catalog_key', r.catalog_key,
    'cuisine', r.cuisine, 'tags', r.tags, 'total_minutes', r.total_minutes,
    'prep_minutes', r.prep_minutes, 'cook_minutes', r.cook_minutes, 'cook_time_type', r.cook_time_type,
    'difficulty', r.difficulty, 'servings', r.servings, 'instructions', r.instructions,
    'source', r.source, 'source_url', r.source_url, 'emoji', r.emoji, 'background_color', r.background_color,
    'creator', jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name,
      'avatar_url', p.avatar_url, 'profile_type', p.profile_type, 'is_verified', p.is_verified),
    'recipe_ingredients', coalesce((
      select jsonb_agg(jsonb_build_object('quantity', ri.quantity, 'unit', ri.unit,
        'preparation_note', ri.preparation_note, 'sort_order', ri.sort_order,
        'ingredient', jsonb_build_object('id', i.id, 'canonical_name', i.canonical_name, 'category', i.category))
        order by ri.sort_order)
      from public.recipe_ingredients ri join public.ingredients i on i.id = ri.ingredient_id
      where ri.recipe_id = r.id
    ), '[]'::jsonb)
  )
  from public.recipes r join public.profiles p on p.id = r.user_id
  where r.id = p_id and public.can_view_recipe(r.id)
$$;
revoke all on function public.recipe_public_document(uuid) from public, anon, authenticated;

create or replace function public.discover_recipes(p_search text default '', p_offset integer default 0)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.recipe_public_document(r.id)
    order by (p.profile_type = 'official') desc, r.created_at desc, r.id), '[]'::jsonb)
  from (
    select r.* from public.recipes r join public.profiles p on p.id = r.user_id
    where auth.uid() is not null and r.visibility = 'public' and not p.is_private
      and (coalesce(p_search, '') = '' or r.share_code = upper(trim(p_search))
        or position(lower(left(p_search, 100)) in lower(r.name)) > 0
        or position(lower(left(p_search, 100)) in lower(r.tags::text)) > 0)
    order by (p.profile_type = 'official') desc, r.created_at desc, r.id
    limit 24 offset greatest(0, least(coalesce(p_offset, 0), 10000))
  ) r join public.profiles p on p.id = r.user_id
$$;
revoke all on function public.discover_recipes(text, integer) from public, anon;
grant execute on function public.discover_recipes(text, integer) to authenticated;

create or replace function public.get_visible_profile(p_lookup text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case
    when p.id = auth.uid() or public.can_manage_profile(p.id) then to_jsonb(p)
    when p.is_private then jsonb_build_object('id', p.id, 'username', p.username,
      'avatar_url', p.avatar_url, 'is_private', true, 'profile_type', p.profile_type)
    else jsonb_build_object('id', p.id, 'username', p.username, 'avatar_url', p.avatar_url,
      'is_private', false, 'display_name', p.display_name, 'bio', p.bio,
      'favorite_cuisines', p.favorite_cuisines,
      'diet_preference', case when p.show_diet then p.diet_preference end,
      'cooking_level', case when p.show_cooking_level then p.cooking_level end,
      'profile_type', p.profile_type, 'is_verified', p.is_verified)
    end
  from public.profiles p
  where auth.uid() is not null and (p.id::text = p_lookup or p.username = lower(p_lookup))
  limit 1
$$;
revoke all on function public.get_visible_profile(text) from public, anon;
grant execute on function public.get_visible_profile(text) to authenticated;

create or replace function public.update_recipe(p_id uuid, p_recipe jsonb, p_ingredients jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in again'; end if;
  perform 1 from public.recipes where id = p_id and public.can_manage_profile(user_id) for update;
  if not found then raise exception 'Recipe not found or access denied'; end if;
  if jsonb_typeof(p_ingredients) is distinct from 'array' or jsonb_array_length(p_ingredients) = 0 then
    raise exception 'Add at least one ingredient';
  end if;
  if jsonb_typeof(p_recipe->'instructions') is distinct from 'array' or jsonb_array_length(p_recipe->'instructions') = 0 then
    raise exception 'Add at least one instruction';
  end if;
  update public.recipes set
    visibility = coalesce(p_recipe->>'visibility', visibility), cook_time_type = coalesce(p_recipe->>'cook_time_type', cook_time_type),
    name = p_recipe->>'name', cuisine = p_recipe->>'cuisine', tags = p_recipe->'tags',
    total_minutes = (p_recipe->>'total_minutes')::integer, prep_minutes = (p_recipe->>'prep_minutes')::integer,
    cook_minutes = (p_recipe->>'cook_minutes')::integer, difficulty = p_recipe->>'difficulty',
    servings = (p_recipe->>'servings')::numeric, instructions = p_recipe->'instructions',
    image_url = p_recipe->>'image_url', source = p_recipe->>'source', source_url = p_recipe->>'source_url'
  where id = p_id;
  delete from public.recipe_ingredients where recipe_id = p_id;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, quantity, unit, preparation_note, sort_order)
  select p_id, (item->>'ingredient_id')::uuid, (item->>'quantity')::numeric,
    item->>'unit', item->>'preparation_note', (ordinality - 1)::integer
  from jsonb_array_elements(p_ingredients) with ordinality as items(item, ordinality);
  return p_id;
end;
$$;
revoke all on function public.update_recipe(uuid, jsonb, jsonb) from public;
grant execute on function public.update_recipe(uuid, jsonb, jsonb) to authenticated;

-- Recipe feedback remains private to the authenticated manager who wrote it.
drop policy if exists "Read own recipe notes" on public.recipe_notes;
drop policy if exists "Create own recipe notes" on public.recipe_notes;
drop policy if exists "Delete own recipe notes" on public.recipe_notes;
create policy "Read own recipe notes" on public.recipe_notes for select to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.recipes r where r.id = recipe_id and public.can_manage_profile(r.user_id)));
create policy "Create own recipe notes" on public.recipe_notes for insert to authenticated
  with check (user_id = (select auth.uid()) and not is_legacy and created_at is not null
    and exists (select 1 from public.recipes r where r.id = recipe_id and public.can_manage_profile(r.user_id)));
create policy "Delete own recipe notes" on public.recipe_notes for delete to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.recipes r where r.id = recipe_id and public.can_manage_profile(r.user_id)));
create or replace function public.save_recipe_feedback(p_id uuid, p_set_rating boolean, p_rating numeric, p_note text, p_note_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare result jsonb;
begin
  perform 1 from public.recipes where id = p_id and public.can_manage_profile(user_id) for update;
  if not found then raise exception 'Recipe not found or access denied'; end if;
  if p_set_rating then
    if p_rating is not null and (p_rating < 1 or p_rating > 5) then raise exception 'Choose a rating between 1 and 5'; end if;
    update public.recipes set rating = p_rating where id = p_id;
  end if;
  if length(trim(coalesce(p_note, ''))) > 0 then
    if length(trim(p_note)) > 5000 then raise exception 'Keep new notes under 5,000 characters'; end if;
    insert into public.recipe_notes(id, recipe_id, user_id, body)
    values (coalesce(p_note_id, gen_random_uuid()), p_id, auth.uid(), trim(p_note)) on conflict (id) do nothing;
  end if;
  select jsonb_build_object('rating', r.rating, 'posts', coalesce((
    select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'created_at', n.created_at, 'is_legacy', n.is_legacy)
      order by n.created_at desc nulls last, n.id) from public.recipe_notes n
    where n.recipe_id = p_id and n.user_id = auth.uid()
  ), '[]'::jsonb)) into result
  from public.recipes r where r.id = p_id and public.can_manage_profile(r.user_id);
  return result;
end;
$$;
revoke all on function public.save_recipe_feedback(uuid, boolean, numeric, text, uuid) from public, anon;
grant execute on function public.save_recipe_feedback(uuid, boolean, numeric, text, uuid) to authenticated;

-- A manager may upload an avatar under the managed profile's storage folder.
drop policy if exists "Users can upload their own avatar" on storage.objects;
drop policy if exists "Users can replace their own avatar" on storage.objects;
drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Managers can upload profile avatars" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and exists (select 1 from public.profiles p
    where p.id::text = (storage.foldername(name))[1] and public.can_manage_profile(p.id)));
create policy "Managers can replace profile avatars" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and exists (select 1 from public.profiles p
    where p.id::text = (storage.foldername(name))[1] and public.can_manage_profile(p.id)))
  with check (bucket_id = 'avatars' and exists (select 1 from public.profiles p
    where p.id::text = (storage.foldername(name))[1] and public.can_manage_profile(p.id)));
create policy "Managers can delete profile avatars" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and exists (select 1 from public.profiles p
    where p.id::text = (storage.foldername(name))[1] and public.can_manage_profile(p.id)));

create or replace function public.can_read_recipe_cover(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.recipes r
    where public.can_view_recipe(r.id) and (r.image_url = p_name
      or split_part(r.image_url, '/storage/v1/object/public/recipe-covers/', 2) = p_name)
  )
$$;

-- One-time operator action after applying this migration:
-- insert into public.profile_memberships (profile_id, user_id, role)
-- select p.id, '<YOUR_EXISTING_AUTH_USER_UUID>'::uuid, 'owner'
-- from public.profiles p where p.username = 'noms'
-- on conflict (profile_id, user_id) do update set role = 'owner';

commit;