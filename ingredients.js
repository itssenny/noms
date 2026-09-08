import { supabase } from './supabase-client.js';

export const units = ['piece','g','kg','ml','l','clove','tsp','tbsp','cup','pinch','can','package','bunch','pcs','pack','loaf','other'];
const states = new WeakMap();
let pickerId = 0;
export function ingredientPicker(name) {
  const id = `ingredient-picker-${++pickerId}`;
  return `<div class="ingredient-picker"><label for="${id}">Ingredient</label><input id="${id}" name="${name}" required autocomplete="off" placeholder="Search ingredients…" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-results" aria-describedby="${id}-status"><div class="ingredient-results" id="${id}-results" role="listbox" hidden></div><small id="${id}-status" class="ingredient-selection" role="status">Choose from the catalogue</small></div>`;
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
function choose(picker, index) {
  const state = stateFor(picker), ingredient = state.results[index];
  if (!ingredient) return;
  state.selected = ingredient;
  state.version++;
  clearTimeout(state.timer);
  picker.querySelector('input').value = ingredient.canonical_name;
  picker.querySelector('[role="status"]').textContent = `Selected: ${ingredient.canonical_name}`;
  const scope = picker.closest('.recipe-ingredient-input') || picker.closest('form');
  const unit = scope.querySelector('select[name="ingredient-unit"],select[name="unit"]');
  const suggested = ingredient.default_unit || 'piece';
  if (![...unit.options].some(option => option.value === suggested)) unit.add(new Option(suggested, suggested));
  unit.value = suggested;
  close(picker);
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
  status.textContent = input.value.trim() ? 'Searching…' : 'Choose from the catalogue';
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
      list.hidden = !results.length;
      input.setAttribute('aria-expanded', String(!!results.length));
      status.textContent = results.length ? 'Choose an ingredient below' : 'No ingredients found. Try a shorter search; new ingredients must be added to the catalogue.';
    } catch (error) {
      if (version !== state.version || !picker.isConnected) return;
      status.textContent = 'Could not search ingredients. Try typing again.';
    }
  }, 150);
}
document.addEventListener('input', event => {
  const picker = event.target.closest('.ingredient-picker');
  if (picker) update(picker);
});
document.addEventListener('click', event => {
  const option = event.target.closest('[data-ingredient-index]');
  if (option) choose(option.closest('.ingredient-picker'), Number(option.dataset.ingredientIndex));
  else document.querySelectorAll('.ingredient-picker').forEach(picker => {
    if (!picker.contains(event.target)) { stateFor(picker).version++; close(picker); }
  });
});
document.addEventListener('keydown', event => {
  const picker = event.target.closest('.ingredient-picker');
  if (!picker) return;
  const state = stateFor(picker), list = picker.querySelector('[role="listbox"]');
  if (event.key === 'Escape' || event.key === 'Tab') { state.version++; close(picker); return; }
  if (list.hidden) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    if (state.active >= 0) choose(picker, state.active);
  } else if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    state.active = (state.active + (event.key === 'ArrowDown' ? 1 : -1) + state.results.length) % state.results.length;
    [...list.children].forEach((option, index) => option.setAttribute('aria-selected', String(index === state.active)));
    picker.querySelector('input').setAttribute('aria-activedescendant', list.children[state.active].id);
    list.children[state.active].scrollIntoView({ block: 'nearest' });
  }
});
