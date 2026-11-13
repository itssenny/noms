import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../catalogue.js',import.meta.url),'utf8');
test('editing saves through the handler even when the hidden id control shadows form.id',async()=>{
 let handler,prevented=false,saved,refreshed=false;const button={disabled:false},status={};const values={id:'ingredient',name:'My noodles',category:'Spices',unit:'g'},form={id:{value:'ingredient'},getAttribute:name=>name==='id'?'catalogue-form':null,querySelector:selector=>selector==='.primary-btn'?button:status,isConnected:true};
 const context=vm.createContext({version:1,document:{addEventListener(type,callback){handler=callback}},FormData:class{get(key){return values[key]}},saveCatalogueIngredient:async value=>saved=value,window:{dispatchEvent(){}},CustomEvent:class{},catalogueView:async()=>refreshed=true});
 const start=source.indexOf("document.addEventListener('submit',async event=>{");vm.runInContext(source.slice(start,source.indexOf('\n});',start)+5),context);await handler({target:form,preventDefault(){prevented=true}});assert.equal(prevented,true);assert.equal(saved.id,'ingredient');assert.equal(saved.category,'Spices');assert.equal(refreshed,true);assert.equal(button.disabled,false);
});
