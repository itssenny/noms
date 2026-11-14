import { supabase } from './supabase-client.js';
// Resolve only canonical IDs already attached to the recipe. RLS remains in force.
export async function loadMeasurementIngredients(ids){
 const unique=[...new Set(ids.filter(Boolean))];if(!unique.length)return new Map();
 try{const {data,error}=await supabase.from('ingredients').select('id,density_g_per_ml,conversion_metadata').in('id',unique);if(error)return new Map();return new Map((data||[]).map(row=>[row.id,row]));}catch{return new Map();}
}
