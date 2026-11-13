import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {readAccountState,writeAccountState} from '../account-state.mjs';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
const recipe={id:'recipe-a',name:'Rice bowl',servings:2};
function form(values){return {get:key=>key in values?values[key]:null,getAll:key=>values[key]||[]}}
function setup(){
 const store=new Map(),storage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
 const context=vm.createContext({plans:[{id:123,recipe:recipe.id,day:'Monday',slot:'Dinner',servings:2}],shopping:[{name:'Rice',qty:50,unit:'g',sources:['Manual'],checked:false}],recipes:[recipe],crypto:{randomUUID:()=> 'new-id'},checks:(r,s)=>[{name:'Rice',missing:100*s/r.servings,unit:'g'}],saveState:()=>{writeAccountState(storage,'a',{plans:context.plans,shopping:context.shopping});return true}});
 vm.runInContext(source.slice(source.indexOf('function savePlannedMeal('),source.indexOf('const recipeUnits')),context);
 // addShop lives after these planner helpers.
 const start=source.indexOf('function addShop(');vm.runInContext(source.slice(start,source.indexOf('\n',start)),context);
 return {context,storage};
}
test('editing moves the existing meal without duplication or shopping changes, and persists',()=>{
 const {context:c,storage}=setup();
 c.savePlannedMeal(form({'plan-id':'123',recipe:recipe.id,day:'Friday',slot:'Lunch',servings:'4'}));
 assert.equal(c.plans.length,1);assert.equal(c.plans[0].id,123);assert.equal(c.plans[0].day,'Friday');assert.equal(c.plans[0].servings,4);
 assert.equal(c.shopping[0].qty,50);assert.equal(readAccountState(storage,'a').plans[0].slot,'Lunch');
});
test('only explicitly selected additions use the updated servings',()=>{
 const {context:c}=setup();c.savePlannedMeal(form({'plan-id':'123',recipe:recipe.id,day:'Monday',slot:'Dinner',servings:'4',missing:['0']}));
 assert.equal(c.shopping[0].qty,250);assert.equal(c.shopping[0].sources.includes(recipe.name),true);
});
test('removal persists and retains shopping, and creating assigns a new ID',()=>{
 const {context:c,storage}=setup();c.removePlannedMeal('123');assert.equal(c.plans.length,0);assert.equal(c.shopping[0].qty,50);assert.equal(readAccountState(storage,'a').plans.length,0);
 c.savePlannedMeal(form({recipe:recipe.id,day:'Sunday',slot:'Brunch',servings:'2'}));assert.equal(c.plans[0].id,'new-id');
});
test('invalid or stale edits do not alter state; failed persistence rolls changes back',()=>{
 const {context:c}=setup();const before=JSON.stringify({plans:c.plans,shopping:c.shopping});
 for(const extra of [{'plan-id':'gone'},{servings:'0'},{day:'Never'}])assert.throws(()=>c.savePlannedMeal(form({'plan-id':'123',recipe:recipe.id,day:'Monday',slot:'Dinner',servings:'2',...extra})));
 c.saveState=()=>false;
 assert.throws(()=>c.savePlannedMeal(form({'plan-id':'123',recipe:recipe.id,day:'Monday',slot:'Dinner',servings:'4',missing:['0']})),/could not be saved/);
 assert.equal(JSON.stringify({plans:c.plans,shopping:c.shopping}),before);
 assert.throws(()=>c.removePlannedMeal('123'),/could not be removed/);assert.equal(c.plans.length,1);
});
