import {DEFAULTS} from './core.mjs';

// Select only explicitly DeepSeek-labelled keys. Other vendors in a notebook
// must never be imported or sent to the DeepSeek API by accident.
export function importDeepSeek(text) {
  if(typeof text!=='string'||text.length>100000)throw Error('配置文件应为小于 100 KB 的文本文件。');
  const keys=new Set();
  const add=value=>{if(typeof value==='string'){const matches=value.match(/\bsk-[A-Za-z0-9_-]{12,}\b/g)||[];for(const key of matches)keys.add(key);}};
  let json;
  try{json=JSON.parse(text);}catch{}
  if(json&&typeof json==='object'){
    const walk=(value,labelled=false,depth=0)=>{
      if(!value||typeof value!=='object'||depth>8)return;
      const active=labelled||/deepseek/i.test(String(value.provider||value.name||''));
      for(const [key,child] of Object.entries(value)){
        const relevant=active||/deepseek/i.test(key);
        if(relevant&&typeof child==='string'&&(/key|token|secret|deepseek/i.test(key)||labelled))add(child);
        else if(child&&typeof child==='object')walk(child,relevant,depth+1);
      }
    };
    walk(json);
  }
  if(!keys.size){
    const lines=text.split(/\r?\n/);
    for(let i=0;i<lines.length;i++){
      if(!/deepseek/i.test(lines[i]))continue;
      const same=lines[i].match(/\bsk-[A-Za-z0-9_-]{12,}\b/g)||[];
      if(same.length){same.forEach(k=>keys.add(k));continue;}
      // A standalone section heading can be followed by the key on its next line.
      if(/^\s*[\[【#*\s]*deepseek[\]】:*\s]*$/i.test(lines[i]))add(lines[i+1]||'');
    }
  }
  if(keys.size===0)throw Error('未找到明确标注 DeepSeek 的密钥。请使用“DeepSeek: sk-…”格式，避免误导入其他供应商。');
  if(keys.size!==1)throw Error('文件中出现多个 DeepSeek 密钥，无法确定用哪一个。请保留一个后再导入。');
  return {...DEFAULTS,provider:'deepseek',protocol:'openai',baseUrl:'https://api.deepseek.com',model:'deepseek-flash',apiKey:[...keys][0],stream:true,tokenField:'max_tokens'};
}
