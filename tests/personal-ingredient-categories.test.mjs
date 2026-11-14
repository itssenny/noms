import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const defaults=(await readFile(new URL('../ingredient-defaults.js',import.meta.url),'utf8')).replace(/^import .*\n/,'').replaceAll('export ','');
test('Sweetener and Essentials save as private category preferences for shared ingredients',async()=>{
 for(const category of ['Sweetener','Essentials']){
  const writes=[];const context=vm.createContext({supabase:{auth:{getUser:async()=>({data:{user:{id:'me'}}})},from(table){const query={upsert(value){writes.push({table,value});return this},update(value){writes.push({table,value});return this},eq(){return this},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};return query}}});
  vm.runInContext(defaults,context);await context.saveIngredientDefaults('shared',{unit:'g',location:'Pantry',threshold:0,category},'me');
  assert.equal(writes[0].table,'ingredient_preferences');assert.equal(writes[0].value.category_override,category);assert.equal(writes[0].value.user_id,'me');assert.equal(writes[1].table,'inventory');assert.deepEqual(Object.keys(writes[1].value),['category_override']);
 }
});
test('shared catalogue category selector is enabled while the shared name stays readonly',async()=>{
 const source=await readFile(new URL('../catalogue.js',import.meta.url),'utf8');
 assert.match(source,/<select name="category">/);assert.match(source,/name="name".*?'readonly'/);
});
const {PGlite}=await import(process.env.PGLITE_MODULE);
test('personal category migration preserves shared categories and enforces owner RLS',async()=>{
 const db=new PGlite(),a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
 const sql=name=>readFile(new URL('../db/supabase/'+name,import.meta.url),'utf8');
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;insert into auth.users values('${a}'),('${b}');`);
 await db.exec((await sql('001_core_recipe_inventory.sql')).replace('create extension if not exists pgcrypto;',''));await db.exec(await sql('007_editable_ingredient_catalogue.sql'));await db.exec(await sql('018_ingredient_preferences.sql'));await db.exec(await sql('028_personal_ingredient_categories.sql'));await db.exec(await sql('028_personal_ingredient_categories.sql'));
 const id=(await db.query("insert into ingredients(canonical_name,category) values('Maple syrup','Other') returning id")).rows[0].id;
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';insert into ingredient_preferences(user_id,ingredient_id,default_unit,storage_location,category_override) values('${a}','${id}','ml','Pantry','Sweetener');`);
 assert.equal((await db.query('select category_override from ingredient_preferences')).rows[0].category_override,'Sweetener');assert.equal((await db.query('select category from ingredients')).rows[0].category,'Other');
 await db.exec(`set request.jwt.claim.sub='${b}';`);assert.equal((await db.query('select * from ingredient_preferences')).rows.length,0);
 await assert.rejects(db.exec(`insert into ingredient_preferences(user_id,ingredient_id,default_unit,storage_location,category_override) values('${a}','${id}','ml','Pantry','Essentials')`),/row-level security/);
 }finally{await db.close()}
});
