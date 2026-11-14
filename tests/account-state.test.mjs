import {dateKey,cleanRecipeSources} from '../planning.mjs';
import {currentWeek} from '../calendar.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {readAccountState,writeAccountState} from '../account-state.mjs';
function storage(){const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)}}
test('two accounts retain separate lists across logout and reload',()=>{
 const store=storage(),a={plans:[{recipe:'a'}],shopping:[{name:'Rice'}]},b={plans:[],shopping:[{name:'Milk'}]};
 writeAccountState(store,'a',a);writeAccountState(store,'b',b);writeAccountState(store,null,b);
 assert.deepEqual(readAccountState(store,'a'),a);assert.deepEqual(readAccountState(store,'b'),b);
 assert.deepEqual(readAccountState(store,null),{plans:[],shopping:[]});
});
test('unowned legacy state is preserved without being exposed to a new account',()=>{
 const store=storage(),legacy=JSON.stringify({plans:[{recipe:'private'}],shopping:[{name:'Private'}]});
 store.setItem('mise-and-meal-state-v1',legacy);
 assert.deepEqual(readAccountState(store,'new'),{plans:[],shopping:[]});
 assert.equal(store.getItem('mise-and-meal-state-v1'),legacy);
});
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
function harness(){
 const pending=[],nodes=new Map(),store=storage();
 const context=vm.createContext({dateKey,cleanRecipeSources,currentWeek,readAccountState,writeAccountState,localStorage:store,console,readOftenBought:()=>[],clearSubstitutions(){},loadSubstitutions:async()=>{},clearCatalogue(){},clearCategoryColours(){},loadCategoryColours:async()=>{},ingredientCategoryPreferences:async()=>new Map(),recipes:[],inventory:{},plans:[],shopping:[],currentRecipe:null,cookStep:0,window:{dispatchEvent(){}},CustomEvent:class {},renderActiveProfileControl(){},URL:{revokeObjectURL(){}},coverBlobs:new Set(),hydrateCovers:async rows=>rows,createdRecipes:()=>context.recipes||[],refreshLibrary:async()=>{},restoreReferencedRecipes:async()=>{},openSharedRoute(){},home(){},show(){},toast(){},$:id=>{if(['#recipe-peek','#planner-recipe-picker','#post-cook-feedback'].includes(id))return null;if(!nodes.has(id))nodes.set(id,{innerHTML:'old account'});return nodes.get(id)},document:{querySelector(){return null}},mapRecipe:row=>row,supabase:{from(){return {select(){return this},eq(){return this},order(){return new Promise(resolve=>pending.push(resolve))}}}}});
 const state=source.slice(source.indexOf('let activeUserId='),source.indexOf('async function currentUser'));
 const loader=source.slice(source.indexOf('async function loadDatabase('),source.indexOf('async function uploadRecipeCover'));
 vm.runInContext(state+loader,context);return {context,pending,nodes,store};
}
test('stale success and failure cannot replace the new account kitchen or lists',async()=>{
 for(const fails of [false,true]){
  const {context:c,pending,store}=harness();writeAccountState(store,'b',{plans:[{recipe:'b'}],shopping:[{name:'B list'}]});
  const a=c.loadDatabase({user:{id:'a'}}),b=c.loadDatabase({user:{id:'b'}});
  pending[1]({data:[{id:'b'}]});await new Promise(setImmediate);
  pending[2]({data:[{id:'b'}]});pending[3]({data:[]});await b;
  pending[0](fails?{error:{message:'old error'}}:{data:[{id:'a'}]});await a;
  assert.equal(vm.runInContext('activeUserId',c),'b');assert.equal(c.recipes[0].id,'b');
  assert.equal(c.shopping[0].name,'B list');assert.equal(c.plans[0].recipe,'b');
 }
});
test('logout clears kitchen, shopping, cooking and rendered content and ignores pending loads',async()=>{
 const {context:c,pending,nodes}=harness();const load=c.loadDatabase({user:{id:'a'}});
 c.shopping=[{name:'Private'}];c.currentRecipe={id:'private'};
 await c.loadDatabase(null);pending[0]({data:[{id:'a'}]});await load;
 assert.equal(c.recipes.length,0);assert.equal(c.shopping.length,0);assert.equal(c.currentRecipe,null);
 for(const node of nodes.values())assert.equal(node.innerHTML,'');
});
