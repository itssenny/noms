-- Apply after 031. Existing feedback stays private; no historic consent is inferred.
begin;
alter table public.recipe_personal_ratings add column if not exists contribute_to_community boolean not null default false;
create index if not exists recipe_public_ratings_idx on public.recipe_personal_ratings(recipe_id) include(rating) where contribute_to_community and rating is not null;
-- Mark the backfill so rerunning this migration cannot restore a deleted rating.
alter table public.recipes add column if not exists personal_rating_migrated boolean not null default false;
insert into public.recipe_personal_ratings(recipe_id,user_id,rating)
select r.id, coalesce(u.id, owners.user_id), r.rating
from public.recipes r left join auth.users u on u.id=r.user_id
left join lateral (select (array_agg(m.user_id))[1] user_id from public.profile_memberships m
 where m.profile_id=r.user_id and m.role='owner' having count(*)=1) owners on true
where not r.personal_rating_migrated and r.rating between 1 and 5 and coalesce(u.id,owners.user_id) is not null
on conflict(recipe_id,user_id) do nothing;
-- Archive the legacy field before clearing it: profile editors must not read another
-- user's personal rating via a recipe row. Ambiguous managed-profile feedback is
-- retained for operator recovery rather than attributed to an arbitrary member.
create table if not exists public.recipe_legacy_ratings (
 recipe_id uuid primary key references public.recipes(id) on delete cascade,
 profile_id uuid, rating numeric not null
);
alter table public.recipe_legacy_ratings enable row level security;
revoke all on public.recipe_legacy_ratings from public,anon,authenticated;
insert into public.recipe_legacy_ratings(recipe_id,profile_id,rating)
 select id,user_id,rating from public.recipes where not personal_rating_migrated and rating is not null
 on conflict(recipe_id) do nothing;
update public.recipes set rating=null where not personal_rating_migrated;
update public.recipes set personal_rating_migrated=true where not personal_rating_migrated;
alter table public.recipes alter column personal_rating_migrated set default true;

create or replace function public.guard_recipe_rating()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.recipe_id is distinct from old.recipe_id or new.user_id is distinct from old.user_id) then
  raise exception 'Rating ownership cannot change';
 end if;
 if new.rating is not null and (new.rating<1 or new.rating>5 or (new.rating<>trunc(new.rating) and (tg_op='INSERT' or new.rating is distinct from old.rating))) then
  raise exception 'Choose a whole-star rating between 1 and 5';
 end if;
 if new.contribute_to_community then
  if new.rating is null then raise exception 'Choose a rating before contributing'; end if;
  perform 1 from public.recipes where id=new.recipe_id and visibility='public' for share;
  if not found then raise exception 'Private recipes cannot receive community ratings'; end if;
 end if;
 return new;
end $$;
drop trigger if exists guard_recipe_rating on public.recipe_personal_ratings;
create trigger guard_recipe_rating before insert or update on public.recipe_personal_ratings for each row execute function public.guard_recipe_rating();
revoke all on function public.guard_recipe_rating() from public,anon,authenticated;

-- Only the current user's personal values and aggregate public values leave this RPC.
create or replace function public.get_recipe_ratings(p_ids uuid[])
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'personal_rating',mine.rating,
  'contribute_to_community',coalesce(mine.contribute_to_community,false),
  'community_average',stats.average,'community_count',coalesce(stats.count,0))),'[]'::jsonb)
 from public.recipes r
 left join public.recipe_personal_ratings mine on mine.recipe_id=r.id and mine.user_id=auth.uid()
 left join lateral (select avg(v.rating) average,count(v.rating) count from public.recipe_personal_ratings v
  where v.recipe_id=r.id and v.contribute_to_community and r.visibility='public') stats on true
 where r.id=any(p_ids) and public.can_view_recipe(r.id)
$$;
revoke all on function public.get_recipe_ratings(uuid[]) from public,anon;
grant execute on function public.get_recipe_ratings(uuid[]) to authenticated;

create or replace function public.save_recipe_rating_feedback(p_id uuid,p_set_rating boolean,p_rating numeric,p_note text,p_note_id uuid,p_contribute boolean default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare summary jsonb;
begin
 if not public.can_view_recipe(p_id) then raise exception 'Recipe not found or access denied'; end if;
 if p_set_rating then
  if p_rating is null then
   delete from public.recipe_personal_ratings where recipe_id=p_id and user_id=auth.uid();
  else
   insert into public.recipe_personal_ratings(recipe_id,user_id,rating,contribute_to_community)
   values(p_id,auth.uid(),p_rating,coalesce(p_contribute,false))
   on conflict(recipe_id,user_id) do update set rating=excluded.rating,
    contribute_to_community=coalesce(p_contribute,recipe_personal_ratings.contribute_to_community);
  end if;
 elsif p_contribute is not null then
  update public.recipe_personal_ratings set contribute_to_community=p_contribute where recipe_id=p_id and user_id=auth.uid();
 end if;
 if length(trim(coalesce(p_note,'')))>0 then
  if length(trim(p_note))>5000 then raise exception 'Keep new notes under 5,000 characters'; end if;
  insert into public.recipe_notes(id,recipe_id,user_id,body) values(coalesce(p_note_id,gen_random_uuid()),p_id,auth.uid(),trim(p_note)) on conflict(id) do nothing;
 end if;
 summary=public.get_recipe_ratings(array[p_id])->0;
 return summary || jsonb_build_object('rating',summary->'personal_rating','posts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'body',body,'created_at',created_at,'is_legacy',is_legacy) order by created_at desc nulls last,id)
 from public.recipe_notes where recipe_id=p_id and user_id=auth.uid()),'[]'::jsonb));
end $$;
revoke all on function public.save_recipe_rating_feedback(uuid,boolean,numeric,text,uuid,boolean) from public,anon;
grant execute on function public.save_recipe_rating_feedback(uuid,boolean,numeric,text,uuid,boolean) to authenticated;
-- Keep old clients working, without resetting an existing sharing preference.
create or replace function public.save_recipe_feedback(p_id uuid,p_set_rating boolean,p_rating numeric,p_note text,p_note_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.recipes where id=p_id and public.can_manage_profile(user_id)) then raise exception 'Recipe not found or access denied'; end if;
 return public.save_recipe_rating_feedback(p_id,p_set_rating,p_rating,p_note,p_note_id,null);
end $$;
create or replace function public.save_public_recipe_feedback(p_id uuid,p_set_rating boolean,p_rating numeric,p_note text,p_note_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select public.save_recipe_rating_feedback(p_id,p_set_rating,p_rating,p_note,p_note_id,null)
$$;
-- Withdrawal of publication also withdraws consent; republishing requires a fresh opt-in.
create or replace function public.withdraw_recipe_ratings()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.visibility='private' and old.visibility is distinct from new.visibility then
  update public.recipe_personal_ratings set contribute_to_community=false where recipe_id=new.id and contribute_to_community;
 end if;
 return new;
end $$;
revoke all on function public.withdraw_recipe_ratings() from public,anon,authenticated;
drop trigger if exists withdraw_recipe_ratings on public.recipes;
create trigger withdraw_recipe_ratings after update of visibility on public.recipes for each row execute function public.withdraw_recipe_ratings();
create or replace function public.prevent_legacy_recipe_rating()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.rating is not null and new.rating<>0 then raise exception 'Save personal ratings through the rating form'; end if;
 new.rating=null;
 return new;
end $$;
revoke all on function public.prevent_legacy_recipe_rating() from public,anon,authenticated;
drop trigger if exists prevent_legacy_recipe_rating on public.recipes;
create trigger prevent_legacy_recipe_rating before insert or update of rating on public.recipes for each row execute function public.prevent_legacy_recipe_rating();
commit;
