// Small, text-only Markdown renderer: no model-supplied HTML is executed.
(() => {
  function inlineTokens(source){
    const out=[];let start=0;
    const pattern=/(`{1,2})([^\n]*?)\1|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
    for(const match of source.matchAll(pattern)){
      if(match.index>start)out.push({type:'text',text:source.slice(start,match.index)});
      if(match[1])out.push({type:'code',text:match[2]});
      else if(match[3]||match[4])out.push({type:'strong',text:match[3]||match[4]});
      else out.push({type:'link',text:match[5],href:match[6]});
      start=match.index+match[0].length;
    }
    if(start<source.length)out.push({type:'text',text:source.slice(start)});
    return out;
  }
  function parseBlocks(source){
    const lines=String(source).replace(/\r\n?/g,'\n').split('\n'),blocks=[];let paragraph=[];
    const flush=()=>{if(paragraph.length){blocks.push({type:'paragraph',text:paragraph.join('\n')});paragraph=[];}};
    for(let i=0;i<lines.length;i++){
      const line=lines[i],fence=line.match(/^\s*(`{3,}|~{3,})\s*(.*)$/);
      if(fence){
        flush();const code=[],marker=fence[1][0],length=fence[1].length;let closed=false;
        for(i++;i<lines.length;i++){
          const close=lines[i].trim();
          if(close.length>=length&&[...close].every(c=>c===marker)){closed=true;break;}
          code.push(lines[i]);
        }
        blocks.push({type:'code',language:fence[2].trim().slice(0,40),text:code.join('\n'),closed});continue;
      }
      if(!line.trim()){flush();continue;}
      const heading=line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*$/);
      if(heading){flush();blocks.push({type:'heading',text:heading[1]});continue;}
      if(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)){flush();blocks.push({type:'rule'});continue;}
      const item=line.match(/^\s*(?:([-+*])|(\d+)[.)])\s+(.+)$/);
      if(item){
        flush();const type=item[2]?'ol':'ul',last=blocks.at(-1);
        if(last?.type===type)last.items.push(item[3]);
        else blocks.push({type,items:[item[3]],start:item[2]?Number(item[2]):1});
        continue;
      }
      const quote=line.match(/^\s*>\s?(.*)$/);
      if(quote){flush();const last=blocks.at(-1);if(last?.type==='quote')last.text+='\n'+quote[1];else blocks.push({type:'quote',text:quote[1]});continue;}
      paragraph.push(line);
    }
    flush();return blocks;
  }
  function renderInline(parent,source){
    for(const token of inlineTokens(source)){
      if(token.type==='text'){parent.append(document.createTextNode(token.text));continue;}
      const el=document.createElement(token.type==='code'?'code':token.type==='strong'?'strong':'a');
      el.textContent=token.text;
      if(token.type==='code')el.className='inline-code';
      if(token.type==='link'){el.href=token.href;el.target='_blank';el.rel='noopener noreferrer';}
      parent.append(el);
    }
  }
  function render(parent,source,onCopyError=()=>{}){
    for(const block of parseBlocks(source)){
      if(block.type==='code'){
        const box=document.createElement('div');box.className='code-box';
        const bar=document.createElement('div');bar.className='code-bar';
        const label=document.createElement('span');label.textContent=block.language||'代码';
        const copy=document.createElement('button');copy.textContent='复制';
        copy.onclick=async()=>{try{await navigator.clipboard.writeText(block.text);copy.textContent='已复制';}catch{onCopyError();}};
        bar.append(label,copy);const pre=document.createElement('pre');pre.textContent=block.text;box.append(bar,pre);parent.append(box);continue;
      }
      if(block.type==='rule'){parent.append(document.createElement('hr'));continue;}
      if(block.type==='ul'||block.type==='ol'){
        const list=document.createElement(block.type);list.className='md-list';if(block.type==='ol')list.start=block.start;
        for(const text of block.items){const item=document.createElement('li');renderInline(item,text);list.append(item);}
        parent.append(list);continue;
      }
      const el=document.createElement(block.type==='heading'?'h4':block.type==='quote'?'blockquote':'p');
      el.className='md-'+block.type;renderInline(el,block.text);parent.append(el);
    }
  }
  globalThis.LeetPetRichText={inlineTokens,parseBlocks,render};
})();
