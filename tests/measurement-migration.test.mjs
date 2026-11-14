import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE);
const sql=name=>readFile(new URL('../db/supabase/'+name,import.meta.url),'utf8');
test('density migrations preserve source data, canonical aliases, idempotency and RLS',async()=>{
 const db=new PGlite();const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;insert into auth.users values('${a}'),('${b}');`);
 await db.exec((await sql('001_core_recipe_inventory.sql')).replace('create extension if not exists pgcrypto;',''));
 await db.exec(await sql('007_editable_ingredient_catalogue.sql'));
 await db.exec(`insert into ingredients(canonical_name) values('Granulated sugar');insert into ingredients(canonical_name,created_by) values('Private flour','${a}');insert into recipes(user_id,name) values('${a}','Original');insert into recipe_ingredients(recipe_id,ingredient_id,quantity,unit) select r.id,i.id,1,'cup' from recipes r,ingredients i where i.canonical_name='Granulated sugar';`);
 const before=(await db.query('select * from recipe_ingredients')).rows;
 for(let i=0;i<2;i++){await db.exec(await sql('026_ingredient_measurements.sql'));await db.exec(await sql('027_starter_measurement_densities.sql'));}
 assert.deepEqual((await db.query('select * from recipe_ingredients')).rows,before);
 assert.equal((await db.query('select count(*)::int n from ingredients where density_g_per_ml is not null')).rows[0].n,28);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${b}';`);
 const aliases=(await db.query("select id,canonical_name from match_ingredient_name(' white sugar ')")).rows;
 assert.equal(aliases.length,1);assert.equal(aliases[0].id,before[0].ingredient_id);
 assert.equal((await db.query("select * from match_ingredient_name('Private flour')")).rows.length,0);
 assert.equal((await db.query('select * from recipe_ingredients')).rows.length,0);
 assert.equal((await db.query("update ingredients set density_g_per_ml=99 where canonical_name='Granulated sugar' returning id")).rows.length,0);
 await db.exec('reset role;');
 assert.equal((await db.query("select density_g_per_ml from ingredients where canonical_name='Powdered sugar'")).rows[0].density_g_per_ml,null);
 }finally{await db.close()}
});
