import test from 'node:test';
import assert from 'node:assert/strict';
import {currentWeek,weekLabel,kitchenSummary} from '../calendar.mjs';
test('week starts Monday and crosses month and year boundaries',()=>{
 const dates=currentWeek(new Date(2027,0,3,10));
 assert.equal(dates[0].getDay(),1);assert.equal(dates[0].getFullYear(),2026);
 assert.equal(dates[0].getDate(),28);assert.equal(dates[6].getDate(),3);
 assert.equal(weekLabel(dates),'Dec 28, 2026 — Jan 3, 2027');
});
test('week follows local calendar days across daylight-saving changes',()=>{
 const dates=currentWeek(new Date(2026,9,25,10));
 assert.deepEqual(dates.map(d=>d.getDate()),[19,20,21,22,23,24,25]);
});
test('dashboard copy distinguishes empty, unavailable, singular and plural',()=>{
 assert.match(kitchenSummary(0,0),/first recipe/);assert.match(kitchenSummary(2,0),/No recipes/);
 assert.equal(kitchenSummary(3,1),'You can make 1 recipe with what you have.');
 assert.equal(kitchenSummary(3,2),'You can make 2 recipes with what you have.');
});
