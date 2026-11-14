import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const {PGlite}=await import(process.env.PGLITE_MODULE);
const sql=async name=>readFile(new URL(`../db/supabase/${name}`,import.meta.url),'utf8');
const userId='00000000-0000-0000-0000-000000000001';

test('authenticated users can contribute normalized shared tags but cannot edit them',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values ('${userId}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  await db.exec(await sql('013_recipe_tag_catalogue.sql'));
  await db.exec(await sql('014_contribute_recipe_tags.sql'));
  await db.exec(await sql('014_contribute_recipe_tags.sql'));
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${userId}';`);
  await db.query("insert into recipe_tags(name,category) values ('Weeknight dinner','Other')");
  assert.equal((await db.query("select name from recipe_tags where name='Weeknight dinner'")).rows.length,1);
  await assert.rejects(db.query("insert into recipe_tags(name) values (' weeknight   dinner ' )"),error=>error.code==='23505');
  await assert.rejects(db.query("update recipe_tags set name='Changed' where name='Weeknight dinner'"),error=>error.code==='42501');
 }finally{await db.close()}
});