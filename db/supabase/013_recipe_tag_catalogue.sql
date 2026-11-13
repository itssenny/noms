-- Shared selectable tags. Existing recipe tag arrays remain unchanged.
begin;
create table if not exists public.recipe_tags (
 id uuid primary key default gen_random_uuid(),
 name text not null unique check(length(trim(name)) between 1 and 80),
 category text not null default 'Other' check(length(trim(category)) between 1 and 80)
);
alter table public.recipe_tags enable row level security;
drop policy if exists "Read recipe tag catalogue" on public.recipe_tags;
create policy "Read recipe tag catalogue" on public.recipe_tags for select to authenticated using(true);
grant select on public.recipe_tags to authenticated;
revoke all on public.recipe_tags from anon;
insert into public.recipe_tags(name,category) values
('Chinese','Cuisine'),('French','Cuisine'),('Greek','Cuisine'),('Indian','Cuisine'),('Italian','Cuisine'),('Japanese','Cuisine'),('Korean','Cuisine'),('Mediterranean','Cuisine'),('Mexican','Cuisine'),('Middle Eastern','Cuisine'),('Thai','Cuisine'),('Vietnamese','Cuisine'),('Fusion','Cuisine'),
('vegetarian','Diet'),('vegan','Diet'),('gluten-free','Diet'),('dairy-free','Diet'),
('breakfast','Meal'),('brunch','Meal'),('lunch','Meal'),('dinner','Meal'),('snack','Meal'),('dessert','Meal'),
('quick','Style'),('comfort food','Style'),('high-protein','Style'),('meal prep','Style')
on conflict(name) do nothing;
commit;
