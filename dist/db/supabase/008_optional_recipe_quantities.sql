-- Run after the existing migrations, before saving recipes with optional amounts.
-- Existing quantities and ownership policies stay unchanged.
begin;
alter table public.recipe_ingredients alter column quantity drop not null;
-- The existing quantity > 0 constraint still rejects zero/negative numbers;
-- NULL now represents an amount chosen by the cook. The unit can be 'to taste'
-- or 'as needed', or retain the ingredient's default measurement suggestion.
-- The update_recipe function from 006 already passes JSON null through correctly.
commit;
