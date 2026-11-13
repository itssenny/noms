import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
function harness(){const pending=[],calls=[],snapshots=[],item={receiptId:'receipt',name:'Rice',qty:100,unit:'g',checked:true};const context=vm.createContext({sessionVersion:1,activeUserId:'a',purchasePending:new Set(),currentUser:async()=>({id:'a'}),inventory:{},shopping:[item],categories:{},home(){},toast(){},saveState(){snapshots.push(JSON.parse(JSON.stringify(item)));return true},supabase:{rpc(name,args){calls.push({name,args});return new Promise(resolve=>pending.push(resolve))}}});vm.runInContext(source.slice(source.indexOf('async function receiveShoppingPurchase('),source.indexOf('function shoppingCategory(')),context);return {context,pending,calls,snapshots,item}}
const response={data:{ingredient:{id:'rice',canonical_name:'Rice',category:'Carbohydrates'},inventory:{id:'stock',quantity:900,unit:'g',storage_location:'Pantry',low_stock_threshold:250}}};
test('purchase payload persists before the request and checked item transfers only after inventory success',async()=>{
 const {context:c,item,pending,calls,snapshots}=harness();const saved=c.receiveShoppingPurchase(item,{id:'rice',canonical_name:'Rice'},100,'g','Pantry');await new Promise(setImmediate);assert.equal(snapshots[0].pendingPurchase.quantity,100);assert.equal(item.checked,true);assert.equal(calls[0].args.p_receipt_id,'receipt');pending[0](response);await saved;assert.equal(item.checked,true);assert.equal(item.pendingPurchase,undefined);assert.equal(c.inventory.Rice.qty,900);
});
test('an uncertain response retains the same receipt and payload for safe retry',async()=>{
 const {context:c,item,pending,calls}=harness();const failed=c.receiveShoppingPurchase(item,{id:'rice',canonical_name:'Rice'},100,'g','Pantry');await new Promise(setImmediate);pending[0]({error:{message:'Connection lost'}});await assert.rejects(failed,/Connection lost/);assert.equal(item.pendingPurchase.quantity,100);assert.equal(item.checked,true);
 const retry=c.receiveShoppingPurchase(item,{id:'rice',canonical_name:'Rice'},100,'g','Pantry');await new Promise(setImmediate);assert.equal(calls[1].args.p_receipt_id,calls[0].args.p_receipt_id);pending[1](response);await retry;assert.equal(item.checked,true);
});
test('late purchase results never update a new account inventory',async()=>{
 const {context:c,item,pending}=harness();const saved=c.receiveShoppingPurchase(item,{id:'rice',canonical_name:'Rice'},100,'g','Pantry');await new Promise(setImmediate);c.sessionVersion++;c.activeUserId='b';pending[0](response);await saved;assert.equal(Object.keys(c.inventory).length,0);assert.equal(item.checked,true);
});
test('purchase completion updates the current cart entry after another action clones the cart',async()=>{
 const {context:c,item,pending}=harness();const saved=c.receiveShoppingPurchase(item,{id:'rice',canonical_name:'Rice'},100,'g','Pantry');await new Promise(setImmediate);c.shopping=[{...item}];pending[0](response);await saved;assert.equal(c.shopping[0].checked,true);assert.equal(c.shopping[0].receivedPurchase,true);assert.equal(c.shopping[0].pendingPurchase,undefined);
});
test('shopping-only check-offs never call catalogue or inventory services',()=>{
 const item={name:'Batteries',inventoryMode:'skip',checked:false},context=vm.createContext({shopping:[item],sessionVersion:1,saveState:()=>true,shoppingView(){}});
 vm.runInContext(source.slice(source.indexOf('async function handleShoppingCheck('),source.indexOf('function receiveShoppingModal(')),context);
 return context.handleShoppingCheck(0,{checked:true}).then(()=>assert.equal(item.checked,true));
});

test('food check-off and uncheck persist locally without transferring inventory',async()=>{
 const item={name:'Rice',ingredientId:'rice',qty:100,unit:'g',checked:false};const context=vm.createContext({shopping:[item],saveState:()=>true,shoppingView(){}});
 vm.runInContext(source.slice(source.indexOf('async function handleShoppingCheck('),source.indexOf('let transferringShopping=')),context);
 await context.handleShoppingCheck(0,{checked:true});assert.equal(item.checked,true);assert.equal(item.receiptId,undefined);
 await context.handleShoppingCheck(0,{checked:false});assert.equal(item.checked,false);
});
test('bulk transfer processes only checked food, keeps rows, and skips settled purchases on repetition',async()=>{
 const rows=[{name:'Rice',checked:true,qty:100,unit:'g',ingredientId:'rice'},{name:'Cream',checked:true,qty:null,unit:'ml',ingredientId:'cream'},{name:'Soap',checked:true,inventoryMode:'skip'},{name:'Butter',checked:false}];const calls=[];
 const context=vm.createContext({shopping:rows,sessionVersion:1,crypto:{randomUUID:()=>String(calls.length)},document:{querySelector:()=>null},inventory:{},units:['g','ml'],saveState:()=>true,shoppingView(){},toast(){},shoppingIngredient:async item=>({id:item.ingredientId}),receiveShoppingPurchase:async(item,ingredient,quantity)=>{calls.push({id:ingredient.id,quantity});item.receivedPurchase=true}});
 vm.runInContext(source.slice(source.indexOf('let transferringShopping='),source.indexOf('function receiveShoppingModal(')),context);
 await context.transferCheckedItems();assert.equal(calls.length,2);assert.equal(calls[1].quantity,null);assert.equal(rows.length,4);assert.equal(rows.filter(row=>row.checked).length,3);await context.transferCheckedItems();assert.equal(calls.length,2);
});
