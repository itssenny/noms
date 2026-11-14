// Pure extraction: never executes website scripts or invents missing amounts.
export function plain(value, limit=10000) {
 return String(value??'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi,entity=>{
  const names={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '};
  if(names[entity.toLowerCase()])return names[entity.toLowerCase()];
  const n=entity[2].toLowerCase()==='x'?parseInt(entity.slice(3),16):parseInt(entity.slice(2),10);
  return n>0&&n<=0x10ffff?String.fromCodePoint(n):' ';
 }).replace(/\s+/g,' ').trim().slice(0,limit);
}
export function minutes(value){
 const m=/^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(String(value||''));
 if(!m||!m.slice(1).some(Boolean))return null;
 return Math.ceil(Number(m[1]||0)*1440+Number(m[2]||0)*60+Number(m[3]||0)+Number(m[4]||0)/60);
}
function steps(value){
 if(Array.isArray(value))return value.flatMap(steps);
 if(typeof value==='string')return value.split(/\n+/).map(s=>plain(s)).filter(Boolean);
 if(value&&typeof value==='object')return value.itemListElement?steps(value.itemListElement):steps(value.text||'');
 return [];
}
export function extractRecipes(html,sourceUrl){
 const found=[];
 function walk(node,depth=0){
  if(!node||typeof node!=='object'||depth>25)return;
  if(Array.isArray(node)){node.forEach(x=>walk(x,depth+1));return}
  const types=[node['@type']].flat();
  if(types.some(type=>typeof type==='string'&&/(^|[/#])Recipe$/i.test(type))){
   const name=plain(node.name,200),ingredients=[node.recipeIngredient].flat().filter(x=>typeof x==='string').map(x=>plain(x,500)).filter(Boolean),instructions=steps(node.recipeInstructions);
   if(name&&ingredients.length&&instructions.length){
    const yieldText=plain([node.recipeYield].flat()[0],100),yieldMatch=/^(\d+(?:\.\d+)?)(?:\s*(?:servings?|people|persons?))?$/i.exec(yieldText);
    const prep=minutes(node.prepTime),cook=minutes(node.cookTime);
    found.push({name,ingredients:ingredients.slice(0,100),steps:instructions.slice(0,100),servings:yieldMatch&&Number(yieldMatch[1])>0?Number(yieldMatch[1]):null,yieldText,time:minutes(node.totalTime)??(prep!==null&&cook!==null?prep+cook:null),prep,cook,tags:[node.recipeCuisine,node.recipeCategory,typeof node.keywords==='string'?node.keywords.split(','):node.keywords].flat(2).filter(x=>typeof x==='string').map(x=>plain(x,60)).filter(Boolean).slice(0,20),source:sourceUrl});
   }
  }
  Object.values(node).forEach(x=>walk(x,depth+1));
 }
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  if(!/\btype\s*=\s*(?:["']application\/ld\+json["']|application\/ld\+json(?:\s|$))/i.test(match[1]))continue;
  try{walk(JSON.parse(match[2].trim().replace(/^<!--|-->$/g,'')))}catch{/* Skip malformed blocks; other blocks may contain the recipe. */}
 }
 return found.filter((recipe,i)=>found.findIndex(x=>x.name===recipe.name)===i).slice(0,10);
}
const unitNames={grams:'g',gram:'g',g:'g',kilograms:'kg',kg:'kg',milliliters:'ml',millilitres:'ml',ml:'ml',l:'l',teaspoon:'tsp',teaspoons:'tsp',tsp:'tsp',tablespoon:'tbsp',tablespoons:'tbsp',tbsp:'tbsp',cups:'cup',cup:'cup',cloves:'clove',clove:'clove',pieces:'piece',piece:'piece',cans:'can',can:'can',pinch:'pinch',bunch:'bunch',package:'package'};
export function ingredientDraft(raw){
 const fractions={'½':'1/2','¼':'1/4','¾':'3/4','⅓':'1/3','⅔':'2/3','⅛':'1/8'};
 const line=raw.replace(/(\d)([½¼¾⅓⅔⅛])/g,'$1 $2').replace(/[½¼¾⅓⅔⅛]/g,c=>fractions[c]);
 // Prefer an explicitly supplied metric equivalent; keep the complete original
 // line for review. This handles "2 cups + 3 tbsp (265g) flour" without adding
 // incompatible volume measurements or discarding the extra tablespoons.
 const metric=/\(\s*(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)\s*\)\s*(.+)$/i.exec(line);
 if(metric&&!/^(?:can|cans|pack|packs|package|packages|tin|tins|bottle|bottles)\b/i.test(line.replace(/^[\d\s/.,]+/,''))){
  const quantity=Number(metric[1].replace(',','.')),name=metric[3].split(',')[0].trim();
  if(quantity>0&&name)return {name,quantity,unit:metric[2].toLowerCase(),raw};
 }
 const match=/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s+([a-z]+)\.?\s+(.+)$/i.exec(line);
 if(match&&unitNames[match[2].toLowerCase()]&&!/^(?:\(\s*\d|\+)/.test(match[3])){
  const amount=match[1].split(/\s+/).reduce((n,x)=>{const [a,b]=x.split('/').map(Number);return n+(b?a/b:Number(x.replace(',','.')))},0);
  const name=match[3].split(',')[0].trim();
  if(amount>0&&Number.isFinite(amount))return {name,quantity:amount,unit:unitNames[match[2].toLowerCase()],raw};
 }
 // Separate a search name from a count, without inventing an amount for
 // composite lines such as "1 large egg + 1 yolk".
 const count=/^(\d+)\s+(?:(?:large|medium|small)\s+)?(eggs?|yolks?|onions?|lemons?|limes?)\b(.*)$/i.exec(line);
 if(count)return {name:count[2],quantity:count[3].trim()?null:Number(count[1]),unit:count[3].trim()?'as needed':'piece',raw};
 // Keep ranges, package sizes and ambiguous units intact for manual review.
 return {name:raw,quantity:null,unit:'as needed',raw};
}
