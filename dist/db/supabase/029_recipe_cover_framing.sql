-- Apply after 028. Preserve originals; store presentation framing only.
begin;
alter table public.recipes add column if not exists image_framing jsonb not null default '{"x":50,"y":50,"zoom":1}'::jsonb
 check(jsonb_typeof(image_framing)='object'
 and image_framing ?& array['x','y','zoom']
 and jsonb_typeof(image_framing->'x')='number' and jsonb_typeof(image_framing->'y')='number' and jsonb_typeof(image_framing->'zoom')='number'
 and (image_framing->>'x')::numeric between 0 and 100
 and (image_framing->>'y')::numeric between 0 and 100
 and (image_framing->>'zoom')::numeric between 1 and 3);
create or replace function public.update_recipe(p_id uuid, p_recipe jsonb, p_ingredients jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in again'; end if;
  perform 1 from public.recipes where id = p_id and public.can_manage_profile(user_id) for update;
  if not found then raise exception 'Recipe not found or access denied'; end if;
  if jsonb_typeof(p_ingredients) is distinct from 'array' or jsonb_array_length(p_ingredients) = 0 then
    raise exception 'Add at least one ingredient';
  end if;
  if jsonb_typeof(p_recipe->'instructions') is distinct from 'array' or jsonb_array_length(p_recipe->'instructions') = 0 then
    raise exception 'Add at least one instruction';
  end if;
  update public.recipes set
    visibility = coalesce(p_recipe->>'visibility', visibility), cook_time_type = coalesce(p_recipe->>'cook_time_type', cook_time_type),
    name = p_recipe->>'name', cuisine = p_recipe->>'cuisine', tags = p_recipe->'tags',
    total_minutes = (p_recipe->>'total_minutes')::integer, prep_minutes = (p_recipe->>'prep_minutes')::integer,
    cook_minutes = (p_recipe->>'cook_minutes')::integer, difficulty = p_recipe->>'difficulty',
    servings = (p_recipe->>'servings')::numeric, instructions = p_recipe->'instructions',
    image_url = p_recipe->>'image_url', image_framing = coalesce(p_recipe->'image_framing', image_framing), source = p_recipe->>'source', source_url = p_recipe->>'source_url'
  where id = p_id;
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
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'user_id', r.user_id, 'profile_id', r.user_id, 'name', r.name, 'image_url', r.image_url, 'image_framing', r.image_framing,
    'visibility', r.visibility, 'share_code', r.share_code, 'catalog_key', r.catalog_key,
    'cuisine', r.cuisine, 'tags', r.tags, 'total_minutes', r.total_minutes,
    'prep_minutes', r.prep_minutes, 'cook_minutes', r.cook_minutes, 'cook_time_type', r.cook_time_type,
    'difficulty', r.difficulty, 'servings', r.servings, 'instructions', r.instructions,
    'source', r.source, 'source_url', r.source_url, 'emoji', r.emoji, 'background_color', r.background_color,
    'creator', jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name,
      'avatar_url', p.avatar_url, 'profile_type', p.profile_type, 'is_verified', p.is_verified),
    'recipe_ingredients', coalesce((
      select jsonb_agg(jsonb_build_object('quantity', ri.quantity, 'unit', ri.unit,
        'preparation_note', ri.preparation_note, 'sort_order', ri.sort_order,
        'ingredient', jsonb_build_object('id', i.id, 'canonical_name', i.canonical_name, 'category', i.category))
        order by ri.sort_order)
      from public.recipe_ingredients ri join public.ingredients i on i.id = ri.ingredient_id
      where ri.recipe_id = r.id
    ), '[]'::jsonb)
  )
  from public.recipes r join public.profiles p on p.id = r.user_id
  where r.id = p_id and public.can_view_recipe(r.id)
$$;
commit;
