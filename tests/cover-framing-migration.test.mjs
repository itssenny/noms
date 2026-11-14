import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE);
const sql=async name=>readFile(new URL(`../db/supabase/${name}`,import.meta.url),'utf8');
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
test('photo framing persists for managed recipes, preserves originals and respects access',async()=>{
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
 await db.exec(await sql('020_recipe_catalog.sql'));await db.exec(await sql('021_starter_recipes.sql'));await db.exec(await sql('022_recipe_time_type.sql'));
 await db.exec(await sql('023_managed_profiles.sql'));
 await db.exec(await sql('024_profile_edit_permissions.sql'));
 await db.exec(await sql('024_profile_edit_permissions.sql'));

 await db.exec(await sql('029_recipe_cover_framing.sql'));await db.exec(await sql('029_recipe_cover_framing.sql'));
 const nomsId=(await db.query("select id from profiles where username='noms'")).rows[0].id;
 await db.exec(`insert into profile_memberships(profile_id,user_id,role) values ('${nomsId}','${a}','owner')`);
 const row=(await db.query("select id from recipes where catalog_key is not null limit 1")).rows[0];
 await db.exec(`update recipes set image_url='original/photo.jpg' where id='${row.id}';set role authenticated;set request.jwt.claim.sub='${a}';`);
 const payload=(await db.query('select get_visible_recipe($1) value',[row.id])).rows[0].value;
 assert.deepEqual(payload.image_framing,{x:50,y:50,zoom:1});
 const ingredients=(await db.query(`select jsonb_agg(jsonb_build_object('ingredient_id',ingredient_id,'quantity',quantity,'unit',unit,'preparation_note',preparation_note) order by sort_order) value from recipe_ingredients where recipe_id=$1`,[row.id])).rows[0].value;
 const framing={x:13,y:79,zoom:2.2};
 await db.query('select update_recipe($1,$2,$3)',[row.id,{...payload,image_framing:framing},ingredients]);
 const saved=(await db.query('select get_visible_recipe($1) value',[row.id])).rows[0].value;
 assert.deepEqual(saved.image_framing,framing);assert.equal(saved.image_url,'original/photo.jpg');
 await db.exec(`set request.jwt.claim.sub='${b}';`);
 await assert.rejects(db.query('select update_recipe($1,$2,$3)',[row.id,{...payload,image_framing:{x:99,y:99,zoom:3}},ingredients]),/access denied/);
 await db.exec('reset role;');
 await assert.rejects(db.query('update recipes set image_framing=$1 where id=$2',[{x:0,y:0,zoom:9},row.id]),/check constraint/);
 }finally{await db.close()}
});
