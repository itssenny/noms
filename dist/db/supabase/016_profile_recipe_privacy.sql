-- Apply after 001–015, then deploy the matching frontend. No rows are deleted.
-- Existing data remains private. Base tables stay owner-only; visitor RPCs use
-- explicit projections because recipe rows also contain private personal data.
begin;
alter table public.profiles add column if not exists is_private boolean not null default true;
alter table public.profiles add column if not exists show_diet boolean not null default false;
alter table public.profiles add column if not exists show_cooking_level boolean not null default false;
alter table public.recipes add column if not exists visibility text not null default 'private'
 check (visibility in ('private','public'));
create index if not exists recipes_public_creator_idx on public.recipes(user_id,created_at) where visibility='public';

create or replace function public.can_view_recipe(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from public.recipes r left join public.profiles p on p.id=r.user_id
 where r.id=p_id and (r.user_id=auth.uid() or (r.visibility='public' and p.is_private=false)))
$$;
revoke all on function public.can_view_recipe(uuid) from public,anon;
grant execute on function public.can_view_recipe(uuid) to authenticated;

create table if not exists public.saved_recipes (
 user_id uuid not null references auth.users(id) on delete cascade,
 recipe_id uuid not null references public.recipes(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,recipe_id)
);
create index if not exists saved_recipes_recipe_idx on public.saved_recipes(recipe_id);
alter table public.saved_recipes enable row level security;
revoke all on public.saved_recipes from public,anon,authenticated;
grant select,insert,delete on public.saved_recipes to authenticated;
drop policy if exists "Read own saves" on public.saved_recipes;
create policy "Read own saves" on public.saved_recipes for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Remove own saves" on public.saved_recipes;
create policy "Remove own saves" on public.saved_recipes for delete to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Save accessible others recipes" on public.saved_recipes;
create policy "Save accessible others recipes" on public.saved_recipes for insert to authenticated
 with check(user_id=(select auth.uid()) and public.can_view_recipe(recipe_id) and
 not exists(select 1 from public.recipes r where r.id=recipe_id and r.user_id=(select auth.uid())));

-- Internal projection, never callable by clients. Ingredient identity/names are
-- exposed only within an authorized recipe; private custom catalogues stay private.
create or replace function public.recipe_public_document(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'id',r.id,'user_id',r.user_id,'name',r.name,'image_url',r.image_url,
 'visibility',r.visibility,'cuisine',r.cuisine,'tags',r.tags,
 'total_minutes',r.total_minutes,'prep_minutes',r.prep_minutes,'cook_minutes',r.cook_minutes,
 'difficulty',r.difficulty,'servings',r.servings,'instructions',r.instructions,
 'source',r.source,'source_url',r.source_url,'emoji',r.emoji,'background_color',r.background_color,
 'creator',jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name),
 'recipe_ingredients',coalesce((select jsonb_agg(jsonb_build_object(
 'quantity',ri.quantity,'unit',ri.unit,'preparation_note',ri.preparation_note,'sort_order',ri.sort_order,
 'ingredient',jsonb_build_object('id',i.id,'canonical_name',i.canonical_name,'category',i.category)) order by ri.sort_order)
 from public.recipe_ingredients ri join public.ingredients i on i.id=ri.ingredient_id where ri.recipe_id=r.id),'[]'::jsonb))
 from public.recipes r join public.profiles p on p.id=r.user_id where r.id=p_id and public.can_view_recipe(r.id)
$$;
revoke all on function public.recipe_public_document(uuid) from public,anon,authenticated;

create or replace function public.get_visible_recipe(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select public.recipe_public_document(p_id) where auth.uid() is not null
$$;
revoke all on function public.get_visible_recipe(uuid) from public,anon;
grant execute on function public.get_visible_recipe(uuid) to authenticated;

create or replace function public.get_visible_profile(p_lookup text)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when p.id=auth.uid() then to_jsonb(p)
 when p.is_private then jsonb_build_object('id',p.id,'username',p.username,'avatar_url',p.avatar_url,'is_private',true)
 else jsonb_build_object('id',p.id,'username',p.username,'avatar_url',p.avatar_url,'is_private',false,
 'display_name',p.display_name,'bio',p.bio,'favorite_cuisines',p.favorite_cuisines,
 'diet_preference',case when p.show_diet then p.diet_preference end,
 'cooking_level',case when p.show_cooking_level then p.cooking_level end) end
 from public.profiles p where auth.uid() is not null and (p.id::text=p_lookup or p.username=lower(p_lookup)) limit 1
$$;
revoke all on function public.get_visible_profile(text) from public,anon;
grant execute on function public.get_visible_profile(text) to authenticated;

create or replace function public.get_profile_recipes(p_user_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(public.recipe_public_document(r.id) order by r.created_at desc),'[]'::jsonb)
 from public.recipes r where auth.uid() is not null and r.user_id=p_user_id and public.can_view_recipe(r.id)
$$;
revoke all on function public.get_profile_recipes(uuid) from public,anon;
grant execute on function public.get_profile_recipes(uuid) to authenticated;

create or replace function public.get_saved_recipes()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('recipe_id',s.recipe_id,
 'recipe',public.recipe_public_document(s.recipe_id)) order by s.created_at desc),'[]'::jsonb)
 from public.saved_recipes s where s.user_id=auth.uid()
$$;
revoke all on function public.get_saved_recipes() from public,anon;
grant execute on function public.get_saved_recipes() to authenticated;

-- Public URLs would bypass privacy regardless of recipe RLS. Keep objects in
-- place and make the bucket private; the client downloads via authenticated RLS.
update storage.buckets set public=false where id='recipe-covers';
drop policy if exists "Recipe covers are publicly readable" on storage.objects;
create or replace function public.can_read_recipe_cover(p_name text)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.recipes r
 where r.user_id::text=split_part(p_name,'/',1) and public.can_view_recipe(r.id)
 and (r.image_url=p_name or split_part(r.image_url,'/storage/v1/object/public/recipe-covers/',2)=p_name))
$$;
revoke all on function public.can_read_recipe_cover(text) from public,anon;
grant execute on function public.can_read_recipe_cover(text) to authenticated;
drop policy if exists "Read authorized recipe covers" on storage.objects;
create policy "Read authorized recipe covers" on storage.objects for select to authenticated using (
 bucket_id='recipe-covers' and ((storage.foldername(name))[1]=(select auth.uid())::text or public.can_read_recipe_cover(name))
);
create or replace function public.update_recipe(p_id uuid, p_recipe jsonb, p_ingredients jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Please sign in again'; end if;
  perform 1 from public.recipes where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'Recipe not found or access denied'; end if;
  if jsonb_typeof(p_ingredients) is distinct from 'array' then
    raise exception 'Ingredients must be an array';
  end if;
  if jsonb_array_length(p_ingredients) = 0 then raise exception 'Add at least one ingredient'; end if;
  if jsonb_typeof(p_recipe->'instructions') is distinct from 'array' then
    raise exception 'Instructions must be an array';
  end if;
  if jsonb_array_length(p_recipe->'instructions') = 0 then raise exception 'Add at least one instruction'; end if;
  update public.recipes set
    visibility = coalesce(p_recipe->>'visibility', visibility),
    name = p_recipe->>'name', cuisine = p_recipe->>'cuisine',
    tags = p_recipe->'tags', total_minutes = (p_recipe->>'total_minutes')::integer,
    prep_minutes = (p_recipe->>'prep_minutes')::integer,
    cook_minutes = (p_recipe->>'cook_minutes')::integer,
    difficulty = p_recipe->>'difficulty', servings = (p_recipe->>'servings')::numeric,
    instructions = p_recipe->'instructions', image_url = p_recipe->>'image_url',
    source = p_recipe->>'source', source_url = p_recipe->>'source_url'
  where id = p_id and user_id = auth.uid();
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

commit;
