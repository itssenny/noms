import test from 'node:test';
import assert from 'node:assert/strict';
import {hasRecipeTag,taggedRecipes} from '../recipe-tags.mjs';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('tag browsing matches exact tags regardless of case, includes cuisine, and deduplicates',()=>{
 const rows=[{id:'a',tags:['Vegan']},{id:'b',tags:['non-vegan']},{id:'c',cuisine:'Italian'},{id:'a',tags:['vegan']}];
 assert.deepEqual(taggedRecipes(rows,' vegan ').map(row=>row.id),['a']);assert.ok(hasRecipeTag(rows[2],'ITALIAN'));assert.equal(hasRecipeTag(rows[1],'vegan'),false);assert.equal(hasRecipeTag(rows[0],''),false);
});
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
test('tag loading ignores responses from a previous account or tag view',async()=>{
 let resolve;const root={_tag:'Vegan',_offset:0,_rows:[],querySelector:()=>({disabled:false})};
 const c=vm.createContext({$:()=>root,sessionVersion:1,supabase:{rpc:()=>new Promise(r=>resolve=r)},hydrateCovers:async()=>{throw new Error('Stale response must not hydrate')},mapRecipe:x=>x,taggedRecipes,renderTagRecipes(){throw new Error('Stale response must not render')}});
 const start=source.indexOf('async function loadTagRecipes('),end=source.indexOf("document.addEventListener('click',event=>{\n const button=event.target.closest('[data-browse-tag]')",start);
 vm.runInContext(source.slice(start,end),c);const pending=c.loadTagRecipes();c.sessionVersion=2;resolve({data:[{id:'private'}]});await pending;assert.equal(root._rows.length,0);
});
test('tags use accessible buttons and are excluded from Discover card navigation',()=>{
 assert.match(source,/type="button" class="tag" data-browse-tag=/);assert.ok(source.includes("event.target.closest('details,[data-browse-tag],[data-visit-recipe],[data-visit-profile]')"));
});
