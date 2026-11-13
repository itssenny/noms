import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE);
const sql=async name=>readFile(new URL(`../db/supabase/${name}`,import.meta.url),'utf8');
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
test('substitution rules are directional, idempotent, account-owned and reference visible ingredients',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values ('${a}'),('${b}');`);
 await db.exec((await sql('001_core_recipe_inventory.sql')).replace('create extension if not exists pgcrypto;',''));
 await db.exec(await sql('007_editable_ingredient_catalogue.sql'));
 const tomato=(await db.query("insert into ingredients(canonical_name) values ('Tomatoes') returning id")).rows[0].id;
 await db.exec(await sql('009_ingredient_substitutions.sql'));await db.exec(await sql('009_ingredient_substitutions.sql'));
 const seeded=(await db.query('select * from ingredient_substitutions')).rows;assert.equal(seeded.length,1);assert.equal(seeded[0].ingredient_id,tomato);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';`);
 const privateId=(await db.query(`insert into ingredients(canonical_name,created_by) values ('My tomato','${a}') returning id`)).rows[0].id;
 const id=(await db.query(`insert into ingredient_substitutions(user_id,ingredient_id,substitute_id) values ('${a}','${tomato}','${privateId}') returning id`)).rows[0].id;
 await assert.rejects(db.exec(`insert into ingredient_substitutions(user_id,ingredient_id,substitute_id) values ('${a}','${tomato}','${tomato}')`),/check constraint/);
 await assert.rejects(db.exec(`insert into ingredient_substitutions(ingredient_id,substitute_id) values ('${privateId}','${tomato}')`),/row-level security/);
 await db.exec(`set request.jwt.claim.sub='${b}';`);
 assert.equal((await db.query('select * from ingredient_substitutions')).rows.length,1);
 assert.equal((await db.query(`delete from ingredient_substitutions where id='${id}' returning id`)).rows.length,0);
 await assert.rejects(db.exec(`insert into ingredient_substitutions(user_id,ingredient_id,substitute_id) values ('${b}','${tomato}','${privateId}')`),/row-level security/);
 await assert.rejects(db.exec(`insert into ingredient_substitutions(user_id,ingredient_id,substitute_id) values ('${a}','${tomato}','${seeded[0].substitute_id}')`),/row-level security/);
 await db.exec(`set request.jwt.claim.sub='${a}';delete from ingredient_substitutions where id='${id}';`);
 assert.equal((await db.query('select * from ingredient_substitutions')).rows.length,1);
 assert.equal((await db.query(`delete from ingredient_substitutions where user_id is null returning id`)).rows.length,0);
 }finally{await db.close()}
});
