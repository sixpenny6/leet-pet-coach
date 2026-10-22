import {DEFAULTS,PRESETS,validateConfig,endpoint} from './core.mjs';
import {importDeepSeek} from './import-config.mjs';
const $=id=>document.getElementById(id);
const call=async(type,extra={})=>{const r=await chrome.runtime.sendMessage({type,...extra});if(!r?.ok)throw Error(r?.error||'扩展连接失败。');return r.result;};
for(const [key,preset] of Object.entries(PRESETS)){const option=document.createElement('option');option.value=key;option.textContent=preset.label;$('provider').append(option);}
const importBar=document.createElement('div');
importBar.className='buttons';
const importButton=document.createElement('button');importButton.type='button';importButton.id='import-deepseek';importButton.textContent='从 sandbox.txt 导入 DeepSeek';
const filePicker=document.createElement('input');filePicker.type='file';filePicker.accept='.txt,.json,.env,text/plain,application/json';filePicker.hidden=true;filePicker.id='import-file';
importButton.onclick=()=>filePicker.click();
filePicker.onchange=async()=>{const file=filePicker.files[0];if(!file)return;try{if(file.size>100000)throw Error('文件过大，请选择小于 100 KB 的配置文件。');const config=importDeepSeek(await file.text());fill(config);$('apiKey').type='password';$('show-key').textContent='显示';show('已读取 DeepSeek 密钥，模型设为 deepseek-flash（当前 Flash 1017）。点击下方“保存并授权接口”完成配置。');}catch(error){show(error.message,true);}finally{filePicker.value='';}};
importBar.append(importButton,filePicker);$('form').prepend(importBar);
const show=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error);};
function fill(c){for(const key of Object.keys(DEFAULTS)){if(!$(key))continue;if(typeof DEFAULTS[key]==='boolean')$(key).checked=c[key];else $(key).value=c[key];}}
function collect(){
  if($('provider').value==='deepseek'&&!$('model').value.trim())$('model').value=PRESETS.deepseek.model;
  const c={};for(const key of Object.keys(DEFAULTS)){if(!$(key))continue;c[key]=typeof DEFAULTS[key]==='boolean'?$(key).checked:$(key).value;}
  return validateConfig(c);
}
function showError(error){
  const message=error.message||String(error);
  const field=/模型 ID/.test(message)?'model':/API Key/.test(message)?'apiKey':/地址/.test(message)?'baseUrl':null;
  if(field){$(field).focus();$(field).scrollIntoView({block:'center',behavior:'smooth'});}
  show(message,true);
}
$('provider').onchange=()=>{const preset=PRESETS[$('provider').value];for(const key of ['protocol','baseUrl','model','tokenField'])$(key).value=preset[key];$('apiKey').value='';show('已切换供应商。请填写属于该供应商的密钥与模型 ID，再保存。');};
$('protocol').onchange=()=>{if($('protocol').value==='anthropic')$('tokenField').value='max_tokens';};
$('show-key').onclick=()=>{$('apiKey').type=$('apiKey').type==='password'?'text':'password';$('show-key').textContent=$('apiKey').type==='password'?'显示':'隐藏';};
async function saveCurrent(){
  const config=collect(),origin=new URL(endpoint(config)).origin+'/*';
  // permissions.request must start directly within this user gesture.
  const granted=await chrome.permissions.request({origins:[origin]});
  if(!granted)throw Error('你没有授权该 API 域名，配置尚未保存。');
  await call('SAVE_SETTINGS',{settings:config});
}
function setBusy(busy){$('save').disabled=busy;$('test').disabled=busy;}
$('form').onsubmit=async e=>{e.preventDefault();setBusy(true);try{await saveCurrent();show('已保存。回到力扣页刷新，点击小猫即可提问。');}catch(error){showError(error);}finally{setBusy(false);}};
$('test').textContent='保存并测试连接';
$('test').onclick=async()=>{
  setBusy(true);
  try{
    await saveCurrent();
    show('当前表单已保存，正在测试连接（不发送题目或代码）…');
    const r=await call('TEST_SETTINGS');show('已保存，连接正常：'+r.text);
  }catch(error){showError(error);}finally{setBusy(false);}
};
$('clear').onclick=async()=>{if(!confirm('清除模型配置和 API Key？题目对话会保留。'))return;try{await call('CLEAR_SETTINGS');fill(DEFAULTS);show('已清除模型配置与密钥。先前授予的域名权限可在浏览器扩展详情中撤销。');}catch(error){show(error.message,true);}};
call('GET_SETTINGS').then(fill).catch(e=>show(e.message,true));
