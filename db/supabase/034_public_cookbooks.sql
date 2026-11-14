-- Apply after 033. Public collections never override recipe or profile privacy.
begin;
drop policy "Create private cookbooks" on public.cookbooks;
drop policy "Edit private cookbooks" on public.cookbooks;
create policy "Create own cookbooks" on public.cookbooks for insert to authenticated with check(user_id=(select auth.uid()));
create policy "Edit own cookbooks" on public.cookbooks for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
-- Base tables and memberships remain owner-only; public reads use projections.
create function public.can_view_cookbook(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.cookbooks c join public.profiles p on p.id=c.user_id
 where c.id=p_id and (c.user_id=auth.uid() or (c.visibility='public' and not p.is_private)))
$$;
create function public.is_public_cookbook_recipe(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.recipes r left join public.profiles p on p.id=r.user_id
 where r.id=p_id and r.visibility='public' and (r.catalog_key is not null or p.is_private=false))
$$;
revoke all on function public.can_view_cookbook(uuid),public.is_public_cookbook_recipe(uuid) from public,anon,authenticated;
-- Internal projection: private entry IDs, counts and cover references are omitted
-- for visitors, even if the visitor happens to manage a private member recipe.
create function public.cookbook_document(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',c.id,'user_id',c.user_id,'name',c.name,'description',c.description,
 'visibility',c.visibility,'created_at',c.created_at,'updated_at',c.updated_at,
 'author',jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'is_private',p.is_private),
 'cover_recipe_id',case when c.user_id=auth.uid() or (public.is_public_cookbook_recipe(c.cover_recipe_id) and exists(select 1 from public.cookbook_recipes cr where cr.cookbook_id=c.id and cr.recipe_id=c.cover_recipe_id)) then c.cover_recipe_id end,
 'recipe_ids',coalesce((select jsonb_agg(cr.recipe_id order by cr.created_at,cr.recipe_id) from public.cookbook_recipes cr
 where cr.cookbook_id=c.id and (c.user_id=auth.uid() or public.is_public_cookbook_recipe(cr.recipe_id))),'[]'::jsonb),
 'cover',(select jsonb_build_object('id',r.id,'name',r.name,'image_url',r.image_url,'image_framing',r.image_framing,'emoji',r.emoji,'background_color',r.background_color)
 from public.cookbook_recipes cr join public.recipes r on r.id=cr.recipe_id
 where cr.cookbook_id=c.id and public.can_view_recipe(r.id) and (c.user_id=auth.uid() or public.is_public_cookbook_recipe(r.id))
 order by (r.id=c.cover_recipe_id) desc,(nullif(r.image_url,'') is not null) desc,cr.created_at,r.id limit 1))
 from public.cookbooks c join public.profiles p on p.id=c.user_id where c.id=p_id and public.can_view_cookbook(c.id)
$$;
revoke all on function public.cookbook_document(uuid) from public,anon,authenticated;
create function public.get_cookbook(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select public.cookbook_document(p_id)
$$;
create or replace function public.get_cookbooks() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(public.cookbook_document(c.id) order by c.created_at desc,c.id),'[]'::jsonb)
 from public.cookbooks c where c.user_id=auth.uid()
$$;
create function public.get_profile_cookbooks(p_profile_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(public.cookbook_document(c.id) order by c.created_at desc,c.id),'[]'::jsonb)
 from public.cookbooks c where c.user_id=p_profile_id and public.can_view_cookbook(c.id)
$$;
create or replace function public.get_cookbook_recipes(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('recipe_id',cr.recipe_id,'recipe',public.recipe_public_document(cr.recipe_id)) order by cr.created_at desc,cr.recipe_id),'[]'::jsonb)
 from public.cookbook_recipes cr join public.cookbooks c on c.id=cr.cookbook_id
 where c.id=p_id and public.can_view_cookbook(c.id)
 and (c.user_id=auth.uid() or public.is_public_cookbook_recipe(cr.recipe_id))
$$;
revoke all on function public.get_cookbook(uuid),public.get_profile_cookbooks(uuid) from public,anon;
grant execute on function public.get_cookbook(uuid),public.get_profile_cookbooks(uuid) to authenticated;
commit;
