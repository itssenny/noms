import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {postCookQuantity} from '../cooking.mjs';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
test('Start cooking dispatches cooking and never the deletion prompt',async()=>{
 let handler,started,deleted=false;const c=vm.createContext({document:{addEventListener:(_type,fn)=>handler=fn},cooking:(...args)=>started=args,modal:()=>deleted=true});
 const start=source.indexOf("document.addEventListener('click',async e=>{");vm.runInContext(source.slice(start,source.indexOf('\n',start)),c);
 await handler({composedPath:()=>[],target:{closest:selector=>selector==='[data-start]'?{dataset:{start:'recipe',servings:'2'}}:null}});assert.deepEqual(started,['recipe','2',undefined]);assert.equal(deleted,false);
});
function checkin(choice='inactive'){
 const original={ingredientId:'rice',qty:100,unit:'g',location:'Pantry',threshold:20,isActive:true},writes=[],messages=[];
 const c=vm.createContext({sessionVersion:1,activeUserId:'a',currentRecipe:{id:'r'},cookingServings:1,cookingChoices:{},checks:()=>[{item:original,inventoryKey:'Rice'}],postCookQuantity,inventory:{Rice:original},$$:()=>[{value:choice,dataset:{stockChoice:'0'},closest:()=>({querySelector:()=>({value:'25'})})}],upsertInventory:async(key,item,userId,options)=>{writes.push({key,item,userId,options});return item},show(){},toast:message=>messages.push(message),openPostCookFeedback(){}});
 vm.runInContext(source.slice(source.indexOf('async function confirmDeduction('),source.indexOf("document.addEventListener('change',event=>{\n if(!event.target.matches('[data-stock-choice]'))")),c);return {c,original,writes,messages};
}
test('post-cooking inactive choice atomically saves zero and inactive membership with existing metadata',async()=>{
 assert.equal(postCookQuantity('inactive'),0);const {c,original,writes}=checkin(),button={disabled:false};await c.confirmDeduction(button);
 assert.equal(writes.length,1);assert.equal(writes[0].userId,'a');assert.equal(writes[0].options.isActive,false);assert.equal(writes[0].item.qty,0);assert.equal(writes[0].item.unit,'g');assert.equal(writes[0].item.threshold,20);assert.equal(c.inventory.Rice.isActive,false);assert.equal(original.qty,100);assert.equal(button.disabled,false);
});
test('ordinary used-up and exact updates stay active; skipping leaves stock untouched',async()=>{
 for(const choice of ['empty','exact']){const {c}=checkin(choice);await c.confirmDeduction({disabled:false});assert.equal(c.inventory.Rice.isActive,true);assert.equal(c.inventory.Rice.qty,choice==='empty'?0:25)}
 const {c,writes}=checkin('unchanged');await c.confirmDeduction({disabled:false});assert.equal(writes.length,0);assert.equal(c.inventory.Rice.qty,100);
});
test('failed or stale post-cooking saves never replace current inventory state',async()=>{
 let f=checkin();f.c.upsertInventory=async()=>{throw new Error('offline')};await f.c.confirmDeduction({disabled:false});assert.equal(f.c.inventory.Rice.qty,100);assert.match(f.messages[0],/failed/);
 f=checkin();f.c.upsertInventory=async()=>{f.c.sessionVersion++;f.c.activeUserId='b';return{qty:0,isActive:false}};await f.c.confirmDeduction({disabled:false});assert.equal(f.c.inventory.Rice.qty,100);
});
