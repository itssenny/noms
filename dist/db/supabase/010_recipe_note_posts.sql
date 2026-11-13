-- Separate private note posts. Existing free-text notes are preserved as an earlier post.
begin;
create table if not exists public.recipe_notes (
 id uuid primary key default gen_random_uuid(),
 recipe_id uuid not null references public.recipes(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(trim(body))>0),
 created_at timestamptz default now(),
 is_legacy boolean not null default false,
 check(created_at is not null or is_legacy),
 check(is_legacy or length(body)<=5000)
);
create unique index if not exists recipe_notes_legacy_unique on public.recipe_notes(recipe_id) where is_legacy;
create index if not exists recipe_notes_recipe_date on public.recipe_notes(recipe_id,created_at desc);
alter table public.recipe_notes enable row level security;
drop policy if exists "Read own recipe notes" on public.recipe_notes;
create policy "Read own recipe notes" on public.recipe_notes for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.recipes r where r.id=recipe_id and r.user_id=(select auth.uid())));
drop policy if exists "Create own recipe notes" on public.recipe_notes;
create policy "Create own recipe notes" on public.recipe_notes for insert to authenticated with check(user_id=(select auth.uid()) and not is_legacy and created_at is not null and exists(select 1 from public.recipes r where r.id=recipe_id and r.user_id=(select auth.uid())));
drop policy if exists "Delete own recipe notes" on public.recipe_notes;
create policy "Delete own recipe notes" on public.recipe_notes for delete to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.recipes r where r.id=recipe_id and r.user_id=(select auth.uid())));
grant select,insert,delete on public.recipe_notes to authenticated;
revoke all on public.recipe_notes from anon;
-- No original timestamp was recorded for this text, so do not invent one.
insert into public.recipe_notes(recipe_id,user_id,body,created_at,is_legacy)
select id,user_id,notes,null,true from public.recipes where length(trim(coalesce(notes,'')))>0
on conflict do nothing;
update public.recipes r set notes=null where exists(select 1 from public.recipe_notes n where n.recipe_id=r.id and n.is_legacy);
create or replace function public.save_recipe_feedback(p_id uuid,p_set_rating boolean,p_rating numeric,p_note text,p_note_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb;
begin
 perform 1 from public.recipes where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Recipe not found or access denied'; end if;
 if p_set_rating then
  if p_rating is not null and (p_rating<1 or p_rating>5) then raise exception 'Choose a rating between 1 and 5'; end if;
  update public.recipes set rating=p_rating where id=p_id and user_id=auth.uid();
 end if;
 if length(trim(coalesce(p_note,'')))>0 then
  if length(trim(p_note))>5000 then raise exception 'Keep new notes under 5,000 characters'; end if;
  insert into public.recipe_notes(id,recipe_id,user_id,body) values(coalesce(p_note_id,gen_random_uuid()),p_id,auth.uid(),trim(p_note)) on conflict(id) do nothing;
 end if;
 select jsonb_build_object('rating',r.rating,'posts',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'body',n.body,'created_at',n.created_at,'is_legacy',n.is_legacy) order by n.created_at desc nulls last,n.id) from public.recipe_notes n where n.recipe_id=p_id),'[]'::jsonb)) into result from public.recipes r where r.id=p_id and r.user_id=auth.uid();
 return result;
end $$;
revoke all on function public.save_recipe_feedback(uuid,boolean,numeric,text,uuid) from public,anon;
grant execute on function public.save_recipe_feedback(uuid,boolean,numeric,text,uuid) to authenticated;
commit;
