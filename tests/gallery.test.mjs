import test from 'node:test';
import assert from 'node:assert/strict';
import {recipeShelves} from '../gallery.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const now=new Date('2026-11-13T12:00:00Z');
const recipes=[{id:'a',name:'Salmon',rating:4,time:30,cuisine:'Japanese',tags:['Dinner'],lastCookedAt:'2026-11-12T12:00:00Z'},{id:'b',name:'Pasta',rating:5,time:45,cuisine:'Italian',lastCookedAt:'2026-08-01T12:00:00Z'},{id:'c',name:'Soup',rating:0,time:15,tags:['Lunch'],lastCookedAt:null}];
test('gallery rows use ratings and actual cooking history, not planned dates',()=>{
 const shelves=recipeShelves(recipes,{now});assert.deepEqual(shelves[0].recipes.map(r=>r.id),['b','a']);assert.deepEqual(shelves[1].recipes.map(r=>r.id),['a']);assert.deepEqual(shelves[2].recipes.map(r=>r.id),['b']);assert.deepEqual(shelves[3].recipes.map(r=>r.id),['c']);assert.equal(recipes[0].id,'a');
});
test('search, readiness, time and tag filters apply to every shelf',()=>{
 assert.deepEqual(recipeShelves(recipes,{now,filter:'quick'}).at(-1).recipes.map(r=>r.id),['a','c']);
 assert.deepEqual(recipeShelves(recipes,{now,filter:'ready',readyIds:['b']}).at(-1).recipes.map(r=>r.id),['b']);
 assert.deepEqual(recipeShelves(recipes,{now,tag:'Dinner',query:'japanese'}).at(-1).recipes.map(r=>r.id),['a']);
 assert.equal(recipeShelves(recipes,{now,query:'no match'}).every(shelf=>shelf.recipes.length===0),true);
});
test('absent, invalid and future history stays out of cooked rows',()=>{
 const shelves=recipeShelves(['invalid','2027-01-01',null].map((lastCookedAt,i)=>({id:i,name:String(i),lastCookedAt})),{now});assert.equal(shelves[1].recipes.length,0);assert.equal(shelves[2].recipes.length,0);assert.equal(shelves[3].recipes.length,3);
});
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
test('finishing cooking only opens a check-in and never writes made history automatically',()=>{
 const finish=source.slice(source.indexOf('function renderCook(){'),source.indexOf('function reconcile('));
 assert.ok(finish.includes('reconcile();'));assert.ok(finish.includes('openPostCookFeedback();')); assert.equal(source.includes('recordCookingCompletion'),false);
});
