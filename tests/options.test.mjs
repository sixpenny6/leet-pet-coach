import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS} from '../extension/core.mjs';
const nodes={},calls=[];let stored={...DEFAULTS},permission=true,focused=null;
function node(id=''){return {id,value:'',checked:false,type:'',textContent:'',classList:{toggle(){}},append(){},prepend(){},focus(){focused=id;},scrollIntoView(){},click(){}};}
for(const id of [...Object.keys(DEFAULTS),'form','status','show-key','save','test','clear'])nodes[id]=node(id);
globalThis.document={getElementById:id=>nodes[id],createElement:tag=>node(tag)};
globalThis.chrome={permissions:{request:async()=>{calls.push('permission');return permission;}},runtime:{sendMessage:async msg=>{
  calls.push(msg.type);
  if(msg.type==='GET_SETTINGS')return {ok:true,result:{...stored}};
  if(msg.type==='SAVE_SETTINGS'){stored={...msg.settings};return {ok:true,result:{saved:true}};}
  if(msg.type==='TEST_SETTINGS')return {ok:true,result:{text:stored.model}};
  return {ok:false,error:'unexpected'};
}}};
await import('../extension/options.js');
await new Promise(resolve=>setImmediate(resolve));
function fill(values){for(const [k,v]of Object.entries({...DEFAULTS,...values})){if(typeof v==='boolean')nodes[k].checked=v;else nodes[k].value=String(v);}}
test('test button saves current fields instead of testing stale empty config',async()=>{
  fill({provider:'deepseek',baseUrl:'https://api.deepseek.com',model:'deepseek-flash',apiKey:'sk-EXAMPLE_TEST_KEY'});calls.length=0;
  await nodes.test.onclick();
  assert.deepEqual(calls,['permission','SAVE_SETTINGS','TEST_SETTINGS']);
  assert.equal(stored.model,'deepseek-flash');assert.equal(stored.apiKey,'sk-EXAMPLE_TEST_KEY');
  assert.match(nodes.status.textContent,/连接正常/);assert.equal(nodes.test.disabled,false);
});
test('DeepSeek missing model is filled before save',async()=>{
  fill({provider:'deepseek',baseUrl:'https://api.deepseek.com',model:'',apiKey:'sk-EXAMPLE_TEST_KEY'});
  await nodes.test.onclick();assert.equal(nodes.model.value,'deepseek-flash');assert.equal(stored.model,'deepseek-flash');
});
test('missing custom model focuses correct input and does not call provider',async()=>{
  fill({provider:'custom',baseUrl:'https://example.com',model:'',apiKey:'sk-EXAMPLE_TEST_KEY'});calls.length=0;
  await nodes.test.onclick();assert.equal(focused,'model');assert.equal(calls.length,0);assert.match(nodes.status.textContent,/模型 ID/);
});
test('denied permission cannot test an unrelated previous configuration',async()=>{
  fill({provider:'deepseek',baseUrl:'https://api.deepseek.com',model:'deepseek-flash',apiKey:'sk-EXAMPLE_TEST_KEY'});calls.length=0;permission=false;
  await nodes.test.onclick();assert.deepEqual(calls,['permission']);assert.match(nodes.status.textContent,/尚未保存/);permission=true;
});
