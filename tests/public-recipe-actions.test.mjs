import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
const own={id:'own',userId:'a'},publicRecipe={id:'public',userId:'b',name:'Public pancakes',ingredients:[],temporary:true};
function harness(){
 let saved=false;const attrs={},writes=[],button={dataset:{saveRecipe:'public'},disabled:false,isConnected:true,setAttribute:(key,value)=>attrs[key]=value};
 const c=vm.createContext({sessionVersion:1,activeUserId:'a',recipes:[{...own},{...publicRecipe}],currentRecipe:{...publicRecipe},visitorRecipe:{...publicRecipe},plans:[],shopping:[],savedIds:new Set(),unavailableSaves:[],libraryRequest:0,window:{},escapeHtml:String,icon:()=>'<svg></svg>',toast(){},show(){throw new Error('Must stay on the recipe')},detail(){throw new Error('Must not redraw/reset the recipe')},recipesView(){throw new Error('Must not navigate to the library')},document:{querySelectorAll:()=>[button],querySelector:()=>null},createdRecipes:()=>c.recipes.filter(row=>row.userId==='a'),hydrateCovers:async rows=>rows,mapRecipe:row=>row,supabase:{from(table){writes.push(table);return {insert(){saved=true;return this},delete(){saved=false;return this},eq(){return this},then(resolve){return Promise.resolve({error:null}).then(resolve)}}},rpc:async name=>({data:name==='get_saved_recipes'?(saved?[{recipe_id:'public',recipe:{...publicRecipe,temporary:false}}]:[]):{...publicRecipe}})}});
 vm.runInContext(source.slice(source.indexOf('async function refreshLibrary('),source.indexOf('async function openSharedRoute(')),c);return {c,button,attrs,writes};
}
test('save then unsave only toggles the bookmark, keeps the current recipe and leaves actions usable',async()=>{
 const {c,button,attrs,writes}=harness(),current=c.currentRecipe;
 await c.toggleSaved('public',button);assert.equal(c.savedIds.has('public'),true);assert.equal(attrs['aria-pressed'],'true');assert.equal(attrs['aria-label'],'Unsave recipe');
 await c.toggleSaved('public',button);assert.equal(c.savedIds.has('public'),false);assert.equal(attrs['aria-pressed'],'false');assert.equal(c.currentRecipe,current);assert.ok(c.recipes.find(row=>row.id==='public').temporary);assert.equal(c.createdRecipes().length,1);assert.deepEqual(writes,['saved_recipes','saved_recipes']);
});
test('unsaved plan and shopping references restore without adding a Saved entry',async()=>{
 const {c,writes}=harness();c.recipes=[own];c.plans=[{recipe:'public'}];c.shopping=[{sourceIds:['public']}];await c.restoreReferencedRecipes();
 assert.equal(c.recipes.length,2);assert.equal(c.recipes[1].temporary,true);assert.equal(c.savedIds.size,0);assert.equal(writes.length,0);
});
test('stale public recipe fetches cannot populate the next account',async()=>{
 const {c}=harness();let resolve;c.recipes=[];c.plans=[{recipe:'public'}];c.supabase.rpc=()=>new Promise(r=>resolve=r);c.hydrateCovers=async()=>{throw new Error('Stale result must not hydrate')};const pending=c.restoreReferencedRecipes();c.sessionVersion=2;resolve({data:publicRecipe});await pending;assert.equal(c.recipes.length,0);
});
test('public detail has all three actions and no save prerequisite removes them',()=>{
 const detail=source.slice(source.indexOf('async function detail('),source.indexOf('function cooking('));for(const attr of ['data-start=','data-plan=','data-recipe-shopping='])assert.ok(detail.includes(attr));assert.equal(detail.includes("querySelectorAll('[data-start],[data-plan],[data-recipe-shopping]')"),false);
});
