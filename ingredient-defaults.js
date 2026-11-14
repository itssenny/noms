import {supabase} from './supabase-client.js';
export async function ingredientDefaults(id){
 const {data:auth,error}=await supabase.auth.getUser();if(error||!auth.user)throw new Error('Please sign in again.');
 const result=await supabase.from('ingredient_preferences').select('*').eq('user_id',auth.user.id).eq('ingredient_id',id).maybeSingle();
 if(result.error)throw new Error('Ingredient defaults are unavailable. Apply database migration 018 in Supabase.');
 return result.data;
}
export async function saveIngredientDefaults(id,{unit,location,threshold,category},expectedUserId){
 if(!unit||!['Fridge','Freezer','Pantry'].includes(location)||!Number.isFinite(threshold)||threshold<0)throw new Error('Choose a unit, location and a non-negative low-stock threshold.');
 if(category!==undefined&&(!String(category).trim()||String(category).length>100))throw new Error('Choose a category.');
 const {data:auth,error}=await supabase.auth.getUser();if(error||!auth.user)throw new Error('Please sign in again.');
 if(expectedUserId&&auth.user.id!==expectedUserId)throw new Error('Account changed. Open the ingredient again.');
 const result=await supabase.from('ingredient_preferences').upsert({user_id:auth.user.id,ingredient_id:id,default_unit:unit,storage_location:location,low_stock_threshold:threshold,...(category!==undefined?{category_override:category}: {})},{onConflict:'user_id,ingredient_id'});
 if(result.error)throw new Error(/category_override/.test(result.error.message||'')?'Personal ingredient categories need database migration 028 in Supabase.':'Could not save ingredient defaults. Apply database migration 018 in Supabase.');
 if(category!==undefined){
  const inventory=await supabase.from('inventory').update({category_override:category}).eq('user_id',auth.user.id).eq('ingredient_id',id);
  if(inventory.error)throw new Error('Category preference saved, but inventory category could not update. Please retry.');
 }

}

export async function ingredientCategoryPreferences(userId){
 const {data,error}=await supabase.from('ingredient_preferences').select('*').eq('user_id',userId);
 if(error)throw new Error('Could not load ingredient category preferences.');
 return new Map((data||[]).filter(row=>row.category_override).map(row=>[row.ingredient_id,row.category_override]));
}
