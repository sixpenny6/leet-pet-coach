import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=new URL('../extension/',import.meta.url);
test('manifest references only existing local assets',async()=>{const m=JSON.parse(await fs.readFile(new URL('manifest.json',root),'utf8'));assert.equal(m.manifest_version,3);const files=[m.background.service_worker,m.options_page,...Object.values(m.icons),...m.content_scripts.flatMap(x=>x.js),...m.web_accessible_resources.flatMap(x=>x.resources)];for(const file of files)assert((await fs.stat(new URL(file,root))).isFile(),file);});
test('installation contains no API keys, fixture or remote execution scripts',async()=>{const files=await fs.readdir(root);assert(!files.includes('mock-chrome.js'));for(const file of files.filter(x=>/\.(js|mjs|html)$/.test(x))){const source=await fs.readFile(new URL(file,root),'utf8');assert(!source.includes('secret-for-test'));assert(!source.includes('TEST-SECRET'));assert(!/\beval\s*\(/.test(source));assert(!/new Function\s*\(/.test(source));}assert(files.includes('安装说明.txt'));});
