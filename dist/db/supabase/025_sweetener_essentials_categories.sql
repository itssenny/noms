-- Apply after 024. Safe to rerun. Reclassify existing shared catalogue rows only.
-- Preserve IDs, quantities, recipe links, personal ingredients and inventory overrides.
begin;
with categories(name, category) as (values
 ('sugar','Sweetener'), ('white sugar','Sweetener'), ('granulated sugar','Sweetener'),
 ('caster sugar','Sweetener'), ('brown sugar','Sweetener'), ('light brown sugar','Sweetener'),
 ('dark brown sugar','Sweetener'), ('powdered sugar','Sweetener'), ('icing sugar','Sweetener'),
 ('coconut sugar','Sweetener'), ('honey','Sweetener'), ('syrup','Sweetener'),
 ('maple syrup','Sweetener'), ('agave syrup','Sweetener'), ('agave nectar','Sweetener'),
 ('golden syrup','Sweetener'), ('corn syrup','Sweetener'), ('molasses','Sweetener'),
 ('oil','Essentials'), ('cooking oil','Essentials'), ('olive oil','Essentials'),
 ('extra virgin olive oil','Essentials'), ('vegetable oil','Essentials'),
 ('sunflower oil','Essentials'), ('canola oil','Essentials'), ('rapeseed oil','Essentials'),
 ('coconut oil','Essentials'), ('sesame oil','Essentials'), ('avocado oil','Essentials'),
 ('flour','Essentials'), ('all-purpose flour','Essentials'), ('all purpose flour','Essentials'),
 ('plain flour','Essentials'), ('bread flour','Essentials'), ('self-raising flour','Essentials'),
 ('self-rising flour','Essentials'), ('whole wheat flour','Essentials'),
 ('baking soda','Essentials'), ('bicarbonate of soda','Essentials'),
 ('baking powder','Essentials'), ('cornstarch','Essentials'), ('corn starch','Essentials'),
 ('potato starch','Essentials'), ('yeast','Essentials'), ('dry yeast','Essentials'),
 ('instant yeast','Essentials'), ('active dry yeast','Essentials')
)
update public.ingredients i set category = c.category
from categories c
where i.created_by is null and i.normalized_name = c.name
  and i.category is distinct from c.category;
commit;
