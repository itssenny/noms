-- Apply after 003. Transactional: conflicting legacy names abort without data loss.
begin;

alter table public.ingredients add column default_unit text not null default 'piece'
  check (length(trim(default_unit)) > 0);
alter table public.ingredients add column normalized_name text generated always as
  (lower(regexp_replace(trim(canonical_name), '[[:space:]]+', ' ', 'g'))) stored;

-- Do not merge IDs automatically: inventory units/locations or recipe rows may conflict.
-- If this index reports duplicates, review the query in db/CANONICAL_INGREDIENTS.md.
create unique index ingredients_normalized_name_unique on public.ingredients(normalized_name);

-- Existing case-insensitive unique index remains valid and is intentionally retained.
-- Catalogue administration is privileged; ordinary clients may only select records.
drop policy "Authenticated users can add ingredients" on public.ingredients;
revoke insert, update, delete on public.ingredients from anon, authenticated;

commit;
