import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../substitutions.js',import.meta.url),'utf8')).replace("import {supabase} from './supabase-client.js';",'').replaceAll('export ','');
function harness(){
 const pending=[],writes=[];const context=vm.createContext({supabase:{from(){return {select(){return this},order(){return new Promise(resolve=>pending.push(resolve))},insert(values){writes.push(values);return Promise.resolve({error:null})}}}}});vm.runInContext(source+";globalThis.substitutionRules=substitutionRules;globalThis.substitutionIssue=substitutionIssue;",context);return {context,pending,writes};
}
test('late substitution results cannot replace a new account or survive logout',async()=>{
 const {context:c,pending}=harness();const first=c.loadSubstitutions('a'),second=c.loadSubstitutions('b');
 pending[1]({data:[{id:'b'}]});await second;pending[0]({data:[{id:'a'}]});await first;assert.equal(c.substitutionRules()[0].id,'b');
 const third=c.loadSubstitutions('b');c.clearSubstitutions();pending[2]({data:[{id:'private'}]});await third;assert.equal(c.substitutionRules().length,0);
});
test('missing substitution setup gives actionable guidance without rejecting kitchen loading',async()=>{
 const {context:c,pending}=harness();const loading=c.loadSubstitutions('a');pending[0]({error:{code:'PGRST205',message:'missing'}});await loading;
 assert.match(c.substitutionIssue(),/009_ingredient_substitutions.sql/);assert.equal(c.substitutionRules().length,0);
});
test('self-rules and duplicate rules are rejected before writing',async()=>{
 const {context:c,pending,writes}=harness();const loading=c.loadSubstitutions('a');pending[0]({data:[{ingredient_id:'tomato',substitute_id:'cherry'}]});await loading;
 await assert.rejects(c.addSubstitution('tomato','tomato'),/different/);await assert.rejects(c.addSubstitution('tomato','cherry'),/already exists/);assert.equal(writes.length,0);
 c.clearSubstitutions();await assert.rejects(c.addSubstitution('tomato','cherry'),/sign in/);
});
