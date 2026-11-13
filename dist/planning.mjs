import {currentWeek} from './calendar.mjs';
import {convertQuantity} from './cooking.mjs';
export const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export function dateKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
export function parseDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw new Error('Choose a valid date.');
 const [year,month,day]=value.split('-').map(Number),date=new Date(year,month-1,day,12);
 if(dateKey(date)!==value)throw new Error('Choose a valid date.');return date;
}
export function dateForDay(day,monday=dateKey(currentWeek()[0])){const index=weekdays.indexOf(day);if(index<0)throw new Error('Choose a valid day.');const date=parseDate(monday);date.setDate(date.getDate()+index);return dateKey(date)}
export function shiftWeek(monday,direction){const date=parseDate(monday);date.setDate(date.getDate()+7*direction);return dateKey(date)}
export function migratePlans(plans,now=new Date()){const monday=dateKey(currentWeek(now)[0]);return plans.map(plan=>plan.date||!weekdays.includes(plan.day)?plan:{...plan,date:dateForDay(plan.day,monday)})}
export function sourceIds(item,recipes){return Array.isArray(item.sourceIds)?item.sourceIds:recipes.filter(recipe=>(item.sources||[]).includes(recipe.name)).map(recipe=>recipe.id)}
export function sourceRecipes(item,recipes){const ids=sourceIds(item,recipes);return recipes.filter(recipe=>ids.includes(recipe.id))}
export function cleanRecipeSources(item,recipes){const matched=sourceRecipes(item,recipes);return {...item,sourceIds:matched.map(recipe=>recipe.id),sources:matched.map(recipe=>recipe.name)}}
export function cartMatches(row,item){return !item.checked&&item.inventoryMode!=='skip'&&!item.receivedPurchase&&!item.pendingPurchase&&(row.ingredientId&&item.ingredientId?row.ingredientId===item.ingredientId:row.name.trim().toLowerCase()===item.name.trim().toLowerCase())}
export function cartCoverage(row,shopping){return shopping.filter(item=>cartMatches(row,item)).reduce((sum,item)=>sum+(convertQuantity(item.qty,item.unit,row.unit)??0),0)}
export function purchaseQuantity(row){return row.missing>0?row.missing:row.need}
// Top up the selected amount rather than duplicating an amount already on the list.
export function addSelectedIngredients(shopping,rows,indices,recipe,recipes=[recipe]){
 const next=shopping.map(item=>({...item,sources:[...(item.sources||[])],sourceIds:[...sourceIds(item,recipes)]}));
 for(const index of new Set(indices.map(Number))){
  const row=rows[index];if(!row)continue;
  if(row.isFlexible){
   let target=next.find(item=>cartMatches(row,item));
   if(!target){target={id:globalThis.crypto.randomUUID(),name:row.name,ingredientId:row.ingredientId||null,qty:null,unit:row.unit,checked:false,sources:[],sourceIds:[]};next.push(target)}
   target.sourceIds=[...new Set([...target.sourceIds,recipe.id])];target.sources=[...new Set([...target.sources,recipe.name])];continue;
  }
  const needed=purchaseQuantity(row);if(!Number.isFinite(needed)||needed<=0)continue;
  const coverage=cartCoverage(row,next),extra=Number(Math.max(0,needed-coverage).toFixed(8));
  const matched=next.filter(item=>cartMatches(row,item)&&convertQuantity(item.qty,item.unit,row.unit)!==null);
  let target=matched[0];
  if(extra>0){if(target)target.qty=Number((target.qty+convertQuantity(extra,row.unit,target.unit)).toFixed(8));else{target={id:globalThis.crypto.randomUUID(),name:row.name,ingredientId:row.ingredientId||null,qty:extra,unit:row.unit,checked:false,sources:[],sourceIds:[]};next.push(target);matched.push(target)}}
  for(const item of matched){item.sourceIds=[...new Set([...item.sourceIds,recipe.id])];item.sources=[...new Set([...item.sources,recipe.name])]}
 }
 return next;
}

export function detachRecipeSources(shopping,id,recipes){return shopping.map(item=>{const resolved=cleanRecipeSources(item,recipes);return cleanRecipeSources({...resolved,sourceIds:resolved.sourceIds.filter(source=>source!==id)},recipes.filter(recipe=>recipe.id!==id))})}

export const mealSlots=['Breakfast','Lunch','Dinner','Snack'];
export function moveMeal(plans,id,date,slot){
 const parsed=parseDate(date),index=plans.findIndex(plan=>String(plan.id)===String(id));
 if(index<0)throw new Error('This meal is no longer in your plan.');
 const chosenSlot=slot||plans[index].slot;
 if(![...mealSlots,'Brunch'].includes(chosenSlot))throw new Error('Choose a valid meal.');
 return plans.map((plan,i)=>i===index?{...plan,date,day:weekdays[(parsed.getDay()+6)%7],slot:chosenSlot}:plan);
}
