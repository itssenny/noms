import {convertQuantity} from './cooking.mjs';
const key=userId=>'mise-meal-often-bought:'+userId;
export function readOftenBought(storage,userId){if(!userId)return [];const saved=JSON.parse(storage.getItem(key(userId))||'[]');return Array.isArray(saved)?saved.filter(item=>item?.ingredientId&&item.name&&item.unit):[]}
export function writeOftenBought(storage,userId,items){if(userId)storage.setItem(key(userId),JSON.stringify(items))}
export function pinIngredient(items,ingredient){if(items.some(item=>item.ingredientId===ingredient.id))return items;return [...items,{ingredientId:ingredient.id,name:ingredient.canonical_name,unit:ingredient.default_unit||'piece',category:ingredient.category||'Other'}]}
export function addIndependentIngredient(shopping,ingredient,quantity,unit){
 if(quantity!==null&&(!Number.isFinite(quantity)||quantity<=0))throw new Error('Enter a positive quantity or leave it blank.');
 const next=shopping.map(item=>({...item})),matches=next.filter(item=>!item.checked&&item.inventoryMode!=='skip'&&!item.receivedPurchase&&!item.pendingPurchase&&(item.ingredientId?item.ingredientId===ingredient.id:item.name.trim().toLowerCase()===ingredient.canonical_name.trim().toLowerCase()));
 let target=matches.find(item=>quantity===null||item.qty===null||convertQuantity(quantity,unit,item.unit)!==null);
 if(!target){next.push({id:crypto.randomUUID(),ingredientId:ingredient.id,name:ingredient.canonical_name,qty:quantity,unit,checked:false,sources:[],sourceIds:[]});return next}
 target.ingredientId=ingredient.id;
 if(quantity===null)return next;
 if(target.qty===null){target.qty=quantity;target.unit=unit}else target.qty=Number((target.qty+convertQuantity(quantity,unit,target.unit)).toFixed(8));
 return next;
}

export function addFreeShoppingItem(shopping,{name,quantity=null,unit='pcs',trackInventory=false}){
 name=name.trim();if(!name||name.length>150)throw new Error('Enter an item name up to 150 characters.');
 if(quantity!==null&&(!Number.isFinite(quantity)||quantity<=0))throw new Error('Enter a positive quantity or leave it blank.');
 const next=shopping.map(item=>({...item})),mode=trackInventory?'food':'skip';
 const target=next.find(item=>!item.checked&&!item.receivedPurchase&&!item.pendingPurchase&&!item.ingredientId&&item.inventoryMode===mode&&item.name.toLowerCase()===name.toLowerCase()&&item.unit===unit);
 if(target){if(quantity!==null)target.qty=Number(((target.qty||0)+quantity).toFixed(8));return next}
 next.push({id:crypto.randomUUID(),name,qty:quantity,unit,checked:false,inventoryMode:mode,sources:[],sourceIds:[]});return next;
}
