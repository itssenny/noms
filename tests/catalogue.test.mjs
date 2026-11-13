import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=(await readFile(new URL('../ingredients.js',import.meta.url),'utf8')).replace("import { supabase } from './supabase-client.js';",'').replaceAll('export ','');
function setup(found=[],failure=null){
 const calls=[];let mode='read';
 const query={select(){return this},eq(...args){calls.push(['eq',...args]);return this},limit:async()=>({data:found,error:failure}),insert(value){mode='insert';calls.push(['insert',value]);return this},update(value){mode='update';calls.push(['update',value]);return this},single:async()=>({data:{id:'new',created_by:'user',canonical_name:'Pasta',default_unit:'g'},error:failure})};
 const context=vm.createContext({supabase:{auth:{getUser:async()=>({data:{user:{id:'user'}}})},from(){return query}},document:{addEventListener(){}},clearTimeout,setTimeout});
 vm.runInContext(source,context);return {context,calls};
}
test('creates an owned catalogue ingredient with normalized name and chosen unit',async()=>{
 const {context:c,calls}=setup();const row=await c.saveCatalogueIngredient({name:'  Rice   noodles  ',category:'Carbohydrates',unit:'g'});
 assert.equal(row.id,'new');const saved=calls.find(x=>x[0]==='insert')[1];assert.equal(saved.canonical_name,'Rice noodles');assert.equal(saved.created_by,'user');assert.equal(saved.default_unit,'g');
});
test('existing names are reused rather than inserted; conflicting renames are rejected',async()=>{
 const {context:c,calls}=setup([{id:'shared',canonical_name:'Pasta',created_by:null}]);
 assert.equal((await c.saveCatalogueIngredient({name:'pasta',category:'Carbohydrates',unit:'g'})).id,'shared');assert.equal(calls.some(x=>x[0]==='insert'),false);
 await assert.rejects(c.saveCatalogueIngredient({id:'own',name:'Pasta',category:'Other',unit:'piece'}),/already exists/);
});
test('custom edit targets the current owner and preserves the selected ID',async()=>{
 const {context:c,calls}=setup([{id:'own',created_by:'user'}]);await c.saveCatalogueIngredient({id:'own',name:'New name',category:'Other',unit:'kg'});
 assert.ok(calls.some(x=>x[0]==='eq'&&x[1]==='created_by'&&x[2]==='user'));assert.ok(calls.some(x=>x[0]==='eq'&&x[1]==='id'&&x[2]==='own'));assert.equal(calls.some(x=>x[0]==='insert'),false);
});
test('empty names and invalid units are rejected and missing setup is explained',async()=>{
 const {context:c}=setup();await assert.rejects(c.saveCatalogueIngredient({name:' ',category:'Other',unit:'g'}),/name/);await assert.rejects(c.saveCatalogueIngredient({name:'Rice',category:'Other',unit:'invalid'}),/unit/);
 assert.match(c.catalogueError({code:'42703',message:'column default_unit does not exist'}),/007_editable/);
 const {context:d}=setup([],{code:'42703'});await assert.rejects(d.saveCatalogueIngredient({name:'Pasta',category:'Other',unit:'g'}),/007_editable/);
});
