const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const fixture=fs.readFileSync(root+'/tests/recipe-catalog-browser.cjs','utf8');
let mock=vm.runInNewContext(fixture.slice(fixture.indexOf('const mock='),fixture.indexOf('\n(async()=>'))+';mock');
mock=mock.replace("window.__mock={saved:false", "starter.catalog_key='gochujang-pasta-v1';starter.creator.profile_type='official';starter.image_url='https://home.test/cover.svg';own.image_url=starter.image_url;\nwindow.__mock={saved:true");
mock=mock.replace("const persisted=", "window.__mock.created=[{...own,id:'20000000-0000-0000-0000-000000000003',name:'Sesame noodles'},{...own,id:'20000000-0000-0000-0000-000000000004',name:'Pancakes'},{...own,id:'20000000-0000-0000-0000-000000000005',name:'Tomato toast'}];\nconst persisted=");
mock=mock.replace("if(filters.id)data=data.filter", "if(filters.catalog_key)data=[starter];if(filters.id)data=data.filter");
mock=mock.replace("const m=window.__mock;if(name==='discover_recipes')", "const m=window.__mock;if(name==='get_recipe_ratings')return {data:args.p_ids.map(id=>({id,personal_rating:0}))};if(name==='get_recipe_made')return {data:args.p_ids.map(id=>({id,made_at:id.endsWith('000003')?'2026-11-13T12:00:00Z':null}))};if(name==='get_visible_recipe')return {data:args.p_id===starter.id?starter:m.own};if(name==='discover_recipes')");
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});try{
for(const width of [1440,768,375,320]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-11-14T12:00:00Z')});
 await page.addInitScript(()=>localStorage.setItem('mise-and-meal-state-v2:00000000-0000-0000-0000-000000000002',JSON.stringify({shopping:[],plans:[{id:1,recipe:'20000000-0000-0000-0000-000000000002',date:'2026-11-14',day:'Saturday',slot:'Dinner',servings:2},{id:2,recipe:'20000000-0000-0000-0000-000000000003',date:'2026-11-16',day:'Monday',slot:'Lunch',servings:1},{id:3,recipe:'20000000-0000-0000-0000-000000000002',date:'2026-11-13',day:'Friday',slot:'Dinner',servings:2}]})));
 await page.route('https://home.test/**',route=>{const p=new URL(route.request().url()).pathname;if(p==='/cover.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#f5cce1"/><circle cx="300" cy="200" r="130" fill="#cab7fb"/><circle cx="300" cy="200" r="85" fill="#e5ed66"/></svg>'});return route.fulfill({body:fs.readFileSync(path.join(root,p==='/'?'index.html':p)),contentType:p.endsWith('.css')?'text/css':p==='/'?'text/html':'text/javascript'})});
 await page.route('**/supabase-client.js',route=>route.fulfill({body:mock,contentType:'text/javascript'}));
 await page.goto('https://home.test/');await page.locator('.home-recipe').first().waitFor();await page.locator('.home-community-recipe').waitFor();
 assert.equal(await page.locator('.home-day').count(),3);assert.deepEqual(await page.locator('.home-day time').evaluateAll(ns=>ns.map(n=>n.dateTime)),['2026-11-14','2026-11-15','2026-11-16']);assert.equal(await page.locator('.home-planned-meal').count(),2);assert.equal(await page.locator('.home-recipe').count(),4);assert.match(await page.locator('.home-recipe').first().textContent(),/Sesame noodles/);assert.equal(await page.locator('.low-panel').count(),0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`/tmp/noms-home-${width}.png`,fullPage:true});
 await page.locator('.home-recipe').first().focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'← Back to Home',exact:true}).click();await page.locator('#home-view.active').waitFor();
 await page.locator('[data-add-date="2026-11-15"]').click();await page.locator('[data-select-plan-recipe]').first().click();assert.equal(await page.locator('#modal-form [name="date"]').inputValue(),'2026-11-15');await page.locator('[data-action="close-modal"]').first().click();
 for(const dest of ['discover','recipes','planner','inventory','home']){await page.locator(`.main-nav [data-view="${dest}"]`).click();await page.locator(`#${dest}-view.active`).waitFor()}
 assert.deepEqual(errors,[]);console.log(width+'px: dates, created/saved gallery, official pick, keyboard recipe opening, return Home, date-specific planning, five destinations and no overflow verified');await page.close();
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
