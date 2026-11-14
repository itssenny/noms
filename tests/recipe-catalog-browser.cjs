// Isolated fixture: no calls to the production Supabase backend.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const screenshots=process.env.SCREENSHOT_DIR||'/private/tmp/noms-catalog-screenshots';fs.mkdirSync(screenshots,{recursive:true});
const mock=`
const user={id:'00000000-0000-0000-0000-000000000002',email:'bob@example.test',created_at:'2026-01-01T00:00:00Z'};
const ingredient={id:'10000000-0000-0000-0000-000000000001',canonical_name:'Rice',category:'Carbohydrates',default_unit:'g'};
const starter={id:'20000000-0000-0000-0000-000000000001',user_id:null,catalog_key:'miso-bowl',share_code:'ABC234',name:'Miso chickpea crunch bowls',visibility:'public',servings:2,tags:['Fusion'],total_minutes:25,instructions:['Cook rice.'],source:'noms kitchen',recipe_ingredients:[{quantity:140,unit:'g',sort_order:0,ingredient}],creator:{username:'noms'}};
const own={...starter,id:'20000000-0000-0000-0000-000000000002',user_id:user.id,catalog_key:null,share_code:null,name:'My rice bowl',visibility:'private',rating:4};
window.__mock={saved:false,own,created:[],writes:[],ingredients:[ingredient,{...ingredient,id:'10000000-0000-0000-0000-000000000002',canonical_name:'salt',normalized_name:'salt'}],failImport:false,profile:{id:user.id,username:'bob',display_name:'Bob',profile_type:'personal',diet_preference:'Everything',cooking_level:'Home Cook',is_private:true,favorite_cuisines:[],created_at:user.created_at}};
const persisted=localStorage.getItem('noms-fixture-db');if(persisted)Object.assign(window.__mock,JSON.parse(persisted));
export const isSupabaseConfigured=true;
export const supabase={
 auth:{getSession:async()=>({data:{session:{user}}}),getUser:async()=>({data:{user}}),onAuthStateChange(){},signOut:async()=>({})},
 storage:{from:()=>({download:async()=>({data:new Blob(['cover'])})})},
 functions:{async invoke(name,{body}){window.__mock.importUrl=body.url;if(window.__mock.failImport)return {error:{context:new Response(JSON.stringify({error:'No structured recipe found. Add it manually.'}))}};return {data:{recipes:[window.__mock.importVariant==='cookies'?{name:'White Chocolate Chip Matcha Cookies',servings:16,tags:['Cookies'],time:30,prep:20,cook:10,source:body.url,ingredients:['2 cups + 3 Tablespoons (265g) all-purpose flour','1 ½ Tablespoons matcha powder','1 teaspoon baking soda','½ teaspoon salt','¾ cup (180g) unsalted butter, melted and slightly cooled','¾ cup (135g) light brown sugar','1/3 cup (70g) granulated sugar','1 large egg + 1 yolk','2 teaspoons vanilla extract','1 cup (175g) white chocolate chips'],steps:['Mix the cookie dough.','Bake the cookies.']}:{name:'Imported bowl',servings:2,tags:['Fusion'],time:20,prep:5,cook:15,source:body.url,ingredients:['140 g Rice','one handful mystery'],steps:['Cook rice.','Serve.']}]}}}},
 from(table){let op='select',values,filters={},single=false,pattern='';const q={select(){return q},eq(k,v){filters[k]=v;return q},ilike(k,v){pattern=v;return q},order(){return q},limit(){return q},insert(v){op='insert';values=v;return q},upsert(v){op='upsert';values=v;return q},update(v){op='update';values=v;return q},delete(){op='delete';return q},single(){single=true;return q},maybeSingle(){single=true;return q},then(resolve){const m=window.__mock;let data=[];if(op!=='select')m.writes.push({table,op,values});
 if(table==='profiles')data=op==='select'?[m.profile]:m.profile;
 if(table==='recipes'){if(op==='insert'){data={...values,id:'20000000-0000-0000-0000-'+String(m.created.length+3).padStart(12,'0'),share_code:null,recipe_ingredients:[]};m.created.push(data)}else{data=[m.own,...m.created];if(filters.id)data=data.filter(x=>x.id===filters.id);if(single)data=data[0]}}
 if(table==='saved_recipes')m.saved=op!=='delete';
 if(table==='recipe_ingredients'&&op==='insert'){for(const created of m.created)if(values.some(x=>x.recipe_id===created.id))created.recipe_ingredients=values.filter(x=>x.recipe_id===created.id).map(x=>({...x,ingredient:m.ingredients.find(i=>i.id===x.ingredient_id)}))}
 if(table==='recipe_tags')data=[{name:'Fusion',category:'Cuisine'}];
 if(table==='ingredients'){
 if(op==='insert'){const added={...values,id:'10000000-0000-0000-0000-'+String(m.ingredients.length+1).padStart(12,'0'),normalized_name:values.canonical_name.toLowerCase()};m.ingredients.push(added);data=added}
 else{data=m.ingredients.filter(i=>filters.normalized_name?i.canonical_name.toLowerCase()===filters.normalized_name:i.canonical_name.toLowerCase().includes(pattern.replaceAll('%','').toLowerCase()));if(single)data=data[0]}
 }
 if(single&&Array.isArray(data))data=data[0];localStorage.setItem('noms-fixture-db',JSON.stringify(m));
 resolve({data})}};return q},
 async rpc(name,args){const m=window.__mock;if(name==='discover_recipes')return {data:!args.p_search||/miso|abc234/i.test(args.p_search)?[starter]:[]};if(name==='get_saved_recipes')return {data:m.saved?[{recipe_id:starter.id,recipe:starter}]:[]};if(name==='get_visible_recipe'||name==='get_recipe_by_code')return {data:starter};return {data:[]}}
};`;
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/supabase-client.js',route=>route.fulfill({contentType:'application/javascript',body:mock}));
 await page.goto(process.env.FOODHUB_URL||'http://127.0.0.1:4173');await page.locator('#app-shell').waitFor({state:'visible'});
 await page.locator('[data-view="discover"]').first().click();await page.getByRole('heading',{name:'Miso chickpea crunch bowls'}).waitFor();
 await page.locator('#discover-search-form input').fill('abc234');await page.locator('#discover-search-form button').click();await page.locator('[data-discover-status]').getByText('1 recipes shown').waitFor();
 await page.screenshot({path:path.join(screenshots,'discover-desktop.png'),fullPage:true});
 await page.locator('[data-discover-results] .recipe-card').click();await page.locator('[data-copy-recipe-code="ABC234"]').waitFor();assert.equal(await page.locator('[data-edit-recipe]').count(),0);assert.equal(await page.locator('.personal-feedback').count(),0);
 await page.locator('[data-save-recipe]').click();await page.getByRole('button',{name:'Remove from Saved',exact:true}).waitFor();
 await page.locator('[data-view="recipes"]').first().click();await page.locator('#all-recipes').getByText('My rice bowl',{exact:true}).waitFor();assert.equal(await page.locator('#all-recipes').getByText('Miso chickpea crunch bowls',{exact:true}).count(),0);
 await page.locator('#recipe-page-navigation [data-recipe-page="saved"]').click();await page.locator('#all-recipes').getByText('Miso chickpea crunch bowls',{exact:true}).waitFor();
 await page.locator('#recipes-view [data-import-recipe]').click();await page.locator('[name="import-url"]').fill('https://recipes.example/bowl');await page.locator('#modal-form .primary-btn').click();
 await page.getByRole('heading',{name:'Review imported recipe'}).waitFor();assert.equal(await page.locator('[name="recipe-visibility"]').inputValue(),'private');assert.equal(await page.locator('[name="edit-recipe-id"]').count(),0);assert.equal(await page.locator('[name="source"]').inputValue(),'https://recipes.example/bowl');
 assert.equal(await page.locator('[name="ingredient-quantity"]').first().inputValue(),'140');assert.equal(await page.locator('[name="ingredient-note"]').first().inputValue(),'140 g Rice');
 assert.equal(await page.evaluate(()=>window.__mock.writes.filter(x=>['recipes','ingredients','recipe_ingredients'].includes(x.table)).length),0);
 await page.locator('#modal-form .primary-btn').click();await page.locator('#modal-form [data-import-resolve]').waitFor();await page.locator('#modal-form [data-recipe-save-error]').getByText(/Review the unmatched ingredient names/).waitFor();await page.waitForTimeout(2000);assert.equal(await page.locator('#modal-form [data-recipe-save-error]').isVisible(),true);assert.equal(await page.evaluate(()=>window.__mock.created.length),0);
 await page.locator('.recipe-ingredient-input').nth(1).locator('[data-action="remove-recipe-row"]').click();await page.locator('[name="recipe-name"]').fill('My edited imported bowl');await page.locator('[name="total-time"]').fill('');await page.locator('#modal-form .primary-btn').click();await page.locator('#modal-form [data-recipe-save-error]').getByText(/Total time/).waitFor();await page.locator('[name="total-time"]').fill('20');await page.locator('[name="ingredient-quantity"]').first().fill('0.001');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(screenshots,'import-review-mobile.png'),fullPage:true});
 await page.locator('#modal-form .primary-btn').click();await page.locator('#recipes-view.active').waitFor();await page.locator('#all-recipes').getByText('My edited imported bowl',{exact:true}).waitFor();
 const created=await page.evaluate(()=>window.__mock.created[0]);assert.equal(created.name,'My edited imported bowl');assert.equal(created.visibility,'private');assert.equal(created.share_code,null);assert.equal(created.source_url,'https://recipes.example/bowl');assert.equal(created.recipe_ingredients[0].quantity,0.001);assert.equal(created.recipe_ingredients[0].ingredient_id,'10000000-0000-0000-0000-000000000001');
 await page.evaluate(()=>window.__mock.failImport=true);await page.locator('#recipes-view [data-import-recipe]').click();await page.locator('[name="import-url"]').fill('https://recipes.example/blocked');await page.locator('#modal-form .primary-btn').click();await page.locator('[data-import-status]').getByText('No structured recipe found. Add it manually.').waitFor();assert.equal(await page.locator('[name="import-url"]').inputValue(),'https://recipes.example/blocked');
 await page.locator('[data-action="close-modal"]').first().click();
 await page.evaluate(()=>{window.__mock.failImport=false;window.__mock.importVariant='cookies'});
 await page.setViewportSize({width:1440,height:1000});await page.locator('[data-view="recipes"]').first().click();await page.locator('#recipe-search').fill('hide all existing recipes');
 await page.locator('#recipes-view [data-import-recipe]').click();await page.locator('[name="import-url"]').fill('https://www.delscookingtwist.com/white-chocolate-chip-matcha-cookies/');await page.locator('#modal-form .primary-btn').click();
 await page.getByRole('heading',{name:'Review imported recipe'}).waitFor();
 assert.equal(await page.locator('[name="ingredient-quantity"]').first().inputValue(),'265');
 assert.equal(await page.locator('.ingredient-picker>input').first().inputValue(),'all-purpose flour');
 await page.locator('[name="cook-time-type"]').selectOption('baking');
 const before=await page.evaluate(()=>({created:window.__mock.created.length,ingredients:window.__mock.ingredients.length}));
 await page.locator('#modal-form .primary-btn').click();await page.locator('[data-confirm-imported-ingredients]').waitFor();
 assert.equal(await page.evaluate(()=>window.__mock.created.length),before.created);assert.equal(await page.evaluate(()=>window.__mock.ingredients.length),before.ingredients);
 await page.locator('[data-confirm-imported-ingredients]').click();
 await page.locator('#recipes-view.active #all-recipes').getByText('White Chocolate Chip Matcha Cookies',{exact:true}).waitFor();
 const cookie=await page.evaluate(()=>window.__mock.created.find(r=>r.name==='White Chocolate Chip Matcha Cookies'));
 assert.equal(cookie.cook_time_type,'baking');assert.equal(cookie.cook_minutes,10);assert.equal(cookie.recipe_ingredients.length,10);assert.equal(cookie.recipe_ingredients[0].quantity,265);assert.equal(cookie.recipe_ingredients[0].unit,'g');assert.equal(cookie.recipe_ingredients[4].quantity,180);assert.equal(cookie.recipe_ingredients[7].quantity,null);assert.equal(cookie.visibility,'private');assert.equal(cookie.source_url,'https://www.delscookingtwist.com/white-chocolate-chip-matcha-cookies/');
 assert.equal(cookie.recipe_ingredients[3].ingredient_id,'10000000-0000-0000-0000-000000000002');
 await page.reload();await page.locator('#recipes-view.active #all-recipes').getByText('White Chocolate Chip Matcha Cookies',{exact:true}).waitFor();
 await page.locator('#all-recipes').getByText('White Chocolate Chip Matcha Cookies',{exact:true}).click();await page.getByText('min baking',{exact:false}).waitFor();await page.locator('[data-edit-recipe]').click();await page.locator('[name="cook-time-type"]').waitFor();assert.equal(await page.locator('[name="cook-time-type"]').inputValue(),'baking');
 assert.deepEqual(errors,[]);console.log('Browser passed: Discover/code search, starter ownership, Save/Created separation, import review, exact matching, unresolved ingredient validation, edited private save with source, failure retry, cookie metric quantities, confirmed missing-ingredient creation, 10 saved ingredient links, Created visibility after reload, desktop/mobile.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
