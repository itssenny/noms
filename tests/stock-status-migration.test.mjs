import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE);const sql=async name=>readFile(new URL(`../db/supabase/${name}`,import.meta.url),'utf8');const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
test('unknown stock status stays private and clears for exact quantities/new purchases without replaying receipts',async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values ('${a}'),('${b}');`);
 await db.exec((await sql('001_core_recipe_inventory.sql')).replace('create extension if not exists pgcrypto;',''));
 for(const name of ['007_editable_ingredient_catalogue.sql','011_shopping_inventory_receipts.sql','012_optional_stock_quantities.sql'])await db.exec(await sql(name));
 const ingredient=(await db.query("insert into ingredients(canonical_name) values ('Rice') returning id")).rows[0].id;
 await db.exec(`insert into inventory(user_id,ingredient_id,quantity,unit,storage_location,low_stock_threshold) values ('${a}','${ingredient}',5,'g','Pantry',2)`);
 await db.exec(await sql('017_inventory_stock_status.sql'));await db.exec(await sql('017_inventory_stock_status.sql'));
 let row=(await db.query('select * from inventory')).rows[0];assert.equal(Number(row.quantity),5);assert.equal(Number(row.low_stock_threshold),2);assert.equal(row.stock_status,null);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';update inventory set quantity=null,stock_status='low'`);row=(await db.query('select * from inventory')).rows[0];assert.equal(row.stock_status,'low');assert.equal(row.quantity,null);
 await db.exec(`set request.jwt.claim.sub='${b}'`);assert.equal((await db.query('select * from inventory')).rows.length,0);assert.equal((await db.query('update inventory set stock_status=null returning id')).rows.length,0);
 await db.exec(`set request.jwt.claim.sub='${a}';update inventory set quantity=10`);assert.equal((await db.query('select stock_status from inventory')).rows[0].stock_status,null);
 await db.exec("update inventory set quantity=null,stock_status='low'");const receipt='10000000-0000-0000-0000-000000000001';const receive=()=>db.query('select receive_shopping_item($1,$2,null,$3,$4) value',[receipt,ingredient,'g','Pantry']);assert.equal((await receive()).rows[0].value.inventory.stock_status,null);
 await db.exec("update inventory set stock_status='low'");assert.equal((await receive()).rows[0].value.inventory.stock_status,'low');assert.equal((await db.query('select * from shopping_receipts')).rows.length,1);
 }finally{await db.close()}});
