import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {recipeChecks,convertQuantity,hasIngredientStock,recipeAvailabilityLabel,needsPurchase} from '../cooking.mjs';
const recipe={id:'pancakes',name:'Sweet potato pancakes',servings:2,ingredients:[['Sweet potato',1,'piece','','potato'],['Flour',1,'cup','','flour'],['Milk',2,'tbsp','','milk']]};
const stock={Potato:{ingredientId:'potato',qty:2,unit:'pcs'},Flour:{ingredientId:'flour',qty:2,unit:'cup'},Milk:{ingredientId:'milk',qty:1,unit:'cup'}};
test('stocked pancake ingredients in convertible units are ready on both screens',()=>{
 const rows=recipeChecks(recipe,stock);
 assert.ok(rows.every(hasIngredientStock));assert.ok(rows.every(row=>!needsPurchase(row)));
 assert.equal(recipeAvailabilityLabel(rows),'Ready to cook');
 assert.equal(convertQuantity(1,'cups','tablespoons'),16);
 assert.equal(convertQuantity(1,'lb','oz'),16);
 assert.equal(convertQuantity(1,'g','cup'),null);
});
test('absent ingredients, short quantities and uncomparable units are distinct',()=>{
 const rows=recipeChecks(recipe,{Flour:{...stock.Flour,qty:0.5}});
 assert.equal(recipeAvailabilityLabel(rows),'Missing 2 · Top up 1');
 const unknownUnits=recipeChecks(recipe,{...stock,Flour:{...stock.Flour,unit:'g'}});
 assert.equal(recipeAvailabilityLabel(unknownUnits),'Check units 1');
 assert.equal(unknownUnits.filter(hasIngredientStock).length,3);
 const unknownAmounts=recipeChecks(recipe,{...stock,Flour:{...stock.Flour,qty:null,unit:'g'}});
 assert.equal(recipeAvailabilityLabel(unknownAmounts),'Ready to cook');
});
test('inactive stock is absent and serving changes still reveal shortages',()=>{
 assert.equal(recipeAvailabilityLabel(recipeChecks(recipe,{...stock,Milk:{...stock.Milk,isActive:false}})),'Missing 1');
 assert.equal(recipeAvailabilityLabel(recipeChecks(recipe,stock,8)),'Top up 2');
});
test('conversion roundoff does not create a phantom shortage',()=>{
 const r={servings:1,ingredients:[['Milk',0.1+0.2,'ml','','milk']]};
 assert.equal(recipeAvailabilityLabel(recipeChecks(r,{Milk:{ingredientId:'milk',qty:0.3,unit:'ml'}})),'Ready to cook');
});
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
test('recipe cards render the classified count instead of labelling stocked items missing',()=>{
 const c=vm.createContext({cookbookAction:()=>'',checks:r=>recipeChecks(r,{Flour:{...stock.Flour,qty:0.5}}),needsPurchase,recipeAvailabilityLabel,recipeColour:()=>'',escapeHtml:String,recipeVisual:()=>'',icon:()=>'',recipeAttribution:()=>'',recipeTagsMarkup:()=>'',communityRatingMarkup:()=>''});
 vm.runInContext(source.slice(source.indexOf('function card('),source.indexOf('\nfunction home(')),c);
 assert.match(c.card(recipe),/Missing 2 · Top up 1/);assert.doesNotMatch(c.card(recipe),/Missing 3/);
});
