import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE);
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
const sql=async name=>readFile(new URL('../db/supabase/'+name,import.meta.url),'utf8');
test('public Cookbooks expose only public recipe projections and obey profile privacy, ownership, and anonymous denial',async()=>{
 const db=new PGlite();try{
 const fixture=await readFile(new URL('./recipe-catalog-migration.test.mjs',import.meta.url),'utf8'),start=fixture.indexOf('await db.exec(`create role'),end=fixture.indexOf('`);',start)+3;
 const setup=fixture.slice(start,end).replaceAll('${a}',a).replaceAll('${b}',b);await db.exec(setup.slice(setup.indexOf('`')+1,setup.lastIndexOf('`')));
 for(const name of (await readdir(new URL('../db/supabase/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort())await db.exec((await sql(name)).replace('create extension if not exists pgcrypto;',''));
 const as=async id=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${id}';`);
 const doc=async id=>(await db.query('select get_cookbook($1) value',[id])).rows[0].value;
 const entries=async id=>(await db.query('select get_cookbook_recipes($1) value',[id])).rows[0].value;
 const profile=async id=>(await db.query('select get_profile_cookbooks($1) value',[id])).rows[0].value;
 await db.exec(`update profiles set is_private=false,display_name='Alice',username='alice' where id='${a}';update profiles set is_private=false where id='${b}';`);
 await as(b);const saved=(await db.query("insert into recipes(user_id,name,visibility,notes) values($1,'Saved public','public','Do not expose') returning id",[b])).rows[0].id;
 await as(a);
 const pub=(await db.query("insert into recipes(user_id,name,visibility,notes,image_url) values($1,'Public recipe','public','Personal secret','public.jpg') returning id",[a])).rows[0].id;
 const priv=(await db.query("insert into recipes(user_id,name,image_url) values($1,'Secret recipe','secret.jpg') returning id",[a])).rows[0].id;
 const book=(await db.query("insert into cookbooks(name,visibility) values('Shared collection','public') returning id")).rows[0].id;
 const privateBook=(await db.query("insert into cookbooks(name) values('Private collection') returning id")).rows[0].id;
 await db.query('insert into saved_recipes(user_id,recipe_id) values($1,$2)',[a,saved]);
 for(const id of [pub,priv,saved])await db.query('insert into cookbook_recipes(cookbook_id,recipe_id) values($1,$2)',[book,id]);
 await db.query('update cookbooks set cover_recipe_id=$1 where id=$2',[priv,book]);
 assert.equal((await doc(book)).recipe_ids.length,3);assert.equal((await profile(a)).length,2);
 await as(b);let view=await doc(book);assert.equal(view.author.display_name,'Alice');assert.equal(view.author.username,'alice');assert.deepEqual(view.recipe_ids.sort(),[pub,saved].sort());assert.equal(view.cover_recipe_id,null);assert.notEqual(view.cover.id,priv);assert.equal(JSON.stringify(view).includes('secret.jpg'),false);assert.equal(JSON.stringify(view).includes(priv),false);
 assert.equal((await entries(book)).length,2);for(const item of await entries(book)){assert.equal('notes' in item.recipe,false);assert.equal('rating' in item.recipe,false);assert.equal('last_cooked_at' in item.recipe,false)}
 assert.equal((await profile(a)).length,1);assert.equal(await doc(privateBook),null);assert.deepEqual(await entries(privateBook),[]);
 assert.equal((await db.query('select * from cookbooks')).rows.length,0);assert.equal((await db.query('select * from cookbook_recipes')).rows.length,0);
 assert.equal((await db.query("update cookbooks set name='Intrusion' where id=$1 returning id",[book])).rows.length,0);assert.equal((await db.query('delete from cookbooks where id=$1 returning id',[book])).rows.length,0);
 await assert.rejects(db.query('insert into cookbook_recipes(cookbook_id,recipe_id) values($1,$2)',[book,saved]),/row-level security|duplicate key/);
 await assert.rejects(db.query('select cookbook_document($1)',[book]),/permission denied/);
 // Even when a visitor owns a member recipe, its private status excludes it.
 await db.query("update recipes set visibility='private' where id=$1",[saved]);assert.equal((await entries(book)).length,1);assert.equal((await doc(book)).recipe_ids.length,1);
 await as(a);await db.query("update recipes set visibility='private' where id=$1",[pub]);
 await as(b);view=await doc(book);assert.deepEqual(view.recipe_ids,[]);assert.equal(view.cover,null);assert.deepEqual(await entries(book),[]);
 await as(a);await db.query('update cookbooks set cover_recipe_id=null where id=$1',[book]);await db.query("update cookbooks set visibility='private' where id=$1",[book]);
 await as(b);assert.equal(await doc(book),null);assert.deepEqual(await profile(a),[]);
 await as(a);await db.query("update cookbooks set visibility='public' where id=$1",[book]);await db.exec(`reset role;update profiles set is_private=true where id='${a}';`);
 await as(b);assert.equal(await doc(book),null);assert.deepEqual(await profile(a),[]);assert.deepEqual(await entries(book),[]);
 await as(a);assert.equal((await doc(book)).recipe_ids.length,3);
 await db.exec("reset role;set role anon;set request.jwt.claim.sub='';");await assert.rejects(doc(book),/permission denied/);await assert.rejects(profile(a),/permission denied/);await assert.rejects(entries(book),/permission denied/);
 }finally{await db.close()}
});
