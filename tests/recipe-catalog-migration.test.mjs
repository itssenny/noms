import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE);
const sql=async name=>readFile(new URL(`../db/supabase/${name}`,import.meta.url),'utf8');
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
test('shared catalogue, private library, publication code lifecycle and RLS remain separate',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 insert into auth.users(id) values ('${a}'),('${b}');`);
 await db.exec((await sql('001_core_recipe_inventory.sql')).replace('create extension if not exists pgcrypto;',''));
 for(const name of ['002_profiles.sql','003_recipe_manual_entry.sql','007_editable_ingredient_catalogue.sql','008_optional_recipe_quantities.sql','010_recipe_note_posts.sql','016_profile_recipe_privacy.sql'])await db.exec(await sql(name));
 await db.exec(`insert into profiles(id,username) values ('${a}','alice'),('${b}','bob');`);
 // Preserve shared ingredient identity, even alongside a custom ingredient with the same name.
 const rice=(await db.query("insert into ingredients(canonical_name,category,default_unit) values ('Rice','Carbohydrates','g') returning id")).rows[0].id;
 await db.exec(`insert into ingredients(canonical_name,created_by) values ('Rice','${a}')`);
 const previous=(await db.query(`insert into recipes(user_id,name,visibility) values ('${a}','Previously published','public') returning id`)).rows[0].id;
 await db.exec(await sql('020_recipe_catalog.sql'));
 await db.exec(await sql('021_starter_recipes.sql'));
 await db.exec(await sql('022_recipe_time_type.sql'));await db.exec(await sql('022_recipe_time_type.sql'));
 const seeded=(await db.query('select id,share_code from recipes where catalog_key is not null order by id')).rows;
 assert.equal(seeded.length,3);for(const row of seeded)assert.match(row.share_code,/^[A-HJ-NP-Z2-9]{6}$/);
 await db.exec(await sql('020_recipe_catalog.sql'));await db.exec(await sql('021_starter_recipes.sql'));await db.exec(await sql('022_recipe_time_type.sql'));
 assert.deepEqual((await db.query('select id,share_code from recipes where catalog_key is not null order by id')).rows,seeded);
 assert.equal((await db.query('select count(*)::int n from recipe_ingredients ri join recipes r on r.id=ri.recipe_id where r.catalog_key is not null')).rows[0].n,21);
 assert.equal((await db.query("select ingredient_id from recipe_ingredients ri join recipes r on r.id=ri.recipe_id where r.catalog_key='miso-chickpea-bowls-v1' and ingredient_id=$1",[rice])).rows[0].ingredient_id,rice);
 const as=async id=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${id}'`);
 const discover=async(search='')=>(await db.query('select discover_recipes($1,0) value',[search])).rows[0].value;
 const codeLookup=async code=>(await db.query('select get_recipe_by_code($1) value',[code])).rows[0]?.value;
 await as(b);assert.equal((await discover()).length,3); // Private creator profile keeps previous public recipe hidden.
 assert.equal((await db.query('select * from recipes')).rows.length,0);
 let starter=(await discover())[0];assert.equal(starter.creator.username,'noms');assert.equal(starter.user_id,null);
 for(const key of ['rating','notes','last_cooked_at'])assert.equal(key in starter,false);
 assert.equal((await codeLookup(' '+starter.share_code.toLowerCase()+' ')).id,starter.id);
 await db.exec(`insert into saved_recipes(user_id,recipe_id) values ('${b}','${starter.id}')`);
 assert.equal((await db.query('select get_saved_recipes() value')).rows[0].value[0].recipe.id,starter.id);
 assert.equal((await db.query(`update recipes set name='Hacked' where id='${starter.id}' returning id`)).rows.length,0);
 await assert.rejects(db.query('select update_recipe($1,$2,$3)',[starter.id,'{}','[]']),/access denied/);
 await assert.rejects(db.exec(`insert into recipes(user_id,catalog_key,name,visibility) values (null,'forged','Forged','public')`),/row-level security/);
 await assert.rejects(db.exec(`insert into recipes(user_id,catalog_key,name,visibility) values ('${b}','forged','Forged','public')`),/check constraint/);
 await as(a);
 const draft=(await db.query(`insert into recipes(user_id,name,share_code,rating,notes) values ('${a}','Private imported bowl','ABC234',5,'Secret') returning id,share_code`)).rows[0];
 assert.equal(draft.share_code,null);await db.exec(`update recipes set cook_time_type='baking',cook_minutes=12 where id='${draft.id}'`);await assert.rejects(db.exec(`update recipes set cook_time_type='invalid' where id='${draft.id}'`),/check constraint/);
 await db.exec(`update recipes set visibility='public' where id='${draft.id}'`);
 const code=(await db.query('select share_code from recipes where id=$1',[draft.id])).rows[0].share_code;assert.match(code,/^[A-HJ-NP-Z2-9]{6}$/);
 await db.exec(`update profiles set is_private=false where id='${a}'`);
 await as(b);assert.equal((await discover('Private imported bowl')).length,1);assert.equal((await codeLookup(code)).id,draft.id);assert.equal((await codeLookup(code)).cook_time_type,'baking');assert.equal((await codeLookup(code)).cook_minutes,12);
 assert.equal('rating' in await codeLookup(code),false);
 await as(a);await db.exec(`update recipes set visibility='private',share_code='ZZZ999' where id='${draft.id}'`);
 assert.equal((await db.query('select share_code from recipes where id=$1',[draft.id])).rows[0].share_code,code);
 await as(b);assert.equal(await codeLookup(code),null);assert.equal((await discover(code)).length,0);
 await as(a);await db.exec(`update recipes set visibility='public' where id='${draft.id}'`);
 await as(b);assert.equal((await codeLookup(code)).id,draft.id);
 await as(a);await db.exec('update profiles set is_private=true where id=auth.uid()');
 await as(b);assert.equal(await codeLookup(code),null);
 assert.equal((await discover()).length,3);
 await db.exec("reset role;set role anon;set request.jwt.claim.sub=''");await assert.rejects(db.query('select discover_recipes()'),/permission denied/);
 await assert.rejects(db.query('select get_recipe_by_code($1)',[code]),/permission denied/);
 // Existing published IDs and codes remain intact throughout.
 await db.exec('reset role');assert.match((await db.query('select share_code from recipes where id=$1',[previous])).rows[0].share_code,/^[A-HJ-NP-Z2-9]{6}$/);
 }finally{await db.close()}
});
