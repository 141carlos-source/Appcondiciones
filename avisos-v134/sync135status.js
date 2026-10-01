(function(){'use strict';
const CFG='SOLTEC_SYNC_CONFIG_V134',PENDING='SOLTEC_SYNC_PENDING_V134',DRAFT='APP_AVISOS_WEB_BORRADOR_V116';
let W=null,probeBusy=false,connection={kind:'unknown',revision:null,at:0,reason:''},bound='';
function parse(v){try{return JSON.parse(v||'{}')||{}}catch(_){return{}}}
function read(key){try{return W.localStorage.getItem(key)}catch(_){return null}}
function cfg(){const c=parse(read(CFG));let outer={};try{outer=parse(window.localStorage.getItem(CFG))}catch(_){}['serverUrl','key','lastSyncAt','lastRevision'].forEach(k=>{if((c[k]==null||c[k]==='')&&outer[k]!=null)c[k]=outer[k]});return c}
function signature(c){return String(c.serverUrl||'').trim().replace(/\/+$/,'')+'\n'+String(c.key||'').trim()}
function describe(i){
  if(!i.configured)return{label:'PC sin configurar',kind:'muted'};
  if(i.offline)return{label:'Sin conexión de red',kind:'err'};
  if(i.conflict)return{label:'Conflicto: revisar sincronización',kind:'err'};
  if(i.busy)return{label:'Sincronización en curso…',kind:'wait'};
  if(i.connection==='error')return{label:i.reason||'PC no disponible',kind:'err'};
  if(i.connection==='checking')return{label:'Comprobando PC…',kind:'wait'};
  if(i.connection!=='connected')return{label:'Conexión con PC sin comprobar',kind:'muted'};
  if(i.blocked)return{label:'PC conectado · sincronización bloqueada',kind:'err'};
  if(i.draft)return{label:'PC conectado · borrador local',kind:'wait'};
  if(i.pending)return{label:'PC conectado · cambios pendientes',kind:'wait'};
  if(i.remote<i.local)return{label:'PC conectado · revisión central anterior',kind:'err'};
  if(i.remote>i.local)return{label:'PC conectado · nueva revisión disponible',kind:'wait'};
  if(!i.synced)return{label:'PC conectado · primera sincronización pendiente',kind:'wait'};
  return{label:'PC conectado · sin cambios pendientes',kind:'ok'};
}
function time(v){if(!v)return'Nunca';const d=new Date(v);return Number.isNaN(d.getTime())?'Sin fecha válida':d.toLocaleString('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
function text(id,value){const n=W.document.getElementById(id);if(n&&n.textContent!==value)n.textContent=value}
function render(){
  if(!W)return;
  const d=W.document,c=cfg(),sig=signature(c),configured=!!(String(c.serverUrl||'').trim()&&String(c.key||'').trim());
  if(sig!==bound){bound=sig;connection={kind:'unknown',revision:null,at:0,reason:''}}
  const status=(d.getElementById('s134EngineStatus')||{}).textContent||'';
  const badge=(d.getElementById('s134EngineBadge')||{}).textContent||'';
  const conflict=d.getElementById('s134EngineConflict'),button=d.getElementById('s134EngineSync');
  const draft=!!read(DRAFT),pending=read(PENDING)==='1';
  const fresh=connection.at&&Date.now()-connection.at<90000;
  const info={configured,offline:W.navigator.onLine===false,conflict:!!(conflict&&conflict.style.display==='block'),
    busy:!!(button&&button.disabled&&/ENVIANDO|RECIBIENDO|PREPARANDO|COMPROBANDO ÚLTIMA|GUARDANDO COPIA/i.test(status)),
    connection:connection.kind==='connected'&&!fresh?'unknown':connection.kind,reason:connection.reason,
    blocked:/BLOQUEAD|SEGURIDAD:|INCONSISTENTE|REVISIÓN DEL PC ANTERIOR|ERROR DE SINCRONIZACIÓN/i.test(status+' '+badge),
    draft,pending,local:Number(c.lastRevision)||0,remote:connection.revision,synced:!!c.lastSyncAt};
  if(info.connection==='connected'&&connection.at<new Date(c.lastSyncAt||0).getTime()&&info.remote<info.local)info.connection='unknown';
  const view=describe(info),panel=d.getElementById('s135SyncSummary');if(!panel)return;
  panel.dataset.kind=view.kind;text('s135SyncHeadline',view.label);
  text('s135SyncPending',draft?'Borrador: sí · cambios pendientes':pending?'Cambios pendientes: sí':'Cambios pendientes: no');
  text('s135SyncLast','Última sincronización: '+time(c.lastSyncAt));
  text('s135SyncRevisions','REV. local: '+(c.lastSyncAt||c.lastRevision!=null?info.local:'—')+' · PC: '+(connection.revision!=null?connection.revision:'—'));
  const detail=info.conflict||info.blocked?status:connection.reason;
  text('s135SyncReason',detail||'');const reason=d.getElementById('s135SyncReason');reason.hidden=!detail;
  const check=d.getElementById('s135SyncCheck');if(check){check.disabled=probeBusy;check.textContent=probeBusy?'Comprobando…':'Comprobar PC'}
}
async function check(){
  if(!W||probeBusy)return;
  render();const c=cfg(),sig=signature(c);
  if(!String(c.serverUrl||'').trim()||!String(c.key||'').trim()){render();return}
  if(W.navigator.onLine===false){connection={kind:'error',revision:null,at:Date.now(),reason:'Dispositivo sin conexión de red'};render();return}
  probeBusy=true;connection={kind:'checking',revision:null,at:0,reason:''};render();
  const ctl=new W.AbortController(),timer=W.setTimeout(()=>ctl.abort(),8000);
  let result;
  try{
    const url=String(c.serverUrl).trim().replace(/\/+$/,'');
    const r=await W.fetch(url+'/api/status',{cache:'no-store',headers:{'X-Soltec-Key':String(c.key).trim()},signal:ctl.signal,targetAddressSpace:'local'});
    if(r.status===401)throw new Error('Clave de sincronización incorrecta');
    if(!r.ok)throw new Error('Error del PC: HTTP '+r.status);
    const s=await r.json(),rev=Number(s.revision);
    if(s.ok!==true||s.server!=='SOLTEC-PC'||Number(s.version)!==134||!Number.isInteger(rev)||rev<0)throw new Error('Respuesta del PC no válida');
    result={kind:'connected',revision:rev,at:Date.now(),reason:''};
  }catch(e){
    let reason=e&&e.name==='AbortError'?'PC sin respuesta · revisa Tailscale y SOLTEC Sync':e&&e.name==='TypeError'?'PC no accesible · revisa Tailscale y permiso de red local':String(e.message||'PC no disponible');
    try{const permission=await W.navigator.permissions.query({name:'local-network-access'});if(permission.state==='denied')reason='Permiso de red local bloqueado en el navegador'}catch(_){}
    result={kind:'error',revision:null,at:Date.now(),reason};
  }finally{W.clearTimeout(timer);probeBusy=false}
  if(signature(cfg())===sig)connection=result;else connection={kind:'unknown',revision:null,at:0,reason:''};
  render();
}
function install(d){
  const header=d.querySelector('header');if(!header||d.getElementById('s135SyncSummary'))return;
  const style=d.createElement('style');style.id='s135SyncSummaryStyle';style.textContent=
    'header{flex-wrap:wrap;padding:8px 12px;gap:6px}#bootState,#s134EngineBadge{display:none!important}'+
    '#s135SyncSummary{flex:0 0 100%;min-width:0;border:1px solid #dbe3ee;border-left:4px solid #667085;border-radius:9px;padding:6px 8px;background:#f8fafc;font-size:10px;line-height:1.35;color:#344054}'+
    '#s135SyncSummary[data-kind=ok]{border-left-color:#15803d;background:#f2fbf4}#s135SyncSummary[data-kind=wait]{border-left-color:#b77900;background:#fff9e9}#s135SyncSummary[data-kind=err]{border-left-color:#b42318;background:#fff4f2}'+
    '#s135SyncHeadline{font-size:12px;font-weight:800}#s135SyncReason{margin-top:3px;overflow-wrap:anywhere}#s135SyncMeta{display:flex;flex-wrap:wrap;gap:2px 10px;margin-top:2px}'+
    '#s135SyncActions{display:flex;gap:6px;margin-top:4px}#s135SyncActions button{font-size:10px;padding:4px 8px;min-height:26px;border-radius:6px}';
  d.head.appendChild(style);
  const panel=d.createElement('div');panel.id='s135SyncSummary';
  panel.innerHTML='<div id="s135SyncHeadline" role="status" aria-live="polite"></div><div id="s135SyncPending"></div><div id="s135SyncMeta"><span id="s135SyncLast"></span><span id="s135SyncRevisions"></span></div><div id="s135SyncReason" hidden></div><div id="s135SyncActions"><button type="button" id="s135SyncCheck">Comprobar PC</button><button type="button" id="s135SyncDetails">Ver diagnóstico</button></div>';
  header.appendChild(panel);
  d.getElementById('s135SyncCheck').onclick=()=>check();
  d.getElementById('s135SyncDetails').onclick=()=>{if(W.App)W.App.show('config');const engine=d.getElementById('s134Engine');if(engine){engine.open=true;engine.style.scrollMarginTop=((d.querySelector('header')||{}).offsetHeight||120)+8+'px';engine.scrollIntoView({block:'start',behavior:'smooth'})}};
}
function init(w){
  if(!w||!w.document||w.document.getElementById('s135SyncSummary'))return;
  W=w;install(W.document);render();
  W.setTimeout(check,3000);
  W.setInterval(render,1000);
  W.setInterval(()=>{if(W.document.visibilityState==='visible')check()},60000);
  W.addEventListener('online',()=>check());
  W.addEventListener('offline',()=>render());
  W.document.addEventListener('visibilitychange',()=>{if(W.document.visibilityState==='visible'){render();check()}});
}
window.SoltecSyncStatus135={init,check};
})();
