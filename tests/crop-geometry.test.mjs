import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCrop,moveCrop,resizeCrop,cropPixels} from '../crop-geometry.mjs';
test('crop starts centered, honors aspect, and translates legacy framing',()=>{
 assert.deepEqual(initialCrop(1200,600,1),{x:.25,y:0,w:.5,h:1});
 const rect=initialCrop(1200,600,1,{x:0,y:100,zoom:2});assert.deepEqual(rect,{x:0,y:.5,w:.25,h:.5});
});
test('dragging and corner resizing stay within the original photo',()=>{
 const rect={x:.2,y:.2,w:.5,h:.5};
 assert.deepEqual(moveCrop(rect,1,-1),{x:.5,y:0,w:.5,h:.5});
 for(const corner of ['nw','ne','sw','se'])for(const dx of [-10,.1,10]){
  const resized=resizeCrop(rect,corner,dx,-dx,1);assert.ok(resized.x>=0&&resized.y>=0);assert.ok(resized.x+resized.w<=1.00001&&resized.y+resized.h<=1.00001);assert.ok(resized.w>0&&resized.h>0);assert.ok(Math.abs(resized.w/resized.h-1)<1e-8);
 }
});
test('export uses actual source pixels and bounds output resolution',()=>{
 assert.deepEqual(cropPixels({x:1/3,y:0,w:1/3,h:1},1200,600),{x:400,y:0,w:400,h:600,outputWidth:400,outputHeight:600});
 const large=cropPixels({x:0,y:0,w:1,h:1},8000,4000);assert.equal(large.outputWidth,1800);assert.equal(large.outputHeight,900);
});
