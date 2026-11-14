import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {parseRecipeQuantity} from '../cooking.mjs';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
const input=value=>({value,setAttribute(){},removeAttribute(){}});
function fixture({name='Cookie',servings='16',time='30',ingredients=[{name:'Flour',qty:'265',unit:'g',selected:true}],steps=['Mix.']}={}){
 const rows=ingredients.map(item=>{const field=input(item.name),picker={selected:item.selected?{canonical_name:item.name}:null,querySelector:()=>field},quantity=input(item.qty||''),unit=input(item.unit||'g'),note=input(item.note||'');return{querySelector:selector=>selector==='.ingredient-picker'?picker:selector.includes('quantity')?quantity:selector.includes('unit')?unit:note}});
 const form={elements:{'recipe-name':input(name),servings:input(servings),'total-time':input(time),prep:input(''),cook:input('')},querySelector:selector=>selector.includes('recipe-save-error')?null:input(''),querySelectorAll:selector=>selector==='.recipe-ingredient-input'?rows:selector==='[name="recipe-step"]'?steps.map(input):[]};
 const context=vm.createContext({parseRecipeQuantity,selectedIngredient:picker=>{if(!picker.selected)throw new Error('No match');return picker.selected}});
 vm.runInContext(source.slice(source.indexOf('function validateRecipeEditor('),source.indexOf("document.addEventListener('invalid'")),context);
 return options=>context.validateRecipeEditor(form,options);
}
test('required name, time, servings, ingredients and instructions produce a readable combined error',()=>{
 const validate=fixture({name:' ',servings:'',time:'',ingredients:[],steps:[' ']});assert.throws(validate,error=>['recipe name','servings','total time','ingredient','instruction'].every(text=>error.message.includes(text)));
});
test('incomplete ingredient rows and invalid quantities block saving',()=>{
 assert.throws(fixture({ingredients:[{name:'',qty:'2',unit:'g'}]}),/enter an ingredient name/);
 assert.throws(fixture({ingredients:[{name:'Flour',qty:'-2',unit:'g',selected:true}]}),/positive quantity/);
});
test('unmatched names require a match, except during the explicit import confirmation stage',()=>{
 const validate=fixture({ingredients:[{name:'Matcha',qty:'1',unit:'tbsp',selected:false}]});assert.throws(validate,/catalogue suggestions/);assert.doesNotThrow(()=>validate({allowUnmatched:true}));
});
test('duplicate ingredients cannot be silently discarded',()=>{assert.throws(fixture({ingredients:[{name:'Flour',qty:'100',selected:true},{name:'flour',qty:'165',selected:true}]}),/appears more than once/)});
test('optional amounts and tiny positive measurements are valid',()=>{
 assert.doesNotThrow(fixture({ingredients:[{name:'Salt',qty:'',unit:'to taste',selected:true}]}));assert.doesNotThrow(fixture({ingredients:[{name:'Spice',qty:'0.001',unit:'g',selected:true}]}));
});
