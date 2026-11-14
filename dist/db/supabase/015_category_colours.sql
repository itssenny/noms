-- noms: personal category colours, shared by all ingredient views.
begin;
create table if not exists public.category_colour_preferences (
 user_id uuid not null references auth.users(id) on delete cascade,
 category text not null check(length(trim(category)) between 1 and 100),
 colour text not null check(colour ~ '^#[0-9a-fA-F]{6}$'),
 primary key(user_id,category)
);
alter table public.category_colour_preferences enable row level security;
revoke all on public.category_colour_preferences from anon,authenticated;
grant select,insert,update,delete on public.category_colour_preferences to authenticated;
drop policy if exists "Read own category colours" on public.category_colour_preferences;
create policy "Read own category colours" on public.category_colour_preferences for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Create own category colours" on public.category_colour_preferences;
create policy "Create own category colours" on public.category_colour_preferences for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists "Update own category colours" on public.category_colour_preferences;
create policy "Update own category colours" on public.category_colour_preferences for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists "Delete own category colours" on public.category_colour_preferences;
create policy "Delete own category colours" on public.category_colour_preferences for delete to authenticated using(user_id=(select auth.uid()));
commit;
