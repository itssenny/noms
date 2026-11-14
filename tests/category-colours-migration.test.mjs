import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE);const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
test('category colours persist per account and reject invalid colours and cross-account writes',async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values ('${a}'),('${b}');`);
 const sql=await readFile(new URL('../db/supabase/015_category_colours.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';insert into category_colour_preferences values ('${a}','Dairy','#123456');`);
 await assert.rejects(db.exec(`insert into category_colour_preferences values ('${b}','Dairy','#ffffff')`),/row-level security/);
 await assert.rejects(db.exec(`insert into category_colour_preferences values ('${a}','Meat','red')`),/check constraint/);
 await db.exec(`set request.jwt.claim.sub='${b}'`);assert.equal((await db.query('select * from category_colour_preferences')).rows.length,0);
 await db.exec(`insert into category_colour_preferences values ('${b}','Dairy','#ffffff')`);
 await db.exec(`update category_colour_preferences set colour='#000000' where user_id='${a}'`);
 await db.exec(`set request.jwt.claim.sub='${a}'`);assert.equal((await db.query('select colour from category_colour_preferences')).rows[0].colour,'#123456');
 await db.exec(`update category_colour_preferences set colour='#abcdef'`);assert.equal((await db.query('select colour from category_colour_preferences')).rows[0].colour,'#abcdef');
 }finally{await db.close()}});
