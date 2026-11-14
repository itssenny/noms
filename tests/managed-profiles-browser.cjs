// Local fixture only; no production Supabase requests.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const fixture=fs.readFileSync(__dirname+'/recipe-catalog-browser.cjs','utf8');
let mock=vm.runInNewContext(fixture.slice(fixture.indexOf('const mock='),fixture.indexOf('\n(async()=>'))+';mock');
mock=mock.replace("const starter=", "const nomsId='00000000-0000-0000-0000-000000000099';\nconst starter=")
 .replace('user_id:null,catalog_key:', 'user_id:nomsId,catalog_key:')
 .replace("creator:{username:'noms'}", "creator:{id:nomsId,username:'noms',display_name:'Noms',is_verified:true}")
 .replace('const persisted=', "window.__mock.noms={...window.__mock.profile,id:nomsId,username:'noms',display_name:'Noms',profile_type:'official',is_verified:true,is_private:false};window.__mock.starters=[starter,...[2,3].map(i=>({...starter,id:'20000000-0000-0000-0000-00000000000'+(i+5),name:'Starter '+i}))];\nconst persisted=")
 .replace("if(table==='profiles')data=op==='select'?[m.profile]:m.profile;", "if(table==='profiles'){let rows=[m.profile,m.noms];if(filters.id)rows=rows.filter(p=>p.id===filters.id);if(op==='update')Object.assign(rows[0],values);data=single?rows[0]:rows;}")
 .replace('data=[m.own,...m.created];', "data=[m.own,...m.created,...m.starters];if(filters.user_id)data=data.filter(x=>x.user_id===filters.user_id);if(op==='delete'){m.starters=m.starters.filter(x=>x.id!==filters.id);data=data.filter(x=>x.id===filters.id).map(x=>({id:x.id}));}")
 .replace("const m=window.__mock;if(name===", "const m=window.__mock;if(name==='get_visible_profile')return {data:m.noms};if(name==='update_recipe'){Object.assign(m.starters.find(x=>x.id===args.p_id),args.p_recipe);return {data:args.p_id}};if(name===");
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/supabase-client.js',route=>route.fulfill({contentType:'text/javascript',body:mock}));
 await page.goto(process.env.FOODHUB_URL||'http://127.0.0.1:4179');
 await page.locator('#active-profile-select').waitFor();await page.locator('#profile-button').click();
 await page.locator('[data-profile-action="edit"]').click();await page.locator('[name="diet_preference"]').selectOption('Vegan');await page.locator('[name="cooking_level"]').selectOption('Chef Mode');
 await page.locator('#profile-form .primary-btn').click();await page.locator('[data-profile-action="edit"]').waitFor();
 const write=await page.evaluate(()=>window.__mock.writes.find(x=>x.table==='profiles'));assert.equal(write.op,'update');assert.equal(write.values.diet_preference,'Vegan');assert.equal(write.values.cooking_level,'Chef Mode');assert.equal('id' in write.values,false);
 await page.locator('#active-profile-select').selectOption('00000000-0000-0000-0000-000000000099');
 await page.locator('#recipes-view.active #all-recipes .recipe-card').nth(2).waitFor();assert.equal(await page.locator('#all-recipes .recipe-card').count(),3);
 await page.locator('#profile-button').click();await page.locator('[data-profile-action="edit"]').click();assert.equal(await page.locator('[name="is_private"]').isDisabled(),true);await page.locator('[name="bio"]').fill('Managed kitchen');await page.locator('#profile-form .primary-btn').click();await page.locator('[data-profile-action="edit"]').waitFor();assert.equal(await page.locator('#profile-view [data-edit-recipe]').count(),3);
 await page.locator('#profile-view [data-visit-recipe]').first().click();
 await page.locator('#detail-view .detail-shareline .share-code').waitFor();assert.equal(await page.locator('#detail-view .detail-shareline .creator-attribution').count(),1);assert.equal(await page.locator('#detail-view .verified-mark').count(),1);
 await page.locator('#detail-view [data-edit-recipe]').click();await page.locator('[name="recipe-name"]').fill('Edited starter');await page.locator('#modal-form .primary-btn').click();await page.locator('#detail-view h1').getByText('Edited starter',{exact:true}).waitFor();
 await page.locator('#detail-view .recipe-options summary').click();await page.locator('#detail-view [data-delete-recipe]').click();await page.locator('#modal-form .primary-btn').click();await page.locator('#recipes-view.active').waitFor();assert.equal(await page.locator('#all-recipes .recipe-card').count(),2);await page.locator('#all-recipes .recipe-card').first().click();await page.locator('#detail-view .creator-attribution').click();await page.locator('#profile-view.active [data-profile-action="edit"]').waitFor();assert.equal(await page.locator('#profile-view .verified-mark').count(),1);assert.deepEqual(errors,[]);
 console.log('Managed profile browser passed: personal preference save, profile switch, three Created starters, official profile edit, verified attribution beside code, starter edit/delete.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
