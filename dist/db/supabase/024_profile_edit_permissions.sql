-- Apply after 023_managed_profiles.sql. Repair editable-column privileges while
-- keeping profile identity, verification and type controlled by the operator.
begin;
revoke update on public.profiles from authenticated;
grant update (username, display_name, bio, avatar_url, diet_preference, cooking_level,
  favorite_cuisines, is_private, show_diet, show_cooking_level)
  on public.profiles to authenticated;
-- Existing managed-profile UPDATE RLS still restricts rows to their owners.
notify pgrst, 'reload schema';
commit;
