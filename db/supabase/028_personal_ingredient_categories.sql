-- Personal categories for shared catalogue records; reuse owner-only preferences RLS.
begin;
alter table public.ingredient_preferences add column if not exists category_override text
 check(category_override is null or length(trim(category_override)) between 1 and 100);
commit;
