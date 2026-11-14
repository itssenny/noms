import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import {filterInventory} from '../list-models.mjs';import {stockStatus} from '../stock-model.mjs';import {recipeChecks,needsPurchase,remainingInventory} from '../cooking.mjs';
const sql=async name=>readFile(new URL(`../db/supabase/${name}`,import.meta.url),'utf8'),{PGlite}=await import(process.env.PGLITE_MODULE);
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
test('tracking migration preserves records, isolates users, rejects stocked deactivation, and restocks without duplicates',async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values ('${a}'),('${b}');`);
 await db.exec((await sql('001_core_recipe_inventory.sql')).replace('create extension if not exists pgcrypto;',''));
 for(const name of ['007_editable_ingredient_catalogue.sql','011_shopping_inventory_receipts.sql','012_optional_stock_quantities.sql','017_inventory_stock_status.sql'])await db.exec(await sql(name));
 const ingredient=(await db.query("insert into ingredients(canonical_name) values ('Lemon') returning id")).rows[0].id;
 const stock=(await db.query(`insert into inventory(user_id,ingredient_id,quantity,unit,storage_location,low_stock_threshold) values ('${a}','${ingredient}',0,'piece','Fridge',1) returning id`)).rows[0].id;
 await db.exec(`insert into inventory(user_id,ingredient_id,quantity,unit,storage_location,low_stock_threshold) values ('${b}','${ingredient}',5,'piece','Pantry',1)`);
 const recipe=(await db.query(`insert into recipes(user_id,name) values ('${a}','Lemon rice') returning id`)).rows[0].id;
 await db.exec(`insert into recipe_ingredients(recipe_id,ingredient_id,quantity,unit) values ('${recipe}','${ingredient}',1,'piece')`);
 await db.exec(await sql('019_inventory_tracking.sql'));await db.exec(await sql('019_inventory_tracking.sql'));
 assert.equal((await db.query('select is_active from inventory where id=$1',[stock])).rows[0].is_active,true);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';update inventory set is_active=false where id='${stock}'`);
 assert.equal((await db.query('select id,is_active,quantity from inventory')).rows[0].is_active,false);
 assert.equal((await db.query('select ingredient_id from recipe_ingredients')).rows[0].ingredient_id,ingredient);
 await db.exec(`set request.jwt.claim.sub='${b}'`);assert.equal((await db.query('select is_active from inventory')).rows[0].is_active,true);assert.equal((await db.query('update inventory set is_active=true where id=$1 returning id',[stock])).rows.length,0);
 await assert.rejects(db.exec('update inventory set is_active=false'),/inactive_inventory_is_empty/);
 await db.exec(`set request.jwt.claim.sub='${a}';update inventory set is_active=true;update inventory set quantity=null`);
 await assert.rejects(db.exec('update inventory set is_active=false'),/inactive_inventory_is_empty/);
 await db.exec('update inventory set quantity=0,is_active=false');
 const receipt='10000000-0000-0000-0000-000000000001';const receive=()=>db.query('select receive_shopping_item($1,$2,2,$3,$4) value',[receipt,ingredient,'piece','Fridge']);
 let row=(await receive()).rows[0].value.inventory;assert.equal(row.id,stock);assert.equal(row.is_active,true);assert.equal(Number(row.quantity),2);assert.equal((await db.query('select id from inventory')).rows.length,1);
 await db.exec('update inventory set quantity=0,is_active=false');row=(await receive()).rows[0].value.inventory;assert.equal(row.is_active,false);assert.equal(Number(row.quantity),0);
 await db.exec('update inventory set quantity=null');row=(await db.query('select * from inventory')).rows[0];assert.equal(row.is_active,true);assert.equal(row.quantity,null);
 }finally{await db.close()}});
const inventory={Rice:{ingredientId:'rice',qty:10,threshold:2,location:'Pantry'},Milk:{ingredientId:'milk',qty:1,threshold:2,location:'Fridge'},Lemon:{ingredientId:'lemon',qty:0,threshold:1,location:'Fridge',isActive:false},Egg:{ingredientId:'egg',qty:0,threshold:1,location:'Fridge'}};
test('active, inactive, all and stock filters combine with location/search/sort',()=>{
 const names=options=>filterInventory(inventory,options).map(([name])=>name);
 assert.deepEqual(names({}),['Egg','Milk','Rice']);assert.deepEqual(names({tracking:'inactive'}),['Lemon']);assert.equal(names({tracking:'all'}).length,4);
 assert.deepEqual(names({status:'stock'}),['Rice']);assert.deepEqual(names({status:'low',location:'Fridge',search:'mi'}),['Milk']);assert.deepEqual(names({status:'out'}),['Egg']);assert.deepEqual(names({tracking:'all',status:'out',sort:'za'}),['Lemon','Egg']);
});
test('inactive ingredients remain recipe references but never supply quantities or substitutions',()=>{
 const recipe={servings:1,ingredients:[['Lemon',1,'piece','','lemon']]};let row=recipeChecks(recipe,inventory)[0];assert.equal(row.ingredientId,'lemon');assert.equal(row.status,'missing');assert.equal(needsPurchase(row),true);assert.equal(remainingInventory(row),null);
 row=recipeChecks(recipe,{Lemon:{...inventory.Lemon,qty:null}})[0];assert.equal(row.status,'missing');
 row=recipeChecks({servings:1,ingredients:[['Lime',null,'piece','','lime']]},inventory,1,[{ingredient_id:'lime',substitute_id:'lemon'}],{lime:'lemon'})[0];assert.equal(row.alternatives.length,0);assert.equal(row.status,'missing');assert.equal(inventory.Lemon.qty,0);
});
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
test('stock boxes are toggleable buttons, expose selection, and count only active out-of-stock ingredients',()=>{
 const nodes={},handlers=[];const context=vm.createContext({inventory,inventoryFilters:{tracking:'active',status:'all',search:'',location:'all',sort:'az'},filterInventory,stockStatus,escapeHtml:x=>x,icon:()=>'',invRows:rows=>rows.map(([name])=>name).join(','),$:selector=>nodes[selector]??=( {innerHTML:'',textContent:''}),$$:()=>[],document:{addEventListener:(name,fn)=>handlers.push(fn)}});
 vm.runInContext(source.slice(source.indexOf('function inventoryView(){'),source.indexOf('function stockFields(')),context);context.inventoryView();
 const markup=nodes['#inventory-view'].innerHTML;assert.match(markup,/data-inventory-status="stock" aria-pressed="false"><b>1<\/b>/);assert.match(markup,/data-inventory-status="out" aria-pressed="false"><b>1<\/b><span>Out of stock<\/span>/);assert.doesNotMatch(nodes['#inventory-body'].innerHTML,/Lemon/);
 for(const tracking of ['inactive','all']){context.inventoryFilters.tracking=tracking;context.inventoryView();assert.match(nodes['#inventory-view'].innerHTML,/data-inventory-status="out" aria-pressed="false"><b>1<\/b>/)}context.inventoryFilters.tracking='active';context.inventoryView();
 const start=source.indexOf("document.addEventListener('click',async event=>{\n const filter=event.target.closest('[data-inventory-status]')");vm.runInContext(source.slice(start,source.indexOf('\n});',start)+5),context);
 const event={target:{closest:selector=>selector==='[data-inventory-status]'?{dataset:{inventoryStatus:'stock'}}:null}};handlers[0](event);assert.equal(nodes['#inventory-body'].innerHTML,'Rice');handlers[0](event);assert.equal(context.inventoryFilters.status,'all');assert.equal(nodes['#inventory-body'].innerHTML,'Egg,Milk,Rice');
});
test('deactivation updates only the existing zero-stock owner record; failures preserve local state',async()=>{
 let saved=true,writes=[];const context=vm.createContext({inventory:structuredClone(inventory),stockStatus,sessionVersion:1,activeUserId:'a',currentUser:async()=>({id:'a'}),supabase:{from:table=>({update(values){writes.push({table,values,filters:[]});return this},eq(k,v){writes.at(-1).filters.push([k,v]);return this},select:async()=>({data:saved?[{id:'stock'}]:[]})})}});
 const start=source.indexOf('async function setInventoryActive(');vm.runInContext(source.slice(start,source.indexOf("\ndocument.addEventListener('click',async event=>{",start)),context);
 assert.equal(await context.setInventoryActive('egg',false),true);assert.equal(context.inventory.Egg.isActive,false);assert.deepEqual(writes[0].filters,[['user_id','a'],['ingredient_id','egg'],['quantity',0]]);
 assert.equal(await context.setInventoryActive('egg',true),true);assert.equal(context.inventory.Egg.isActive,true);
 await assert.rejects(context.setInventoryActive('rice',false),/Only out-of-stock/);saved=false;await assert.rejects(context.setInventoryActive('egg',false),/Stock changed/);assert.equal(context.inventory.Egg.isActive,true);
});
test('manual inventory additions reactivate the existing key even with zero amount and stale local membership',async()=>{
 let write;const context=vm.createContext({inventory:structuredClone(inventory),activeUserId:'a',currentUser:async()=>({id:'a'}),supabase:{from:()=>({upsert(values,options){write={values,options};return this},select(){return this},single:async()=>({data:{id:'lemon-stock',ingredient_id:'lemon'}})})}});
 const start=source.indexOf('async function upsertInventory(');vm.runInContext(source.slice(start,source.indexOf('\nconst $=',start)),context);
 const item={ingredientId:'lemon',qty:0,unit:'piece',location:'Pantry',threshold:1};context.inventory.Lemon.isActive=true;
 const saved=await context.upsertInventory('Lemon',item,'a');assert.equal(write.values.is_active,true);assert.equal(write.values.user_id,'a');assert.equal(write.values.ingredient_id,'lemon');assert.equal(write.options.onConflict,'user_id,ingredient_id');assert.equal(saved.id,'lemon-stock');assert.equal(saved.isActive,true);
});
