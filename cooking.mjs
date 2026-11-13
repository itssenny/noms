// Only convert quantities whose dimensions are unambiguous.
const measures={g:['mass',1],kg:['mass',1000],ml:['volume',1],l:['volume',1000],piece:['count',1],pcs:['count',1]};
export function convertQuantity(quantity,from,to){
 if(from===to&&from!=='other')return quantity;
 const a=measures[from],b=measures[to];
 return a&&b&&a[0]===b[0]?quantity*a[1]/b[1]:null;
}
export function recipeChecks(recipe,inventory,servings=recipe.servings){
 return recipe.ingredients.map(([name,qty,unit,note,ingredientId])=>{
  const entry=ingredientId?Object.entries(inventory).find(([,item])=>item.ingredientId===ingredientId):Object.entries(inventory).find(([key])=>key===name);
  const [inventoryKey,item]=entry||[];
  const need=qty*servings/recipe.servings,converted=item?convertQuantity(item.qty,item.unit,unit):0;
  const compatible=converted!==null,have=converted??0,missing=Math.max(0,need-have);
  return {name,need,have,missing,unit,note,item,inventoryKey,compatible,status:missing===0?(item&&item.qty<=item.threshold?'low':'ready'):(have>0?'partial':'missing')};
 });
}
export function remainingInventory(check){
 if(!check.item||!check.compatible)return null;
 const used=convertQuantity(check.need,check.unit,check.item.unit);
 if(used===null)return null;
 return {before:check.item.qty,after:Number(Math.max(0,check.item.qty-used).toFixed(8)),unit:check.item.unit};
}
