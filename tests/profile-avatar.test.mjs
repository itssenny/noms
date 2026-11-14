import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../profile.js',import.meta.url),'utf8')).replace(/^import.*\n/,'');
const a={user:{id:'a',email:'alice@example.test',created_at:'2026-01-01'}},b={user:{id:'b',email:'bob@example.test',created_at:'2026-01-01'}};
function harness(){const callbacks={},queries=[],view={innerHTML:'',classList:{contains:()=>false}},button={innerHTML:'',set textContent(value){this.innerHTML=value}};
 const context=vm.createContext({console,document:{querySelector:selector=>selector==='#profile-button'?button:view,addEventListener(){}},window:{addEventListener:(name,cb)=>callbacks[name]=cb},supabase:{auth:{getSession:async()=>({data:{session:a}})},from(){return {select(){return this},eq(){return this},maybeSingle(){return new Promise(resolve=>queries.push(resolve))}}}}});vm.runInContext(source,context);return {context,callbacks,queries,view,button}}
test('header photo loads at sign-in and stays through auth refresh without opening profile',async()=>{
 const {callbacks,queries,view,button}=harness();await new Promise(setImmediate);assert.equal(queries.length,1);queries[0]({data:{id:'a',avatar_url:'https://example.test/a.jpg',display_name:'Alice'}});await new Promise(setImmediate);assert.match(button.innerHTML,/a.jpg/);assert.equal(view.innerHTML,'');callbacks['mise-auth-change']({detail:{session:a}});assert.match(button.innerHTML,/a.jpg/);assert.equal(queries.length,1);
});
test('late profile reads cannot show the previous account photo after switching or logout',async()=>{
 const {callbacks,queries,button}=harness();await new Promise(setImmediate);callbacks['mise-auth-change']({detail:{session:b}});assert.equal(queries.length,2);queries[1]({data:{id:'b',avatar_url:'https://example.test/b.jpg'}});await new Promise(setImmediate);queries[0]({data:{id:'a',avatar_url:'https://example.test/a.jpg'}});await new Promise(setImmediate);assert.match(button.innerHTML,/b.jpg/);assert.doesNotMatch(button.innerHTML,/a.jpg/);callbacks['mise-auth-change']({detail:{session:null}});assert.doesNotMatch(button.innerHTML,/<img/);
});
