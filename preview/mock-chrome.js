// Development-only Chrome API fixture. Not shipped in the extension ZIP.
(()=>{
  // Make the test fixture inspectable by accessibility/browser QA tooling.
  // The packaged extension retains a closed ShadowRoot.
  const attachShadow=Element.prototype.attachShadow;
  Element.prototype.attachShadow=function(options){return attachShadow.call(this,{...options,mode:'open'});};
  const data=JSON.parse(localStorage.getItem('pet-demo')||'{}');
  const save=()=>localStorage.setItem('pet-demo',JSON.stringify(data));
  const event=()=>{const handlers=[];return {addListener:f=>handlers.push(f),emit:m=>handlers.forEach(f=>f(m))};};
  window.chrome={runtime:{lastError:null,getURL:p=>'/extension/'+p,onMessage:event(),
    async sendMessage(msg){
      if(msg.type==='GET_SETTINGS')return {ok:true,result:{provider:'custom',protocol:'openai',baseUrl:'https://example.test/v1',model:'offline-demo',apiKey:'NOT-A-REAL-KEY',maxTokens:2048,tokenField:'max_tokens',stream:true,customPrompt:'',...data.settings}};
      if(msg.type==='SAVE_SETTINGS'){data.settings=msg.settings;save();return {ok:true,result:{saved:true}};}
      if(msg.type==='CLEAR_SETTINGS'){delete data.settings;save();return {ok:true,result:{}};}
      if(msg.type==='TEST_SETTINGS')return {ok:true,result:{text:'这是离线演示，没有进行外部 API 请求。'}};
      if(msg.type==='STATUS')return {ok:true,result:{provider:'离线演示',model:'模拟流式回答',configured:true}};
      if(msg.type==='OPEN_SETTINGS'){window.open('/settings','_blank');return {ok:true,result:{}};}
      if(msg.type==='GET_HISTORY')return {ok:true,result:{messages:data.messages||[]}};
      if(msg.type==='SAVE_HISTORY'){data.messages=msg.messages;save();return {ok:true,result:{}};}
      if(msg.type==='GET_POSITION')return {ok:true,result:data.position||null};
      if(msg.type==='SAVE_POSITION'){data.position=msg.position;save();return {ok:true,result:{}};}
      if(msg.type==='GET_MOTION')return {ok:true,result:{enabled:data.motionEnabled!==false}};
      if(msg.type==='SET_MOTION'){data.motionEnabled=msg.enabled;save();return {ok:true,result:{}};}
      if(msg.type==='READ_CONTEXT')return {ok:true,result:{url:location.href,title:'1. 两数之和 · 离线演示',description:'找两个不同下标，使对应数字之和为 target。',code:document.getElementById('demo-code').value,source:'离线测试文本框',complete:true,language:'python',capturedAt:Date.now()}};
      return {ok:false,error:'Unknown fixture message'};
    },
    connect(){const port={onMessage:event(),onDisconnect:event()},controller=new AbortController();let disconnected=false;
      port.disconnect=()=>{if(!disconnected){disconnected=true;controller.abort();port.onDisconnect.emit();}};
      port.postMessage=async msg=>{if(msg.type==='STOP'){controller.abort();return;}if(msg.type!=='ASK')return;
        port.onMessage.emit({type:'START'});
        try{const {readResponse}=await import('/extension/core.mjs');const response=await fetch('/mock-chat',{method:'POST',body:JSON.stringify(msg),signal:controller.signal});await readResponse(response,'openai',text=>port.onMessage.emit({type:'DELTA',text}));if(!disconnected)port.onMessage.emit({type:'DONE'});}catch(e){if(!disconnected)port.onMessage.emit({type:'ERROR',error:e.message});}
      };return port;
    }
  },permissions:{request:async()=>true}};
})();
