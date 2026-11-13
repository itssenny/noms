import test from 'node:test';import assert from 'node:assert/strict';
import {readOftenBought,writeOftenBought,pinIngredient,addIndependentIngredient} from '../shopping-extra.mjs';
const rice={id:'rice',canonical_name:'Rice',default_unit:'g',category:'Carbohydrates'};
test('pinned staples are idempotent and private to the signed-in account',()=>{
 const map=new Map(),storage={getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value)},pins=pinIngredient([],rice);assert.equal(pinIngredient(pins,rice).length,1);writeOftenBought(storage,'a',pins);assert.deepEqual(readOftenBought(storage,'b'),[]);assert.deepEqual(readOftenBought(storage,null),[]);assert.deepEqual(readOftenBought(storage,'a'),pins);
});
test('independent additions preserve recipe labels, support unit conversion and never add a source',()=>{
 const cart=[{ingredientId:'rice',name:'Rice',qty:0.5,unit:'kg',checked:false,sourceIds:['recipe'],sources:['Bowl']}],next=addIndependentIngredient(cart,rice,250,'g');assert.equal(next[0].qty,0.75);assert.equal(cart[0].qty,0.5);assert.deepEqual(next[0].sourceIds,['recipe']);const fresh=addIndependentIngredient([],rice,100,'g');assert.deepEqual(fresh[0].sourceIds,[]);
});
test('as-needed and checked items are handled without inventing quantities or mixing incompatible units',()=>{
 const flexible=addIndependentIngredient([],rice,null,'g');assert.equal(flexible[0].qty,null);assert.equal(addIndependentIngredient(flexible,rice,100,'g')[0].qty,100);assert.equal(addIndependentIngredient([{...flexible[0],checked:true}],rice,1,'cup').length,2);assert.equal(addIndependentIngredient([{...flexible[0],qty:1,unit:'cup'}],rice,100,'g').length,2);assert.throws(()=>addIndependentIngredient([],rice,-1,'g'));
});
test('legacy name-only shopping items merge without treating different catalogue IDs as equal',()=>{
 const cart=[{name:'Rice',qty:100,unit:'g',checked:false,sources:['Bowl']}];const next=addIndependentIngredient(cart,rice,50,'g');assert.equal(next.length,1);assert.equal(next[0].qty,150);assert.equal(next[0].ingredientId,'rice');assert.equal(addIndependentIngredient([{...cart[0],ingredientId:'different'}],rice,50,'g').length,2);
});
test('a previously received or pending item is never reused for a new purchase',()=>{
 for(const state of [{receivedPurchase:true},{pendingPurchase:{quantity:100}}]){
  const cart=[{ingredientId:'rice',name:'Rice',qty:100,unit:'g',checked:false,receiptId:'old-receipt',...state}];const next=addIndependentIngredient(cart,rice,50,'g');assert.equal(next.length,2);assert.equal(next[1].qty,50);assert.equal(next[1].receiptId,undefined);
 }
});
test('plain shopping items need no catalogue entry and never merge with food purchases',async()=>{
 const {addFreeShoppingItem}=await import('../shopping-extra.mjs');let cart=addFreeShoppingItem([],{name:' Batteries ',quantity:2,unit:'pack'});assert.equal(cart[0].name,'Batteries');assert.equal(cart[0].inventoryMode,'skip');assert.equal(cart[0].ingredientId,undefined);cart=addFreeShoppingItem(cart,{name:'batteries',quantity:1,unit:'pack'});assert.equal(cart[0].qty,3);assert.equal(cart.length,1);
 const food=addFreeShoppingItem([],{name:'Rice',quantity:1,unit:'g'});assert.equal(addIndependentIngredient(food,rice,50,'g').length,2);assert.throws(()=>addFreeShoppingItem([],{name:' '}));
});
