import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const {PGlite}=await import(process.env.PGLITE_MODULE);
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002',c='00000000-0000-0000-0000-000000000003';
test('public ratings are personal, notes private, comments visible with access and author-only deletion',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;insert into auth.users values('${a}'),('${b}'),('${c}');create table profiles(id uuid primary key,display_name text,username text,is_private boolean default false);insert into profiles values('${a}','Owner','owner',false),('${b}','Reader','reader',false),('${c}','Other','other',false);create table recipes(id uuid primary key default gen_random_uuid(),user_id uuid,visibility text,catalog_key text,rating numeric);alter table recipes enable row level security;create policy own on recipes for all to authenticated using(user_id=auth.uid());grant select,update on recipes to authenticated;create function can_manage_profile(p_id uuid) returns boolean language sql stable as $$select coalesce(p_id=auth.uid(),false)$$;create table recipe_notes(id uuid primary key default gen_random_uuid(),recipe_id uuid references recipes(id) on delete cascade,user_id uuid references auth.users(id),body text,created_at timestamptz default now(),is_legacy boolean default false);alter table recipe_notes enable row level security;grant select,insert,delete on recipe_notes to authenticated;`);
 const sql=await readFile(new URL('../db/supabase/030_public_recipe_feedback.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 await db.exec(`alter table profiles add column avatar_url text;update profiles set avatar_url='https://example.com/reader.jpg' where id='${b}';`);
 const authorSql=await readFile(new URL('../db/supabase/031_recipe_comment_profiles.sql',import.meta.url),'utf8');await db.exec(authorSql);await db.exec(authorSql);
 const recipe=(await db.query(`insert into recipes(user_id,visibility,rating) values('${a}','public',4) returning id`)).rows[0].id;
 const catalog=(await db.query(`insert into recipes(visibility,catalog_key) values('public','starter') returning id`)).rows[0].id;
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${b}';`);
 const save=(id,rating,note,noteId)=>db.query('select save_public_recipe_feedback($1,true,$2,$3,$4) result',[id,rating,note,noteId]);
 let r=(await save(recipe,5,'Private secret',b)).rows[0].result;assert.equal(Number(r.rating),5);assert.equal(r.posts.length,1);await save(recipe,5,'Private secret',b);assert.equal((await db.query('select * from recipe_notes')).rows.length,1);
 await assert.rejects(save(recipe,2,'x'.repeat(5001),c));assert.equal(Number((await db.query('select rating from recipe_personal_ratings')).rows[0].rating),5);
 await save(catalog,3,'Catalogue note',c);
 await db.query('select post_recipe_comment($1,$2,$3)',[recipe,'Public tip',b]);await db.query('select post_recipe_comment($1,$2,$3)',[recipe,'Public tip',b]);
 await assert.rejects(db.query('select post_recipe_comment($1,$2,$3)',[recipe,'Changed retry',b]));
 await db.exec(`set request.jwt.claim.sub='${a}';`);
 assert.equal((await db.query('select * from recipe_notes')).rows.length,0);assert.equal((await db.query('select * from recipe_personal_ratings')).rows.length,0);assert.equal(Number((await db.query('select rating from recipes')).rows[0].rating),4);
 const posts=(await db.query('select get_recipe_comments($1,0) result',[recipe])).rows[0].result;assert.equal(posts.length,1);assert.equal(posts[0].body,'Public tip');assert.equal(posts[0].author,'Reader');assert.equal(posts[0].username,'reader');assert.equal(posts[0].avatar_url,'https://example.com/reader.jpg');assert.equal(posts[0].user_id,b);assert.equal(JSON.stringify(posts).includes('Private secret'),false);
 assert.equal((await db.query('delete from recipe_comments returning id')).rows.length,0);
 await db.exec(`reset role;update recipes set visibility='private' where id='${recipe}';set role authenticated;set request.jwt.claim.sub='${c}';`);
 assert.equal((await db.query('select get_recipe_comments($1,0) result',[recipe])).rows[0].result.length,0);await assert.rejects(save(recipe,1,'hidden',a),/access denied/);await assert.rejects(db.query('select post_recipe_comment($1,$2,$3)',[recipe,'hidden',a]),/access denied/);
 await db.exec(`set request.jwt.claim.sub='${b}';`);assert.equal((await db.query('select * from recipe_notes')).rows.length,2);assert.equal((await db.query('delete from recipe_comments returning id')).rows.length,1);
 }finally{await db.close()}
});
test('opening source is consistent for recipe text and public cards',async()=>{
 const source=await readFile(new URL('../app.js',import.meta.url),'utf8');const context=vm.createContext({});vm.runInContext(source.slice(source.indexOf('function recipeOpenOrigin('),source.indexOf('function recipeCommentsSection(')),context);
 for(const [selector,expected] of [['#discover-view','discover'],['#tags-view','tags'],['#planner-view','planner'],['#recipes-view','recipes']])assert.equal(context.recipeOpenOrigin({closest:s=>s===selector?{}:null}),expected);
 assert.ok(source.includes("!rc.dataset.discoverRecipe"));assert.ok(source.includes('detail(recipe.dataset.visitRecipe,recipeOpenOrigin(recipe))'));
 const detail=source.slice(source.indexOf('async function detail('),source.indexOf('function cooking('));assert.ok(detail.includes('recipeCommentsSection(r)'));assert.ok(detail.includes("loadRecipeNotePosts(r.id)"));assert.equal(detail.includes('${ownsRecipe(r)?`<section class="panel personal-feedback">'),false);
 assert.equal(source.includes('function openPostCookFeedback(){if(currentRecipe&&!ownsRecipe(currentRecipe))return;'),false);
});
