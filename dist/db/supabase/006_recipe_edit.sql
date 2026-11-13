-- Apply after 001–005, before deploying the recipe editor.
-- Invoker privileges preserve existing owner RLS. One RPC is one transaction.
create or replace function public.update_recipe(p_id uuid, p_recipe jsonb, p_ingredients jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Please sign in again'; end if;
  perform 1 from public.recipes where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'Recipe not found or access denied'; end if;
  if jsonb_typeof(p_ingredients) is distinct from 'array' then
    raise exception 'Ingredients must be an array';
  end if;
  if jsonb_array_length(p_ingredients) = 0 then raise exception 'Add at least one ingredient'; end if;
  if jsonb_typeof(p_recipe->'instructions') is distinct from 'array' then
    raise exception 'Instructions must be an array';
  end if;
  if jsonb_array_length(p_recipe->'instructions') = 0 then raise exception 'Add at least one instruction'; end if;
  update public.recipes set
    name = p_recipe->>'name', cuisine = p_recipe->>'cuisine',
    tags = p_recipe->'tags', total_minutes = (p_recipe->>'total_minutes')::integer,
    prep_minutes = (p_recipe->>'prep_minutes')::integer,
    cook_minutes = (p_recipe->>'cook_minutes')::integer,
    difficulty = p_recipe->>'difficulty', servings = (p_recipe->>'servings')::numeric,
    instructions = p_recipe->'instructions', image_url = p_recipe->>'image_url',
    source = p_recipe->>'source', source_url = p_recipe->>'source_url'
  where id = p_id and user_id = auth.uid();
  delete from public.recipe_ingredients where recipe_id = p_id;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, quantity, unit, preparation_note, sort_order)
  select p_id, (item->>'ingredient_id')::uuid, (item->>'quantity')::numeric,
         item->>'unit', item->>'preparation_note', (ordinality - 1)::integer
  from jsonb_array_elements(p_ingredients) with ordinality as items(item, ordinality);
  return p_id;
end;
$$;
revoke all on function public.update_recipe(uuid, jsonb, jsonb) from public;
grant execute on function public.update_recipe(uuid, jsonb, jsonb) to authenticated;
