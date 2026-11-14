-- Three original noms kitchen recipes. Operator-run after 020; no fake Auth user.
-- Shared ingredient names reuse existing IDs. Reruns do not edit existing recipes.
begin;
do $seed$
declare recipe jsonb; item jsonb; new_recipe_id uuid; linked_ingredient_id uuid; item_position integer;
begin
 for recipe in select value from jsonb_array_elements($catalog$[{"key": "miso-chickpea-bowls-v1", "name": "Miso chickpea crunch bowls", "tags": ["Fusion", "Vegetarian", "Dinner"], "time": 25, "servings": 2, "ingredients": [["Chickpeas", 240, "g", "drained", "Canned Goods"], ["Rice", 140, "g", "dry", "Carbohydrates"], ["Cucumber", 150, "g", "diced", "Vegetables"], ["Miso paste", 20, "g", "", "Sauces & Condiments"], ["Soy sauce", 15, "ml", "", "Sauces & Condiments"], ["Olive oil", 15, "ml", "", "Sauces & Condiments"], ["Lime", 1, "piece", "juiced", "Fruits"]], "steps": ["Cook the rice according to its packet, using water as directed.", "Pat the chickpeas dry. Heat the oil in a frying pan and fry for 8–10 minutes, stirring, until golden.", "Loosen the miso with the soy sauce, lime juice and a little water. Stir half through the chickpeas and warm briefly.", "Serve the chickpeas over rice with cucumber and the remaining dressing."]}, {"key": "gochujang-pasta-v1", "name": "Creamy gochujang pasta", "tags": ["Korean inspired", "Vegetarian", "Quick"], "time": 20, "servings": 2, "ingredients": [["Pasta", 180, "g", "", "Carbohydrates"], ["Gochujang", 20, "g", "check vegetarian label", "Sauces & Condiments"], ["Cream", 100, "ml", "", "Dairy"], ["Garlic", 2, "clove", "minced", "Vegetables"], ["Butter", 15, "g", "", "Dairy"], ["Soy sauce", 10, "ml", "", "Sauces & Condiments"]], "steps": ["Cook the pasta according to its packet. Reserve a mug of cooking water before draining.", "Melt the butter over medium-low heat. Add garlic and stir for a minute.", "Stir in the gochujang, then add cream, soy sauce and a splash of pasta water. Simmer gently for 2 minutes.", "Toss in the pasta. Add cooking water a little at a time until the sauce coats it, then serve."]}, {"key": "green-goddess-chickpeas-v1", "name": "Green goddess chickpea toast", "tags": ["Vegetarian", "Lunch", "Quick"], "time": 15, "servings": 2, "ingredients": [["Chickpeas", 240, "g", "drained", "Canned Goods"], ["Greek yogurt", 100, "g", "", "Dairy"], ["Lemon", 1, "piece", "juiced", "Fruits"], ["Parsley", 15, "g", "finely chopped", "Herbs"], ["Cucumber", 100, "g", "finely diced", "Vegetables"], ["Bread", 4, "piece", "slices", "Carbohydrates"], ["Olive oil", 10, "ml", "", "Sauces & Condiments"], ["Salt", null, "to taste", "", "Spices"]], "steps": ["Mash half of the chickpeas with a fork and leave the rest whole.", "Mix yogurt, parsley, olive oil and lemon juice to taste. Fold through chickpeas and cucumber. Season with salt.", "Toast the bread until crisp and spoon over the chickpea mixture. Serve straight away."]}]$catalog$::jsonb) loop
  insert into public.recipes(catalog_key,user_id,visibility,name,tags,total_minutes,difficulty,servings,instructions,source)
  values(recipe->>'key',null,'public',recipe->>'name',recipe->'tags',(recipe->>'time')::integer,'Easy',(recipe->>'servings')::numeric,recipe->'steps','noms kitchen · original starter recipe')
  on conflict(catalog_key) do nothing returning id into new_recipe_id;
  if new_recipe_id is null then continue; end if;
  item_position := 0;
  for item in select value from jsonb_array_elements(recipe->'ingredients') loop
   insert into public.ingredients(canonical_name,category,default_unit,created_by)
   values(item->>0,item->>4,item->>2,null) on conflict do nothing;
   select id into strict linked_ingredient_id from public.ingredients where created_by is null
    and normalized_name=lower(regexp_replace(trim(item->>0),'[[:space:]]+',' ','g'));
   insert into public.recipe_ingredients(recipe_id,ingredient_id,quantity,unit,preparation_note,sort_order)
   values(new_recipe_id,linked_ingredient_id,(item->>1)::numeric,item->>2,item->>3,item_position);
   item_position := item_position+1;
  end loop;
 end loop;
end $seed$;
commit;
