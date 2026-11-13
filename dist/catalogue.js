import {supabase} from './supabase-client.js';
import {units,ingredientCategories,escapeIngredientHtml as html,catalogueError,saveCatalogueIngredient} from './ingredients.js';
let version=0,rows=[],owner=null;
export function clearCatalogue(){version++;rows=[];owner=null}
export async function catalogueView(){
 const current=++version,view=document.querySelector('#catalogue-view');
 view.innerHTML='<p role="status">Loading ingredients…</p>';
 try{
  const {data:auth,error:authError}=await supabase.auth.getUser();
  if(current!==version)return;
  if(authError||!auth.user)throw new Error('Please sign in again.');
  const result=await supabase.from('ingredients').select('id,canonical_name,category,default_unit,created_by').order('canonical_name').limit(1000);
  if(current!==version)return;
  if(result.error)throw new Error(catalogueError(result.error));
  owner=auth.user.id;rows=result.data||[];
  view.innerHTML=`<button class="back-btn" data-view="inventory">← Back to inventory</button><div class="page-head"><div><p class="eyebrow">YOUR INGREDIENTS</p><h1>Ingredient catalogue</h1><p>Browse shared ingredients and add or edit your own. Default units are suggestions; saved recipe and stock quantities stay as entered.</p></div><button class="primary-btn" data-catalogue-new>Add ingredient</button></div><div id="catalogue-editor"></div><label class="search">Search ingredients<input id="catalogue-search" placeholder="e.g. Pasta"></label><p id="catalogue-count"></p><div id="catalogue-list" class="panel"></div>`;
  renderRows('');
 }catch(error){if(current===version)view.innerHTML=`<button class="back-btn" data-view="inventory">← Back to inventory</button><h1>Ingredient catalogue</h1><p role="alert">${html(error.message)}</p><button class="secondary-btn" data-catalogue-retry>Retry</button>`}
}
function renderRows(query){
 const filtered=rows.filter(row=>row.canonical_name.toLowerCase().includes(query.trim().toLowerCase()));
 document.querySelector('#catalogue-count').textContent=`${filtered.length} ingredients${rows.length===1000?' (first 1,000 shown)':''}`;
 document.querySelector('#catalogue-list').innerHTML=filtered.length?filtered.map(row=>`<div class="catalogue-row"><div><strong>${html(row.canonical_name)}</strong><small>${html(row.category)} · ${html(row.default_unit)} · ${row.created_by===owner?'Yours':'Shared'}</small></div>${row.created_by===owner?`<button class="secondary-btn" data-catalogue-edit="${html(row.id)}">Edit</button>`:''}</div>`).join(''):'<p>No ingredients found. Add one above. If you want the starter ingredients, apply database seed 005 in Supabase.</p>';
}
function editIngredient(id=null){
 const row=id?rows.find(row=>row.id===id&&row.created_by===owner):null;
 if(id&&!row)return;
 const editor=document.querySelector('#catalogue-editor');
 editor.innerHTML=`<form id="catalogue-form" class="panel catalogue-form"><h2>${row?'Edit ingredient':'Add ingredient'}</h2>${row?`<input type="hidden" name="id" value="${html(row.id)}">`:''}<label>Name<input name="name" required maxlength="100" value="${html(row?.canonical_name||'')}"></label><label>Category<select name="category">${ingredientCategories.map(x=>`<option ${x===(row?.category||'Other')?'selected':''}>${html(x)}</option>`).join('')}</select></label><label>Default unit<select name="unit">${units.map(x=>`<option ${x===(row?.default_unit||'piece')?'selected':''}>${html(x)}</option>`).join('')}</select></label><p role="status" id="catalogue-save-status"></p><button class="primary-btn">${row?'Save changes':'Add ingredient'}</button><button type="button" class="secondary-btn" data-catalogue-cancel>Cancel</button></form>`;
 editor.querySelector('[name="name"]').focus();
}
document.addEventListener('input',event=>{if(event.target.id==='catalogue-search')renderRows(event.target.value)});
document.addEventListener('click',event=>{
 if(event.target.closest('[data-catalogue-retry]'))catalogueView();
 if(event.target.closest('[data-catalogue-new]'))editIngredient();
 const edit=event.target.closest('[data-catalogue-edit]');if(edit)editIngredient(edit.dataset.catalogueEdit);
 if(event.target.closest('[data-catalogue-cancel]'))document.querySelector('#catalogue-editor').innerHTML='';
});
document.addEventListener('submit',async event=>{
 if(event.target.id!=='catalogue-form')return;
 event.preventDefault();const form=event.target,button=form.querySelector('.primary-btn'),current=version;
 if(button.disabled)return;button.disabled=true;
 const data=new FormData(form),status=form.querySelector('#catalogue-save-status');status.textContent='Saving…';
 try{
  await saveCatalogueIngredient({id:data.get('id'),name:data.get('name'),category:data.get('category'),unit:data.get('unit')});
  if(current!==version)return;
  window.dispatchEvent(new CustomEvent('mise-catalogue-updated'));
  await catalogueView();
 }catch(error){if(form.isConnected&&current===version)status.textContent=error.message}finally{button.disabled=false}
});
