import {detachRecipeSources} from '../planning.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
const record={name:'Edited',cuisine:'Other',tags:[],time:20,prep:5,cook:15,difficulty:'Easy',servings:2,steps:['Cook'],imageUrl:'old-cover',source:'https://example.com/recipe',ingredients:[['Rice',200,'g','rinsed','ingredient-id']]};
function setup(){
 const calls=[],nodes=new Map(),context=vm.createContext({detachRecipeSources,sessionVersion:1,recipes:[{id:'r'},{id:'other'}],plans:[{recipe:'r'},{recipe:'other'}],currentRecipe:{id:'r'},shopping:[{name:'Rice',qty:100}],currentUser:async()=>({id:'user'}),uploadRecipeCover:async()=> 'new-cover',hydrateCovers:async rows=>rows,saveState:()=>true,home(){},show(){},toast(){},$:id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'old'});return nodes.get(id)},supabase:{rpc:async(name,args)=>{calls.push({name,args});return {data:'r'}},from(){return{delete(){return this},eq(){return this},select(){return this},single:async()=>({data:{share_code:'ABC234'}}),then(resolve){resolve({data:[{id:'r'}]})}}}}});
 vm.runInContext(source.slice(source.indexOf('function recipePayload('),source.indexOf('async function upsertInventory(')),context);return {context,calls};
}
test('edit keeps cover without a replacement and sends stable ingredient IDs',async()=>{
 const {context:c,calls}=setup();const result=await c.updateRecipe('r',structuredClone(record),{size:0});
 assert.equal(result.id,'r');assert.equal(result.imageUrl,'old-cover');assert.equal(calls[0].name,'update_recipe');
 assert.equal(calls[0].args.p_ingredients[0].ingredient_id,'ingredient-id');assert.equal(calls[0].args.p_recipe.source_url,record.source);
 assert.equal(calls[0].args.p_recipe.source,null);
});
test('cover replacement and missing migration errors are handled',async()=>{
 const {context:c}=setup();assert.equal((await c.updateRecipe('r',structuredClone(record),{size:10})).imageUrl,'new-cover');
 c.supabase.rpc=async()=>({error:{code:'PGRST202',message:'missing'}});
 await assert.rejects(c.updateRecipe('r',structuredClone(record),null),/006_recipe_edit.sql/);
});
test('deletion cleans only matching plans and leaves shopping untouched',async()=>{
 const {context:c}=setup();await c.deleteRecipe('r');assert.equal(c.recipes.length,1);assert.equal(c.plans.length,1);assert.equal(c.plans[0].recipe,'other');assert.equal(c.shopping[0].qty,100);assert.equal(c.currentRecipe,null);
});
test('failed or unauthorized deletion leaves local data intact',async()=>{
 const {context:c}=setup();c.supabase.from=()=>({delete(){return this},eq(){return this},select:async()=>({data:[]})});
 await assert.rejects(c.deleteRecipe('r'),/access denied/);assert.equal(c.recipes.length,2);assert.equal(c.plans.length,2);
});

test('editing persists the selected baking time without changing its minutes',async()=>{
 const {context:c,calls}=setup();await c.updateRecipe('r',{...structuredClone(record),cookTimeType:'baking'},null);assert.equal(calls[0].args.p_recipe.cook_time_type,'baking');assert.equal(calls[0].args.p_recipe.cook_minutes,15);
});
