import test from 'node:test';
import assert from 'node:assert/strict';
import {recipeChecks,remainingInventory,convertQuantity,postCookQuantity} from '../cooking.mjs';
const recipe={servings:2,ingredients:[['Rice',200,'g','', 'rice']]};
test('matches stable IDs despite changed labels and scales portions in stock units',()=>{
 const [row]=recipeChecks(recipe,{'Renamed rice':{ingredientId:'rice',qty:1,unit:'kg',threshold:0.1}},4);
 assert.equal(row.need,400);assert.equal(row.have,1000);assert.equal(row.missing,0);
 assert.deepEqual(remainingInventory(row),{before:1,after:0.6,unit:'kg'});
});
test('missing stock and a same-name different ID never become deduction targets',()=>{
 for(const inventory of [{},{Rice:{ingredientId:'different',qty:1000,unit:'g'}}]){
  const [row]=recipeChecks(recipe,inventory);assert.equal(row.missing,200);assert.equal(remainingInventory(row),null);
 }
});
test('incompatible units require manual review and never deduct',()=>{
 const [row]=recipeChecks(recipe,{Rice:{ingredientId:'rice',qty:2,unit:'cup'}});
 assert.equal(row.compatible,false);assert.equal(row.status,'missing');assert.equal(remainingInventory(row),null);
 assert.equal(convertQuantity(1,'g','ml'),null);assert.equal(convertQuantity(1,'other','other'),null);
});
test('supported unit conversions and insufficient stock remain safe',()=>{
 assert.equal(convertQuantity(1,'l','ml'),1000);assert.equal(convertQuantity(2,'pcs','piece'),2);
 const [row]=recipeChecks(recipe,{Rice:{ingredientId:'rice',qty:0.1,unit:'kg'}});
 assert.equal(row.missing,100);assert.equal(remainingInventory(row).after,0);
});

test('stock with an unspecified amount counts as present without inventing a deduction',()=>{
 const inventory={Rice:{ingredientId:'rice',qty:null,unit:'g',threshold:250}};
 const [row]=recipeChecks(recipe,inventory);assert.equal(row.status,'ready');assert.equal(row.quantityUnknown,true);assert.equal(row.missing,null);assert.equal(remainingInventory(row),null);
 const [flexible]=recipeChecks({...recipe,ingredients:[['Rice',null,'g','','rice']]},inventory);assert.equal(flexible.status,'ready');assert.equal(remainingInventory(flexible),null);
});
test('post-cook choices preserve, clear, finish, or precisely update tracked stock',()=>{
 assert.equal(postCookQuantity('unchanged'),undefined);
 assert.equal(postCookQuantity('unknown'),null);
 assert.equal(postCookQuantity('empty'),0);
 assert.equal(postCookQuantity('exact','125'),125);
 assert.equal(postCookQuantity('exact','0'),0);
 assert.throws(()=>postCookQuantity('exact',''));
 assert.throws(()=>postCookQuantity('exact','-1'));
 assert.throws(()=>postCookQuantity('other'));
});
