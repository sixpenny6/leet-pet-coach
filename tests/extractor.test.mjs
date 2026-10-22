import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {extractLeetContext} from '../extension/extractor.js';
function setup({monaco,editor,plain}={}){
  return vm.createContext({window:{monaco},location:{href:'https://leetcode.cn/problems/two-sum/'},document:{title:'两数之和',querySelector(selector){if(selector.includes('question-title'))return {innerText:'1. 两数之和'};if(selector.includes('description_content'))return {innerText:'自编题目测试内容'};if(selector.startsWith('textarea['))return plain||null;return null;},querySelectorAll(selector){return selector==='.monaco-editor'&&editor?[editor]:[];}}});
}
function editor(){return {clientWidth:500,clientHeight:300,getBoundingClientRect:()=>({width:500,height:300}),getAttribute:()=> 'inmemory://model/1',closest:()=>true,parentElement:null};}
const run=ctx=>vm.runInContext('('+extractLeetContext.toString()+')()',ctx);
test('extractor matches visible Monaco URI instead of hidden model',()=>{const live={uri:'inmemory://model/1',getValue:()=> 'FULL\nCODE',getLanguageId:()=> 'python'},other={uri:'inmemory://model/2',getValue:()=> 'WRONG',getLanguageId:()=> 'cpp'};const r=run(setup({editor:editor(),monaco:{editor:{getModels:()=>[other,live]}}}));assert.equal(r.code,'FULL\nCODE');assert.equal(r.complete,true);assert.equal(r.language,'python');});
test('React editor ref is supported when Monaco is not global',()=>{const el=editor();el.__reactFiber$test={memoizedProps:{editorRef:{current:{getValue:()=> 'FULL',getModel:()=>({getValue:()=> 'FULL',getLanguageId:()=> 'python'})}}}};const r=run(setup({editor:el}));assert.equal(r.code,'FULL');assert.equal(r.source,'React 编辑器引用');});
test('virtualized DOM is never accepted as a complete solution',()=>{const r=run(setup({editor:editor()}));assert.equal(r.complete,false);assert.equal(r.code,'');});
test('oversized editor model is explicitly marked incomplete',()=>{const m={uri:'inmemory://model/1',getValue:()=> 'x'.repeat(40001),getLanguageId:()=> 'python'};const r=run(setup({editor:editor(),monaco:{editor:{getModels:()=>[m]}}}));assert.equal(r.complete,false);assert.equal(r.code.length,40000);});
test('plain code textarea fallback supports whole source',()=>{const r=run(setup({plain:{value:'def solve():\n    pass',closest:()=>null}}));assert.equal(r.complete,true);assert.equal(r.source,'代码文本框');});
