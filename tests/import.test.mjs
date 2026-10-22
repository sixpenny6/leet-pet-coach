import test from 'node:test';
import assert from 'node:assert/strict';
import {importDeepSeek} from '../extension/import-config.mjs';
const key='sk-EXAMPLE_DEEPSEEK_123456';
test('imports only DeepSeek from a multivendor text file',()=>{const c=importDeepSeek(`DeepSeek: ${key}\nOpenAI: sk-EXAMPLE_OTHER_123456\nGemini: other-key`);assert.equal(c.apiKey,key);assert.equal(c.model,'deepseek-flash');assert.equal(c.baseUrl,'https://api.deepseek.com');});
test('imports labelled JSON configuration',()=>{assert.equal(importDeepSeek(JSON.stringify({deepseek:{apiKey:key},openai:{apiKey:'sk-EXAMPLE_OTHER_123456'}})).apiKey,key);});
test('does not import an unlabelled key or ambiguous keys',()=>{assert.throws(()=>importDeepSeek('sk-EXAMPLE_OTHER_123456'));assert.throws(()=>importDeepSeek(`DeepSeek: ${key}\nDeepSeek: sk-EXAMPLE_ANOTHER_123456`));});
test('accepts a DeepSeek section heading and deduplicates the same key',()=>{assert.equal(importDeepSeek(`[DeepSeek]\n${key}`).apiKey,key);assert.equal(importDeepSeek(`DeepSeek: ${key}\nDeepSeek: ${key}`).apiKey,key);});
