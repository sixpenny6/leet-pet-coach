import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:8767');
  if(url.pathname==='/mock-chat'&&req.method==='POST'){
    let body='';for await(const chunk of req){body+=chunk;if(body.length>200000){res.writeHead(413);res.end();return;}}
    const pieces=['这是离线演示，没有调用真实模型。\n\n','**你已经找到正确方向了。** 固定 `i` 后，另一个下标从 `i + 1` 开始：\n\n','```python\nfor j in range(i + 1, len(nums)):\n    print("当前下标", j)\n```\n\n','1. `j` 从下一个位置开始，避免重复使用同一个数。\n2. `range` 不包含右端点，所以最后一个下标是 `len(nums) - 1`。\n\n如果 `i = 0`，你觉得 `j` 从几开始？'];
    res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache'});
    for(const piece of pieces){if(res.destroyed)break;res.write('data: '+JSON.stringify({choices:[{delta:{content:piece}}]})+'\n\n');await new Promise(r=>setTimeout(r,180));}
    if(!res.destroyed)res.end('data: [DONE]\n\n');return;
  }
  let relative=url.pathname;
  if(relative.startsWith('/problems/'))relative='/preview/index.html';
  if(relative==='/settings'){
    let html=await fs.readFile(path.join(root,'extension/options.html'),'utf8');
    html=html.replace('<head>','<head><base href="/extension/"><script src="/preview/mock-chrome.js"></script>').replace('<main>','<main><p style="color:#aa7854">离线设置界面演示：请勿在此输入真实密钥；不会发出模型请求。</p>');
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(relative));
  if(!file.startsWith(root+path.sep)||!relative.match(/^\/(extension|preview)\//)){res.writeHead(404);res.end();return;}
  try{let data=await fs.readFile(file);if(relative==='/preview/index.html')data=data.toString().replace('nums = [2, 7, 11, 15]\\ntarget = 9\\n\\n期望下标：[0, 1]','nums = [2, 7, 11, 15]\ntarget = 9\n\n期望下标：[0, 1]');res.writeHead(200,{'content-type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.gif':'image/gif'})[path.extname(file)]||'text/plain'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}
}).listen(8767,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:8767/problems/two-sum/'));
