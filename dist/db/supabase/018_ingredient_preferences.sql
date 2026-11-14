-- Personal catalogue defaults, independent of inventory quantities.
begin;
create table if not exists public.ingredient_preferences (
 user_id uuid not null references auth.users(id) on delete cascade,
 ingredient_id uuid not null references public.ingredients(id) on delete cascade,
 default_unit text not null check(length(trim(default_unit)) between 1 and 50),
 storage_location text not null check(storage_location in ('Fridge','Freezer','Pantry')),
 low_stock_threshold numeric not null default 0 check(low_stock_threshold >= 0),
 primary key(user_id,ingredient_id)
);
alter table public.ingredient_preferences enable row level security;
revoke all on public.ingredient_preferences from anon,authenticated;
grant select,insert,update,delete on public.ingredient_preferences to authenticated;
drop policy if exists "Read own ingredient defaults" on public.ingredient_preferences;
create policy "Read own ingredient defaults" on public.ingredient_preferences for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Create own ingredient defaults" on public.ingredient_preferences;
create policy "Create own ingredient defaults" on public.ingredient_preferences for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.ingredients i where i.id=ingredient_id));
drop policy if exists "Update own ingredient defaults" on public.ingredient_preferences;
create policy "Update own ingredient defaults" on public.ingredient_preferences for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.ingredients i where i.id=ingredient_id));
drop policy if exists "Delete own ingredient defaults" on public.ingredient_preferences;
create policy "Delete own ingredient defaults" on public.ingredient_preferences for delete to authenticated using(user_id=(select auth.uid()));
-- Preserve earlier stock settings without creating any inventory records.
insert into public.ingredient_preferences(user_id,ingredient_id,default_unit,storage_location,low_stock_threshold)
select user_id,ingredient_id,unit,case when storage_location in ('Fridge','Freezer','Pantry') then storage_location else 'Pantry' end,low_stock_threshold from public.inventory
on conflict(user_id,ingredient_id) do nothing;
commit;
