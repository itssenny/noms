-- Apply after 032. Personal collections are account-owned, like saved_recipes.
begin;
create table public.cookbooks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 120),
 description text not null default '' check(length(description)<=2000),
 cover_recipe_id uuid references public.recipes(id) on delete set null,
 visibility text not null default 'private' check(visibility in ('private','public')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index cookbooks_owner_idx on public.cookbooks(user_id,created_at);
create table public.cookbook_recipes (
 cookbook_id uuid not null references public.cookbooks(id) on delete cascade,
 recipe_id uuid not null references public.recipes(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(cookbook_id,recipe_id)
);
create index cookbook_recipes_recipe_idx on public.cookbook_recipes(recipe_id);
alter table public.cookbooks enable row level security;
alter table public.cookbook_recipes enable row level security;
revoke all on public.cookbooks,public.cookbook_recipes from public,anon,authenticated;
grant select,insert,update,delete on public.cookbooks to authenticated;
grant select,insert,delete on public.cookbook_recipes to authenticated;
create policy "Read personal cookbooks" on public.cookbooks for select to authenticated using(user_id=(select auth.uid()));
create policy "Create private cookbooks" on public.cookbooks for insert to authenticated with check(user_id=(select auth.uid()) and visibility='private');
create policy "Edit private cookbooks" on public.cookbooks for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and visibility='private');
create policy "Delete personal cookbooks" on public.cookbooks for delete to authenticated using(user_id=(select auth.uid()));
create policy "Read personal cookbook entries" on public.cookbook_recipes for select to authenticated using(exists(select 1 from public.cookbooks c where c.id=cookbook_id and c.user_id=(select auth.uid())));
create policy "Remove personal cookbook entries" on public.cookbook_recipes for delete to authenticated using(exists(select 1 from public.cookbooks c where c.id=cookbook_id and c.user_id=(select auth.uid())));
create policy "Add accessible library recipes" on public.cookbook_recipes for insert to authenticated with check(
 exists(select 1 from public.cookbooks c where c.id=cookbook_id and c.user_id=(select auth.uid()))
 and public.can_view_recipe(recipe_id)
 and (exists(select 1 from public.recipes r where r.id=recipe_id and public.can_manage_profile(r.user_id))
 or exists(select 1 from public.saved_recipes s where s.recipe_id=cookbook_recipes.recipe_id and s.user_id=(select auth.uid())))
);
create function public.validate_cookbook_cover() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.cover_recipe_id is not null and (not public.can_view_recipe(new.cover_recipe_id) or not exists(
 select 1 from public.cookbook_recipes cr where cr.cookbook_id=new.id and cr.recipe_id=new.cover_recipe_id)) then
 raise exception 'Choose an accessible recipe inside this Cookbook'; end if;
 new.updated_at=now(); return new;
end $$;
create trigger validate_cookbook_cover before insert or update on public.cookbooks for each row execute function public.validate_cookbook_cover();
revoke all on function public.validate_cookbook_cover() from public,anon,authenticated;
-- Use the existing guarded projection. Never return raw recipes or personal notes.
create function public.get_cookbook_recipes(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('recipe_id',cr.recipe_id,'recipe',public.recipe_public_document(cr.recipe_id)) order by cr.created_at desc,cr.recipe_id),'[]'::jsonb)
 from public.cookbook_recipes cr join public.cookbooks c on c.id=cr.cookbook_id
 where c.id=p_id and c.user_id=auth.uid()
$$;
revoke all on function public.get_cookbook_recipes(uuid) from public,anon;
grant execute on function public.get_cookbook_recipes(uuid) to authenticated;
create function public.get_cookbooks() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object(
 'recipe_ids',coalesce((select jsonb_agg(cr.recipe_id) from public.cookbook_recipes cr where cr.cookbook_id=c.id),'[]'::jsonb),
 'cover',(select jsonb_build_object('id',r.id,'name',r.name,'image_url',r.image_url,'image_framing',r.image_framing,'emoji',r.emoji,'background_color',r.background_color)
 from public.cookbook_recipes cr join public.recipes r on r.id=cr.recipe_id
 where cr.cookbook_id=c.id and public.can_view_recipe(r.id)
 order by (r.id=c.cover_recipe_id) desc,(nullif(r.image_url,'') is not null) desc,cr.created_at,r.id limit 1)
 ) order by c.created_at desc,c.id),'[]'::jsonb) from public.cookbooks c where c.user_id=auth.uid()
$$;
revoke all on function public.get_cookbooks() from public,anon;
grant execute on function public.get_cookbooks() to authenticated;
commit;
