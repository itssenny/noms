import { supabase } from './supabase-client.js';

export const units = ['piece','g','kg','ml','l','clove','tsp','tbsp','cup','pinch','can','package','bunch','pcs','pack','loaf','other'];
export const ingredientCategories=['Vegetables','Fruits','Meat','Fish & Seafood','Dairy','Eggs','Carbohydrates','Canned Goods','Sauces & Condiments','Spices','Herbs','Other'];
export const escapeIngredientHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function catalogueError(error){
 if(['42703','PGRST204'].includes(error?.code)||/default_unit|created_by|normalized_name/.test(error?.message||''))return 'The ingredient catalogue needs database update 007_editable_ingredient_catalogue.sql. Apply it in Supabase, then retry.';
 if(error?.code==='42501')return 'Could not access the catalogue. Sign in and check that database update 007 is installed.';
 return error?.message||'Could not load ingredients. Check your connection and retry.';
}
function normalizedName(value){return value.trim().replace(/\s+/g,' ')}
export async function saveCatalogueIngredient({id=null,name,category,unit}){
 name=normalizedName(name);
 if(!name||name.length>100)throw new Error('Enter an ingredient name between 1 and 100 characters.');
 if(!units.includes(unit)||!ingredientCategories.includes(category))throw new Error('Choose a category and unit.');
 const {data:auth,error:authError}=await supabase.auth.getUser();
 if(authError||!auth.user)throw new Error('Please sign in again.');
 const userId=auth.user.id;
 // Reuse an exact visible match instead of creating duplicate capitalizations.
 {
  const found=await supabase.from('ingredients').select('id,canonical_name,category,default_unit,created_by').eq('normalized_name',name.toLowerCase()).limit(2);
  if(found.error)throw new Error(catalogueError(found.error));
  const match=found.data?.find(row=>row.id!==id);
  if(match){if(id)throw new Error('An ingredient with that name already exists. Choose a different name.');return found.data.find(row=>row.created_by===null)||match;}
 }
 const values={canonical_name:name,category,default_unit:unit};
 const query=id?supabase.from('ingredients').update(values).eq('id',id).eq('created_by',userId):supabase.from('ingredients').insert({...values,created_by:userId});
 const {data,error}=await query.select('id,canonical_name,category,default_unit,created_by').single();
 if(error){
  if(error.code==='23505')throw new Error('An ingredient with that name already exists. Search for it or choose a different name.');
  throw new Error(catalogueError(error));
 }
 return data;
}
const states = new WeakMap();
let pickerId = 0;
export function ingredientPicker(name,required=true) {
  const id = `ingredient-picker-${++pickerId}`;
  return `<div class="ingredient-picker"><label for="${id}">Ingredient</label><input id="${id}" name="${name}" ${required?'required':''} autocomplete="off" placeholder="Search ingredients…" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-results" aria-describedby="${id}-status"><div class="ingredient-results" id="${id}-results" role="listbox" hidden></div><small id="${id}-status" class="ingredient-selection" role="status"></small><div class="inline-ingredient-editor" hidden></div></div>`;
}
export async function searchIngredients(query) {
  // Escape LIKE wildcards so typed punctuation never broadens a search.
  const text = query.trim().replace(/\s+/g, ' ').slice(0, 100);
  if (!text) return [];
  const pattern = text.replace(/[\\%_]/g, '\\$&');
  const { data, error } = await supabase.from('ingredients')
    .select('id,canonical_name,category,default_unit')
    .ilike('canonical_name', `%${pattern}%`).order('canonical_name').limit(10);
  if (error) throw error;
  return data || [];
}
function stateFor(picker) {
  if (!states.has(picker)) states.set(picker, { selected: null, results: [], version: 0, active: -1 });
  return states.get(picker);
}
export function selectedIngredient(picker) {
  const selected = stateFor(picker).selected;
  if (!selected || picker.querySelector('input').value !== selected.canonical_name) {
    throw new Error('Choose an ingredient from the catalogue suggestions.');
  }
  return selected;
}
function close(picker) {
  picker.querySelector('[role="listbox"]').hidden = true;
  const input = picker.querySelector('input');
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
}
export function presetIngredient(picker, ingredient) {
  const state=stateFor(picker);
  state.results=[ingredient];
  choose(picker,0);
}
function choose(picker, index) {
  const state = stateFor(picker);
  if(state.canCreate&&index===state.results.length){openIngredientEditor(picker);return}
  const ingredient=state.results[index];
  if (!ingredient) return;
  state.selected = ingredient;
  state.version++;
  clearTimeout(state.timer);
  picker.querySelector('input').value = ingredient.canonical_name;
  picker.querySelector('[role="status"]').textContent = '';
  const scope = picker.closest('.recipe-ingredient-input') || picker.closest('form');
  const unit = scope.querySelector('select[name="ingredient-unit"],select[name="unit"]');
  const suggested = ingredient.default_unit || 'piece';
  if(unit){
  if (![...unit.options].some(option => option.value === suggested)) unit.add(new Option(suggested, suggested));
  unit.value = suggested;}
  const quantity=scope.querySelector('[name="ingredient-quantity"]');if(quantity)quantity.disabled=['as needed','to taste'].includes(suggested);
  close(picker);
  picker.dispatchEvent?.(new CustomEvent('noms-ingredient-selected',{bubbles:true,detail:{ingredient}}));
  picker.querySelector('input').focus();
}
async function update(picker) {
  const state = stateFor(picker), version = ++state.version;
  const input = picker.querySelector('input'), list = picker.querySelector('[role="listbox"]');
  const status = picker.querySelector('[role="status"]');
  state.selected = null;
  state.results = [];
  state.active = -1;
  close(picker);
  clearTimeout(state.timer);
  status.textContent = input.value.trim() ? 'Searching…' : '';
  if (!input.value.trim()) return;
  state.timer = setTimeout(async () => {
    try {
      const results = await searchIngredients(input.value);
      if (version !== state.version || !picker.isConnected) return;
      state.results = results;
      list.replaceChildren(...results.map((ingredient, index) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.role = 'option';
        option.id = `${input.id}-option-${index}`;
        option.dataset.ingredientIndex = index;
        option.setAttribute('aria-selected', 'false');
        option.textContent = `${ingredient.canonical_name} · ${ingredient.category}`;
        return option;
      }));
      state.canCreate=!results.some(ingredient=>normalizedName(ingredient.canonical_name).toLowerCase()===normalizedName(input.value).toLowerCase());
      if(state.canCreate){const add=document.createElement('button');add.type='button';add.role='option';add.id=`${input.id}-option-${results.length}`;add.dataset.newIngredient='true';add.setAttribute('aria-selected','false');add.textContent=`Add “${input.value.trim()}” to catalogue`;list.append(add)}
      list.hidden=false;input.setAttribute('aria-expanded','true');
      status.textContent='';
    } catch (error) {
      if (version !== state.version || !picker.isConnected) return;
      status.textContent = catalogueError(error);
    }
  }, 150);
}
document.addEventListener('input', event => {
  const picker = event.target.closest('.ingredient-picker');
  if (picker && event.target===picker.querySelector('input')) update(picker);
});
document.addEventListener('click', async event => {
  const add=event.target.closest('[data-new-ingredient]');
  if(add){openIngredientEditor(add.closest('.ingredient-picker'));return}
  const cancel=event.target.closest('[data-cancel-ingredient]');
  if(cancel){cancel.closest('.inline-ingredient-editor').hidden=true;return}
  const save=event.target.closest('[data-save-ingredient]');
  if(save){await saveInlineIngredient(save.closest('.ingredient-picker'),save);return}
  const option = event.target.closest('[data-ingredient-index]');
  if (option) choose(option.closest('.ingredient-picker'), Number(option.dataset.ingredientIndex));
  else document.querySelectorAll('.ingredient-picker').forEach(picker => {
    if (!picker.contains(event.target)) { stateFor(picker).version++; close(picker); }
  });
});
document.addEventListener('keydown', event => {
  const picker = event.target.closest('.ingredient-picker');
  if (!picker || event.target!==picker.querySelector('input')) return;
  const state = stateFor(picker), list = picker.querySelector('[role="listbox"]');
  if (event.key === 'Escape' || event.key === 'Tab') { state.version++; close(picker); return; }
  if (list.hidden) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    if (state.active >= 0) choose(picker, state.active);
  } else if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    const count=state.results.length+(state.canCreate?1:0);if(!count)return;
    state.active = (state.active + (event.key === 'ArrowDown' ? 1 : -1) + count) % count;
    [...list.children].forEach((option, index) => option.setAttribute('aria-selected', String(index === state.active)));
    picker.querySelector('input').setAttribute('aria-activedescendant', list.children[state.active].id);
    list.children[state.active].scrollIntoView({ block: 'nearest' });
  }
});

function openIngredientEditor(picker){
 const state=stateFor(picker);state.version++;clearTimeout(state.timer);close(picker);
 const editor=picker.querySelector('.inline-ingredient-editor');
 const name=picker.querySelector('input').value;
 editor.hidden=false;
 editor.innerHTML=`<p>Add a reusable ingredient to your catalogue.</p><label>Name<input data-catalogue-name maxlength="100" value="${escapeIngredientHtml(name)}"></label><label>Category<select data-catalogue-category>${ingredientCategories.map(x=>`<option>${x}</option>`).join('')}</select></label><label>Default unit<select data-catalogue-unit>${units.map(x=>`<option>${x}</option>`).join('')}</select></label><p data-catalogue-status role="status"></p><button type="button" class="secondary-btn" data-save-ingredient>Add and select</button><button type="button" class="text-btn" data-cancel-ingredient>Cancel</button>`;
 editor.querySelector('[data-catalogue-category]').value='Other';
 editor.querySelector('[data-catalogue-name]').focus();
}
async function saveInlineIngredient(picker,button){
 if(button.disabled)return;
 const editor=picker.querySelector('.inline-ingredient-editor'),status=editor.querySelector('[data-catalogue-status]');
 button.disabled=true;status.textContent='Saving…';
 try{
  const {data:before}=await supabase.auth.getUser();
  if(!picker.isConnected)return;
  const ingredient=await saveCatalogueIngredient({name:editor.querySelector('[data-catalogue-name]').value,category:editor.querySelector('[data-catalogue-category]').value,unit:editor.querySelector('[data-catalogue-unit]').value});
  const {data:after}=await supabase.auth.getUser();
  if(!picker.isConnected||before.user?.id!==after.user?.id)return;
  presetIngredient(picker,ingredient);editor.hidden=true;
 }catch(error){if(picker.isConnected)status.textContent=error.message}finally{button.disabled=false}
}

document.addEventListener('focusin',event=>{const picker=event.target.closest('.ingredient-picker');if(picker&&event.target===picker.querySelector('input')&&!stateFor(picker).selected&&event.target.value.trim())update(picker)});
