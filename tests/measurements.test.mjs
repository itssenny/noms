import test from 'node:test';
import assert from 'node:assert/strict';
import {convertMeasurement,displayMeasurement,formatMeasurement,parseMeasurement,normalizeUnit,measurementPreference,saveMeasurementPreference} from '../measurements.mjs';
import {ingredientDraft} from '../supabase/functions/_shared/recipe-import.mjs';
const ingredient=grams=>({density_g_per_ml:grams/236.5882365,conversion_metadata:{status:'verified',source:'reference'}});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('ingredient densities and dimensional fallbacks',()=>{
 close(displayMeasurement(1,'cup','metric',ingredient(120)).quantity,120);
 close(displayMeasurement(1,'cup','metric',ingredient(198)).quantity,198);
 close(displayMeasurement(100,'g','us',ingredient(226)).quantity,100/226);
 close(displayMeasurement(250,'ml','us').quantity,250/236.5882365);
 assert.equal(displayMeasurement(100,'g','us').unit,'oz');
 close(convertMeasurement(1,'oz','g'),28.349523125);
 close(convertMeasurement(1,'fl oz','ml'),29.5735295625);
 assert.equal(convertMeasurement(1,'oz','ml'),null);
 assert.equal(displayMeasurement(1,'cup','metric',ingredient(120),1,'sifted').unit,'ml');
 const unverified=ingredient(120);unverified.conversion_metadata.status='unverified';assert.equal(displayMeasurement(1,'cup','metric',unverified).unit,'ml');
});
test('servings and repeated toggles derive from the untouched original',()=>{
 const original=Object.freeze({quantity:1,unit:'cup'});
 for(let i=0;i<100;i++){
  close(displayMeasurement(original.quantity,original.unit,'metric',ingredient(120),4/2).quantity,240);
  assert.deepEqual(displayMeasurement(original.quantity,original.unit,'us',ingredient(120),4/2),{quantity:2,unit:'cup'});
 }
 assert.equal(original.quantity,1);
 for(const unit of ['piece','clove','egg','pinch','bunch','unknown'])assert.deepEqual(displayMeasurement(2,unit,'us',null,2),{quantity:4,unit});
 assert.equal(formatMeasurement(displayMeasurement(null,'to taste','us')),'To taste');
 assert.equal(formatMeasurement(displayMeasurement(.5,'cup','us')),'½ cups');
 assert.equal(formatMeasurement(displayMeasurement(1/10000,'tsp','us')),'0.0001 tsp');
});
test('fractions, abbreviations, mixed imports and original source units',()=>{
 for(const [input,value] of [['½',.5],['1¾',1.75],['3/4',.75],['1 1/2',1.5],['⅝',.625]])close(parseMeasurement(input),value);
 for(const unit of ['oz.','ounces'])assert.equal(normalizeUnit(unit),'oz');
 assert.equal(normalizeUnit('fl. oz.'),'fl oz');
 for(const [line,amount,unit] of [['½ cup flour',.5,'cup'],['2 fl oz milk',2,'fl oz'],['3 ounces butter',3,'oz'],['1 lb flour',1,'lb'],['100g sugar',100,'g'],['1 cup (120g) flour',1,'cup']]){
  const draft=ingredientDraft(line);assert.equal(draft.quantity,amount,line);assert.equal(draft.unit,unit,line);assert.equal(draft.raw,line);
 }
});
test('account preference survives navigation and handles unavailable storage',()=>{
 const map=new Map(),storage={getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value)};
 assert.equal(measurementPreference(storage,'a'),'metric');saveMeasurementPreference(storage,'a','us');assert.equal(measurementPreference(storage,'a'),'us');assert.equal(measurementPreference(storage,'b'),'metric');assert.equal(measurementPreference(null,'a'),'metric');
});
