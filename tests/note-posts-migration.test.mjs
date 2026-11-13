import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE);const sql=async name=>readFile(new URL(`../db/supabase/${name}`,import.meta.url),'utf8');
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002',note='10000000-0000-0000-0000-000000000001';
test('note migration preserves legacy text and atomic feedback creates private, timestamped, idempotent posts',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values ('${a}'),('${b}');`);
 await db.exec((await sql('001_core_recipe_inventory.sql')).replace('create extension if not exists pgcrypto;',''));
 const recipe=(await db.query(`insert into recipes(user_id,name,notes,rating) values ('${a}','Soup','My earlier note',4) returning id`)).rows[0].id;
 await db.exec(await sql('010_recipe_note_posts.sql'));await db.exec(await sql('010_recipe_note_posts.sql'));
 let posts=(await db.query('select * from recipe_notes')).rows;assert.equal(posts.length,1);assert.equal(posts[0].body,'My earlier note');assert.equal(posts[0].created_at,null);assert.equal(posts[0].is_legacy,true);assert.equal((await db.query('select notes from recipes')).rows[0].notes,null);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';`);
 const save=(rating,body,id=note)=>db.query('select public.save_recipe_feedback($1,true,$2,$3,$4) result',[recipe,rating,body,id]);
 let result=(await save(5,'More pepper')).rows[0].result;assert.equal(Number(result.rating),5);assert.equal(result.posts.length,2);assert.ok(result.posts[0].created_at);assert.equal(result.posts[0].body,'More pepper');
 await save(5,'More pepper');assert.equal((await db.query('select * from recipe_notes')).rows.length,2);
 await assert.rejects(save(1,'x'.repeat(5001)));assert.equal(Number((await db.query('select rating from recipes')).rows[0].rating),5);
 await db.exec(`set request.jwt.claim.sub='${b}';`);assert.equal((await db.query('select * from recipe_notes')).rows.length,0);await assert.rejects(save(1,'Not yours'),/access denied/);assert.equal((await db.query(`delete from recipe_notes where id='${note}' returning id`)).rows.length,0);
 await assert.rejects(db.exec(`insert into recipe_notes(recipe_id,user_id,body) values ('${recipe}','${b}','Wrong owner')`),/row-level security/);
 await db.exec(`set request.jwt.claim.sub='${a}';delete from recipe_notes where is_legacy;reset role;`);await db.exec(await sql('010_recipe_note_posts.sql'));assert.equal((await db.query('select * from recipe_notes where is_legacy')).rows.length,0);
 await db.exec(`delete from recipes where id='${recipe}'`);assert.equal((await db.query('select * from recipe_notes')).rows.length,0);
 }finally{await db.close()}
});
