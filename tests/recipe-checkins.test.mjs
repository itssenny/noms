import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE);
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002',c='00000000-0000-0000-0000-000000000003',managed='00000000-0000-0000-0000-000000000004';
const sql=async name=>readFile(new URL('../db/supabase/'+name,import.meta.url),'utf8');
test('explicit check-ins cover own and unsaved recipes, with private history, atomic feedback and idempotent retries',async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;insert into auth.users values('${a}'),('${b}'),('${c}');create table profiles(id uuid primary key,display_name text,username text,is_private boolean default false);insert into profiles values('${a}','Owner','owner',false),('${b}','Reader','reader',false),('${c}','Other','other',false),('${managed}','Team','team',false);create table profile_memberships(profile_id uuid,user_id uuid,role text);insert into profile_memberships values('${a}','${a}','owner'),('${managed}','${a}','owner'),('${managed}','${b}','editor');create table recipes(id uuid primary key default gen_random_uuid(),user_id uuid,visibility text,catalog_key text,rating numeric);alter table recipes enable row level security;create function can_manage_profile(p_id uuid) returns boolean language sql stable security definer as $$select exists(select 1 from public.profile_memberships where profile_id=p_id and user_id=auth.uid())$$;create policy own on recipes for all to authenticated using(can_manage_profile(user_id));grant select,update on recipes to authenticated;create table recipe_notes(id uuid primary key default gen_random_uuid(),recipe_id uuid references recipes(id) on delete cascade,user_id uuid references auth.users(id),body text,created_at timestamptz default now(),is_legacy boolean default false);alter table recipe_notes enable row level security;grant select,insert,delete on recipe_notes to authenticated;`);

 await db.exec(await sql('030_public_recipe_feedback.sql'));await db.exec(await sql('032_personal_community_ratings.sql'));
 await db.exec(`create function public.recipe_public_document(p_id uuid) returns jsonb language sql stable security definer as $$select jsonb_build_object('id',id,'name','Test recipe','visibility',visibility) from public.recipes where id=p_id and public.can_view_recipe(id)$$;`);
 await db.exec(`insert into profile_memberships values('${b}','${b}','owner'),('${c}','${c}','owner');`);
 const migration=await sql('035_recipe_made_checkins.sql');await db.exec(migration);await db.exec(migration);
 const ids=(await db.query(`insert into recipes(user_id,visibility) values('${a}','public'),('${a}','private'),('${b}','public') returning id`)).rows.map(r=>r.id);
 const as=async id=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${id}';`);
 const save=(id,made,extras={})=>db.query('select save_recipe_checkin($1,$2,$3,$4,$5,$6,$7,$8,$9) result',[id,made,extras.rating!=null,extras.rating??null,extras.note??null,extras.noteId??null,false,extras.comment??null,extras.commentId??null]);
 await as(b);assert.equal((await db.query('select get_made_recipes() result')).rows[0].result.length,0);
 let result=(await save(ids[0],true)).rows[0].result;assert.ok(result.made_at);const first=result.made_at;
 result=(await save(ids[0],true)).rows[0].result;assert.equal(result.made_at,first);
 await save(ids[2],true,{rating:5,note:'Private cooking tip',noteId:c,comment:'Public cooking tip',commentId:c});
 let history=(await db.query('select get_made_recipes() result')).rows[0].result;assert.equal(history.length,2);assert.equal(history.find(r=>r.recipe_id===ids[2]).personal_note,'Private cooking tip');assert.equal(history.find(r=>r.recipe_id===ids[2]).comment,'Public cooking tip');
 await save(ids[2],true,{rating:5,note:'Private cooking tip',noteId:c,comment:'Public cooking tip',commentId:c});assert.equal((await db.query('select * from recipe_notes')).rows.length,1);assert.equal((await db.query('select * from recipe_comments')).rows.length,1);
 await save(ids[0],false);history=(await db.query('select get_made_recipes() result')).rows[0].result;assert.equal(history.length,1);assert.equal(history[0].recipe_id,ids[2]);
 await assert.rejects(save(ids[1],true),/access denied/);
 // Atomic rollback: neither rating nor marker survives an invalid comment.
 await assert.rejects(save(ids[0],true,{rating:3,comment:'x'.repeat(2001)}));assert.equal((await db.query('select get_recipe_made($1) result',[[ids[0]]])).rows[0].result.length,0);assert.equal((await db.query('select rating from recipe_personal_ratings where recipe_id=$1',[ids[0]])).rows.length,0);
 await as(a);assert.equal((await db.query('select get_made_recipes() result')).rows[0].result.length,0);assert.equal((await db.query('select * from recipe_made')).rows.length,0);
 assert.equal((await db.query('delete from recipe_made where user_id=$1 returning *',[b])).rows.length,0);
 await save(ids[1],true);assert.equal((await db.query('select get_made_recipes() result')).rows[0].result.length,1);
 await db.exec(`reset role;update recipes set visibility='private' where id='${ids[2]}';`);await as(b);assert.equal((await db.query('select get_made_recipes() result')).rows[0].result.length,1); // still own
 await as(c);assert.equal((await db.query('select get_made_recipes() result')).rows[0].result.length,0);
 await db.exec(`reset role;set role anon;`);await assert.rejects(db.query('select get_made_recipes()'),/permission denied/);
 }finally{await db.close()}
});
