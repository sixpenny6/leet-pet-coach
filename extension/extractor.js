// This function is serialized by chrome.scripting into the page MAIN world.
// Keep all dependencies inside it. Never return page cookies, storage or tokens.
export function extractLeetContext() {
  const text = (selector, limit=14000) => (document.querySelector(selector)?.innerText || '').trim().slice(0,limit);
  const title=text('[data-e2e-locator="question-title"], [data-cy="question-title"], h1',300)||document.title;
  const description=text('[data-track-load="description_content"], [data-cy="question-content"], .question-content, [class*="elfjS"]');
  const language=text('[data-e2e-locator="lang-selector-button"], [data-cy="lang-select"]',80);
  const results=text('[data-e2e-locator="console-result"], [data-e2e-locator="console-result-content"], [data-track-load="submission_result"], .result-container',6000);
  const base={title, description, language, results, url:location.href, code:'',source:'unavailable',complete:false,capturedAt:Date.now()};
  const editorElements=[...document.querySelectorAll('.monaco-editor')].filter(e=>{const r=e.getBoundingClientRect();return r.width>100&&r.height>50;}).sort((a,b)=>b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight);
  const editorElement=editorElements.find(e=>e.closest('[data-track-load="code_editor"]'))||editorElements[0];
  function result(code,source,lang='') {
    if(typeof code!=='string')return null;
    const complete=code.length<=40000;
    return {...base,code:code.slice(0,40000),source,complete,language:lang||language};
  }
  function editorValue(candidate,source) {
    try {
      if(candidate&&typeof candidate.getValue==='function'&&typeof candidate.getModel==='function'){
        const model=candidate.getModel();if(model&&typeof model.getValue==='function')return result(model.getValue(),source,model.getLanguageId?.()||'');
      }
      if(candidate&&typeof candidate.getValue==='function'&&typeof candidate.getLanguageId==='function')return result(candidate.getValue(),source,candidate.getLanguageId());
    } catch {}
    return null;
  }
  // Pick the model that belongs to the visible code editor, never a hidden scratch editor.
  try {
    const api=window.monaco?.editor;
    if(api&&editorElement){
      const uri=editorElement.getAttribute('data-uri');
      const model=api.getModels?.().find(m=>String(m.uri)===uri);
      const found=editorValue(model,'Monaco 完整模型');if(found)return found;
      const live=api.getEditors?.().find(e=>e.getDomNode?.()===editorElement);
      const full=editorValue(live,'Monaco 编辑器');if(full)return full;
    }
  } catch {}
  // Monaco is not always exposed on window. Search only the visible editor's
  // React refs/hooks, with strict depth/node limits and a small property allowlist.
  const seen=new WeakSet();let budget=500;
  function findRef(obj,depth=0){
    if(!obj||typeof obj!=='object'||seen.has(obj)||depth>4||budget--<=0)return null;
    seen.add(obj);const direct=editorValue(obj,'React 编辑器引用');if(direct)return direct;
    for(const key of ['current','editor','editorRef','_editor','monacoEditor','memoizedState','next']){
      let value;try{value=obj[key];}catch{continue;}
      const found=findRef(value,depth+1);if(found)return found;
    }
    return null;
  }
  if(editorElement){
    for(let el=editorElement,level=0;el&&level<7;el=el.parentElement,level++){
      const key=Object.keys(el).find(k=>k.startsWith('__reactFiber$')||k.startsWith('__reactInternalInstance$'));
      if(!key)continue;
      let fiber=el[key];
      for(let n=0;fiber&&n<14;fiber=fiber.return,n++){
        let found=findRef(fiber.memoizedProps);if(found)return found;
        let hook=fiber.memoizedState;
        for(let h=0;hook&&h<40;hook=hook.next,h++){
          found=findRef(hook.memoizedState);if(found)return found;
        }
      }
    }
  }
  const cm=document.querySelector('.cm-editor');
  try{const v=cm?.cmView?.view||cm?.querySelector('.cm-content')?.cmView?.view;if(v?.state?.doc)return result(v.state.doc.toString(),'CodeMirror 完整文档');}catch{}
  try{const ace=document.querySelector('.ace_editor');if(ace?.env?.editor)return result(ace.env.editor.getValue(),'Ace 编辑器');}catch{}
  const plain=document.querySelector('textarea[data-leet-code], textarea[data-cy="code-editor"], textarea#code');
  if(plain&&!plain.closest('.monaco-editor'))return result(plain.value,'代码文本框');
  // Monaco's inputarea and .view-lines are partial/virtualized. Never report them as full code.
  return base;
}
