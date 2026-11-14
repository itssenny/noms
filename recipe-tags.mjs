export function hasRecipeTag(recipe,tag){
 const wanted=String(tag??'').trim().toLocaleLowerCase();
 return !!wanted&&[...(recipe.tags||[]),recipe.cuisine].some(value=>String(value??'').trim().toLocaleLowerCase()===wanted);
}
export function taggedRecipes(recipes,tag){return [...new Map(recipes.filter(recipe=>hasRecipeTag(recipe,tag)).map(recipe=>[recipe.id,recipe])).values()];}
