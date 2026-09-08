import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const {PGlite}=await import(process.env.PGLITE_MODULE);
const sql=async name=>readFile(new URL(`../db/supabase/${name}`,import.meta.url),'utf8');
const core=(await sql('001_core_recipe_inventory.sql')).replace('create extension if not exists pgcrypto;','');
const migration=await sql('004_canonical_ingredient_foundation.sql');
const seed=await sql('005_development_ingredient_catalogue.sql');
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
async function database(){const db=new PGlite();await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; insert into auth.users values ('${a}'),('${b}');`);await db.exec(core);return db}
test('migrations preserve references, seed idempotently, enforce uniqueness and owner RLS',async()=>{
 const db=await database();try{
 await db.exec(`insert into ingredients(canonical_name) values ('Cucumbers'); insert into inventory(user_id,ingredient_id,quantity,unit,storage_location) select '${a}',id,2,'kg','Fridge' from ingredients; insert into recipes(user_id,name) values ('${a}','Existing recipe'); insert into recipe_ingredients(recipe_id,ingredient_id,quantity,unit) select r.id,i.id,1,'kg' from recipes r,ingredients i;`);
 const before=(await db.query('select * from inventory')).rows;
 await db.exec(migration);await db.exec(seed);await db.exec(seed);
 assert.deepEqual((await db.query('select * from inventory')).rows,before);
 assert.equal((await db.query('select count(*)::int n from recipe_ingredients')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from ingredients')).rows[0].n,40);
 assert.deepEqual((await db.query("select canonical_name,default_unit from ingredients where canonical_name in ('Cucumbers','Flour','Milk') order by canonical_name")).rows,[{canonical_name:'Cucumbers',default_unit:'piece'},{canonical_name:'Flour',default_unit:'g'},{canonical_name:'Milk',default_unit:'ml'}]);
 await assert.rejects(db.exec("insert into ingredients(canonical_name) values ('  CHERRY   TOMATO  ');"),/duplicate key/);
 await db.exec(`set role authenticated; set request.jwt.claim.sub='${a}';`);
 assert.equal((await db.query("select count(*)::int n from ingredients where canonical_name ilike '%CUC%'")).rows[0].n,1);
 await assert.rejects(db.exec("insert into ingredients(canonical_name) values ('Cucumber');"),/permission denied/);
 await db.exec("update inventory set quantity=3,unit='piece';");
 assert.equal((await db.query('select quantity::float q from inventory')).rows[0].q,3);
 await db.exec(`set request.jwt.claim.sub='${b}';`);
 assert.equal((await db.query('select * from inventory')).rows.length,0);
 assert.equal((await db.query('select * from recipes')).rows.length,0);
 assert.equal((await db.query('select * from recipe_ingredients')).rows.length,0);
 await db.exec('update inventory set quantity=99;');
 await assert.rejects(db.exec(`insert into inventory(user_id,ingredient_id,quantity,unit,storage_location) select '${a}',id,1,'g','Pantry' from ingredients where canonical_name='Flour';`),/row-level security/);
 await db.exec(`set request.jwt.claim.sub='${a}';`);
 assert.equal((await db.query('select quantity::float q from inventory')).rows[0].q,3);
 }finally{await db.close()}
});
test('ambiguous whitespace duplicates roll back the entire migration',async()=>{
 const db=await database();try{
 await db.exec("insert into ingredients(canonical_name) values ('Cherry Tomato'),('Cherry  Tomato');");
 await assert.rejects(db.exec(migration),{code:'23505'});await db.exec('rollback;');
 assert.equal((await db.query("select column_name from information_schema.columns where table_name='ingredients' and column_name='default_unit'")).rows.length,0);
 assert.equal((await db.query('select count(*)::int n from ingredients')).rows[0].n,2);
 }finally{await db.close()}
});
