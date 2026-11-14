-- Apply after 026. Curated US culinary estimates checked 2026-11-14.
-- King Arthur ingredient chart: https://www.kingarthurbaking.com/learn/ingredient-weight-chart
-- Ambiguous names/preparations have NULL density. No personal rows are modified.
begin;
create temporary table measurement_seed(name text, grams numeric, amount numeric, unit text, category text, aliases jsonb) on commit drop;
insert into measurement_seed values
 ('All-purpose flour', 120, 1, 'cup', 'Essentials', '["all purpose flour", "plain flour"]'::jsonb),
 ('Bread flour', 120, 1, 'cup', 'Essentials', '[]'::jsonb),
 ('Whole wheat flour', 113, 1, 'cup', 'Essentials', '[]'::jsonb),
 ('Granulated sugar', 198, 1, 'cup', 'Sweetener', '["white sugar", "regular sugar"]'::jsonb),
 ('Brown sugar (packed)', 213, 1, 'cup', 'Sweetener', '[]'::jsonb),
 ('Powdered sugar (unsifted)', 113, 1, 'cup', 'Sweetener', '[]'::jsonb),
 ('Butter', 113, 0.5, 'cup', 'Dairy', '[]'::jsonb),
 ('Honey', 21, 1, 'tbsp', 'Sweetener', '[]'::jsonb),
 ('Maple syrup', 156, 0.5, 'cup', 'Sweetener', '[]'::jsonb),
 ('Vegetable oil', 198, 1, 'cup', 'Essentials', '[]'::jsonb),
 ('Olive oil', 50, 0.25, 'cup', 'Essentials', '[]'::jsonb),
 ('Cocoa powder (unsweetened)', 42, 0.5, 'cup', 'Essentials', '[]'::jsonb),
 ('Rolled oats (old-fashioned)', 89, 1, 'cup', 'Carbohydrates', '[]'::jsonb),
 ('Rice (long grain, dry)', 99, 0.5, 'cup', 'Carbohydrates', '[]'::jsonb),
 ('Table salt', 18, 1, 'tbsp', 'Spices', '[]'::jsonb),
 ('Baking powder', 4, 1, 'tsp', 'Essentials', '[]'::jsonb),
 ('Baking soda', 3, 0.5, 'tsp', 'Essentials', '[]'::jsonb),
 ('Almond flour', 96, 1, 'cup', 'Essentials', '[]'::jsonb),
 ('Cornstarch', 28, 0.25, 'cup', 'Essentials', '[]'::jsonb),
 ('Coconut flour', 128, 1, 'cup', 'Essentials', '[]'::jsonb),
 ('Coconut sugar', 77, 0.5, 'cup', 'Sweetener', '[]'::jsonb),
 ('Corn syrup', 312, 1, 'cup', 'Sweetener', '[]'::jsonb),
 ('Molasses', 85, 0.25, 'cup', 'Sweetener', '[]'::jsonb),
 ('Peanut butter', 135, 0.5, 'cup', 'Sauces & Condiments', '[]'::jsonb),
 ('Tahini', 128, 0.5, 'cup', 'Sauces & Condiments', '[]'::jsonb),
 ('Tomato paste', 29, 2, 'tbsp', 'Sauces & Condiments', '[]'::jsonb),
 ('Vanilla extract', 14, 1, 'tbsp', 'Essentials', '[]'::jsonb),
 ('Sesame seeds', 71, 0.5, 'cup', 'Essentials', '[]'::jsonb),
 ('Milk', null, null, null, 'Dairy', '[]'::jsonb),
 ('Heavy cream', null, null, null, 'Dairy', '[]'::jsonb),
 ('Water', null, null, null, 'Essentials', '[]'::jsonb),
 ('Salt', null, null, null, 'Spices', '[]'::jsonb),
 ('Rice', null, null, null, 'Carbohydrates', '[]'::jsonb),
 ('Brown sugar', null, null, null, 'Sweetener', '[]'::jsonb),
 ('Powdered sugar', null, null, null, 'Sweetener', '[]'::jsonb);
insert into public.ingredients(canonical_name,category,default_unit,aliases)
select s.name,s.category,case when s.name in ('Milk','Heavy cream','Water') then 'ml' else 'g' end,s.aliases
from measurement_seed s where not exists(select 1 from public.ingredients i where i.created_by is null and i.normalized_name=lower(s.name))
on conflict do nothing;
update public.ingredients i set
 density_g_per_ml=s.grams/(s.amount*case s.unit when 'cup' then 236.5882365 when 'tbsp' then 14.78676478125 when 'tsp' then 4.92892159375 end),
 conversion_metadata=jsonb_build_object('status','verified','source','https://www.kingarthurbaking.com/learn/ingredient-weight-chart','checked_on','2026-11-14','reference_grams',s.grams,'reference_quantity',s.amount,'reference_unit',s.unit,'approximate',true,'scope',s.name),
 aliases=(select coalesce(jsonb_agg(distinct value),'[]'::jsonb) from jsonb_array_elements(i.aliases||s.aliases))
from measurement_seed s where i.created_by is null and i.normalized_name=lower(s.name) and s.grams is not null
and i.density_g_per_ml is null;
commit;
