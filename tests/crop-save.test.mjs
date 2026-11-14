import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
test('new recipes save the cropped upload using existing photo columns, without a framing migration',async()=>{
 const writes=[],croppedFile={name:'recipe-cover.webp',size:200,type:'image/webp'};
 const context=vm.createContext({activeProfileId:'owner',activeProfile:{id:'owner',username:'owner'},sessionVersion:1,currentUser:async()=>({id:'owner'}),
 uploadRecipeCover:async file=>{assert.equal(file,croppedFile);return 'owner/cropped.webp'},hydrateCovers:async rows=>rows.map(row=>({...row,image_url:'blob:cropped'})),
 supabase:{from(table){return {insert(value){writes.push({table,value});return this},select(){return this},single:async()=>({data:{id:'recipe',share_code:'ABC234'}}),then(resolve){return Promise.resolve({data:[]}).then(resolve)}}}}});
 vm.runInContext(source.slice(source.indexOf('async function createRecipe('),source.indexOf('function recipePayload(')),context);
 const saved=await context.createRecipe({name:'Cropped recipe',source:'Family',imageFraming:{x:50,y:50,zoom:1},ingredients:[['Rice',1,'cup','','rice']]},croppedFile);
 assert.equal(writes[0].value.image_url,'owner/cropped.webp');assert.equal('image_framing' in writes[0].value,false);assert.equal(saved.imageUrl,'blob:cropped');assert.equal(saved.imagePath,'owner/cropped.webp');
});
