import test from 'node:test';
import assert from 'node:assert/strict';
import {recipeChecks,remainingInventory} from '../cooking.mjs';
import {addSelectedIngredients} from '../planning.mjs';
const recipe={id:'salad',name:'Salad',servings:2,ingredients:[['Tomatoes',300,'g','','tomato']]};
const rules=[{ingredient_id:'tomato',substitute_id:'cherry'}];
const stock={'Cherry tomatoes':{ingredientId:'cherry',qty:0.5,unit:'kg'},'Tomato paste':{ingredientId:'paste',qty:1000,unit:'g'},'Canned tomatoes':{ingredientId:'canned',qty:1000,unit:'g'}};
test('alternatives require explicit rules and confirmation; tomato products stay separate',()=>{
 const [row]=recipeChecks(recipe,stock,2,rules);
 assert.equal(row.missing,300);assert.equal(row.item,undefined);assert.deepEqual(row.alternatives.map(x=>x.id),['cherry']);assert.equal(remainingInventory(row),null);
 assert.equal(recipeChecks(recipe,stock,2,[])[0].alternatives.length,0);
});
test('confirmed one-way substitution uses stable ID, scaled quantities and actual stock unit',()=>{
 const [row]=recipeChecks(recipe,stock,4,rules,{tomato:'cherry'});
 assert.equal(row.name,'Cherry tomatoes');assert.equal(row.originalName,'Tomatoes');assert.equal(row.missing,100);assert.equal(row.ingredientId,'cherry');
 assert.deepEqual(remainingInventory(row),{before:0.5,after:0,unit:'kg'});
 const cart=addSelectedIngredients([], [row],['0'],recipe,[recipe]);assert.equal(cart[0].name,'Cherry tomatoes');assert.equal(cart[0].qty,100);assert.equal(cart[0].ingredientId,'cherry');
 const reverse={servings:2,ingredients:[['Cherry tomatoes',200,'g','','cherry']]};
 assert.equal(recipeChecks(reverse,{Tomatoes:{ingredientId:'tomato',qty:500,unit:'g'}},2,rules)[0].alternatives.length,0);
});
test('mismatched units, stale choices, unapproved products and depleted stock cannot deduct',()=>{
 for(const [inventory,choice] of [[{'Cherry tomatoes':{ingredientId:'cherry',qty:12,unit:'piece'}},'cherry'],[{},'cherry'],[stock,'paste'],[{'Cherry tomatoes':{ingredientId:'cherry',qty:0,unit:'g'}},'cherry']]){
  const [row]=recipeChecks(recipe,inventory,2,rules,{tomato:choice});assert.equal(row.substituted,false);assert.equal(row.invalidChoice,true);assert.equal(remainingInventory(row),null);
 }
});
test('one stock item cannot be counted twice across original or alternative ingredients',()=>{
 const combined={servings:2,ingredients:[...recipe.ingredients,['Cherry tomatoes',100,'g','','cherry']]};
 assert.equal(recipeChecks(combined,stock,2,rules,{tomato:'cherry'})[0].substituted,false);
 const two={servings:2,ingredients:[...recipe.ingredients,['Red tomatoes',100,'g','','red']]};
 const rows=recipeChecks(two,stock,2,[...rules,{ingredient_id:'red',substitute_id:'cherry'}],{tomato:'cherry',red:'cherry'});
 assert.equal(rows[0].substituted,true);assert.equal(rows[1].substituted,false);
});
test('flexible substituted amounts remain flexible and never auto-deduct',()=>{
 const flexible={...recipe,ingredients:[['Tomatoes',null,'to taste','','tomato']]};
 const [row]=recipeChecks(flexible,stock,10,rules,{tomato:'cherry'});assert.equal(row.name,'Cherry tomatoes');assert.equal(row.need,null);assert.equal(row.status,'ready');assert.equal(remainingInventory(row),null);
});
