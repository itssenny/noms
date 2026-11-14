-- Apply after 019. Additive rollout: no existing recipes or ingredient IDs are removed.
begin;
alter table public.recipes add column if not exists catalog_key text unique;
alter table public.recipes alter column user_id drop not null;
-- Only operator-seeded catalogue rows may have no owner. Owner RLS denies
-- client creation/editing of these rows, including through update_recipe.
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.recipes'::regclass and conname='recipes_catalog_owner') then
 alter table public.recipes add constraint recipes_catalog_owner check
 ((catalog_key is null and user_id is not null) or (catalog_key is not null and user_id is null and visibility='public'));
 end if; end $$;
alter table public.recipes add column if not exists share_code text unique
 check (share_code is null or share_code ~ '^[A-HJ-NP-Z2-9]{6}$');
create or replace function public.assign_recipe_share_code()
returns trigger language plpgsql security definer set search_path='' as $$
declare code text; alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
 -- Codes belong to the database, not caller-supplied values. Retain forever
 -- after first publication, even when the recipe becomes private again.
 if TG_OP='UPDATE' then new.share_code := old.share_code; else new.share_code := null; end if;
 if new.share_code is null and new.visibility='public' then
  perform pg_advisory_xact_lock(627310211);
  loop
   code := '';
   for i in 1..6 loop code := code || substr(alphabet,1+floor(random()*length(alphabet))::integer,1); end loop;
   exit when not exists(select 1 from public.recipes where share_code=code);
  end loop;
  new.share_code := code;
 end if;
 return new;
end $$;
revoke all on function public.assign_recipe_share_code() from public,anon,authenticated;
drop trigger if exists recipes_share_code on public.recipes;
create trigger recipes_share_code before insert or update on public.recipes
 for each row execute function public.assign_recipe_share_code();
-- Already-published recipes receive their first code without changing privacy.
update public.recipes set visibility=visibility where visibility='public' and share_code is null;

create or replace function public.can_view_recipe(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from public.recipes r left join public.profiles p on p.id=r.user_id
 where r.id=p_id and (r.user_id=auth.uid() or
 (r.visibility='public' and (r.catalog_key is not null or p.is_private=false))))
$$;
create or replace function public.recipe_public_document(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'id',r.id,'user_id',r.user_id,'name',r.name,'image_url',r.image_url,
 'visibility',r.visibility,'share_code',r.share_code,'catalog_key',r.catalog_key,'cuisine',r.cuisine,'tags',r.tags,
 'total_minutes',r.total_minutes,'prep_minutes',r.prep_minutes,'cook_minutes',r.cook_minutes,
 'difficulty',r.difficulty,'servings',r.servings,'instructions',r.instructions,
 'source',r.source,'source_url',r.source_url,'emoji',r.emoji,'background_color',r.background_color,
 'creator',case when r.catalog_key is not null then jsonb_build_object('display_name','noms kitchen','username','noms') else jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name) end,
 'recipe_ingredients',coalesce((select jsonb_agg(jsonb_build_object(
 'quantity',ri.quantity,'unit',ri.unit,'preparation_note',ri.preparation_note,'sort_order',ri.sort_order,
 'ingredient',jsonb_build_object('id',i.id,'canonical_name',i.canonical_name,'category',i.category)) order by ri.sort_order)
 from public.recipe_ingredients ri join public.ingredients i on i.id=ri.ingredient_id where ri.recipe_id=r.id),'[]'::jsonb))
 from public.recipes r left join public.profiles p on p.id=r.user_id where r.id=p_id and public.can_view_recipe(r.id)
$$;
revoke all on function public.recipe_public_document(uuid) from public,anon,authenticated;


-- Bounded discovery. Recheck access on every request; base tables stay private.
create or replace function public.discover_recipes(p_search text default '',p_offset integer default 0)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(public.recipe_public_document(r.id) order by (r.catalog_key is not null) desc,r.created_at desc,r.id),'[]'::jsonb)
 from (select r.* from public.recipes r left join public.profiles p on p.id=r.user_id
 where auth.uid() is not null and r.visibility='public' and (r.catalog_key is not null or p.is_private=false)
 and (coalesce(p_search,'')='' or r.share_code=upper(trim(p_search)) or
 position(lower(left(p_search,100)) in lower(r.name))>0 or
 position(lower(left(p_search,100)) in lower(r.tags::text))>0)
 order by (r.catalog_key is not null) desc,r.created_at desc,r.id
 limit 24 offset greatest(0,least(coalesce(p_offset,0),10000))) r
$$;
revoke all on function public.discover_recipes(text,integer) from public,anon;
grant execute on function public.discover_recipes(text,integer) to authenticated;
create or replace function public.get_recipe_by_code(p_code text)
returns jsonb language sql stable security definer set search_path='' as $$
 select public.recipe_public_document(r.id) from public.recipes r
 where auth.uid() is not null and r.share_code=upper(trim(p_code)) and r.visibility='public' and public.can_view_recipe(r.id)
$$;
revoke all on function public.get_recipe_by_code(text) from public,anon;
grant execute on function public.get_recipe_by_code(text) to authenticated;
commit;
