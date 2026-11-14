// Isolated fixtures: no production data or authentication writes.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const homeFixture=fs.readFileSync(path.join(__dirname,'home-browser.cjs'),'utf8');
let mock=vm.runInNewContext(homeFixture.slice(0,homeFixture.indexOf('\n(async()=>'))+';mock',{require,__dirname,process});
mock=mock.replace('window.__mock={saved:true',`own.prep_minutes=5;own.cook_minutes=20;own.source_url='https://recipes.example.test/rice';own.creator={id:user.id,username:'bob',display_name:'Bob'};own.instructions=['Rinse the rice, then cook gently until tender. Keep the lid on while it rests.','Serve warm with your favourite vegetables and a little seasoning.'];
window.__mock={saved:true`);
mock=mock.replace("if(table==='recipe_tags')", "if(table==='inventory'&&op==='upsert')data={id:'inventory-rice',ingredient_id:values.ingredient_id,...values};if(table==='recipe_tags')");
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try{for(const width of [1440,768,375,320]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://home.test/**',route=>{const name=new URL(route.request().url()).pathname;if(name==='/cover.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#f5cce1"/><circle cx="300" cy="200" r="125" fill="#cab7fb"/><circle cx="300" cy="200" r="80" fill="#e5ed66"/></svg>'});return route.fulfill({body:fs.readFileSync(path.join(root,name==='/'?'index.html':name)),contentType:name.endsWith('.css')?'text/css':name==='/'?'text/html':'text/javascript'})});
  await page.route('**/supabase-client.js',route=>route.fulfill({body:mock,contentType:'text/javascript'}));
  await page.goto('https://home.test/');await page.locator('.home-recipe').first().waitFor();
  await page.locator('.home-recipe').first().focus();assert.equal(await page.locator('.home-recipe').first().evaluate(e=>getComputedStyle(e).outlineStyle),'solid');await page.keyboard.press('Enter');await page.locator('#detail-view.active').waitFor();
  assert.match(await page.locator('.recipe-overview').evaluate(e=>getComputedStyle(e).backgroundImage),/linear-gradient/);
  assert.equal(await page.locator('.instructions').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
  assert.equal(await page.locator('.recipe-overview').evaluate(e=>getComputedStyle(e).boxShadow),'none');
  assert.match(await page.locator('.detail-shareline').textContent(),/@bob/);
  assert.equal(await page.locator('.detail-source a').getAttribute('href'),'https://recipes.example.test/rice');
  assert.match(await page.locator('.facts').textContent(),/5 min prep/);assert.match(await page.locator('.facts').textContent(),/20 min cooking/);
  assert.equal(await page.locator('.instruction').count(),2);assert.match(await page.locator('.personal-feedback').evaluate(e=>getComputedStyle(e).backgroundImage),/linear-gradient/);
  const photo=await page.locator('.detail-image').boundingBox();assert.ok(Math.abs(photo.width-photo.height)<2);
  assert.equal(await page.locator('.detail-image img').evaluate(e=>getComputedStyle(e).filter),'none');
  await page.locator('#servings').fill('4');await page.locator('#servings').dispatchEvent('change');assert.match(await page.locator('#ingredient-checks .ingredient-row>b').textContent(),/280 g/);assert.equal(await page.locator('#recipe-yield-fact').textContent(),'4');
  await page.locator('[data-measurement="us"]').click();assert.equal(await page.locator('[data-measurement="us"]').getAttribute('aria-pressed'),'true');assert.match(await page.locator('#ingredient-checks .ingredient-row>b').textContent(),/oz/);
  await page.locator('[data-measurement="metric"]').click();assert.match(await page.locator('#ingredient-checks .ingredient-row>b').textContent(),/280 g/);
  await page.locator('[data-recipe-stock]').check();await page.waitForFunction(()=>window.__mock.writes.some(w=>w.table==='inventory'&&w.op==='upsert'));await page.waitForFunction(()=>!document.querySelector('[data-recipe-stock]').disabled);assert.equal(await page.locator('[data-recipe-stock]').isChecked(),true);
  const box=await page.locator('.recipe-presence-check').boundingBox();assert.ok(box.width>=44&&box.height>=44);
  await page.locator('.recipe-options summary').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('.recipe-options summary').click();
  await page.locator('[data-edit-recipe]').click();await page.locator('#modal-form [name="recipe-name"]').waitFor();assert.equal(await page.locator('#modal-form [name="recipe-visibility"]').inputValue(),'private');await page.locator('[data-action="close-modal"]').first().click();await page.locator('.modal-backdrop').waitFor({state:'detached'});
  await page.addStyleTag({content:'#toast{visibility:hidden!important}'});await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`/tmp/noms-editorial-detail-${width}.png`,fullPage:true});
  await page.locator('[data-start]').click();await page.locator('#cooking-view.active').waitFor();await page.locator('[data-action="exit-cook"]').click();await page.locator('#detail-view.active').waitFor();
  await page.getByRole('button',{name:'← Back to Home',exact:true}).click();await page.locator('.home-community-recipe').waitFor();await page.locator('.home-community-recipe').click();await page.locator('#detail-view.active').waitFor();assert.equal(await page.locator('[data-edit-recipe]').count(),0);await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedRecipeCode=text}}}));assert.match(await page.locator('.public-comments').evaluate(e=>getComputedStyle(e).backgroundImage),/linear-gradient/);await page.locator('[data-copy-recipe-code]').click();await page.waitForFunction(()=>window.__copiedRecipeCode==='ABC234');await page.locator('#detail-view [data-save-recipe]').click();await page.locator('#detail-view [data-save-recipe][aria-pressed="false"]').waitFor();
  assert.deepEqual(errors,[]);console.log(`${width}px: gradient hero, white instructions, square photo, source, metadata, serving scaling, measurement conversion, inventory checkbox, edit/privacy controls, cooking, save and navigation verified`);await page.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
