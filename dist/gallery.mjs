// A planned meal is not cooking history. Only recorded completions populate these rows.
export function recipeShelves(recipes,{query='',filter='all',tag='',readyIds=[],now=new Date()}={}){
 const cutoff=Number(now)-30*24*60*60*1000,text=query.trim().toLowerCase(),ready=new Set(readyIds);
 const visible=recipes.filter(recipe=>(!text||[recipe.name,recipe.cuisine,...(recipe.tags||[])].join(' ').toLowerCase().includes(text))&&(!tag||recipe.cuisine===tag||recipe.tags?.includes(tag))&&(filter!=='ready'||ready.has(recipe.id))&&(filter!=='quick'||(Number.isFinite(recipe.time)&&recipe.time<=30)));
 const cooked=recipe=>{const stamp=Date.parse(recipe.lastCookedAt);return Number.isFinite(stamp)&&stamp<=Number(now)?stamp:null};
 return [
 {id:'rated',title:'Highest rated',description:'Your personal favourites, highest rating first.',recipes:visible.filter(r=>r.rating>0).sort((a,b)=>b.rating-a.rating||a.name.localeCompare(b.name))},
 {id:'recent',title:'Recently cooked',description:'Made in the last 30 days.',recipes:visible.filter(r=>cooked(r)!==null&&cooked(r)>=cutoff).sort((a,b)=>cooked(b)-cooked(a))},
 {id:'while',title:'It’s been a while',description:'Last cooked over 30 days ago, oldest first.',recipes:visible.filter(r=>cooked(r)!==null&&cooked(r)<cutoff).sort((a,b)=>cooked(a)-cooked(b))},
 {id:'new',title:'Not cooked yet',description:'Something to try next.',recipes:visible.filter(r=>cooked(r)===null).sort((a,b)=>a.name.localeCompare(b.name))},
 {id:'all',title:'All recipes',description:'Your whole cookbook.',recipes:[...visible].sort((a,b)=>a.name.localeCompare(b.name))}
 ];
}
