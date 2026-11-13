-- Run after 007. Explicit one-way, equal-amount substitutions; products stay separate.
begin;
create table if not exists public.ingredient_substitutions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete cascade,
 ingredient_id uuid not null references public.ingredients(id) on delete cascade,
 substitute_id uuid not null references public.ingredients(id) on delete cascade,
 check (ingredient_id <> substitute_id)
);
create unique index if not exists substitutions_shared_unique on public.ingredient_substitutions(ingredient_id,substitute_id) where user_id is null;
create unique index if not exists substitutions_owner_unique on public.ingredient_substitutions(user_id,ingredient_id,substitute_id) where user_id is not null;
alter table public.ingredient_substitutions enable row level security;
drop policy if exists "Read visible substitutions" on public.ingredient_substitutions;
create policy "Read visible substitutions" on public.ingredient_substitutions for select to authenticated using (
 (user_id is null or user_id=(select auth.uid()))
 and exists(select 1 from public.ingredients where id=ingredient_id)
 and exists(select 1 from public.ingredients where id=substitute_id));
drop policy if exists "Create own substitutions" on public.ingredient_substitutions;
create policy "Create own substitutions" on public.ingredient_substitutions for insert to authenticated with check (
 user_id=(select auth.uid())
 and exists(select 1 from public.ingredients where id=ingredient_id)
 and exists(select 1 from public.ingredients where id=substitute_id));
drop policy if exists "Delete own substitutions" on public.ingredient_substitutions;
create policy "Delete own substitutions" on public.ingredient_substitutions for delete to authenticated using (user_id=(select auth.uid()));
grant select,insert,delete on public.ingredient_substitutions to authenticated;
revoke all on public.ingredient_substitutions from anon;
-- Starter example: cherry tomatoes can replace general fresh tomatoes, one way only.
insert into public.ingredients(canonical_name,category,default_unit)
values ('Cherry tomatoes','Vegetables','g') on conflict do nothing;
insert into public.ingredient_substitutions(ingredient_id,substitute_id)
select original.id,alternative.id from public.ingredients original cross join public.ingredients alternative
where original.created_by is null and alternative.created_by is null
 and original.normalized_name in ('tomato','tomatoes')
 and alternative.normalized_name='cherry tomatoes'
on conflict do nothing;
commit;
