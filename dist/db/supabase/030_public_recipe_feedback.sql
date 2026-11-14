-- Apply after 029. Private feedback never appears in public recipe documents.
begin;
-- Preserve managed-profile access and include the ownerless public catalogue.
create or replace function public.can_view_recipe(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.recipes r left join public.profiles p on p.id=r.user_id
 where r.id=p_id and (public.can_manage_profile(r.user_id) or (r.visibility='public' and (r.catalog_key is not null or p.is_private=false))))
$$;
create table if not exists public.recipe_personal_ratings(
 recipe_id uuid not null references public.recipes(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 rating numeric check(rating between 1 and 5),
 primary key(recipe_id,user_id)
);
alter table public.recipe_personal_ratings enable row level security;
drop policy if exists "Own personal ratings" on public.recipe_personal_ratings;
create policy "Own personal ratings" on public.recipe_personal_ratings for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and public.can_view_recipe(recipe_id));
grant select,insert,update,delete on public.recipe_personal_ratings to authenticated;
revoke all on public.recipe_personal_ratings from anon;
-- Notes remain readable/deletable by their author even if publication is withdrawn.
drop policy if exists "Read own recipe notes" on public.recipe_notes;
drop policy if exists "Create own recipe notes" on public.recipe_notes;
drop policy if exists "Delete own recipe notes" on public.recipe_notes;
create policy "Read own recipe notes" on public.recipe_notes for select to authenticated using(user_id=(select auth.uid()));
create policy "Delete own recipe notes" on public.recipe_notes for delete to authenticated using(user_id=(select auth.uid()));
create policy "Create own recipe notes" on public.recipe_notes for insert to authenticated
 with check(user_id=(select auth.uid()) and not is_legacy and created_at is not null and public.can_view_recipe(recipe_id));
create or replace function public.save_public_recipe_feedback(p_id uuid,p_set_rating boolean,p_rating numeric,p_note text,p_note_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not public.can_view_recipe(p_id) then raise exception 'Recipe not found or access denied'; end if;
 if p_set_rating then
  if p_rating is not null and (p_rating<1 or p_rating>5) then raise exception 'Choose a rating between 1 and 5'; end if;
  insert into public.recipe_personal_ratings(recipe_id,user_id,rating) values(p_id,auth.uid(),p_rating)
  on conflict(recipe_id,user_id) do update set rating=excluded.rating;
 end if;
 if length(trim(coalesce(p_note,'')))>0 then
  if length(trim(p_note))>5000 then raise exception 'Keep new notes under 5,000 characters'; end if;
  insert into public.recipe_notes(id,recipe_id,user_id,body) values(coalesce(p_note_id,gen_random_uuid()),p_id,auth.uid(),trim(p_note)) on conflict(id) do nothing;
 end if;
 return jsonb_build_object('rating',(select rating from public.recipe_personal_ratings where recipe_id=p_id and user_id=auth.uid()),
 'posts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'body',body,'created_at',created_at,'is_legacy',is_legacy) order by created_at desc nulls last,id) from public.recipe_notes where recipe_id=p_id and user_id=auth.uid()),'[]'::jsonb));
end $$;
revoke all on function public.save_public_recipe_feedback(uuid,boolean,numeric,text,uuid) from public,anon;
grant execute on function public.save_public_recipe_feedback(uuid,boolean,numeric,text,uuid) to authenticated;
create table if not exists public.recipe_comments(
 id uuid primary key default gen_random_uuid(),
 recipe_id uuid not null references public.recipes(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index if not exists recipe_comments_date on public.recipe_comments(recipe_id,created_at desc,id);
alter table public.recipe_comments enable row level security;
-- Reading/inserting uses explicit RPC projections, never a private notes join.
drop policy if exists "Delete own public comments" on public.recipe_comments;
create policy "Delete own public comments" on public.recipe_comments for delete to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Read own comment for deletion" on public.recipe_comments;
create policy "Read own comment for deletion" on public.recipe_comments for select to authenticated using(user_id=(select auth.uid()));
grant select,delete on public.recipe_comments to authenticated;
revoke all on public.recipe_comments from anon;
create or replace function public.get_recipe_comments(p_id uuid,p_offset integer default 0)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc,c.id),'[]'::jsonb) from
 (select c.id,c.recipe_id,c.user_id,c.body,c.created_at,coalesce(nullif(p.display_name,''),nullif(p.username,''),'Cook') author
 from public.recipe_comments c left join public.profiles p on p.id=c.user_id
 where c.recipe_id=p_id and public.can_view_recipe(p_id) and exists(select 1 from public.recipes r where r.id=p_id and r.visibility='public')
 order by c.created_at desc,c.id limit 30 offset greatest(0,least(coalesce(p_offset,0),10000))) c
$$;
create or replace function public.post_recipe_comment(p_id uuid,p_body text,p_comment_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.can_view_recipe(p_id) or not exists(select 1 from public.recipes where id=p_id and visibility='public') then raise exception 'Recipe not found or access denied'; end if;
 if p_body is null or length(trim(p_body)) not between 1 and 2000 then raise exception 'Enter a comment under 2,000 characters'; end if;
 result=coalesce(p_comment_id,gen_random_uuid());
 insert into public.recipe_comments(id,recipe_id,user_id,body) values(result,p_id,auth.uid(),trim(p_body)) on conflict(id) do nothing;
 if not exists(select 1 from public.recipe_comments where id=result and user_id=auth.uid() and recipe_id=p_id and body=trim(p_body)) then raise exception 'Comment retry does not match'; end if;
 return result;
end $$;
revoke all on function public.get_recipe_comments(uuid,integer),public.post_recipe_comment(uuid,text,uuid) from public,anon;
grant execute on function public.get_recipe_comments(uuid,integer),public.post_recipe_comment(uuid,text,uuid) to authenticated;
commit;
