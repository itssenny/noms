import test from 'node:test';
import assert from 'node:assert/strict';
import {feedbackPatch,noteTimeLabel} from '../feedback.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const recipe={id:'r',rating:4,notes:'Earlier note.'};
test('new notes are independent posts and optional blank post-cook input preserves the rating',()=>{
 assert.deepEqual(feedbackPatch(recipe,{append:true}),{});assert.deepEqual(feedbackPatch(recipe,{rating:'5',notes:' New post ',append:true}),{rating:5,note:'New post'});
 assert.deepEqual(feedbackPatch(recipe,{notes:'Only a note',append:true}),{note:'Only a note'});assert.deepEqual(feedbackPatch(recipe,{}),{rating:null});
 for(const rating of ['0','6','bad'])assert.throws(()=>feedbackPatch(recipe,{rating}));assert.throws(()=>feedbackPatch(recipe,{notes:'x'.repeat(5001)}));
});
test('timestamps graduate from minutes and hours to days, weekday and a full date',()=>{
 const now=new Date('2026-11-13T12:00:00Z'),ago=seconds=>new Date(Number(now)-seconds*1000).toISOString();
 assert.equal(noteTimeLabel(ago(10),now),'Just now');assert.equal(noteTimeLabel(ago(300),now),'5 min ago');assert.equal(noteTimeLabel(ago(3600),now),'1 hr ago');assert.equal(noteTimeLabel(ago(90000),now),'1 day ago');assert.equal(noteTimeLabel(ago(3*86400),now),'Tuesday');assert.equal(noteTimeLabel('2026-02-13T12:00:00Z',now),'13 Feb 2026');assert.match(noteTimeLabel(null,now),/date unknown/);
});
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
function harness(){const pending=[],calls=[],context=vm.createContext({feedbackPatch,ownsRecipe:()=>true,crypto:{randomUUID:()=> 'nonce'},sessionVersion:1,activeUserId:'a',recipes:[structuredClone(recipe)],currentRecipe:structuredClone(recipe),currentUser:async()=>({id:'a'}),supabase:{rpc(name,args){calls.push({name,args});return new Promise(resolve=>pending.push(resolve))}}});vm.runInContext(source.slice(source.indexOf('async function saveRecipeFeedback('),source.indexOf("document.addEventListener('click',event=>{\n const shoppingButton")),context);return {context,pending,calls}}
test('rating and note save atomically with a stable draft ID, and update only after success',async()=>{
 const {context:c,pending,calls}=harness();const saving=c.saveRecipeFeedback('r',{rating:'5',notes:'New note',noteId:'draft'});await new Promise(setImmediate);assert.equal(c.recipes[0].rating,4);assert.equal(calls[0].name,'save_recipe_rating_feedback');assert.equal(calls[0].args.p_note_id,'draft');assert.equal(calls[0].args.p_note,'New note');pending[0]({data:{rating:5,posts:[{id:'draft',body:'New note',created_at:'2026-11-13T12:00:00Z'}]}});await saving;assert.equal(c.recipes[0].rating,5);assert.equal(c.currentRecipe.notePosts.length,1);assert.equal(c.currentRecipe.notes,'Earlier note.');
});
test('failed and stale saves retain notes; missing setup explains update 032',async()=>{
 const a=harness();const failure=a.context.saveRecipeFeedback('r',{notes:'new'});await new Promise(setImmediate);a.pending[0]({error:{code:'PGRST202',message:'missing'}});await assert.rejects(failure,/032_personal_community_ratings.sql/);assert.equal(a.context.recipes[0].notes,recipe.notes);
 const b=harness();const stale=b.context.saveRecipeFeedback('r',{rating:'5'});await new Promise(setImmediate);b.context.sessionVersion++;b.context.activeUserId='b';b.pending[0]({data:{rating:5,posts:[]}});assert.equal(await stale,null);assert.equal(b.context.recipes[0].rating,4);
});
test('recipe shopping changes only the cart and restores it when persistence fails',()=>{
 for(const succeeds of [true,false]){
  const plans=[{recipe:'other'}],cart=[{name:'Salt',qty:1}],context=vm.createContext({recipes:[recipe],plans,shopping:cart,checks:()=>[{name:'Rice',ingredientId:'rice',need:200,missing:200,unit:'g'}],plannedSubstitutions:()=>({}),addSelectedIngredients:(shopping,rows)=>[...shopping,{name:rows[0].name}],saveState:()=>succeeds});
  vm.runInContext(source.slice(source.indexOf('function saveRecipeShopping('),source.indexOf('function plannedLeftoverSource(')),context);
  const data={get:key=>({recipe:'r',servings:'2'}[key]??null),getAll:()=>['0']};
  if(succeeds){context.saveRecipeShopping(data);assert.equal(context.shopping.length,2)}else{assert.throws(()=>context.saveRecipeShopping(data));assert.equal(context.shopping,cart)}assert.equal(context.plans,plans);
 }
});
