import {supabase} from './supabase-client.js';
import {setCategoryColourOverrides,categoryColourOverrides} from './list-models.mjs?v=20261114-tracking';
let owner=null,version=0,issue='';
export function clearCategoryColours(){version++;owner=null;issue='';setCategoryColourOverrides([])}
export function categoryColourIssue(){return issue}
export async function loadCategoryColours(userId){
 const current=++version;owner=userId;issue='';setCategoryColourOverrides([]);
 try{
  const {data,error}=await supabase.from('category_colour_preferences').select('category,colour').eq('user_id',userId).limit(1000);
  if(current!==version)return;if(error)throw error;setCategoryColourOverrides(data||[]);
 }catch(error){if(current===version)issue=['42P01','PGRST205'].includes(error.code)?'To save category colours, run database update 015_category_colours.sql in Supabase.':`Could not load category colours: ${error.message}`}
}
export async function saveCategoryColours(values){
 const current=version,userId=owner;if(!userId)throw new Error('Please sign in again.');
 const rows=values.map(({category,colour})=>{if(!category?.trim()||category.length>100||!/^#[0-9a-f]{6}$/i.test(colour))throw new Error('Choose a valid colour for each category.');return {user_id:userId,category,colour:colour.toLowerCase()}});
 if(!rows.length)return;
 const {data,error}=await supabase.from('category_colour_preferences').upsert(rows,{onConflict:'user_id,category'}).select('category,colour');
 if(current!==version||userId!==owner)return false;
 if(error)throw new Error(['42P01','PGRST205'].includes(error.code)?'To save category colours, run database update 015_category_colours.sql in Supabase.':error.message);
 if(data?.length!==rows.length)throw new Error('Could not confirm all category colours. Please retry.');
 setCategoryColourOverrides([...categoryColourOverrides(),...data]);issue='';window.dispatchEvent(new CustomEvent('noms-category-colours-updated'));return true;
}
