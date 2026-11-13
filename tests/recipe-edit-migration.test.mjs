import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE);
const sql=async name=>readFile(new URL(`../db/supabase/${name}`,import.meta.url),'utf8');
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
test('recipe editing is atomic, owner-only and preserves metadata; deletion cascades',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values ('${a}'),('${b}');`);
 await db.exec((await sql('001_core_recipe_inventory.sql')).replace('create extension if not exists pgcrypto;',''));
 await db.exec(await sql('006_recipe_edit.sql'));
 await db.exec(await sql('008_optional_recipe_quantities.sql'));
 const ingredient=(await db.query("insert into ingredients(canonical_name) values ('Rice') returning id")).rows[0].id;
 const recipe=(await db.query(`insert into recipes(user_id,name,rating,notes) values ('${a}','Old',4,'Keep notes') returning id`)).rows[0].id;
 await db.exec(`insert into recipe_ingredients(recipe_id,ingredient_id,quantity,unit) values ('${recipe}','${ingredient}',100,'g');set role authenticated;set request.jwt.claim.sub='${a}';`);
 const record={name:'Edited',cuisine:'Other',tags:[],total_minutes:20,prep_minutes:null,cook_minutes:15,difficulty:'Easy',servings:4,instructions:['Cook'],image_url:'https://example.com/cover.png',source:'Book',source_url:null};
 const items=[{ingredient_id:ingredient,quantity:250,unit:'g',preparation_note:'rinsed'}];
 const update=(body,ingredients)=>db.query('select public.update_recipe($1,$2,$3)',[recipe,JSON.stringify(body),JSON.stringify(ingredients)]);
 await update(record,items);
 let row=(await db.query('select * from recipes')).rows[0];assert.equal(row.name,'Edited');assert.equal(Number(row.rating),4);assert.equal(row.notes,'Keep notes');
 await update(record,[{...items[0],quantity:null,unit:'to taste'}]);
 assert.equal((await db.query('select quantity from recipe_ingredients')).rows[0].quantity,null);
 for(const quantity of [0,-1])await assert.rejects(update(record,[{...items[0],quantity}]));
 await update(record,items);
 const before=JSON.stringify((await db.query('select * from recipe_ingredients')).rows);
 await assert.rejects(update({...record,name:'Broken'},[...items,...items]));
 assert.equal((await db.query('select name from recipes')).rows[0].name,'Edited');assert.equal(JSON.stringify((await db.query('select * from recipe_ingredients')).rows),before);
 await assert.rejects(update(record,[]));
 await db.exec(`set request.jwt.claim.sub='${b}'`);await assert.rejects(update(record,items),/access denied/);
 assert.equal((await db.query(`delete from recipes where id='${recipe}' returning id`)).rows.length,0);
 await db.exec(`set request.jwt.claim.sub='${a}';delete from recipes where id='${recipe}';`);
 assert.equal((await db.query('select * from recipe_ingredients')).rows.length,0);
 }finally{await db.close()}
});
