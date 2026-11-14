import {supabase} from './supabase-client.js';
export async function ingredientDefaults(id){
 const {data:auth,error}=await supabase.auth.getUser();if(error||!auth.user)throw new Error('Please sign in again.');
 const result=await supabase.from('ingredient_preferences').select('default_unit,storage_location,low_stock_threshold').eq('user_id',auth.user.id).eq('ingredient_id',id).maybeSingle();
 if(result.error)throw new Error('Ingredient defaults are unavailable. Apply database migration 018 in Supabase.');
 return result.data;
}
export async function saveIngredientDefaults(id,{unit,location,threshold},expectedUserId){
 if(!unit||!['Fridge','Freezer','Pantry'].includes(location)||!Number.isFinite(threshold)||threshold<0)throw new Error('Choose a unit, location and a non-negative low-stock threshold.');
 const {data:auth,error}=await supabase.auth.getUser();if(error||!auth.user)throw new Error('Please sign in again.');
 if(expectedUserId&&auth.user.id!==expectedUserId)throw new Error('Account changed. Open the ingredient again.');
 const result=await supabase.from('ingredient_preferences').upsert({user_id:auth.user.id,ingredient_id:id,default_unit:unit,storage_location:location,low_stock_threshold:threshold},{onConflict:'user_id,ingredient_id'});
 if(result.error)throw new Error('Could not save ingredient defaults. Apply database migration 018 in Supabase.');
}
