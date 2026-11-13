import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = (await readFile(new URL('../ingredients.js', import.meta.url), 'utf8'))
  .replace("import { supabase } from './supabase-client.js';", '').replaceAll('export ', '');
function setup() {
  const events = {}, calls = [];
  const query = {select(value){calls.push(['select',value]);return this},ilike(...args){calls.push(['ilike',...args]);return this},order(){return this},limit(value){calls.push(['limit',value]);return Promise.resolve({data:[]})}};
  const context = vm.createContext({supabase:{from(table){calls.push(['from',table]);return query}},document:{addEventListener(name,fn){events[name]=fn}},clearTimeout,setTimeout,Option:class {constructor(text,value){this.text=text;this.value=value}}});
  vm.runInContext(source, context);
  return {context,calls,events};
}
function pickerFixture() {
  const input={value:'',setAttribute(){},removeAttribute(){},focus(){}},status={},list={},unit={options:[{value:'piece'},{value:'g'},{value:'ml'}],value:'piece',add(option){this.options.push(option)}};
  return {input,status,unit,picker:{querySelector(selector){return selector==='input'?input:selector==='[role="status"]'?status:list},closest(){return{querySelector(){return unit}}}}};
}
test('search uses bounded case-insensitive substring query and escapes wildcards',async()=>{
  const {context,calls}=setup();
  await context.searchIngredients('  CUc  ');
  assert.deepEqual(calls.find(x=>x[0]==='ilike'),['ilike','canonical_name','%CUc%']);
  assert.deepEqual(calls.find(x=>x[0]==='limit'),['limit',10]);
  calls.length=0;
  await context.searchIngredients('a%_');
  assert.equal(calls.find(x=>x[0]==='ilike')[2],'%a\\%\\_%');
  calls.length=0;await context.searchIngredients('   ');assert.equal(calls.length,0);
});
test('selection retains stable ID and default unit; override remains valid; edited text is rejected',()=>{
  const {context}=setup();
  for(const [name,unit] of [['Cucumber','piece'],['Flour','g'],['Milk','ml']]){
    const fixture=pickerFixture(), ingredient={id:`id-${name}`,canonical_name:name,default_unit:unit};
    context.stateFor(fixture.picker).results=[ingredient];
    context.choose(fixture.picker,0);
    assert.equal(context.selectedIngredient(fixture.picker).id,ingredient.id);
    assert.equal(fixture.unit.value,unit);
    fixture.unit.value='kg';
    assert.equal(context.selectedIngredient(fixture.picker).id,ingredient.id);
    assert.equal(fixture.unit.value,'kg');
    fixture.input.value='Arbitrary raw text';
    assert.throws(()=>context.selectedIngredient(fixture.picker),/Choose an ingredient/);
  }
});
test('unselected text cannot be saved',()=>{
  const {context}=setup();const fixture=pickerFixture();fixture.input.value='Cucumber';
  assert.throws(()=>context.selectedIngredient(fixture.picker),/Choose an ingredient/);
});
test('recipe editor presets a catalogue selection and its saved unit',()=>{
 const {context}=setup(),fixture=pickerFixture();
 context.presetIngredient(fixture.picker,{id:'rice-id',canonical_name:'Rice',default_unit:'kg'});
 assert.equal(context.selectedIngredient(fixture.picker).id,'rice-id');assert.equal(fixture.input.value,'Rice');assert.equal(fixture.unit.value,'kg');
});
