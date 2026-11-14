import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
test('refreshing unchanged recipe libraries preserves their controls and card DOM',()=>{
 let pageWrites=0,cardWrites=0;
 const grid={set innerHTML(value){cardWrites++;this.html=value}},root={childNodes:[],replaceChildren(){},querySelector:()=>grid,set innerHTML(value){pageWrites++;this.html=value}},count={};
 const recipe={id:'one',name:'Soup',tags:[],cuisine:'Other'};
 const context=vm.createContext({sessionVersion:1,libraryTab:'created',cookbooks:{reset(){}},libraryRecipes:()=>[recipe],recipes:[recipe],availability:()=>false,escapeHtml:String,icon:()=>'',recipeFilters:{search:'',ready:false,sort:'az'},filterRecipes:rows=>rows,card:row=>`<article>${row.name}</article>`,unavailableSaves:[],$:selector=>({'#recipes-view':root,'#all-recipes':grid,'#recipe-result-count':count}[selector])});
 vm.runInContext(source.slice(source.indexOf('function recipesView(){'),source.indexOf('function invRows(')),context);
 context.recipesView();context.recipesView();assert.equal(pageWrites,1);assert.equal(cardWrites,1);
 recipe.name='Updated soup';context.recipesView();assert.equal(cardWrites,2);assert.match(grid.html,/Updated soup/);
});
test('cover refresh reuses a stable URL only after access succeeds; denied covers are cleared',async()=>{
 let allowed=true,downloads=0,created=0;
 const context=vm.createContext({sessionVersion:1,hydrateRecipeRatings:async rows=>rows,coverPath:value=>value,recipes:[{imagePath:'owner/photo.webp',imageUrl:'blob:existing'}],coverBlobs:new Set(['blob:existing']),URL:{createObjectURL(){created++;return 'blob:new'}},supabase:{storage:{from:()=>({download:async()=>{downloads++;return allowed?{data:{}}:{error:new Error('Denied')}}})}}});
 vm.runInContext(source.slice(source.indexOf('async function hydrateCovers('),source.indexOf('async function refreshLibrary(')),context);
 const rows=[{id:'one',image_url:'owner/photo.webp'}];
 assert.equal((await context.hydrateCovers(rows))[0].image_url,'blob:existing');assert.equal(created,0);assert.equal(downloads,1);
 allowed=false;assert.equal((await context.hydrateCovers(rows))[0].image_url,'');assert.equal(downloads,2);
 allowed=true;context.coverBlobs.clear();assert.equal((await context.hydrateCovers(rows))[0].image_url,'blob:new');assert.equal(created,1);
});
