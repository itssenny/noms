import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {dateKey} from '../planning.mjs';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const homeSource=source.slice(source.indexOf('const homeFeaturedCatalogKey='),source.indexOf('\nfunction recipesView()'));
function harness(){
 const nodes=new Map(),c=vm.createContext({Date:class extends Date{constructor(...args){super(...(args.length?args:[2026,11,31,12]))}},Intl,Symbol,sessionVersion:1,loadedUserId:'u',activeUserId:'u',recipes:[],plans:[],savedIds:new Set(),mealSlots:['Breakfast','Lunch','Dinner','Snack'],dateKey,ownsRecipe:r=>r.userId==='u',escapeHtml:value=>String(value??'').replaceAll('<','&lt;'),icon:()=>'',framingStyle:()=>'',recipeVisual:r=>`<img alt="${r.name}">`,document:{addEventListener(){}},$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)},supabase:{},mapRecipe:row=>row,hydrateCovers:async rows=>rows});
 c.$('#home-view')._kitchenVersion=1;c.$('#home-pick')._version=1;
 vm.runInContext(homeSource,c);return c;
}
test('Home shows three calendar dates across a year boundary, all meals, and an empty-day action',()=>{
 const c=harness();c.recipes=[{id:'a',name:'Rice',userId:'u'}];c.plans=[{recipe:'a',date:'2026-12-31',slot:'Dinner',servings:2},{recipe:'a',date:'2026-12-31',slot:'Lunch',servings:1},{recipe:'a',date:'2027-01-02',slot:'Dinner'},{recipe:'a',date:'2026-12-30',slot:'Breakfast'}];c.home();
 const html=c.$('#home-meals').innerHTML;assert.match(html,/datetime="2026-12-31"/);assert.match(html,/datetime="2027-01-01"/);assert.match(html,/datetime="2027-01-02"/);assert.match(html,/data-add-date="2027-01-01"/);assert.equal((html.match(/home-planned-meal/g)||[]).length,3);assert.ok(html.indexOf('Lunch')<html.indexOf('Dinner'));assert.doesNotMatch(html,/Breakfast/);
});
test('Home gallery includes created and saved recipes, excludes unrelated public references, and prioritizes real cooking history',()=>{
 const c=harness();c.recipes=[{id:'a',name:'Apple',userId:'u'},{id:'b',name:'Bread',userId:'other',lastCookedAt:'2026-12-30'},{id:'c',name:'Unrelated public recipe',userId:'other'},{id:'d',name:'Dumplings',userId:'u'},{id:'e',name:'Eggs',userId:'u'},{id:'f',name:'Fish',userId:'u'}];c.savedIds.add('b');c.home();const html=c.$('#home-recipes').innerHTML;assert.equal((html.match(/class="home-recipe"/g)||[]).length,4);assert.ok(html.indexOf('Bread')<html.indexOf('Apple'));assert.doesNotMatch(html,/Unrelated|Fish/);
});
test('Loading, errors and a genuinely empty cookbook remain distinct; unavailable planned recipes are preserved',()=>{
 const c=harness();c.loadedUserId=null;c.home();assert.match(c.$('#home-recipes').innerHTML,/Opening your kitchen/);c.$('#home-view')._kitchenIssue=true;c.home();assert.match(c.$('#home-recipes').innerHTML,/data-home-retry/);c.loadedUserId='u';c.$('#home-view')._kitchenIssue=false;c.plans=[{recipe:'gone',date:'2026-12-31'}];c.home();assert.match(c.$('#home-recipes').innerHTML,/Good taste starts here/);assert.match(c.$('#home-meals').innerHTML,/Recipe unavailable/);
});
test('Noms Pick rejects non-official and private results, and ignores stale account responses',async()=>{
 const c=harness();let row={id:'pick',name:'Pick',visibility:'public',creator:{username:'other',profile_type:'official'}};
 c.supabase={from:()=>({select(){return this},eq(){return this},limit:async()=>({data:[{id:'pick'}]})}),rpc:async()=>({data:row})};
 await c.loadHomePick();assert.doesNotMatch(c.$('#home-pick').innerHTML,/data-home-recipe/);
 row={...row,visibility:'private',creator:{username:'noms',profile_type:'official'}};await c.loadHomePick();assert.doesNotMatch(c.$('#home-pick').innerHTML,/data-home-recipe/);
 row.visibility='public';await c.loadHomePick();assert.match(c.$('#home-pick').innerHTML,/data-home-recipe="pick"/);
 let resolve;c.supabase.rpc=()=>new Promise(done=>{resolve=done});const pending=c.loadHomePick();await new Promise(setImmediate);c.sessionVersion++;c.$('#home-pick').innerHTML='New account';resolve({data:row});await pending;assert.equal(c.$('#home-pick').innerHTML,'New account');
});
