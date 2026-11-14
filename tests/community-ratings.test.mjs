import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {feedbackPatch} from '../feedback.mjs';
import {filterRecipes} from '../list-models.mjs';
const {PGlite}=await import(process.env.PGLITE_MODULE);
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002',c='00000000-0000-0000-0000-000000000003',managed='00000000-0000-0000-0000-000000000004';
const sql=async name=>readFile(new URL('../db/supabase/'+name,import.meta.url),'utf8');
test('migration preserves private feedback; RLS, opt-in aggregates, edits, deletes and publication work across users',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;insert into auth.users values('${a}'),('${b}'),('${c}');create table profiles(id uuid primary key,display_name text,username text,is_private boolean default false);insert into profiles values('${a}','Owner','owner',false),('${b}','Reader','reader',false),('${c}','Other','other',false),('${managed}','Team','team',false);create table profile_memberships(profile_id uuid,user_id uuid,role text);insert into profile_memberships values('${a}','${a}','owner'),('${managed}','${a}','owner'),('${managed}','${b}','editor');create table recipes(id uuid primary key default gen_random_uuid(),user_id uuid,visibility text,catalog_key text,rating numeric);alter table recipes enable row level security;create function can_manage_profile(p_id uuid) returns boolean language sql stable security definer as $$select exists(select 1 from public.profile_memberships where profile_id=p_id and user_id=auth.uid())$$;create policy own on recipes for all to authenticated using(can_manage_profile(user_id));grant select,update on recipes to authenticated;create table recipe_notes(id uuid primary key default gen_random_uuid(),recipe_id uuid references recipes(id) on delete cascade,user_id uuid references auth.users(id),body text,created_at timestamptz default now(),is_legacy boolean default false);alter table recipe_notes enable row level security;grant select,insert,delete on recipe_notes to authenticated;`);
 await db.exec(await sql('030_public_recipe_feedback.sql'));
 const recipe=(await db.query(`insert into recipes(user_id,visibility,rating) values('${a}','public',4) returning id`)).rows[0].id;
 const team=(await db.query(`insert into recipes(user_id,visibility,rating) values('${managed}','public',3.5) returning id`)).rows[0].id;
 const privateId=(await db.query(`insert into recipes(user_id,visibility,rating) values('${a}','private',2) returning id`)).rows[0].id;
 const starter=(await db.query(`insert into recipes(visibility,catalog_key) values('public','starter') returning id`)).rows[0].id;
 // Existing visitor feedback is retained alongside the creator's historical feedback.
 await db.query(`insert into recipe_personal_ratings(recipe_id,user_id,rating) values($1,$2,5)`,[recipe,b]);
 const migration=await sql('032_personal_community_ratings.sql');await db.exec(migration);await db.exec(migration);
 const as=async user=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${user}';`);
 const summary=async (id=recipe)=>(await db.query('select get_recipe_ratings($1) result',[[id]])).rows[0].result;
 const save=async(rating,share,id=recipe,set=true,note=null)=>(await db.query('select save_recipe_rating_feedback($1,$2,$3,$4,$5,$6) result',[id,set,rating,note,c,share])).rows[0].result;
 await as(a);let r=(await summary())[0];assert.equal(Number(r.personal_rating),4);assert.equal(r.community_count,0);assert.equal(r.community_average,null);assert.equal(r.contribute_to_community,false);assert.equal(Number((await summary(team))[0].personal_rating),3.5);
 await as(b);assert.equal((await db.query('select rating from recipes where id=$1',[team])).rows[0].rating,null);await assert.rejects(db.query('select * from recipe_legacy_ratings'),/permission denied/);assert.equal(Number((await summary())[0].personal_rating),5);assert.equal((await db.query('select * from recipe_personal_ratings')).rows.length,1);assert.equal((await summary(privateId)).length,0);assert.equal((await summary(team))[0].personal_rating,null);
 await save(5,true);await save(5,true);assert.equal((await db.query('select * from recipe_personal_ratings')).rows.length,1);
 await as(c);r=await save(3,true);assert.equal(r.community_count,2);assert.equal(Number(r.community_average),4);
 await save(1,false);r=(await summary())[0];assert.equal(r.community_count,1);assert.equal(Number(r.community_average),5);assert.equal(Number(r.personal_rating),1);
 r=await save(4,true);assert.equal(Number(r.community_average),4.5);await assert.rejects(save(2,true,recipe,true,'x'.repeat(5001)));assert.equal(Number((await summary())[0].personal_rating),4);
 for(const invalid of [0,6,2.5])await assert.rejects(save(invalid,true));
 // Sharing can change independently; legacy RPCs preserve consent.
 await save(null,false,recipe,false);assert.equal((await summary())[0].community_count,1);
 await db.query('select save_public_recipe_feedback($1,true,2,null,null)',[recipe]);assert.equal((await summary())[0].contribute_to_community,false);
 await assert.rejects(db.query(`insert into recipe_personal_ratings values($1,$2,1,true)`,[recipe,a]),/row-level security/);
 assert.equal((await db.query('update recipe_personal_ratings set rating=1 where user_id=$1 returning *',[b])).rows.length,0);
 assert.equal((await db.query('delete from recipe_personal_ratings where user_id=$1 returning *',[b])).rows.length,0);
 await save(4,true,starter);assert.equal((await summary(starter))[0].community_count,1);
 await as(a);await assert.rejects(save(5,true,privateId),/Private recipes/);await assert.rejects(db.query('insert into recipe_personal_ratings(recipe_id,user_id,rating,contribute_to_community) values($1,$2,5,true)',[privateId,a]),/Private recipes/);
 await db.query("update recipes set visibility='private' where id=$1",[recipe]);assert.equal((await summary())[0].community_count,0);await db.query("update recipes set visibility='public' where id=$1",[recipe]);assert.equal((await summary())[0].community_count,0);
 await as(b);assert.equal((await summary())[0].contribute_to_community,false);await save(null,false);assert.equal((await db.query('select * from recipe_personal_ratings')).rows.length,0);
 await db.exec('reset role');await db.exec(migration);await as(b);assert.equal((await summary())[0].personal_rating,null);
 await db.exec(`reset role;delete from recipes where id='${recipe}';`);assert.equal((await db.query('select * from recipe_personal_ratings where recipe_id=$1',[recipe])).rows.length,0);
 await db.exec('set role anon');await assert.rejects(summary(starter),/permission denied/);await assert.rejects(db.query('select * from recipe_personal_ratings'),/permission denied/);
 }finally{await db.close()}
});
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
test('public/private forms preserve opt-in; cards distinguish personal ratings and zero public ratings',()=>{
 const c=vm.createContext({escapeHtml:String});vm.runInContext(source.slice(source.indexOf('function communityRatingMarkup('),source.indexOf('async function hydrateCovers(')),c);vm.runInContext(source.slice(source.indexOf('function recipeFeedbackFields('),source.indexOf('function openPostCookFeedback(')),c);
 const recipe={id:'r',visibility:'public',rating:4};assert.match(c.recipeFeedbackFields(recipe),/Contribute to community rating/);assert.doesNotMatch(c.recipeFeedbackFields(recipe),/name="contribute-to-community" checked/);assert.match(c.recipeFeedbackFields({...recipe,contributeToCommunity:true}),/name="contribute-to-community" checked/);assert.doesNotMatch(c.recipeFeedbackFields({...recipe,visibility:'private'}),/checkbox/);assert.match(c.recipeFeedbackFields({...recipe,contributeToCommunity:true},true),/name="contribute-to-community" checked/);assert.match(c.communityRatingMarkup(recipe),/No public ratings yet/);assert.match(c.communityRatingMarkup({...recipe,communityAverage:4.25,communityCount:2}),/<b>4.3 \(2\)<\/b><span>public rating<\/span>/);assert.equal(c.communityRatingMarkup({...recipe,visibility:'private'}),'');
 assert.throws(()=>feedbackPatch(recipe,{rating:'2.5'}));assert.deepEqual(feedbackPatch({rating:3.5},{rating:'3.5',notes:'Keep legacy feedback'}),{note:'Keep legacy feedback'});assert.deepEqual(feedbackPatch(recipe,{append:true}),{});
 const recipes=[{id:'a',name:'A',ingredients:[],tags:[],rating:1,communityAverage:5},{id:'b',name:'B',ingredients:[],tags:[],rating:5,communityAverage:1}];assert.deepEqual(filterRecipes(recipes,{sort:'rating-desc'}).map(r=>r.id),['b','a']);assert.deepEqual(filterRecipes(recipes,{sort:'rating-asc'}).map(r=>r.id),['a','b']);
});
test('rating migration applies after the complete existing Supabase migration chain',async()=>{
 const db=new PGlite();try{
 const fixture=await readFile(new URL('./recipe-catalog-migration.test.mjs',import.meta.url),'utf8');
 const start=fixture.indexOf('await db.exec(`create role'),end=fixture.indexOf('`);',start)+3;
 const setup=fixture.slice(start,end).replaceAll('${a}',a).replaceAll('${b}',b);
 // Reuse the existing auth/storage fixture, then apply the actual production migrations.
 await db.exec(setup.slice(setup.indexOf('`')+1,setup.lastIndexOf('`')));
 const {readdir}=await import('node:fs/promises');
 for(const name of (await readdir(new URL('../db/supabase/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort()){
  await db.exec((await sql(name)).replace('create extension if not exists pgcrypto;',''));
 }
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';`);
 const rows=(await db.query("select discover_recipes('',0) result")).rows[0].result;assert.ok(rows.length>=3);
 const result=(await db.query('select save_recipe_rating_feedback($1,true,5,null,null,true) result',[rows[0].id])).rows[0].result;
 assert.equal(result.community_count,1);assert.equal(Number(result.community_average),5);
 }finally{await db.close()}
});
