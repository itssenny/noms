import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRecipeQuantity,quantityLabel,recipeChecks,needsPurchase,remainingInventory} from '../cooking.mjs';
import {addSelectedIngredients,sourceRecipes} from '../planning.mjs';
test('blank quantities and cook-choice measures stay null; invalid numeric amounts fail',()=>{
 for(const [value,unit] of [['','g'],[' ','ml'],['5','to taste'],['2','as needed']])assert.equal(parseRecipeQuantity(value,unit),null);
 assert.equal(parseRecipeQuantity('2.5','g'),2.5);
 for(const value of ['0','-2','abc'])assert.throws(()=>parseRecipeQuantity(value,'g'));
});
test('flexible labels never scale or invent an amount',()=>{
 assert.equal(quantityLabel(null,'g',4),'As needed');assert.equal(quantityLabel(null,'to taste',4),'To taste');assert.equal(quantityLabel(20,'g',4),'80 g');
});
test('flexible ingredients use stock presence and never deduct unknown usage',()=>{
 const recipe={servings:2,ingredients:[['Salt',null,'to taste','','salt']]};
 const [stocked]=recipeChecks(recipe,{salt:{ingredientId:'salt',qty:100,unit:'g'}},8);
 assert.equal(needsPurchase(stocked),false);assert.equal(remainingInventory(stocked),null);
 assert.equal(needsPurchase(recipeChecks(recipe,{})[0]),true);
});
test('flexible shopping additions retain null quantity and share recipe labels',()=>{
 const recipes=[{id:'a',name:'A'},{id:'b',name:'B'}],rows=[{name:'Salt',ingredientId:'salt',isFlexible:true,need:null,missing:null,unit:'to taste'}];
 let cart=addSelectedIngredients([],rows,['0'],recipes[0],recipes);
 cart=addSelectedIngredients(cart,rows,['0'],recipes[1],recipes);
 assert.equal(cart.length,1);assert.equal(cart[0].qty,null);assert.equal(sourceRecipes(cart[0],recipes).length,2);
 const numeric=addSelectedIngredients([{name:'Salt',ingredientId:'salt',qty:100,unit:'g',checked:false}],rows,['0'],recipes[0],recipes);
 assert.equal(numeric.length,1);assert.equal(numeric[0].qty,100);
});
