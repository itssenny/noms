import {migratePlans} from './planning.mjs';
const prefix='mise-and-meal-state-v2:';
// The old shared key has no owner. Preserve it without exposing it to an account.
export function readAccountState(storage,userId){
 if(!userId)return {plans:[],shopping:[]};
 const saved=JSON.parse(storage.getItem(prefix+userId)||'null');
 return {plans:Array.isArray(saved?.plans)?migratePlans(saved.plans):[],shopping:Array.isArray(saved?.shopping)?saved.shopping:[]};
}
export function writeAccountState(storage,userId,state){
 if(userId)storage.setItem(prefix+userId,JSON.stringify({plans:state.plans,shopping:state.shopping}));
}
