-- Explicit, private cooking history. Legacy automatic last_cooked_at values are
-- deliberately not imported: finishing the stepper did not mean "I made it".
begin;
create table if not exists public.recipe_made (
 recipe_id uuid not null references public.recipes(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 made_at timestamptz not null default now(),
 primary key(recipe_id,user_id)
);
alter table public.recipe_made enable row level security;
revoke all on public.recipe_made from public,anon,authenticated;
grant select,insert,delete on public.recipe_made to authenticated;
drop policy if exists "Read own made recipes" on public.recipe_made;
create policy "Read own made recipes" on public.recipe_made for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Mark accessible recipes made" on public.recipe_made;
create policy "Mark accessible recipes made" on public.recipe_made for insert to authenticated with check(user_id=(select auth.uid()) and public.can_view_recipe(recipe_id));
drop policy if exists "Unmark own made recipes" on public.recipe_made;
create policy "Unmark own made recipes" on public.recipe_made for delete to authenticated using(user_id=(select auth.uid()));

create or replace function public.get_recipe_made(p_ids uuid[])
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',recipe_id,'made_at',made_at)),'[]'::jsonb)
 from public.recipe_made where recipe_id=any(p_ids) and user_id=auth.uid() and public.can_view_recipe(recipe_id)
$$;
create or replace function public.save_recipe_checkin(p_id uuid,p_made boolean,
 p_set_rating boolean default false,p_rating numeric default null,p_note text default null,
 p_note_id uuid default null,p_contribute boolean default null,p_comment text default null,p_comment_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare summary jsonb; stamp timestamptz;
begin
 if auth.uid() is null or not public.can_view_recipe(p_id) then raise exception 'Recipe not found or access denied'; end if;
 if p_made is null then raise exception 'Choose whether you made this recipe'; end if;
 -- One transaction: a failed comment or note cannot leave a partial check-in.
 summary=public.save_recipe_rating_feedback(p_id,p_set_rating,p_rating,p_note,p_note_id,p_contribute);
 if length(trim(coalesce(p_comment,'')))>0 then
  perform public.post_recipe_comment(p_id,p_comment,p_comment_id);
 end if;
 if p_made then
  insert into public.recipe_made(recipe_id,user_id) values(p_id,auth.uid()) on conflict do nothing;
  select made_at into stamp from public.recipe_made where recipe_id=p_id and user_id=auth.uid();
 else
  delete from public.recipe_made where recipe_id=p_id and user_id=auth.uid();
 end if;
 return summary || jsonb_build_object('made_at',stamp);
end $$;

create or replace function public.get_made_recipes()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('recipe_id',m.recipe_id,'made_at',m.made_at,
  'recipe',public.recipe_public_document(m.recipe_id),'personal_rating',v.rating,
  'personal_note',(select n.body from public.recipe_notes n where n.recipe_id=m.recipe_id and n.user_id=auth.uid() order by n.created_at desc nulls last,n.id limit 1),
  'comment',(select c.body from public.recipe_comments c where c.recipe_id=m.recipe_id and c.user_id=auth.uid() order by c.created_at desc,c.id limit 1)) order by m.made_at desc,m.recipe_id),'[]'::jsonb)
 from public.recipe_made m left join public.recipe_personal_ratings v on v.recipe_id=m.recipe_id and v.user_id=auth.uid()
 where m.user_id=auth.uid() and public.can_view_recipe(m.recipe_id)
$$;
revoke all on function public.get_recipe_made(uuid[]),public.save_recipe_checkin(uuid,boolean,boolean,numeric,text,uuid,boolean,text,uuid),public.get_made_recipes() from public,anon;
grant execute on function public.get_recipe_made(uuid[]),public.save_recipe_checkin(uuid,boolean,boolean,numeric,text,uuid,boolean,text,uuid),public.get_made_recipes() to authenticated;
commit;
