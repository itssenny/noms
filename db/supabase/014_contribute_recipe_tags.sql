-- Allow signed-in users to add shared custom tags without editing or deleting existing tags.
begin;
create unique index if not exists recipe_tags_normalized_name_unique
 on public.recipe_tags (lower(regexp_replace(trim(name), '[[:space:]]+', ' ', 'g')));
drop policy if exists "Contribute recipe tags" on public.recipe_tags;
create policy "Contribute recipe tags" on public.recipe_tags for insert to authenticated
 with check ((select auth.uid()) is not null and category='Other');
grant insert on public.recipe_tags to authenticated;
revoke insert,update,delete on public.recipe_tags from anon;
revoke update,delete on public.recipe_tags from authenticated;
commit;