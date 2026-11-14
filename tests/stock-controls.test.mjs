import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {stockDraft,stockStatus} from '../stock-model.mjs';
const data=values=>({get:key=>values[key]??null});
test('exact, unknown, manually low and empty stock retain distinct meanings',()=>{
 let draft=stockDraft(data({'stock-mode':'exact','inventory-quantity':'2.5','inventory-unit':'kg','inventory-threshold':'3'}));assert.equal(stockStatus(draft),'low');assert.equal(draft.qty,2.5);
 draft=stockDraft(data({'stock-mode':'unknown','inventory-quantity':'99','inventory-unit':'g','inventory-threshold':'20','stock-status':'low'}));assert.equal(draft.qty,null);assert.equal(stockStatus(draft),'low');
 draft=stockDraft(data({'stock-mode':'unknown','inventory-unit':'g','inventory-threshold':'20','stock-status':'stock'}));assert.equal(stockStatus(draft),'stock');
 draft=stockDraft(data({'stock-mode':'empty','inventory-unit':'g','inventory-threshold':'20'}));assert.equal(draft.qty,0);assert.equal(stockStatus(draft),'out');
 for(const threshold of ['','-1','NaN'])assert.throws(()=>stockDraft(data({'stock-mode':'unknown','inventory-threshold':threshold})),/threshold/);
 for(const amount of ['','-1','NaN'])assert.throws(()=>stockDraft(data({'stock-mode':'exact','inventory-quantity':amount,'inventory-threshold':'1'})),/amount/);
});
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
test('removing one shopping row and clearing all preserve inventory; failed local writes roll back',()=>{
 const c=vm.createContext({shopping:[{name:'A',checked:true,receivedPurchase:true},{name:'B',checked:false}],inventory:{Rice:{qty:10}},shoppingView(){},saveState:()=>true});
 vm.runInContext(source.slice(source.indexOf('function removeShoppingItems('),source.indexOf("document.addEventListener('click',event=>{const remove=")),c);
 assert.equal(c.removeShoppingItems(1),true);assert.equal(c.shopping.length,1);assert.equal(c.shopping[0].name,'A');assert.equal(c.inventory.Rice.qty,10);
 c.saveState=()=>false;assert.equal(c.removeShoppingItems(),false);assert.equal(c.shopping.length,1);c.saveState=()=>true;assert.equal(c.removeShoppingItems(),true);assert.equal(c.shopping.length,0);assert.equal(c.inventory.Rice.qty,10);
});
test('inventory edits save thresholds and unknown low state with owner filters, then clear the override',async()=>{
 const writes=[],c=vm.createContext({stockDraft,sessionVersion:1,activeUserId:'a',inventory:{Rice:{ingredientId:'rice',qty:10,threshold:2,unit:'g'}},categories:{},currentUser:async()=>({id:'a'}),supabase:{from:()=>({update(values){writes.push({values,filters:[]});return this},eq(k,v){writes.at(-1).filters.push([k,v]);return this},select:async()=>({data:[{id:'stock'}]})})}});
 vm.runInContext(source.slice(source.indexOf('async function saveInventoryEdit('),source.indexOf('function planRecipePhoto(')),c);
 const values={'edit-inventory-id':'rice','inventory-location':'Pantry','inventory-category':'Grains','stock-mode':'unknown','stock-status':'low','inventory-unit':'g','inventory-threshold':'5'};
 await c.saveInventoryEdit(data(values));assert.equal(writes[0].values.quantity,null);assert.equal(writes[0].values.stock_status,'low');assert.equal(writes[0].values.low_stock_threshold,5);assert.deepEqual(writes[0].filters,[['ingredient_id','rice'],['user_id','a']]);
 await c.saveInventoryEdit(data({...values,'stock-mode':'exact','inventory-quantity':'50'}));assert.equal(writes[1].values.stock_status,null);assert.equal(c.inventory.Rice.qty,50);
});

test('focus refreshes with unchanged recipes do not redraw shopping controls during a click',async()=>{
 let callback,redraws=0;const c=vm.createContext({recipes:[{id:'r',name:'Rice',imageUrl:'old'}],activeUserId:'a',sessionVersion:1,currentRecipe:null,location:{hash:'#/meal-plan/shopping'},window:{addEventListener(_name,fn){callback=fn}},document:{addEventListener(){},querySelector:selector=>selector==='#shopping-view.active'?{}:null},refreshLibrary:async()=>{c.recipes=[{id:'r',name:'Rice',imageUrl:'new-blob'}]},shoppingView(){redraws++},toast(){}});
 vm.runInContext(source.slice(source.indexOf("window.addEventListener('focus',()=>")),c);callback();await new Promise(setImmediate);assert.equal(redraws,0);
 c.refreshLibrary=async()=>{c.recipes=[]};callback();await new Promise(setImmediate);assert.equal(redraws,1);
});

test('stock and inactive status save together; restocking reactivates and failures preserve local state',async()=>{
 const writes=[];let fail=false;const c=vm.createContext({stockDraft,sessionVersion:1,activeUserId:'a',inventory:{Rice:{ingredientId:'rice',qty:10,threshold:2,unit:'g',isActive:true}},categories:{},currentUser:async()=>({id:'a'}),supabase:{from:()=>({update(values){writes.push(values);return this},eq(){return this},select:async()=>fail?{error:{message:'Save failed'}}:{data:[{id:'stock'}]}})}});
 vm.runInContext(source.slice(source.indexOf('async function saveInventoryEdit('),source.indexOf('function planRecipePhoto(')),c);
 const values={'edit-inventory-id':'rice','inventory-location':'Pantry','inventory-category':'Grains','stock-mode':'empty','inventory-active':'false','inventory-unit':'g','inventory-threshold':'5'};
 await c.saveInventoryEdit(data(values));assert.equal(writes.length,1);assert.equal(writes[0].quantity,0);assert.equal(writes[0].is_active,false);assert.equal(c.inventory.Rice.isActive,false);
 await c.saveInventoryEdit(data({...values,'stock-mode':'exact','inventory-quantity':'12'}));assert.equal(writes[1].is_active,true);assert.equal(c.inventory.Rice.qty,12);assert.equal(c.inventory.Rice.isActive,true);
 fail=true;await assert.rejects(c.saveInventoryEdit(data(values)),/Save failed/);assert.equal(c.inventory.Rice.qty,12);assert.equal(c.inventory.Rice.isActive,true);
});

test('inactive control follows unsaved stock changes and resets when stock is restored',()=>{
 const state={value:'true'},button={dataset:{},setAttribute(){}},hint={};
 const form={elements:{'stock-mode':{value:'exact'},'inventory-quantity':{value:'10'}},querySelector(selector){return selector==='[name="inventory-active"]'?state:selector==='[data-set-inventory-active]'?button:hint}};
 const c=vm.createContext({});vm.runInContext(source.slice(source.indexOf('function syncInventoryTracking('),source.indexOf('function addInventoryModal(')),c);
 c.syncInventoryTracking(form);assert.equal(button.disabled,true);
 form.elements['stock-mode'].value='empty';c.syncInventoryTracking(form);assert.equal(button.disabled,false);assert.equal(button.dataset.nextActive,'false');
 state.value='false';c.syncInventoryTracking(form);assert.equal(button.textContent,'Reactivate');
 form.elements['stock-mode'].value='unknown';c.syncInventoryTracking(form);assert.equal(state.value,'true');assert.equal(button.disabled,true);
 form.elements['stock-mode'].value='exact';form.elements['inventory-quantity'].value='0';c.syncInventoryTracking(form);assert.equal(button.disabled,false);
 form.elements['inventory-quantity'].value='';c.syncInventoryTracking(form);assert.equal(button.disabled,true);
});
