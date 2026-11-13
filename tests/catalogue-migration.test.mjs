import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE);
const sql=async name=>readFile(new URL(`../db/supabase/${name}`,import.meta.url),'utf8');
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
test('catalogue migration bootstraps missing foundation, seeds Pasta and isolates custom edits and references',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values ('${a}'),('${b}');`);
 await db.exec((await sql('001_core_recipe_inventory.sql')).replace('create extension if not exists pgcrypto;',''));
 await db.exec(await sql('007_editable_ingredient_catalogue.sql'));await db.exec(await sql('007_editable_ingredient_catalogue.sql'));
 await db.exec(await sql('005_development_ingredient_catalogue.sql'));await db.exec(await sql('005_development_ingredient_catalogue.sql'));
 assert.equal((await db.query("select default_unit from ingredients where canonical_name='Pasta'")).rows[0].default_unit,'g');
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';`);
 const id=(await db.query(`insert into ingredients(canonical_name,category,default_unit,created_by) values ('My noodles','Carbohydrates','g','${a}') returning id`)).rows[0].id;
 await db.exec(`insert into inventory(user_id,ingredient_id,quantity,unit,storage_location) values ('${a}','${id}',1,'kg','Pantry')`);
 await db.exec(`update ingredients set canonical_name='My rice noodles', default_unit='kg' where id='${id}'`);
 assert.equal((await db.query('select unit from inventory')).rows[0].unit,'kg');
 assert.equal((await db.query(`select canonical_name from ingredients where id='${id}'`)).rows[0].canonical_name,'My rice noodles');
 await assert.rejects(db.exec(`insert into ingredients(canonical_name,created_by) values (' My   RICE noodles ','${a}')`),/duplicate key/);
 assert.equal((await db.query("update ingredients set canonical_name='Hacked' where canonical_name='Pasta' returning id")).rows.length,0);
 await assert.rejects(db.exec("insert into ingredients(canonical_name) values ('Shared exploit')"),/row-level security/);
 await db.exec(`set request.jwt.claim.sub='${b}';`);
 assert.equal((await db.query(`select * from ingredients where id='${id}'`)).rows.length,0);
 assert.equal((await db.query(`update ingredients set canonical_name='Hacked' where id='${id}' returning id`)).rows.length,0);
 await assert.rejects(db.exec(`insert into inventory(user_id,ingredient_id,quantity,unit,storage_location) values ('${b}','${id}',2,'g','Pantry')`),/row-level security/);
 const recipe=(await db.query(`insert into recipes(user_id,name) values ('${b}','Test') returning id`)).rows[0].id;
 await assert.rejects(db.exec(`insert into recipe_ingredients(recipe_id,ingredient_id,quantity,unit) values ('${recipe}','${id}',1,'g')`),/row-level security/);
 assert.equal((await db.query("select count(*)::int n from ingredients where canonical_name='Pasta'")).rows[0].n,1);
 }finally{await db.close()}
});
