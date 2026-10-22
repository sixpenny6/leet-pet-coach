import {DEFAULTS, validateConfig, endpoint, composeMessages, buildRequest, readResponse, redactError, problemKey} from './core.mjs';
import {extractLeetContext} from './extractor.js';

const lockStorage = () => chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
const ready=lockStorage();
chrome.runtime.onInstalled.addListener(()=>lockStorage().catch(()=>{}));
const isOptions = sender => sender.id===chrome.runtime.id && sender.url===chrome.runtime.getURL('options.html');
const isPage = sender => sender.id===chrome.runtime.id && !!sender.tab?.id && !!problemKey(sender.url||sender.tab.url);
const settings = async()=>{await ready;return {...DEFAULTS,...(await chrome.storage.local.get('settings')).settings};};
const safeConfig = c=>({provider:c.provider,model:c.model,baseUrl:c.baseUrl,configured:!!(c.baseUrl&&c.model),stream:c.stream});
const cleanMessages = list => {
  if(!Array.isArray(list))return [];
  const cleaned=list.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-20).map(m=>({role:m.role,content:m.content.slice(0,7000),failed:m.failed===true}));
  let budget=60000;return cleaned.reverse().filter(m=>{if(m.content.length>budget)return false;budget-=m.content.length;return true;}).reverse();
};
let saveChain=Promise.resolve();
function saveHistory(key,messages){const task=saveChain.then(async()=>{await ready;const {histories={}}=await chrome.storage.local.get('histories');histories[key]={messages:cleanMessages(messages),updated:Date.now()};const latest=Object.entries(histories).sort((a,b)=>b[1].updated-a[1].updated).slice(0,25);await chrome.storage.local.set({histories:Object.fromEntries(latest)});});saveChain=task.catch(()=>{});return task;}

chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  (async()=>{
    if(!msg||typeof msg.type!=='string')throw Error('无效请求。');
    if(msg.type==='GET_SETTINGS') {if(!isOptions(sender))throw Error('仅设置页可读取密钥。');return await settings();}
    if(msg.type==='SAVE_SETTINGS') {
      if(!isOptions(sender))throw Error('仅设置页可保存密钥。');
      const c=validateConfig(msg.settings),origin=new URL(endpoint(c)).origin+'/*';
      if(!await chrome.permissions.contains({origins:[origin]}))throw Error('尚未授权访问 API 服务器，请在设置页保存并授权。');
      await chrome.storage.local.set({settings:c});return {saved:true};
    }
    if(msg.type==='CLEAR_SETTINGS') {if(!isOptions(sender))throw Error('仅设置页可清除配置。');await ready;await chrome.storage.local.remove('settings');return {cleared:true};}
    if(msg.type==='TEST_SETTINGS') {
      if(!isOptions(sender))throw Error('仅设置页可测试连接。');
      const c=validateConfig(await settings());
      if(!await chrome.permissions.contains({origins:[new URL(endpoint(c)).origin+'/*']}))throw Error('请先保存并授权接口域名。');
      const request=buildRequest({...c,stream:false,maxTokens:128},[{role:'user',content:'请只回复：连接正常。'}]);
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
      try{const response=await fetch(request.url,{...request.init,signal:controller.signal});let text='';await readResponse(response,c.protocol,t=>text+=t);return {text:text.slice(0,500)};}
      catch(error){throw Error(controller.signal.aborted?'连接测试超时，请核对模型服务是否运行。':redactError(error,c.apiKey));}
      finally{clearTimeout(timer);}
    }
    if(!isPage(sender))throw Error('请在力扣题目页使用刷题搭子。');
    const key=problemKey(sender.url||sender.tab.url);
    if(msg.type==='STATUS')return safeConfig(await settings());
    if(msg.type==='OPEN_SETTINGS'){await chrome.runtime.openOptionsPage();return {};}
    if(msg.type==='READ_CONTEXT') {
      const out=await chrome.scripting.executeScript({target:{tabId:sender.tab.id},world:'MAIN',func:extractLeetContext});
      const context=out[0]?.result;if(!context)throw Error('未能读取页面，刷新题目后重试。');
      return context;
    }
    if(msg.type==='GET_HISTORY'){await ready;const {histories={}}=await chrome.storage.local.get('histories');return {messages:histories[key]?.messages||[]};}
    if(msg.type==='SAVE_HISTORY'){await saveHistory(key,msg.messages);return {};}
    if(msg.type==='SAVE_POSITION'){await ready;const p=msg.position;if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){const clamp=n=>Math.max(0,Math.min(1,n)),position={x:clamp(p.x),y:clamp(p.y)};if(p.panel&&Number.isFinite(p.panel.x)&&Number.isFinite(p.panel.y))position.panel={x:clamp(p.panel.x),y:clamp(p.panel.y)};await chrome.storage.local.set({petPosition:position});}return {};}
    if(msg.type==='GET_POSITION'){await ready;return (await chrome.storage.local.get('petPosition')).petPosition||null;}
    if(msg.type==='GET_MOTION'){await ready;return {enabled:(await chrome.storage.local.get('petMotionEnabled')).petMotionEnabled!==false};}
    if(msg.type==='SET_MOTION'){if(typeof msg.enabled!=='boolean')throw Error('动画设置无效。');await ready;await chrome.storage.local.set({petMotionEnabled:msg.enabled});return {};}
    throw Error('未知请求。');
  })().then(result=>reply({ok:true,result})).catch(error=>reply({ok:false,error:redactError(error)}));
  return true;
});

chrome.runtime.onConnect.addListener(port=>{
  if(port.name!=='leet-pet-chat'||!isPage(port.sender)){port.disconnect();return;}
  let controller=null,active=false;
  const send=d=>{try{port.postMessage(d);}catch{controller?.abort();}};
  port.onDisconnect.addListener(()=>controller?.abort());
  port.onMessage.addListener(async msg=>{
    if(msg.type==='STOP'){controller?.abort();return;}
    if(msg.type!=='ASK'||active)return;
    active=true;let config,timeout,headerTimeout;
    controller=new AbortController();
    try{
      config=validateConfig(await settings());
      const origin=new URL(endpoint(config)).origin+'/*';
      if(!await chrome.permissions.contains({origins:[origin]}))throw Error('接口授权已失效，请在设置里重新保存。');
      const key=problemKey(port.sender.url||port.sender.tab.url);
      if(problemKey(msg.context?.url)!==key)throw Error('题目已切换，请重新读取当前代码后发送。');
      if(typeof msg.context?.code==='string'&&msg.context.code.length>40000)throw Error('代码超过 40000 字符，请缩短后重试。');
      const messages=composeMessages(msg,config),request=buildRequest(config,messages);
      timeout=setTimeout(()=>controller.abort('timeout'),120000);
      send({type:'START'});
      headerTimeout=setTimeout(()=>controller.abort('headers-timeout'),25000);
      const response=await fetch(request.url,{...request.init,signal:controller.signal});
      clearTimeout(headerTimeout);
      await readResponse(response,config.protocol,text=>send({type:'DELTA',text}));
      send({type:'DONE'});
    }catch(error){
      const aborted=controller.signal.aborted;
      send({type:'ERROR',error:aborted?(controller.signal.reason==='timeout'?'请求超过 120 秒，已停止。':controller.signal.reason==='headers-timeout'?'模型服务超过 25 秒未响应。请检查连接、使用流式输出或选择响应更快的模型。':'已停止生成。'):redactError(error,config?.apiKey)});
    }finally{clearTimeout(timeout);clearTimeout(headerTimeout);active=false;controller=null;}
  });
});

chrome.action.onClicked.addListener(async tab=>{
  if(problemKey(tab.url)){
    try{await chrome.tabs.sendMessage(tab.id,{type:'TOGGLE_PET'});}catch{await chrome.scripting.executeScript({target:{tabId:tab.id},files:['rich-text.js','content.js']});}
  }else await chrome.tabs.create({url:'https://leetcode.cn/studyplan/top-100-liked/'});
});
