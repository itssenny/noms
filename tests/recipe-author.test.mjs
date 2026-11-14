import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const createSource=source.slice(source.indexOf('async function createRecipe('),source.indexOf('function recipePayload('));
const creatorSource=source.slice(source.indexOf('function creatorAttribution('),source.indexOf('function recipeSourceMarkup('));
const metaStart=source.indexOf('<div class="detail-shareline recipe-meta-line">');
const metaSource=source.slice(metaStart,source.indexOf('</div><p class="recipe-source',metaStart)+6);
function setup(profile){
 const writes=[];
 const c=vm.createContext({activeProfileId:profile.id,activeProfile:profile,sessionVersion:1,currentUser:async()=>({id:'personal-login'}),uploadRecipeCover:async()=>'',hydrateCovers:async rows=>rows,escapeHtml:v=>String(v??''),icon:()=>'',supabase:{from(table){return {insert(value){writes.push({table,value});return this},select(){return this},single:async()=>({data:{id:'new-recipe',share_code:'ABC234'}}),then(resolve){return Promise.resolve({data:[]}).then(resolve)}}}}});
 vm.runInContext(createSource+creatorSource,c);
 return {c,writes};
}
for(const profile of [{id:'official',username:'noms',display_name:'Noms',is_verified:true},{id:'personal',username:'senny',display_name:'Senny'}]){
 for(const visibility of ['public','private'])test(`new ${visibility} recipe preserves @${profile.username} author immediately after saving`,async()=>{
  const {c,writes}=setup(profile);
  const saved=await c.createRecipe({name:'New recipe',visibility,source:'Family',ingredients:[['Rice',1,'cup','','rice']]},null);
  assert.equal(saved.creator,profile);assert.equal(saved.userId,profile.id);assert.equal(writes[0].value.user_id,profile.id);
  c.r=saved;const html=vm.runInContext('`'+metaSource+'`',c);
  assert.match(html,new RegExp('@'+profile.username));assert.match(html,new RegExp('>'+ (visibility==='public'?'Public':'Private') +'<'));
  assert.ok(html.indexOf('creator-attribution')<html.indexOf('recipe-privacy-badge'));
  if(visibility==='public'){assert.match(html,/data-copy-recipe-code="ABC234"/);assert.ok(html.indexOf('recipe-privacy-badge')<html.indexOf('data-copy-recipe-code'))}
  else assert.doesNotMatch(html,/ABC234|data-copy-recipe-code/);
 });
}
test('profile switches during creation still abort before any database write',async()=>{
 const {c,writes}=setup({id:'official',username:'noms'});
 c.currentUser=async()=>{c.activeProfileId='personal';return {id:'personal-login'}};
 await assert.rejects(c.createRecipe({source:'Family'},null),/Active profile changed/);assert.equal(writes.length,0);
});
