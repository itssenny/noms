const difficulty={Easy:0,Medium:1,Hard:2};
export function filterRecipes(recipes,{search='',ready=false,difficulty:level='',tag='',sort='az'}={},readyIds=[]){
 const text=search.trim().toLowerCase(),available=new Set(readyIds);
 const rows=recipes.filter(recipe=>(!text||[recipe.name,...recipe.ingredients.map(row=>row[0])].join(' ').toLowerCase().includes(text))&&(!ready||available.has(recipe.id))&&(!level||recipe.difficulty===level)&&(!tag||recipe.tags.includes(tag)||recipe.cuisine===tag));
 const rank=recipe=>sort.startsWith('time')?recipe.time:sort.startsWith('rating')?(recipe.rating||0):(difficulty[recipe.difficulty]??3);
 return rows.sort((a,b)=>sort==='az'?a.name.localeCompare(b.name):sort==='za'?b.name.localeCompare(a.name):((rank(a)-rank(b))*(sort.endsWith('desc')?-1:1)||a.name.localeCompare(b.name)));
}
export function inventoryStatus(item){return item.qty===null?'stock':item.qty<=0?'out':item.qty<=item.threshold?'low':'stock'}
export function filterInventory(inventory,{search='',location='all',sort='az'}={}){
 const rank=sort==='stock'?{stock:0,low:1,out:2}:{out:0,low:1,stock:2},text=search.trim().toLowerCase();
 return Object.entries(inventory).filter(([name,item])=>name.toLowerCase().includes(text)&&(location==='all'||item.location===location)).sort(([a,x],[b,y])=>sort==='za'?b.localeCompare(a):sort==='az'?a.localeCompare(b):(rank[inventoryStatus(x)]-rank[inventoryStatus(y)]||a.localeCompare(b)));
}
export const categoryColours={'Vegetables':'#368552','Fruits':'#e46c21','Meat':'#b52b42','Fish & Seafood':'#2277b5','Dairy':'#8a60ba','Eggs':'#c39906','Carbohydrates':'#9a653a','Canned Goods':'#507673','Sauces & Condiments':'#bc4b90','Spices':'#b45820','Herbs':'#597b25','Other':'#626573'};
export function categoryColour(category){if(categoryColours[category])return categoryColours[category];let hash=0;for(const character of category)hash=(hash*31+character.charCodeAt(0))>>>0;return `hsl(${hash%360} 55% 40%)`}
