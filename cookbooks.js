// Personal collections reference recipes; the database remains the authority for access.
export function cookbookAction(id,escape){return `<button type="button" class="secondary-btn cookbook-add" data-cookbook-add="${escape(id)}" aria-label="Add to Cookbook">Add to Cookbook</button>`}
export function createCookbooks({supabase,escapeHtml:e,session,hydrate,mapRecipe,visual,card,openCookbook,remember,getLibrary,isLibraryRecipe,saveRecipe}){
 let books=[],serial=0,selected='',detailRows=[];
 const root=()=>document.querySelector('#recipes-view');
 const alive=(version)=>session().version===version;
 const check=({data,error})=>{if(error)throw new Error(error.message);return data};
 const field=(name,label,value='',extra='')=>`<label>${label}<input name="${name}" value="${e(value)}" ${extra}></label>`;
 const errorText=error=>`Could not load Cookbooks. Apply database migration 034_public_cookbooks.sql if needed. ${error.message}`;
 async function load(){const version=session().version;const rows=check(await supabase.rpc('get_cookbooks'))||[];if(!alive(version))return null;books=rows;return rows}
 function reset(){serial++;books=[];selected='';detailRows=[];document.querySelector('#cookbook-dialog')?.remove()}
 function author(book){const a=book.author||{},lookup=a.username||a.id||book.user_id;return `<a class="cookbook-author" href="#/profile/${encodeURIComponent(lookup||'')}" data-visit-profile="${e(lookup)}">${e(a.display_name||a.username||'Cook')}</a>`}
 function cover(book){return book.cover?visual(book.cover):'<span class="cookbook-placeholder" aria-hidden="true">📖</span>'}
 async function render(id=selected){selected=id;const request=++serial,version=session().version,target=root();target.innerHTML='<p role="status">Loading Cookbooks…</p>';
 try{
 const rows=await load();if(!rows||request!==serial||!alive(version))return;
 if(!id){
 const covers=await hydrate(rows.filter(b=>b.cover).map(b=>b.cover));if(request!==serial||!alive(version))return;
 const mapped=new Map(covers.map(row=>[row.id,mapRecipe(row)]));
 target.innerHTML=`<div class="page-head"><div><p class="eyebrow">YOUR COLLECTIONS</p><h1>Cookbooks</h1><p>Keep the recipes you love together, privately or on your public profile.</p></div><button class="primary-btn" data-cookbook-new>＋ New Cookbook</button></div><div class="recipe-grid cookbook-grid">${rows.map(book=>`<article class="cookbook-card" data-cookbook-open="${e(book.id)}" tabindex="0" role="link" aria-label="Open ${e(book.name)}"><div class="cookbook-cover">${cover({...book,cover:mapped.get(book.cover?.id)})}</div><div class="cookbook-copy"><h2>${e(book.name)}</h2><p>${book.recipe_ids.length} recipe${book.recipe_ids.length===1?'':'s'} · ${author(book)}</p></div></article>`).join('')||'<div class="empty-state"><h2>A collection for every craving.</h2><p>Create your first Cookbook, then add recipes from Created or Saved.</p><button class="primary-btn" data-cookbook-new>Create a Cookbook</button></div>'}</div>`;return;
 }
 const book=rows.find(b=>b.id===id)||check(await supabase.rpc('get_cookbook',{p_id:id}));if(request!==serial||!alive(version))return;if(!book){target.innerHTML='<p>Cookbook unavailable.</p><button class="secondary-btn" data-cookbook-open="">Back to Cookbooks</button>';return}
 const entries=check(await supabase.rpc('get_cookbook_recipes',{p_id:id}))||[];if(request!==serial||!alive(version))return;
 const hydrated=await hydrate(entries.filter(row=>row.recipe).map(row=>row.recipe));if(request!==serial||!alive(version))return;
 detailRows=hydrated.map(mapRecipe);remember(detailRows);
 const owned=book.user_id===session().userId;
 const chosen=detailRows.find(r=>r.id===book.cover_recipe_id)||detailRows.find(r=>r.imageUrl)||detailRows[0];
 target.innerHTML=`<button class="back-btn" data-cookbook-open="">← Cookbooks</button><div class="cookbook-heading"><div class="cookbook-cover">${cover({cover:chosen})}</div><div><p class="eyebrow">${book.visibility==='public'?'PUBLIC':'PRIVATE'} COOKBOOK</p><h1>${e(book.name)}</h1><p class="cookbook-description">${e(book.description)}</p><p>${entries.length} recipe${entries.length===1?'':'s'} · ${author(book)}${entries.length!==detailRows.length?` · ${entries.length-detailRows.length} unavailable`:''}</p>${owned?`<div class="detail-actions"><button class="primary-btn" data-cookbook-browse="${e(id)}">＋ Add recipes</button><button class="secondary-btn" data-cookbook-edit="${e(id)}">Edit Cookbook</button><button class="text-btn danger-action" data-cookbook-delete="${e(id)}">Delete Cookbook</button></div>`:''}</div></div><div class="recipe-grid cookbook-grid">${detailRows.map(recipe=>`<div class="cookbook-entry">${card(recipe,{showCookbook:false})}${owned?`<button class="text-btn" data-cookbook-remove="${e(recipe.id)}">Remove from Cookbook</button>`:''}</div>`).join('')}${entries.filter(row=>!row.recipe&&owned).map(row=>`<article class="panel"><p>This recipe is private or unavailable.</p><button class="text-btn" data-cookbook-remove="${e(row.recipe_id)}">Remove from Cookbook</button></article>`).join('')}${entries.length?'':owned?`<div class="empty-state"><h2>Make room for your favourites.</h2><p>Find a favourite from Created, Saved or Discover and add it here.</p><button class="secondary-btn" data-cookbook-browse="${e(id)}">Find recipes</button></div>`:'<p>No public recipes in this Cookbook yet.</p>'}</div>`;
 }catch(error){if(request===serial&&alive(version))target.innerHTML=`<div class="panel" role="alert"><p>${e(errorText(error))}</p><button class="secondary-btn" data-cookbook-open="${e(id)}">Try again</button></div>`}
 }
 function dialog(title,body,submit,onSubmit){
 document.querySelector('#cookbook-dialog')?.remove();const version=session().version,previous=document.activeElement,d=document.createElement('dialog');d.id='cookbook-dialog';d.className='cookbook-dialog';d.innerHTML=`<form><div class="modal-head"><h2>${e(title)}</h2><button type="button" data-cookbook-close aria-label="Close">×</button></div>${body}<p role="alert" data-cookbook-error></p><div class="modal-actions"><button type="button" class="secondary-btn" data-cookbook-close>Cancel</button><button class="primary-btn">${e(submit)}</button></div></form>`;document.body.append(d);
 d.addEventListener('close',()=>{d.remove();previous?.isConnected&&previous.focus()});d.querySelectorAll('[data-cookbook-close]').forEach(b=>b.onclick=()=>d.close());
 d.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.target,button=form.querySelector('.primary-btn');if(button.disabled)return;button.disabled=true;try{await onSubmit(new FormData(form),d,version);if(alive(version)&&d.isConnected)d.close()}catch(error){if(alive(version)&&d.isConnected){d.querySelector('[data-cookbook-error]').textContent=error.message;button.disabled=false}}};d.showModal();return d;
 }
 function editor(id='',after){const book=books.find(b=>b.id===id);dialog(book?'Edit Cookbook':'New Cookbook',field('name','Name',book?.name||'','required maxlength="120"')+`<label>Description <span class="optional">Optional</span><textarea name="description" maxlength="2000">${e(book?.description||'')}</textarea></label><label>Visibility<select name="visibility"><option value="private" ${book?.visibility!=='public'?'selected':''}>Private</option><option value="public" ${book?.visibility==='public'?'selected':''}>Public</option></select><small>Public Cookbooks appear on your public profile. Private recipes stay private. A private profile keeps its Cookbooks hidden.</small></label>`+(book?`<label>Cover recipe<select name="cover"><option value="">Automatic</option>${detailRows.map(r=>`<option value="${e(r.id)}" ${r.id===book.cover_recipe_id?'selected':''}>${e(r.name)}</option>`).join('')}</select></label>`:''),'Save Cookbook',async(data,d,version)=>{
 const name=data.get('name').trim();if(!name)throw new Error('Give your Cookbook a name.');const values={name,description:data.get('description').trim(),visibility:data.get('visibility')||'private'};
 const saved=book?check(await supabase.from('cookbooks').update({...values,cover_recipe_id:data.get('cover')||null}).eq('id',id).eq('user_id',session().userId).select('id').single()):check(await supabase.from('cookbooks').insert({...values,user_id:session().userId}).select('id').single());
 if(!alive(version))return;if(after){d.close();await after(saved.id)}else await render(book?id:'');
 })}
 async function browseRecipes(cookbookId){
 const version=session().version,book=books.find(b=>b.id===cookbookId);if(!book)return;
 const included=new Set(book.recipe_ids),chosen=new Map();let library=[],rows=[],request=0,timer,offset=0,hasMore=false;
 const d=dialog('Add recipes',`<p>Find recipes for <strong>${e(book.name)}</strong>. Recipes from Discover are also added to Saved.</p><div class="gallery-controls"><label class="search"><span class="sr-only">Search recipes</span><input type="search" data-cookbook-search placeholder="Find a recipe…" autofocus></label><label><span class="sr-only">Recipe source</span><select data-cookbook-source><option value="library">Created & Saved</option><option value="discover">Discover</option></select></label></div><p role="status" data-cookbook-results-status>Loading recipes…</p><div class="cookbook-recipe-results"></div><button type="button" class="secondary-btn" data-cookbook-more hidden>Load more</button>`,'Add selected recipes',async(data,dialog,version)=>{
 if(!chosen.size)throw new Error('Choose at least one recipe.');
 for(const [id,recipe] of chosen){if(!alive(version))return;if(!isLibraryRecipe(id)){await saveRecipe(id);if(!alive(version))return}const result=await supabase.from('cookbook_recipes').insert({cookbook_id:cookbookId,recipe_id:id});if(result.error?.code!=='23505')check(result);included.add(id)}
 if(alive(version))await render(cookbookId);
 });
 d.classList.add('cookbook-recipe-picker');const search=d.querySelector('[data-cookbook-search]'),source=d.querySelector('[data-cookbook-source]'),results=d.querySelector('.cookbook-recipe-results'),status=d.querySelector('[data-cookbook-results-status]'),more=d.querySelector('[data-cookbook-more]'),submit=d.querySelector('.modal-actions .primary-btn');
 const current=()=>alive(version)&&d.isConnected&&d.open;
 const selection=()=>{submit.textContent=chosen.size?`Add ${chosen.size} recipe${chosen.size===1?'':'s'}`:'Add selected recipes';submit.disabled=!chosen.size};
 function draw(){
 results.innerHTML=rows.map(recipe=>`<button type="button" class="gallery-recipe cookbook-recipe-choice" data-cookbook-choose="${e(recipe.id)}" aria-pressed="${chosen.has(recipe.id)}" ${included.has(recipe.id)?'disabled':''}>${visual(recipe)}<strong>${e(recipe.name)}</strong><small>${included.has(recipe.id)?'Already in Cookbook':chosen.has(recipe.id)?'Selected ✓':'Select recipe'}</small></button>`).join('');
 status.textContent=rows.length?`${rows.length} recipe${rows.length===1?'':'s'}${chosen.size?` · ${chosen.size} selected`:''}`:'No recipes found. Try another search or browse Discover.';more.hidden=!hasMore;selection();
 }
 async function find(append=false){
 const seq=++request,query=search.value.trim();clearTimeout(timer);d.querySelector('[data-cookbook-error]').textContent='';
 if(source.value==='library'){hasMore=false;rows=library.filter(r=>[r.name,r.cuisine,...(r.tags||[]),...(r.ingredients||[]).map(i=>i[0])].join(' ').toLowerCase().includes(query.toLowerCase()));draw();return}
 if(!append){offset=0;rows=[];results.innerHTML='';}status.textContent='Searching Discover…';more.disabled=true;
 try{const data=check(await supabase.rpc('discover_recipes',{p_search:query,p_offset:offset}))||[];if(!current()||seq!==request)return;
 const hydrated=await hydrate(data);if(!current()||seq!==request)return;const incoming=hydrated.map(mapRecipe);remember(incoming);rows=[...new Map([...(append?rows:[]),...incoming].map(r=>[r.id,r])).values()];offset+=data.length;hasMore=data.length===24;draw();
 }catch(error){if(current()&&seq===request){status.textContent='Could not search Discover. Try again.';d.querySelector('[data-cookbook-error]').textContent=error.message;more.hidden=false;more.textContent='Try again'}}finally{if(current()&&seq===request)more.disabled=false}
 }
 results.addEventListener('click',event=>{const button=event.target.closest('[data-cookbook-choose]');if(!button||button.disabled)return;const id=button.dataset.cookbookChoose;if(chosen.has(id))chosen.delete(id);else chosen.set(id,rows.find(r=>r.id===id));draw()});
 search.addEventListener('input',()=>{request++;clearTimeout(timer);if(source.value==='discover')timer=setTimeout(()=>{if(current())find()},300);else find()});
 search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();find()}});
 source.addEventListener('change',()=>find());more.onclick=()=>find(true);d.addEventListener('close',()=>{request++;clearTimeout(timer)});selection();
 try{library=await getLibrary();if(current()&&source.value==='library')await find()}catch(error){if(current()){status.textContent='Could not load your recipes. You can still search Discover.';d.querySelector('[data-cookbook-error]').textContent=error.message}}
 }
 async function picker(recipeId,chosen){const version=session().version;try{if(!await load()||!alive(version))return;
 const initial=new Set(books.filter(b=>b.recipe_ids.includes(recipeId)).map(b=>b.id));if(chosen)initial.add(chosen);
 const d=dialog('Add to Cookbook',`<p>Choose one or more Cookbooks.</p>${isLibraryRecipe(recipeId)?'':'<p>This recipe will also be added to Saved Recipes.</p>'}<div class="cookbook-choices">${books.map(b=>`<label><input type="checkbox" name="books" value="${e(b.id)}" ${initial.has(b.id)?'checked':''}><span>${e(b.name)}<small>${b.recipe_ids.length} recipes</small></span></label>`).join('')||'<p>No Cookbooks yet. Create your first below.</p>'}</div><button type="button" class="text-btn" data-cookbook-create-inline>＋ New Cookbook</button>`,'Save selection',async(data,dialog,version)=>{
 const wanted=new Set(data.getAll('books'));if(wanted.size&&!isLibraryRecipe(recipeId)){await saveRecipe(recipeId);if(!alive(version))return}
 // Only change this recipe's memberships, preserving all other recipes.
 for(const b of books){if(!alive(version))return;const had=b.recipe_ids.includes(recipeId),want=wanted.has(b.id);if(had===want)continue;const result=want?await supabase.from('cookbook_recipes').insert({cookbook_id:b.id,recipe_id:recipeId}):await supabase.from('cookbook_recipes').delete().eq('cookbook_id',b.id).eq('recipe_id',recipeId);if(result.error?.code!=='23505')check(result)}
 if(alive(version)&&root()?.closest('.active')&&location.hash.includes('/cookbooks'))await render();
 });d.querySelector('[data-cookbook-create-inline]').onclick=()=>{const checked=[...d.querySelectorAll('[name="books"]:checked')].map(n=>n.value);d.close();editor('',async id=>{await picker(recipeId,id);const next=document.querySelector('#cookbook-dialog');for(const input of next?.querySelectorAll('[name="books"]')||[])input.checked=checked.includes(input.value)||input.value===id})};
 }catch(error){if(alive(version))dialog('Cookbooks unavailable',`<p>${e(errorText(error))}</p>`,'Close',async()=>{})}}
 async function click(event){const b=event.target.closest('[data-cookbook-add],[data-cookbook-open],[data-cookbook-new],[data-cookbook-edit],[data-cookbook-delete],[data-cookbook-remove],[data-cookbook-browse]');if(!b||event.target.closest('[data-visit-profile],[data-profile-privacy],.profile-card-privacy'))return;event.preventDefault();event.stopImmediatePropagation();
 try{
 if(b.hasAttribute('data-cookbook-add'))return await picker(b.dataset.cookbookAdd);
 if(b.hasAttribute('data-cookbook-open')){selected=b.dataset.cookbookOpen;history.pushState(null,'',selected?'#/cookbook/'+selected:'#/recipes/cookbooks');return openCookbook(selected)}
 if(b.hasAttribute('data-cookbook-browse'))return await browseRecipes(b.dataset.cookbookBrowse);
 if(b.hasAttribute('data-cookbook-new'))return editor();
 if(b.hasAttribute('data-cookbook-edit'))return editor(b.dataset.cookbookEdit);
 if(b.hasAttribute('data-cookbook-delete'))return dialog('Delete Cookbook?',`<p>Delete ${e(books.find(book=>book.id===selected)?.name)}? Your recipes will stay in Created and Saved.</p>`,'Delete Cookbook',async(data,d,version)=>{check(await supabase.from('cookbooks').delete().eq('id',selected).eq('user_id',session().userId));if(alive(version)){selected='';history.replaceState(null,'','#/recipes/cookbooks');await render('')}});
 if(b.hasAttribute('data-cookbook-remove')){b.disabled=true;const version=session().version;check(await supabase.from('cookbook_recipes').delete().eq('cookbook_id',selected).eq('recipe_id',b.dataset.cookbookRemove));if(alive(version))await render()}
 }catch(error){b.disabled=false;dialog('Could not update Cookbook',`<p>${e(error.message)}</p>`,'Close',async()=>{})}
 }
 document.addEventListener('click',click,true);
 document.addEventListener('keydown',event=>{if(event.target.matches('.cookbook-card')&&['Enter',' '].includes(event.key)){event.preventDefault();event.target.click()}});
 return {render,reset,route(id=''){selected=id}};
}
