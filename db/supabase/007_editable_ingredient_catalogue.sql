-- Apply once before deploying catalogue management. Includes the 004 foundation
-- if it was missed. Existing ingredients stay shared; no recipe/inventory is deleted.
-- After this, 005 can be run to populate the optional shared starter catalogue.
begin;
alter table public.ingredients add column if not exists default_unit text not null default 'piece'
  check (length(trim(default_unit)) > 0);
alter table public.ingredients add column if not exists normalized_name text generated always as
  (lower(regexp_replace(trim(canonical_name), '[[:space:]]+', ' ', 'g'))) stored;
alter table public.ingredients add column if not exists created_by uuid references auth.users(id) on delete cascade;
drop index if exists public.ingredients_normalized_name_unique;
drop index if exists public.ingredients_canonical_name_unique;
create unique index if not exists ingredients_shared_name_unique on public.ingredients(normalized_name) where created_by is null;
create unique index if not exists ingredients_owner_name_unique on public.ingredients(created_by, normalized_name) where created_by is not null;
drop policy if exists "Authenticated users can read ingredients" on public.ingredients;
drop policy if exists "Authenticated users can add ingredients" on public.ingredients;
drop policy if exists "Read shared and own ingredients" on public.ingredients;
drop policy if exists "Create own ingredients" on public.ingredients;
drop policy if exists "Edit own ingredients" on public.ingredients;
create policy "Read shared and own ingredients" on public.ingredients for select to authenticated
  using (created_by is null or created_by = (select auth.uid()));
create policy "Create own ingredients" on public.ingredients for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "Edit own ingredients" on public.ingredients for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
grant select, insert, update on public.ingredients to authenticated;
revoke delete on public.ingredients from authenticated;
revoke insert, update, delete on public.ingredients from anon;
-- Enforce catalogue visibility when storing foreign keys as well as searching.
drop policy if exists "Inventory uses visible ingredients" on public.inventory;
create policy "Inventory uses visible ingredients" on public.inventory as restrictive for all to authenticated
 using (exists (select 1 from public.ingredients i where i.id = ingredient_id))
 with check (exists (select 1 from public.ingredients i where i.id = ingredient_id));
drop policy if exists "Recipes use visible ingredients" on public.recipe_ingredients;
create policy "Recipes use visible ingredients" on public.recipe_ingredients as restrictive for all to authenticated
 using (exists (select 1 from public.ingredients i where i.id = ingredient_id))
 with check (exists (select 1 from public.ingredients i where i.id = ingredient_id));
commit;
