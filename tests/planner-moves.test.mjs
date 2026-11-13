import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {moveMeal,dateKey,parseDate} from '../planning.mjs';
import {currentWeek} from '../calendar.mjs';
const original=[{id:'meal',date:'2026-12-31',day:'Thursday',slot:'Dinner',recipe:'r',servings:3,isLeftover:true,leftoverOf:'source',substitutions:{tomato:'cherry'}}];
test('moving changes only date and slot, preserves leftovers and substitutions, and crosses years',()=>{
 const next=moveMeal(original,'meal','2027-01-02','Lunch');assert.equal(next.length,1);assert.equal(next[0].day,'Saturday');assert.equal(next[0].slot,'Lunch');assert.equal(next[0].isLeftover,true);assert.deepEqual(next[0].substitutions,original[0].substitutions);assert.equal(next[0].leftoverOf,'source');assert.equal(original[0].date,'2026-12-31');assert.equal(moveMeal(original,'meal','2027-01-01')[0].slot,'Dinner');
});
test('stale, invalid-date and invalid-slot moves are rejected',()=>{
 assert.throws(()=>moveMeal(original,'gone','2027-01-01','Lunch'));assert.throws(()=>moveMeal(original,'meal','2027-02-30','Lunch'));assert.throws(()=>moveMeal(original,'meal','2027-01-01','Invalid'));
});
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
test('moving persists no shopping changes and restores the plan if storage fails',()=>{
 for(const succeeds of [true,false]){
  const shopping=[{name:'Salt',qty:1}],before=structuredClone(original),context=vm.createContext({plans:before,shopping,moveMeal,dateKey,parseDate,currentWeek,saveState:()=>succeeds,plannerView(){},home(){},toast(){},$:()=>({textContent:''})});
  vm.runInContext(source.slice(source.indexOf('function movePlannedMeal('),source.indexOf('function duplicatePlanModal(')),context);
  assert.equal(context.movePlannedMeal('meal','2027-01-02','Lunch'),succeeds);assert.equal(context.plans[0].date,succeeds?'2027-01-02':'2026-12-31');assert.equal(context.shopping,shopping);
 }
});
test('leftover blocks cannot initiate ingredient deductions through the cooking entry point',()=>{
 let opened;const context=vm.createContext({plans:original,detail:id=>opened=id});
 vm.runInContext(source.slice(source.indexOf('function cooking('),source.indexOf('function renderCook(')),context);context.cooking('r',3,'meal');assert.equal(opened,'r');
});
