-- Extend canonical records. No recipe quantities, IDs, ownership or RLS change.
begin;
alter table public.ingredients add column if not exists density_g_per_ml numeric
 check(density_g_per_ml > 0 and density_g_per_ml < 100);
alter table public.ingredients add column if not exists conversion_metadata jsonb
 check(conversion_metadata is null or jsonb_typeof(conversion_metadata)='object');
-- Metadata can later contain preparation_factors with their own source/status.
-- Exact alias resolution uses existing aliases, and returns all matches so callers
-- can decline ambiguous names. SECURITY INVOKER applies existing catalogue RLS.
create or replace function public.match_ingredient_name(p_name text)
returns setof public.ingredients language sql stable security invoker
set search_path=public as $$
 select i.* from public.ingredients i
 where i.normalized_name=lower(regexp_replace(trim(p_name),'[[:space:]]+',' ','g'))
 or exists(select 1 from jsonb_array_elements_text(i.aliases) a(name)
 where lower(regexp_replace(trim(a.name),'[[:space:]]+',' ','g'))=lower(regexp_replace(trim(p_name),'[[:space:]]+',' ','g')))
 limit 10;
$$;
revoke all on function public.match_ingredient_name(text) from public,anon;
grant execute on function public.match_ingredient_name(text) to authenticated;
commit;
