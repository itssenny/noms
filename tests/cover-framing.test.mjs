import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFraming,framingStyle,dragFraming} from '../cover-framing.mjs';
test('old recipes retain centered framing; invalid values cannot become CSS',()=>{
 assert.deepEqual(normalizeFraming(),{x:50,y:50,zoom:1});
 assert.deepEqual(normalizeFraming({x:-5,y:140,zoom:99}),{x:0,y:100,zoom:3});
 assert.deepEqual(normalizeFraming({x:'bad',y:NaN,zoom:Infinity}),{x:50,y:50,zoom:1});
 assert.equal(framingStyle({x:25,y:75,zoom:2}),'object-position:25% 75%;transform:scale(2);transform-origin:25% 75%;');
});
test('dragging follows visible image movement without exposing empty edges',()=>{
 const frame={x:50,y:50,zoom:1};
 assert.deepEqual(dragFraming(frame,100,100,400,400,1200,400),{x:37.5,y:50,zoom:1});
 assert.deepEqual(dragFraming(frame,10000,-10000,400,400,1200,800),{x:0,y:50,zoom:1});
 const zoomed=dragFraming({...frame,zoom:2},50,50,400,400,800,800);assert.deepEqual(zoomed,{x:37.5,y:37.5,zoom:2});
 assert.deepEqual(frame,{x:50,y:50,zoom:1});
});
