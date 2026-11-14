import test from 'node:test';import assert from 'node:assert/strict';import {filterRecipes,filterInventory,categoryColour,categoryColours} from '../list-models.mjs';
const recipes=[{id:'a',name:'Apple curry',ingredients:[['Rice']],tags:['Dinner'],cuisine:'Indian',difficulty:'Hard',rating:3,time:60},{id:'b',name:'Bean salad',ingredients:[['Beans']],tags:['Lunch'],difficulty:'Easy',rating:5,time:10},{id:'c',name:'Carrot soup',ingredients:[['Carrots']],tags:['Dinner'],difficulty:'Medium',rating:4,time:30}];
test('recipe filters combine search, tags, difficulty and readiness',()=>{
 assert.deepEqual(filterRecipes(recipes,{tag:'Dinner',difficulty:'Medium',search:'carrot',ready:true},['c']).map(r=>r.id),['c']);assert.equal(filterRecipes(recipes,{tag:'Lunch',difficulty:'Hard'}).length,0);
});
test('recipe sorts cover both directions of time, rating, difficulty and name',()=>{
 for(const [sort,expected] of [['az','abc'],['za','cba'],['time-asc','bca'],['time-desc','acb'],['rating-desc','bca'],['rating-asc','acb'],['difficulty-asc','bca'],['difficulty-desc','acb']])assert.equal(filterRecipes(recipes,{sort}).map(r=>r.id).join(''),expected);assert.equal(recipes[0].id,'a');
});
test('inventory status sorts and location/name filters stay combined',()=>{
 const inventory={Apple:{qty:0,threshold:1,location:'Pantry'},Beans:{qty:100,threshold:10,location:'Pantry'},Carrots:{qty:2,threshold:3,location:'Fridge'}};
 assert.deepEqual(filterInventory(inventory,{sort:'stock'}).map(([name])=>name),['Beans','Carrots','Apple']);assert.deepEqual(filterInventory(inventory,{sort:'low'}).map(([name])=>name),['Apple','Carrots','Beans']);assert.deepEqual(filterInventory(inventory,{sort:'za',location:'Pantry',search:'a'}).map(([name])=>name),['Beans','Apple']);
});
test('category colours are distinct and unknown category colours are stable',()=>{assert.equal(new Set(Object.values(categoryColours)).size,Object.keys(categoryColours).length);assert.equal(categoryColour('My category'),categoryColour('My category'));assert.notEqual(categoryColour('Dairy'),categoryColour('Vegetables'))});
test('personal category colours override defaults, validate stored values, and can be cleared',async()=>{
 const {categoryColour,setCategoryColourOverrides,defaultCategoryColour}=await import('../list-models.mjs');
 try{setCategoryColourOverrides([{category:'Dairy',colour:'#ABC123'},{category:'Meat',colour:'red'}]);assert.equal(categoryColour('Dairy'),'#abc123');assert.equal(categoryColour('Meat'),defaultCategoryColour('Meat'));assert.match(defaultCategoryColour('Custom'),/^#[0-9a-f]{6}$/);setCategoryColourOverrides([]);assert.equal(categoryColour('Dairy'),defaultCategoryColour('Dairy'))}finally{setCategoryColourOverrides([])}
});
