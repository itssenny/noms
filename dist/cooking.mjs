import { parseMeasurement } from './measurements.mjs';
// Only convert quantities whose dimensions are unambiguous.
const measures={g:['mass',1],kg:['mass',1000],ml:['volume',1],l:['volume',1000],piece:['count',1],pcs:['count',1]};
export function convertQuantity(quantity,from,to){
 if(from===to&&from!=='other')return quantity;
 const a=measures[from],b=measures[to];
 return a&&b&&a[0]===b[0]?quantity*a[1]/b[1]:null;
}
export function parseRecipeQuantity(value,unit){
 if(['as needed','to taste'].includes(unit)||String(value??'').trim()==='')return null;
 const quantity=parseMeasurement(value);if(quantity===null||!Number.isFinite(quantity)||quantity<=0)throw new Error('Enter a positive quantity or leave it blank for As needed.');return quantity;
}
export function quantityLabel(quantity,unit,scale=1){
 if(quantity===null||quantity===undefined||quantity==='')return unit==='to taste'?'To taste':'As needed';
 return `${Number((quantity*scale).toFixed(3))} ${unit}`;
}
export function needsPurchase(row){return row.isFlexible?row.status==='missing':row.missing>0}
export function recipeChecks(recipe,inventory,servings=recipe.servings,rules=[],choices={}){
 // Inactive records remain addressable, but never count as available stock.
 inventory=Object.fromEntries(Object.entries(inventory).map(([name,item])=>[name,item.isActive===false?{...item,qty:0}:item]));
 const directIds=new Set(recipe.ingredients.map(row=>row[4]).filter(Boolean)),used=new Set();
 return recipe.ingredients.map(([originalName,qty,unit,note,originalId])=>{
  const flexible=qty===null||qty===undefined,key=originalId||originalName;
  const alternatives=Object.entries(inventory).flatMap(([name,item])=>{
   if(!(item.qty===null||item.qty>0)||!item.ingredientId||!originalId||!rules.some(rule=>rule.ingredient_id===originalId&&rule.substitute_id===item.ingredientId))return [];
   const compatible=item.qty===null||flexible||convertQuantity(item.qty,item.unit,unit)!==null;
   const reserved=directIds.has(item.ingredientId)||used.has(item.ingredientId);
   return [{id:item.ingredientId,name,qty:item.qty,unit:item.unit,compatible,available:compatible&&!reserved,reason:!compatible?'Different units — use matching stock units':reserved?'Already used by another ingredient':''}];
  });
  const selected=alternatives.find(candidate=>candidate.id===choices[key]&&candidate.available);
  const ingredientId=selected?.id||originalId,name=selected?.name||originalName;
  const entry=ingredientId?Object.entries(inventory).find(([,item])=>item.ingredientId===ingredientId):Object.entries(inventory).find(([key])=>key===name);
  const [inventoryKey,item]=entry||[];
  if(selected)used.add(selected.id);
  const metadata={name,originalName,originalId,choiceKey:key,substituted:!!selected,invalidChoice:!!choices[key]&&!selected,alternatives,unit,note,ingredientId,item,inventoryKey};
  if(flexible)return {...metadata,need:null,have:item?.qty||0,missing:null,isFlexible:true,compatible:true,status:item&&(item.qty===null||item.qty>0)?'ready':'missing'};
  const need=qty*servings/recipe.servings;if(item?.qty===null)return {...metadata,need,have:null,missing:null,compatible:true,quantityUnknown:true,status:'ready'};const converted=item?convertQuantity(item.qty,item.unit,unit):0;
  const compatible=converted!==null,have=converted??0,missing=Math.max(0,need-have);
  return {...metadata,need,have,missing,compatible,status:missing===0?(item&&item.qty<=item.threshold?'low':'ready'):(have>0?'partial':'missing')};
 });
}
export function remainingInventory(check){
 if(check.item?.isActive===false||check.invalidChoice||check.quantityUnknown||check.item?.qty===null||check.isFlexible||!check.item||!check.compatible)return null;
 const used=convertQuantity(check.need,check.unit,check.item.unit);
 if(used===null)return null;
 return {before:check.item.qty,after:Number(Math.max(0,check.item.qty-used).toFixed(8)),unit:check.item.unit};
}
export function postCookQuantity(choice,value=''){
 if(choice==='unchanged')return undefined;
 if(choice==='unknown')return null;
 if(choice==='empty'||choice==='inactive')return 0;
 if(choice==='exact'){
  if(String(value).trim()==='')throw new Error('Enter an exact amount or choose another stock update.');
  const quantity=Number(value);
  if(!Number.isFinite(quantity)||quantity<0)throw new Error('Enter zero or a positive amount.');
  return quantity;
 }
 throw new Error('Choose how to update this ingredient.');
}
