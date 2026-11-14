import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
function harness(){const classes=()=>({values:new Set(),add(value){this.values.add(value)},remove(value){this.values.delete(value)},toggle(value,on){on?this.values.add(value):this.values.delete(value)}}),nodes=new Map(),nav=['home','discover','recipes','planner','inventory'].map(view=>({dataset:{view},classList:classes()})),calls=[],history=[];
 const context=vm.createContext({detailRequest:0,libraryTab:'created',activeUserId:'user',sessionVersion:1,location:{pathname:'/',search:'',hash:''},history:{pushState(_state,_title,url){history.push(url);context.location.hash=url.includes('#')?'#'+url.split('#')[1]:''}},$:selector=>{if(!nodes.has(selector))nodes.set(selector,{classList:classes(),remove(){}});return nodes.get(selector)},$$:selector=>selector==='.nav-item'?nav:['[data-meal-page]','[data-recipe-page]'].includes(selector)?[]:[...nodes.values()],scrollTo(){},home(){calls.push('home')},plannerView(){calls.push('planner')},shoppingView(){calls.push('shopping')},inventoryView(){calls.push('inventory')},recipesView(){calls.push('recipes')},refreshLibrary:async()=>{},toast(){}});
 vm.runInContext(source.slice(source.indexOf('function show(v'),source.indexOf('function toast(')),context);
 vm.runInContext(source.slice(source.indexOf('async function openSharedRoute('),source.indexOf("window.addEventListener('hashchange'")),context);
 return{context,nav,calls,history};
}
test('shopping and weekly overview are addressable pages with Meal Plan active',async()=>{const {context:c,nav,calls,history}=harness();c.show('planner');assert.equal(c.location.hash,'#/meal-plan/weekly');c.show('shopping');assert.equal(c.location.hash,'#/meal-plan/shopping');assert.equal(nav.find(n=>n.dataset.view==='planner').classList.values.has('active'),true);assert.equal(calls.at(-1),'shopping');const count=history.length;
 c.location.hash='#/meal-plan/weekly';await c.openSharedRoute({type:'hashchange'});assert.equal(calls.at(-1),'planner');assert.equal(history.length,count);
 c.location.hash='#/meal-plan/shopping';await c.openSharedRoute();assert.equal(calls.at(-1),'shopping');assert.equal(history.length,count);
});
test('primary navigation restores the proper page when returning from shopping',async()=>{const {context:c,nav,calls}=harness();c.location.hash='#/inventory';await c.openSharedRoute();assert.equal(calls.at(-1),'inventory');c.location.hash='#/discover';await c.openSharedRoute();assert.equal(nav.find(n=>n.dataset.view==='discover').classList.values.has('active'),true);c.location.hash='';await c.openSharedRoute({type:'hashchange'});assert.equal(calls.at(-1),'home');
 c.activeUserId=null;c.location.hash='#/meal-plan/shopping';const count=calls.length;await c.openSharedRoute();assert.equal(calls.length,count);
});

test('restoring an authenticated session preserves a direct shopping subpage URL',async()=>{const {context:c,history,calls}=harness();Object.assign(c,{libraryRequest:0,routeRequest:0,coverBlobs:new Set(),purchasePending:new Set(),URL:{revokeObjectURL(){}},window:{},clearCatalogue(){},clearSubstitutions(){},clearCategoryColours(){},loadState(){},dateKey:()=> '2026-11-09',currentWeek:()=>[new Date()]});
 vm.runInContext(source.slice(source.indexOf('function switchAccount(userId)'),source.indexOf('async function currentUser(')),c);
 c.location.hash='#/meal-plan/shopping';c.switchAccount('another-user');assert.equal(c.location.hash,'#/meal-plan/shopping');assert.equal(history.length,0);await c.openSharedRoute();assert.equal(calls.at(-1),'shopping');
});

test('Created and Saved are separate recipe URLs, including direct entry and return navigation',async()=>{const {context:c,history}=harness();c.location.hash='#/recipes/saved';await c.openSharedRoute();assert.equal(c.libraryTab,'saved');assert.equal(history.length,0);c.location.hash='#/recipes/created';await c.openSharedRoute();assert.equal(c.libraryTab,'created');c.libraryTab='saved';c.show('recipes');assert.equal(c.location.hash,'#/recipes/saved');});
