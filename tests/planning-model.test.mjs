import test from 'node:test';
import assert from 'node:assert/strict';
import {dateKey,parseDate,dateForDay,shiftWeek,migratePlans,cleanRecipeSources,sourceRecipes,cartCoverage,addSelectedIngredients,detachRecipeSources} from '../planning.mjs';
import {readAccountState,writeAccountState} from '../account-state.mjs';
const recipes=[{id:'r1',name:'Salmon'},{id:'r2',name:'Pasta'}];
const rows=[{ingredientId:'cream',name:'Cream',need:150,have:0,missing:150,unit:'ml'},{ingredientId:'rice',name:'Rice',need:200,have:800,missing:0,unit:'g'}];
test('top-up respects compatible units, repeats are idempotent, and sources include multiple recipes',()=>{
 const original=[{name:'Cream',qty:0.1,unit:'l',checked:false,sources:['Pasta']}];
 const a=addSelectedIngredients(original,rows,['0'],recipes[0],recipes);
 assert.equal(a[0].qty,0.15);assert.equal(original[0].qty,0.1);assert.deepEqual(sourceRecipes(a[0],recipes).map(r=>r.id),['r1','r2']);
 const b=addSelectedIngredients(a,rows,['0'],recipes[0],recipes);assert.equal(b[0].qty,0.15);assert.equal(b.length,1);
});
test('manual selection buys a stocked ingredient and unselected shortages remain untouched',()=>{
 const cart=addSelectedIngredients([],rows,['1'],recipes[0],recipes);
 assert.equal(cart.length,1);assert.equal(cart[0].name,'Rice');assert.equal(cart[0].qty,200);assert.equal(cart[0].ingredientId,'rice');
});
test('completed, incompatible-unit and different-ID shopping entries do not count as coverage',()=>{
 assert.equal(cartCoverage(rows[0],[{name:'Cream',qty:1,unit:'l',checked:true}]),0);
 assert.equal(cartCoverage(rows[0],[{name:'Cream',qty:5,unit:'cup',checked:false}]),0);
 assert.equal(cartCoverage(rows[0],[{ingredientId:'other',name:'Cream',qty:100,unit:'ml',checked:false}]),0);
 const cart=addSelectedIngredients([{name:'Cream',qty:1,unit:'cup',checked:false}],rows,['0'],recipes[0],recipes);assert.equal(cart.length,2);
});
test('removing one recipe label preserves other recipes, quantities, and check state',()=>{
 const cart=[{name:'Cream',qty:150,unit:'ml',checked:true,sources:['Salmon','Pasta'],sourceIds:['r1','r2']}];
 const next=detachRecipeSources(cart,'r1',recipes);assert.deepEqual(next[0].sources,['Pasta']);assert.deepEqual(next[0].sourceIds,['r2']);assert.equal(next[0].qty,150);assert.equal(next[0].checked,true);
 const blank=detachRecipeSources(next,'r2',recipes);assert.deepEqual(blank[0].sources,[]);assert.equal(blank[0].qty,150);
});
test('ID labels survive recipe renaming and legacy names migrate without linking deleted recipes',()=>{
 const item={sourceIds:['r1','gone'],sources:['Old name','Deleted']};assert.deepEqual(cleanRecipeSources(item,[{id:'r1',name:'New name'}]).sources,['New name']);
 assert.deepEqual(cleanRecipeSources({sources:['Salmon','Deleted']},recipes).sourceIds,['r1']);
});
test('dated weeks cross year boundaries without shifting local dates',()=>{
 assert.equal(shiftWeek('2026-12-28',1),'2027-01-04');assert.equal(shiftWeek('2027-01-04',-1),'2026-12-28');
 assert.equal(dateForDay('Sunday','2026-12-28'),'2027-01-03');assert.equal(dateKey(parseDate('2026-03-29')),'2026-03-29');
 assert.throws(()=>parseDate('2026-02-30'));assert.throws(()=>parseDate('2026-2-3'));
});
test('legacy weekdays move to current week once; future and historical plans keep their dates',()=>{
 const migrated=migratePlans([{id:1,day:'Monday'},{id:2,day:'Friday',date:'2026-09-04'}],new Date(2026,10,13));
 assert.equal(migrated[0].date,'2026-11-09');assert.equal(migrated[1].date,'2026-09-04');
 assert.deepEqual(migratePlans(migrated,new Date(2026,10,23)),migrated);
});
test('plans in separate weeks persist without repeating or overwriting one another',()=>{
 const store=new Map(),storage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};
 const plans=[{id:1,date:'2026-11-09',day:'Monday',recipe:'r1'},{id:2,date:'2026-11-16',day:'Monday',recipe:'r2'}];
 writeAccountState(storage,'user',{plans,shopping:[]});assert.deepEqual(readAccountState(storage,'user').plans,plans);
 assert.equal(plans.filter(p=>p.date===dateForDay('Monday','2026-11-09')).length,1);
});
test('received and pending shopping items never count as new purchase coverage',()=>{
 for(const state of [{receivedPurchase:true},{pendingPurchase:{quantity:150}}]){
  const cart=[{ingredientId:'cream',name:'Cream',qty:150,unit:'ml',checked:false,...state}];assert.equal(cartCoverage(rows[0],cart),0);const next=addSelectedIngredients(cart,rows,['0'],recipes[0],recipes);assert.equal(next.length,2);assert.equal(next[1].qty,150);
 }
});
