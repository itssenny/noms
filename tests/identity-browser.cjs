// Local fixtures only. Verify the visual refresh without touching production data.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),fixture=fs.readFileSync(path.join(__dirname,'home-browser.cjs'),'utf8');
let mock=vm.runInNewContext(fixture.slice(0,fixture.indexOf('\n(async()=>'))+';mock',{require,__dirname,process});
mock=mock.replace("if(table==='recipe_tags')",`if(table==='inventory'&&op==='select')data=[{id:'inventory-1',ingredient,quantity:120,unit:'g',is_active:true,low_stock_threshold:150,storage_location:'Pantry'},{id:'inventory-2',ingredient:{...ingredient,id:'10000000-0000-0000-0000-000000000002',canonical_name:'Salt',category:'Spices'},quantity:0,unit:'g',is_active:true,low_stock_threshold:10,storage_location:'Pantry'}];if(table==='recipe_tags')`);
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try{for(const width of [1440,768,375,320]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-11-14T12:00:00Z')});
  await page.addInitScript(()=>localStorage.setItem('mise-and-meal-state-v2:00000000-0000-0000-0000-000000000002',JSON.stringify({shopping:[],plans:[{id:1,recipe:'20000000-0000-0000-0000-000000000002',date:'2026-11-14',day:'Saturday',slot:'Dinner',servings:2}]})));
  await page.route('https://home.test/**',route=>{const name=new URL(route.request().url()).pathname;if(name==='/cover.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#f5cce1"/><circle cx="300" cy="200" r="125" fill="#cab7fb"/><circle cx="300" cy="200" r="80" fill="#e5ed66"/></svg>'});return route.fulfill({body:fs.readFileSync(path.join(root,name==='/'?'index.html':name)),contentType:name.endsWith('.css')?'text/css':name==='/'?'text/html':'text/javascript'})});
  await page.route('**/supabase-client.js',route=>route.fulfill({body:mock,contentType:'text/javascript'}));
  await page.goto('https://home.test/');await page.locator('.home-recipe').first().waitFor();await page.locator('.home-community-recipe').waitFor();
  await page.addStyleTag({content:'#toast,.toast,.floating-toast{display:none!important}'});
  const noOverflow=async()=>{const info=await page.evaluate(()=>({page:location.hash,width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>!e.closest('.table-wrap')).map(e=>({tag:e.tagName,cls:typeof e.className==='string'?e.className:'svg',right:e.getBoundingClientRect().right})).filter(e=>e.right>innerWidth+1).slice(0,10)}));assert.ok(info.scroll<=info.width,JSON.stringify(info))};
  const screenshot=async name=>{await noOverflow();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`/tmp/noms-identity-${name}-${width}.png`,fullPage:true,animations:'disabled'})};
  assert.equal(await page.locator('.home-day').count(),3);assert.equal(await page.locator('.home-recipe').count(),4);assert.match(await page.locator('.week-panel').evaluate(e=>getComputedStyle(e).backgroundImage),/linear-gradient/);await screenshot('home');
  const gradients=new Map();
  for(const name of ['discover','recipes','planner','inventory']){
   await page.locator(`.main-nav [data-view="${name}"]`).click();await page.locator(`#${name}-view.active`).waitFor();await screenshot(name);
   if(name==='recipes'){
    const cards=page.locator('#all-recipes .recipe-card'),count=await cards.count();
    for(let i=0;i<Math.min(count,3);i++){
     await cards.nth(i).locator('h3').click();await page.locator('.recipe-overview').waitFor();
     const tone=await page.locator('.recipe-overview').getAttribute('data-recipe-tone'),gradient=await page.locator('.recipe-overview').evaluate(e=>getComputedStyle(e).backgroundImage);assert.match(gradient,/linear-gradient/);gradients.set(tone,gradient);await screenshot('hero-'+tone);
     await page.locator('.recipe-overview>.back-btn').click();await page.locator('#recipes-view.active').waitFor();
    }
    assert.equal(gradients.size,3);assert.equal(new Set(gradients.values()).size,3);
   }
   if(name==='planner'){
    await page.locator('[data-planner-slots]').check();await page.locator('.week-grid.with-meal-slots').waitFor();await noOverflow();await page.locator('[data-planner-slots]').uncheck();
   }
   if(name==='inventory'){
    const ramps=await page.locator('.stock-filter').evaluateAll(nodes=>nodes.map(e=>getComputedStyle(e).backgroundImage));assert.ok(ramps.every(g=>g.includes('linear-gradient')));assert.equal(new Set(ramps).size,3);
    await page.locator('[data-inventory-status="out"]').click();assert.equal(await page.locator('[data-inventory-status="out"]').getAttribute('aria-pressed'),'true');await page.locator('#inventory-search').fill('Salt');assert.match(await page.locator('#inventory-body').textContent(),/Salt/);await page.locator('#inventory-search').fill('');
   }
  }
  await page.locator('.main-nav [data-view="planner"]').click();await page.locator('[data-meal-page="shopping"]').click();await page.locator('.often-bought-panel').waitFor();assert.match(await page.locator('.often-bought-panel').evaluate(e=>getComputedStyle(e).backgroundImage),/linear-gradient/);await screenshot('shopping');
  await page.locator('#profile-button').click();await page.locator('.profile-card').waitFor();assert.match(await page.locator('.profile-wash').evaluate(e=>getComputedStyle(e).backgroundImage),/linear-gradient/);await screenshot('profile');
  await page.locator('[data-profile-action="edit"]').click();await page.locator('#profile-form').waitFor();await noOverflow();await page.locator('[data-profile-action="cancel"]').first().click();
  await page.locator('.main-nav [data-view="home"]').click();await page.locator('#home-view [data-action="add-recipe"]').click();await page.locator('.recipe-modal').waitFor();assert.match(await page.locator('.recipe-modal .modal-head').evaluate(e=>getComputedStyle(e).backgroundImage),/linear-gradient/);await screenshot('create');await page.locator('[data-action="close-modal"]').first().click();await page.locator('.modal-backdrop').waitFor({state:'detached'});
  await page.locator('.home-community-image img').evaluate(img=>img.dispatchEvent(new Event('error')));assert.equal(await page.locator('.home-community-image .cover-fallback').count(),1);await noOverflow();
  const homeCss=await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor);assert.equal(homeCss,'rgb(255, 255, 255)');
  assert.deepEqual(errors,[]);console.log(`${width}px: Home, Discover, Recipes, all three hero tones, planner slots, inventory filters, profile/editor, creation and image fallback pass without page overflow`);await page.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
