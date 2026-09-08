-- Optional development starter catalogue, after 004. Safe to rerun.
-- Reuse existing singular/plural records without changing their IDs or labels.
-- Ambiguous pre-existing pairs are preserved for manual review, never merged.
begin;
create temporary table starter_ingredients(name text, category text, unit text, legacy_plural text) on commit drop;
insert into starter_ingredients values
  ('Tomato', 'Vegetables', 'piece', 'Tomatoes'),
  ('Cherry Tomato', 'Vegetables', 'piece', 'Cherry Tomatoes'),
  ('Cucumber', 'Vegetables', 'piece', 'Cucumbers'),
  ('Onion', 'Vegetables', 'piece', 'Onions'),
  ('Garlic', 'Vegetables', 'clove', null),
  ('Carrot', 'Vegetables', 'piece', 'Carrots'),
  ('Bell Pepper', 'Vegetables', 'piece', 'Bell Peppers'),
  ('Broccoli', 'Vegetables', 'g', null),
  ('Spinach', 'Vegetables', 'g', null),
  ('Apple', 'Fruits', 'piece', 'Apples'),
  ('Banana', 'Fruits', 'piece', 'Bananas'),
  ('Lemon', 'Fruits', 'piece', 'Lemons'),
  ('Lime', 'Fruits', 'piece', 'Limes'),
  ('Avocado', 'Fruits', 'piece', 'Avocados'),
  ('Egg', 'Eggs', 'piece', 'Eggs'),
  ('Chicken Breast', 'Meat', 'g', 'Chicken Breasts'),
  ('Beef', 'Meat', 'g', null),
  ('Pork', 'Meat', 'g', null),
  ('Salmon', 'Fish & Seafood', 'g', null),
  ('Tofu', 'Other', 'g', null),
  ('Milk', 'Dairy', 'ml', null),
  ('Butter', 'Dairy', 'g', null),
  ('Mozzarella', 'Dairy', 'g', null),
  ('Parmesan', 'Dairy', 'g', null),
  ('Yogurt', 'Dairy', 'g', null),
  ('Rice', 'Carbohydrates', 'g', null),
  ('Pasta', 'Carbohydrates', 'g', null),
  ('Bread', 'Carbohydrates', 'piece', null),
  ('Flour', 'Carbohydrates', 'g', null),
  ('Potato', 'Vegetables', 'piece', 'Potatoes'),
  ('Olive Oil', 'Sauces & Condiments', 'ml', null),
  ('Soy Sauce', 'Sauces & Condiments', 'ml', null),
  ('Salt', 'Other', 'g', null),
  ('Black Pepper', 'Other', 'g', null),
  ('Sugar', 'Other', 'g', null),
  ('Honey', 'Sauces & Condiments', 'ml', null),
  ('Chickpeas', 'Canned Goods', 'g', null),
  ('Cream', 'Dairy', 'ml', null),
  ('Miso Paste', 'Sauces & Condiments', 'g', null),
  ('Salmon fillet', 'Fish & Seafood', 'g', null);

update public.ingredients i set default_unit = s.unit
from starter_ingredients s
where i.normalized_name in (lower(s.name), lower(s.legacy_plural))
  and i.default_unit = 'piece';

insert into public.ingredients(canonical_name, category, default_unit)
select s.name, s.category, s.unit from starter_ingredients s
where not exists (
  select 1 from public.ingredients i
  where i.normalized_name in (lower(s.name), lower(s.legacy_plural))
)
on conflict do nothing;
commit;
