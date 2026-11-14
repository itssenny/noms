// Isolated UI flow: no production Supabase requests.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm');
(async()=>{
 const fixture=await fs.readFile(path.join(__dirname,'recipe-catalog-browser.cjs'),'utf8');
 let mock=vm.runInNewContext(fixture.slice(fixture.indexOf('const mock='),fixture.indexOf('\n(async()=>'))+';mock');
 mock=mock.replace("const m=window.__mock;if(name==='discover_recipes')",`const m=window.__mock;
 m.ratings||={};
 const summary=id=>{const mine=m.ratings[id]||{rating:id===m.own.id?4:null,share:false};return {id,personal_rating:mine.rating,rating:mine.rating,contribute_to_community:mine.share,community_average:mine.share?mine.rating:null,community_count:mine.share?1:0,posts:[]}};
 if(name==='get_recipe_ratings')return {data:args.p_ids.map(summary)};
 if(name==='save_recipe_rating_feedback'){const previous=summary(args.p_id);const rating=args.p_set_rating?args.p_rating:previous.rating;m.ratings[args.p_id]={rating,share:rating!=null&&args.p_contribute};return {data:summary(args.p_id)}};
 if(name==='discover_recipes')`);
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://ratings.test/**',async route=>{const pathname=new URL(route.request().url()).pathname;const file=path.join(__dirname,'..',pathname==='/'?'index.html':pathname);await route.fulfill({body:await fs.readFile(file),contentType:pathname.endsWith('.css')?'text/css':pathname==='/'?'text/html':'text/javascript'});});
 await page.route('**/supabase-client.js',route=>route.fulfill({contentType:'text/javascript',body:mock}));
 await page.goto('https://ratings.test/');await page.locator('#app-shell').waitFor({state:'visible'});
 await page.locator('[data-view="discover"]').first().click();await page.locator('[data-discover-results]').getByText('No public ratings yet').waitFor();
 await page.locator('[data-discover-results] h3').first().click();const form=page.locator('#recipe-feedback-form');await form.waitFor();const checkbox=form.getByRole('checkbox',{name:'Contribute to community rating'});assert.equal(await checkbox.isChecked(),false);
 await form.getByRole('button',{name:'Rate 5 out of 5',exact:true}).click();await form.getByRole('button',{name:'Save rating & private note'}).click();await form.locator('[data-feedback-status]').getByText('Saved',{exact:true}).waitFor();assert.equal(await page.locator('#recipe-rating-fact').textContent(),'★ 5');assert.match(await page.locator('.facts .community-rating').textContent(),/No public/);
 await checkbox.check();await form.getByRole('button',{name:'Save rating & private note'}).click();await page.locator('.facts .community-rating').getByText('5.0 (1)',{exact:true}).waitFor();
 await form.getByRole('button',{name:'Rate 3 out of 5',exact:true}).click();await form.getByRole('button',{name:'Save rating & private note'}).click();await page.locator('.facts .community-rating').getByText('3.0 (1)',{exact:true}).waitFor();
 await checkbox.uncheck();await form.getByRole('button',{name:'Save rating & private note'}).click();await page.locator('.facts .community-rating').getByText('No public ratings yet',{exact:true}).waitFor();assert.equal(await page.locator('#recipe-rating-fact').textContent(),'★ 3');
 await page.locator('#detail-view [data-save-recipe]').click();await page.locator('#detail-view [data-save-recipe][aria-pressed="true"]').waitFor();
 await page.locator('[data-view="recipes"]').first().click();await page.locator('[data-recipe-page="saved"]').click();await page.locator('#all-recipes .personal-rating').getByText('★ 3 · Your rating',{exact:true}).waitFor();await page.locator('[data-recipe-sort]').selectOption('rating-desc');
 await page.locator('#all-recipes h3').first().click();await form.waitFor();assert.equal(await checkbox.isChecked(),false);await form.getByRole('button',{name:'Clear rating selection'}).click();await form.getByRole('button',{name:'Save rating & private note'}).click();await page.locator('#recipe-rating-fact').getByText('Not rated',{exact:true}).waitFor();assert.equal(await checkbox.isChecked(),false);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/noms-community-rating-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
 await page.locator('[data-view="recipes"]').first().click();await page.locator('[data-recipe-page="created"]').click();await page.locator('#all-recipes h3').first().click();await form.waitFor();assert.equal(await form.getByRole('checkbox').count(),0);assert.equal(await page.locator('.facts .community-rating').count(),0);assert.equal(await page.locator('#recipe-rating-fact').textContent(),'★ 4');
 assert.deepEqual(errors,[]);console.log('Passed: private default, opt-in, rating update, opt-out, Saved personal rating, sorting, deletion, private-recipe form and mobile layout.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
