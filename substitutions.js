import {supabase} from './supabase-client.js';
let rules=[],owner=null,generation=0,issue='';
export const substitutionRules=()=>rules;
export const substitutionIssue=()=>issue;
export function clearSubstitutions(){generation++;owner=null;rules=[];issue=''}
export async function loadSubstitutions(userId){
 const current=++generation;owner=userId;rules=[];issue='';if(!userId)return;
 try{
  const {data,error}=await supabase.from('ingredient_substitutions').select('id,user_id,ingredient_id,substitute_id').order('id');
  if(current!==generation)return;
  if(error)throw error;rules=data||[];
 }catch(error){if(current===generation)issue=['42P01','PGRST205'].includes(error.code)?'Substitutions need database update 009_ingredient_substitutions.sql in Supabase.':`Could not load substitutions: ${error.message}`}
}
export async function addSubstitution(ingredientId,substituteId){
 if(!owner)throw new Error('Please sign in again.');
 if(ingredientId===substituteId)throw new Error('Choose two different ingredients.');
 if(rules.some(rule=>rule.ingredient_id===ingredientId&&rule.substitute_id===substituteId))throw new Error('This substitution already exists.');
 const userId=owner,current=generation;
 const {error}=await supabase.from('ingredient_substitutions').insert({user_id:userId,ingredient_id:ingredientId,substitute_id:substituteId});
 if(error)throw new Error(error.code==='23505'?'This substitution already exists.':error.message);
 if(current===generation)await loadSubstitutions(userId);
}
export async function removeSubstitution(id){
 const userId=owner,current=generation;if(!userId)throw new Error('Please sign in again.');
 const {error}=await supabase.from('ingredient_substitutions').delete().eq('id',id).eq('user_id',userId);
 if(error)throw error;if(current===generation)await loadSubstitutions(userId);
}
