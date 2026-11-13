import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE);const sql=async name=>readFile(new URL(`../db/supabase/${name}`,import.meta.url),'utf8');
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
test('purchases increment stock exactly once, preserve private categories/location, and roll back incompatible receipts',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values ('${a}'),('${b}');`);
 await db.exec((await sql('001_core_recipe_inventory.sql')).replace('create extension if not exists pgcrypto;',''));await db.exec(await sql('007_editable_ingredient_catalogue.sql'));await db.exec(await sql('011_shopping_inventory_receipts.sql'));await db.exec(await sql('011_shopping_inventory_receipts.sql'));
 const ingredient=(await db.query("insert into ingredients(canonical_name,category) values ('Rice','Carbohydrates') returning id")).rows[0].id;
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';`);
 const receipt='10000000-0000-0000-0000-000000000001',second='10000000-0000-0000-0000-000000000002',bad='10000000-0000-0000-0000-000000000003';
 const receive=(id,quantity,unit)=>db.query('select public.receive_shopping_item($1,$2,$3,$4,$5) result',[id,ingredient,quantity,unit,'Pantry']);
 let result=(await receive(receipt,1,'kg')).rows[0].result;assert.equal(Number(result.inventory.quantity),1);
 await receive(receipt,1,'kg');assert.equal(Number((await db.query('select quantity from inventory')).rows[0].quantity),1);
 await db.exec("update inventory set storage_location='Freezer',category_override='My grains',low_stock_threshold=0.2");
 result=(await receive(second,250,'g')).rows[0].result;assert.equal(Number(result.inventory.quantity),1.25);assert.equal(result.inventory.storage_location,'Freezer');assert.equal(result.inventory.category_override,'My grains');assert.equal(Number(result.inventory.low_stock_threshold),0.2);
 await assert.rejects(receive(bad,1,'cup'),/different unit/);assert.equal((await db.query(`select * from shopping_receipts where id='${bad}'`)).rows.length,0);assert.equal(Number((await db.query('select quantity from inventory')).rows[0].quantity),1.25);
 await assert.rejects(receive(second,300,'g'),/different details/);await assert.rejects(receive(bad,null,'g'),/actual quantity/);
 await db.exec(`set request.jwt.claim.sub='${b}'`);assert.equal((await db.query('select * from shopping_receipts')).rows.length,0);assert.equal((await db.query('select * from inventory')).rows.length,0);await assert.rejects(receive(receipt,1,'kg'),/different details/);
 await receive(bad,20,'g');assert.equal(Number((await db.query('select quantity from inventory')).rows[0].quantity),20);
 assert.equal((await db.query('select category_override from inventory')).rows[0].category_override,null);
 }finally{await db.close()}
});
