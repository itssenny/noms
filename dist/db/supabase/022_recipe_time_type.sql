-- Apply after 021. Existing minute values and privacy remain unchanged.
begin;
alter table public.recipes add column if not exists cook_time_type text not null default 'cooking'
 check (cook_time_type in ('cooking','baking'));
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
    visibility = coalesce(p_recipe->>'visibility', visibility),
    cook_time_type = coalesce(p_recipe->>'cook_time_type', cook_time_type),
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


create or replace function public.recipe_public_document(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'id',r.id,'user_id',r.user_id,'name',r.name,'image_url',r.image_url,
 'visibility',r.visibility,'share_code',r.share_code,'catalog_key',r.catalog_key,'cuisine',r.cuisine,'tags',r.tags,
 'total_minutes',r.total_minutes,'prep_minutes',r.prep_minutes,'cook_minutes',r.cook_minutes,'cook_time_type',r.cook_time_type,
 'difficulty',r.difficulty,'servings',r.servings,'instructions',r.instructions,
 'source',r.source,'source_url',r.source_url,'emoji',r.emoji,'background_color',r.background_color,
 'creator',case when r.catalog_key is not null then jsonb_build_object('display_name','noms kitchen','username','noms') else jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name) end,
 'recipe_ingredients',coalesce((select jsonb_agg(jsonb_build_object(
 'quantity',ri.quantity,'unit',ri.unit,'preparation_note',ri.preparation_note,'sort_order',ri.sort_order,
 'ingredient',jsonb_build_object('id',i.id,'canonical_name',i.canonical_name,'category',i.category)) order by ri.sort_order)
 from public.recipe_ingredients ri join public.ingredients i on i.id=ri.ingredient_id where ri.recipe_id=r.id),'[]'::jsonb))
 from public.recipes r left join public.profiles p on p.id=r.user_id where r.id=p_id and public.can_view_recipe(r.id)
$$;
revoke all on function public.recipe_public_document(uuid) from public,anon,authenticated;



commit;
