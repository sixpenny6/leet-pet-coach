(() => {
  if (document.getElementById('leet-pet-coach-host')) return;
  const host=document.createElement('div');host.id='leet-pet-coach-host';
  host.style.cssText='position:fixed;inset:0;width:0;height:0;z-index:2147483646;';
  const root=host.attachShadow({mode:'closed'}),css=document.createElement('link');
  css.rel='stylesheet';css.href=chrome.runtime.getURL('panel.css');
  const whaleCss=document.createElement('link');whaleCss.rel='stylesheet';whaleCss.href=chrome.runtime.getURL('whale.css');root.append(css,whaleCss);
  const wrap=document.createElement('div');
  wrap.innerHTML=`
    <button id="pet" aria-label="打开刷题搭子，可拖动" title="点我提问，也可以拖动我">
      <span class="speech">今天也要吃一道题！</span>
      <img id="whale-sprite" class="whale-sprite" src="${chrome.runtime.getURL('assets/whale-idle.png')}" alt="蓝色大肥鱼鲸鱼娘" draggable="false">
      <span class="pet-label">大肥鱼陪你刷 <i></i></span>
    </button>
    <section id="panel" aria-label="刷题搭子对话" hidden>
      <header id="panel-head"><div class="avatar"><img src="${chrome.runtime.getURL('assets/whale-avatar.png')}" alt="鲸鱼娘头像"></div><div class="heading"><strong>刷题搭子 · 大肥鱼</strong><small>白饭要吃，算法也要学。</small></div><button id="motion-toggle" title="暂停待机动画" aria-label="暂停待机动画" aria-pressed="false">动</button><button id="settings" title="配置模型" aria-label="配置模型">⚙</button><button id="collapse" title="收起" aria-label="收起对话">−</button></header>
      <div class="topic"><span class="dot"></span><b id="topic-title">读取当前题目…</b><button id="read" title="读取当前完整代码">↻ 读取</button></div>
      <div class="provider"><span id="provider-label">尚未配置模型</span><button id="export" title="导出本题对话">导出</button><button id="clear" title="清空本题对话">清空</button></div>
      <div id="messages" role="log" aria-label="对话记录" aria-live="polite"></div>
      <div id="notice" role="status"></div>
      <details id="context"><summary><span id="code-status">尚未读取代码</span><span>查看附件 ⌄</span></summary><div class="context-body"><label><input id="attach-code" type="checkbox" checked> 附带当前代码</label><label><input id="attach-problem" type="checkbox" checked> 附带题目</label><label><input id="manual-mode" type="checkbox"> 改用手动粘贴的完整代码</label><textarea id="code-preview" aria-label="读取到的代码或手动代码" spellcheck="false" placeholder="点击读取；读取失败时可以勾选手动粘贴。" readonly></textarea><textarea id="error-input" aria-label="补充报错或测试结果" placeholder="可选：粘贴报错、失败用例或运行结果…"></textarea><small id="source">只读取题目与编辑器，不读取账号信息。</small></div></details>
      <div class="composer"><div class="modes" role="group" aria-label="教学模式"><button data-mode="hint" class="selected">一点提示</button><button data-mode="review">检查代码</button><button data-mode="explain">讲懂语法</button><button data-mode="interview">面试追问</button></div><textarea id="question" aria-label="向搭子提问" placeholder="我卡住了，先给我一点提示…" rows="2"></textarea><div class="sendbar"><small>Enter 发送 · Shift+Enter 换行</small><button id="stop" hidden>停止</button><button id="send">发送 ↗</button></div><p class="privacy">发送时，所选附件与最近对话会交给你配置的模型。</p></div>
    </section>`;
  root.append(wrap);document.documentElement.append(host);
  const $=id=>root.getElementById(id),pet=$('pet'),panel=$('panel');
  const PET_W=112,PET_H=148;
  const sprites=Object.fromEntries(['idle','thinking','happy'].map(mood=>[mood,chrome.runtime.getURL('assets/whale-'+mood+'.png')]));
  const animatedIdle=chrome.runtime.getURL('assets/whale-idle.gif'),reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  for(const src of Object.values(sprites)){const image=new Image();image.src=src;}
  let context=null,messages=[],mode='hint',busy=false,reading=false,port=null,config=null,keepAlive=null,moodTimer=null,motionEnabled=true;
  function refreshSprite(){
    const animate=motionEnabled&&!reducedMotion.matches,mood=pet.dataset.mood||'idle';
    pet.dataset.animation=animate?'on':'off';$('whale-sprite').src=animate&&mood==='idle'?animatedIdle:sprites[mood]||sprites.idle;
    $('motion-toggle').textContent=animate?'动':'静';$('motion-toggle').title=animate?'暂停待机动画':'开启待机动画';$('motion-toggle').setAttribute('aria-label',$('motion-toggle').title);$('motion-toggle').setAttribute('aria-pressed',String(!animate));
  }
  function setMood(mood,label){clearTimeout(moodTimer);pet.dataset.mood=mood;refreshSprite();root.querySelector('.speech').textContent=label||'今天也要吃一道题！';}
  reducedMotion.addEventListener('change',refreshSprite);
  let route=null,generation=0,opened=false,manualCode='',sessionMessage=null,requestToken=0,loadHistoryPromise=Promise.resolve();
  let pos={x:innerWidth-PET_W-20,y:innerHeight-PET_H-20},manualLayout=null;
  const key=()=>{const m=location.pathname.match(/^\/problems\/([^/]+)/);return m?location.hostname+'/'+m[1]:'';};
  const call=async(type,extra={})=>{const r=await chrome.runtime.sendMessage({type,...extra});if(!r?.ok)throw Error(r?.error||'扩展连接中断，请刷新力扣页面。');return r.result;};
  const say=(text,error=false)=>{$('notice').textContent=text;$('notice').classList.toggle('error',error);};
  function moveGroup(layout,dx,dy){
    const next={...layout};
    // On narrow windows the panel takes priority; its header stays draggable.
    if(next.width+PET_W+32>innerWidth)next.showPet=false;
    const minX=next.showPet?Math.min(next.panelX,next.petX):next.panelX;
    const maxX=next.showPet?Math.max(next.panelX+next.width,next.petX+PET_W):next.panelX+next.width;
    const minY=next.showPet?Math.min(next.panelY,next.petY):next.panelY;
    const maxY=next.showPet?Math.max(next.panelY+next.height,next.petY+PET_H):next.panelY+next.height;
    const sx=Math.max(8-minX,Math.min(innerWidth-8-maxX,dx));
    const sy=Math.max(8-minY,Math.min(innerHeight-8-maxY,dy));
    next.panelX+=sx;next.panelY+=sy;next.petX+=sx;next.petY+=sy;
    return next;
  }
  function place(){
    pos.x=Math.max(0,Math.min(innerWidth-PET_W,pos.x));pos.y=Math.max(0,Math.min(innerHeight-PET_H,pos.y));
    pet.style.left=pos.x+'px';pet.style.top=pos.y+'px';
    const width=Math.min(416,innerWidth-24),height=Math.min(704,innerHeight-24);
    panel.style.width=width+'px';panel.style.height=height+'px';
    if(opened&&manualLayout){
      if(manualLayout.height!==height)manualLayout.petY=Math.max(manualLayout.panelY,Math.min(manualLayout.panelY+height-PET_H,manualLayout.petY));
      manualLayout=moveGroup({...manualLayout,width,height},0,0);
      panel.style.left=manualLayout.panelX+'px';panel.style.top=manualLayout.panelY+'px';
      pet.style.left=manualLayout.petX+'px';pet.style.top=manualLayout.petY+'px';pet.style.visibility=manualLayout.showPet?'visible':'hidden';
      pos={x:manualLayout.petX,y:manualLayout.petY};return;
    }
    const panelLeft=Math.max(12,Math.min(innerWidth-width-12,pos.x>innerWidth/2?pos.x-width+PET_W-10:pos.x));
    panel.style.left=panelLeft+'px';
    panel.style.top=Math.max(12,Math.min(innerHeight-height-12,pos.y-height+20))+'px';
    // Keep the mascot beside the open panel, never over the send button.
    const outsideLeft=panelLeft>=PET_W+10?panelLeft-PET_W-8:panelLeft+width+8;
    pet.style.visibility=opened&&outsideLeft+PET_W>innerWidth?'hidden':'visible';
    if(opened)pet.style.left=outsideLeft+'px';
  }
  function toggle(force){opened=typeof force==='boolean'?force:!opened;panel.hidden=!opened;pet.classList.toggle('open',opened);if(opened){refreshConfig();if(!context)readContext();setTimeout(()=>$('question').focus(),80);}place();}
  let drag=null,moved=false;
  function savePosition(){
    const position={x:pos.x/Math.max(1,innerWidth-PET_W),y:pos.y/Math.max(1,innerHeight-PET_H)};
    if(manualLayout)position.panel={x:manualLayout.panelX/Math.max(1,innerWidth-manualLayout.width),y:manualLayout.panelY/Math.max(1,innerHeight-manualLayout.height)};
    call('SAVE_POSITION',{position}).catch(()=>{});
  }
  function beginDrag(e){
    if(e.button!==0||e.isPrimary===false)return;
    if(e.currentTarget===$('panel-head')&&e.target.closest('button'))return;
    moved=false;
    const rect=pet.getBoundingClientRect(),panelRect=panel.getBoundingClientRect();
    drag={x:e.clientX,y:e.clientY,px:rect.left,py:rect.top,pointerId:e.pointerId,target:e.currentTarget,layout:opened?{panelX:panelRect.left,panelY:panelRect.top,width:panelRect.width,height:panelRect.height,petX:rect.left,petY:rect.top,showPet:pet.style.visibility!=='hidden'}:null};
    e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.classList.add('dragging');e.preventDefault();
  }
  function moveDrag(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(Math.abs(dx)+Math.abs(dy)>5)moved=true;
    if(!moved)return;
    if(drag.layout){manualLayout=moveGroup(drag.layout,dx,dy);}
    else{manualLayout=null;pos={x:drag.px+dx,y:drag.py+dy};}
    place();
  }
  function endDrag(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    drag.target.classList.remove('dragging');if(moved)savePosition();drag=null;
  }
  for(const target of [pet,$('panel-head')]){
    target.addEventListener('pointerdown',beginDrag);target.addEventListener('pointermove',moveDrag);
    target.addEventListener('pointerup',endDrag);target.addEventListener('pointercancel',endDrag);target.addEventListener('lostpointercapture',endDrag);
  }
  pet.onclick=()=>{if(!moved)toggle();moved=false;};
  window.addEventListener('resize',place);
  $('collapse').onclick=()=>toggle(false);
  $('settings').onclick=()=>call('OPEN_SETTINGS').catch(e=>say(e.message,true));
  $('motion-toggle').onclick=()=>{motionEnabled=!motionEnabled;refreshSprite();call('SET_MOTION',{enabled:motionEnabled}).catch(e=>say(e.message,true));};
  async function refreshConfig(){try{config=await call('STATUS');$('provider-label').textContent=config.configured?`${config.provider} · ${config.model}`:'点 ⚙ 配置模型后开始聊天';}catch(e){say(e.message,true);}}
  function renderText(parent,text){
    if(globalThis.LeetPetRichText)globalThis.LeetPetRichText.render(parent,text,()=>say('复制失败，可手动选中代码复制。',true));
    else{const fallback=document.createElement('div');fallback.className='prose';fallback.textContent=text;parent.append(fallback);}
  }
  function renderMessages(){const box=$('messages');const nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<100;box.replaceChildren();
    if(!messages.length){const intro=document.createElement('div');intro.className='welcome';intro.innerHTML='<span class="welcome-icon">✦</span><h3>这一题，我们一起想。</h3><p>你负责敲代码，我负责陪你找思路。<br>先给提示，不着急揭晓答案。</p><button id="welcome-ask">不知道从哪里开始？</button>';box.append(intro);intro.querySelector('button').onclick=()=>{$('question').value='我完全不会写这道题，请从题目含义和暴力思路开始，一次只带我做一步。';$('question').focus();};}
    for(const m of messages){const article=document.createElement('article');article.className='message '+m.role;const label=document.createElement('small');label.textContent=m.role==='user'?'你':'搭子';const body=document.createElement('div');body.className='bubble';renderText(body,m.content||'正在想…');article.append(label,body);box.append(article);}
    if(nearBottom||busy)box.scrollTop=box.scrollHeight;
  }
  async function persist(){try{await call('SAVE_HISTORY',{messages});}catch(e){say('对话未保存：'+e.message,true);}}
  function setBusy(value){busy=value;pet.classList.toggle('thinking',value);setMood(value?'thinking':'idle',value?'让我想想这道题…':'今天也要吃一道题！');$('send').disabled=value||reading;$('stop').hidden=!value;$('clear').disabled=value;root.querySelectorAll('[data-mode]').forEach(b=>b.disabled=value);}
  async function readContext(){
    if(reading)return null;reading=true;$('read').disabled=true;$('send').disabled=true;const gen=generation;
    try{const value=await call('READ_CONTEXT');if(gen!==generation)return null;
      if(!value||!value.url||new URL(value.url).pathname.split('/')[2]!==location.pathname.split('/')[2])throw Error('题目切换中，请重新读取。');
      context=value;$('topic-title').textContent=value.title||'当前题目';
      const usable=value.complete&&typeof value.code==='string';
      if(!$('manual-mode').checked)$('code-preview').value=value.code||'';
      $('code-status').textContent=usable?`已读取 ${value.code.split('\n').length} 行代码`:'未读取到完整代码 · 可手动粘贴';
      $('source').textContent=`来源：${value.source} · ${new Date(value.capturedAt||Date.now()).toLocaleTimeString()}。${usable?'发送前会重新读取。':'不会使用可能缺行的可视片段。'}`;
      if(!usable&&$('attach-code').checked&&!$('manual-mode').checked)say('没有取得完整模型。可展开附件粘贴代码，或取消“附带当前代码”先问思路。');else say('题目和代码已更新。');
      return value;
    }catch(e){if(gen===generation){context=null;$('code-status').textContent='读取失败';say(e.message,true);}return null;}
    finally{reading=false;$('read').disabled=false;$('send').disabled=busy;}
  }
  $('read').onclick=readContext;
  $('manual-mode').onchange=()=>{$('code-preview').readOnly=!$('manual-mode').checked;if($('manual-mode').checked){$('code-preview').value=manualCode;$('code-preview').focus();}else $('code-preview').value=context?.code||'';};
  $('code-preview').oninput=()=>{if($('manual-mode').checked)manualCode=$('code-preview').value;};
  root.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;root.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('selected',x===b));const placeholders={hint:'卡在哪里？我们只迈出下一小步…',review:'帮我检查这份代码，先指出一个关键问题…',explain:'哪一行、哪个语法不理解？',interview:'围绕我的解法，像面试官一样追问我…'};$('question').placeholder=placeholders[mode];});
  $('question').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();ask();}};
  $('send').onclick=ask;
  function finish(error){
    clearInterval(keepAlive);keepAlive=null;
    requestToken++;if(error){say(error,true);if(sessionMessage){sessionMessage.failed=true;sessionMessage.content+=(sessionMessage.content?'\n\n':'')+'[未完成] '+error;}}
    setBusy(false);setMood(error?'idle':'happy',error?'没关系，我们再试一次。':'这一步，你学会了吗？');if(!error)moodTimer=setTimeout(()=>setMood('idle'),7000);renderMessages();persist();sessionMessage=null;if(port){port.disconnect();port=null;}
  }
  $('stop').onclick=()=>{if(port)try{port.postMessage({type:'STOP'});}catch{}finish('已停止生成。');};
  async function ask(){
    if(busy||reading)return;const question=$('question').value.trim();if(!question){say('先写下你想问的一个问题。');$('question').focus();return;}
    if(question.length>12000){say('问题过长，请缩短到 12000 字符以内。',true);return;}
    setBusy(true);const gen=generation,token=++requestToken;
    try{
      await loadHistoryPromise;
      await refreshConfig();if(gen!==generation||token!==requestToken)return;
      if(!config?.configured)throw Error('先点右上角 ⚙ 配置模型供应商、模型 ID 和 API Key。');
      const fresh=await readContext();if(gen!==generation||token!==requestToken)return;
      const ctx=fresh||{title:document.title,url:location.href,description:'',code:'',results:'',source:'手动上下文'};
      if($('attach-code').checked){
        if($('manual-mode').checked){if(!manualCode.trim())throw Error('请在附件里粘贴完整代码，或取消“附带当前代码”。');if(manualCode.length>40000)throw Error('代码超过 40000 字符。');ctx.code=manualCode;ctx.source='用户手动粘贴的完整代码';ctx.complete=true;}
        else if(!ctx.complete)throw Error('没有读到完整代码。请展开附件手动粘贴，或取消代码附件后提问。');
      }else{ctx.code='';ctx.source='用户未附带代码';}
      if(!$('attach-problem').checked)ctx.description='';
      ctx.results=[ctx.results||'',$('error-input').value.trim()].filter(Boolean).join('\n\n').slice(0,6000);
      const history=messages.filter(m=>!m.failed).map(m=>({role:m.role,content:m.content})).slice(-16);
      messages.push({role:'user',content:question});sessionMessage={role:'assistant',content:''};messages.push(sessionMessage);$('question').value='';renderMessages();say('正在连接你配置的模型…');
      port=chrome.runtime.connect({name:'leet-pet-chat'});
      keepAlive=setInterval(()=>{try{port?.postMessage({type:'PING'});}catch{}},20000);
      port.onMessage.addListener(m=>{if(gen!==generation||token!==requestToken)return;if(m.type==='START')say('搭子正在思考…');if(m.type==='DELTA'){sessionMessage.content+=m.text;renderMessages();say('正在回答…');}if(m.type==='DONE'){say('回答完成。继续问，我会接着你的思路。');finish();}if(m.type==='ERROR')finish(m.error);});
      port.onDisconnect.addListener(()=>{if(busy&&gen===generation&&token===requestToken){const last=chrome.runtime.lastError;finish(last?'连接中断，请刷新页面或重试。':'连接已断开，回答可能未完成。');}});
      port.postMessage({type:'ASK',question,history,context:ctx,mode});
    }catch(e){if(gen===generation&&token===requestToken){if(sessionMessage)finish(e.message);else{setBusy(false);say(e.message,true);}}}
  }
  $('clear').onclick=()=>{if(!busy&&confirm('清空当前题目的聊天记录？其他题目不受影响。')){messages=[];renderMessages();persist();say('本题对话已清空。');}};
  $('export').onclick=()=>{const text=`# ${context?.title||document.title}\n\n${location.href}\n\n${messages.map(m=>`## ${m.role==='user'?'你':'搭子'}\n\n${m.content}`).join('\n\n')}`;const blob=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=blob;a.download=(location.pathname.split('/')[2]||'leetcode')+'-学习记录.md';a.click();setTimeout(()=>URL.revokeObjectURL(blob),2000);};
  function changedRoute(){
    const next=key();if(next===route)return;generation++;requestToken++;clearInterval(keepAlive);keepAlive=null;if(port){port.disconnect();port=null;}setBusy(false);sessionMessage=null;route=next;context=null;manualCode='';messages=[];$('manual-mode').checked=false;$('code-preview').readOnly=true;$('code-preview').value='';$('error-input').value='';$('question').value='';$('code-status').textContent='尚未读取代码';$('topic-title').textContent='当前题目';say('');host.style.display=next?'block':'none';
    if(!next)return;
    const gen=generation;loadHistoryPromise=call('GET_HISTORY').then(r=>{if(gen===generation){messages=r.messages||[];renderMessages();}}).catch(e=>{if(gen===generation)say(e.message,true);});
    if(opened)readContext();else renderMessages();
  }
  chrome.runtime.onMessage.addListener(msg=>{if(msg.type==='TOGGLE_PET')toggle();});
  place();changedRoute();refreshConfig();refreshSprite();call('GET_MOTION').then(p=>{motionEnabled=p.enabled!==false;refreshSprite();}).catch(()=>{});
  call('GET_POSITION').then(p=>{if(p){pos={x:p.x*Math.max(1,innerWidth-PET_W),y:p.y*Math.max(1,innerHeight-PET_H)};if(p.panel){const width=Math.min(416,innerWidth-24),height=Math.min(704,innerHeight-24);manualLayout={panelX:p.panel.x*Math.max(1,innerWidth-width),panelY:p.panel.y*Math.max(1,innerHeight-height),width,height,petX:pos.x,petY:pos.y,showPet:innerWidth>=width+PET_W+32};}place();}}).catch(()=>{});
  setInterval(changedRoute,800);
})();
