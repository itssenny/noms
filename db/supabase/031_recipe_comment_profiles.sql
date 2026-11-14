-- Apply after 030. Extend only the public comment author projection.
begin;
create or replace function public.get_recipe_comments(p_id uuid,p_offset integer default 0)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc,c.id),'[]'::jsonb) from
 (select c.id,c.recipe_id,c.user_id,c.body,c.created_at,
 coalesce(nullif(p.display_name,''),nullif(p.username,''),'Cook') author,p.username,p.avatar_url
 from public.recipe_comments c left join public.profiles p on p.id=c.user_id
 where c.recipe_id=p_id and public.can_view_recipe(p_id) and exists(select 1 from public.recipes r where r.id=p_id and r.visibility='public')
 order by c.created_at desc,c.id limit 30 offset greatest(0,least(coalesce(p_offset,0),10000))) c
$$;
revoke all on function public.get_recipe_comments(uuid,integer) from public,anon;
grant execute on function public.get_recipe_comments(uuid,integer) to authenticated;
commit;
