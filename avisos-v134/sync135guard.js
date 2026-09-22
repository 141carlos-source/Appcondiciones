(function(){'use strict';
const BUILD='V135-SYNC-GUARD2';
const CFG='SOLTEC_SYNC_CONFIG_V134',GUARD='SOLTEC_SYNC_GUARD_V135',PENDING='SOLTEC_SYNC_PENDING_V134';
const OUT=window;
let W=null,busy=false,bypass=false,rawSyncNow=null;

function parse(v,d){try{const x=JSON.parse(String(v||''));return x&&typeof x==='object'?x:d}catch(_){return d}}
function clean(v){return String(v||'').trim().replace(/\/+$/,'')}
function cfg(){
  let c={};
  try{c=parse(W.localStorage.getItem(CFG),{})}catch(_){}
  try{const o=parse(OUT.localStorage.getItem(CFG),{});['serverUrl','key','deviceId','deviceName','lastRevision','lastHash','lastSyncAt'].forEach(k=>{if((c[k]==null||c[k]==='')&&o[k]!=null&&o[k]!=='')c[k]=o[k]})}catch(_){}
  return c;
}
function guardState(){try{return parse(W.localStorage.getItem(GUARD),{})}catch(_){return{}}}
function saveGuard(g){try{W.localStorage.setItem(GUARD,JSON.stringify(g))}catch(_){}try{OUT.localStorage.setItem(GUARD,JSON.stringify(g))}catch(_){}}
async function digest(s){
  s=String(s||'');
  try{const b=new W.TextEncoder().encode(s),h=await W.crypto.subtle.digest('SHA-256',b);return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,20)}
  catch(_){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return'f'+(h>>>0).toString(16)}
}
async function signature(c){return digest(clean(c.serverUrl)+'\n'+String(c.key||'')+'\nSOLTEC-PC\n134')}
async function permissionState(){
  try{
    if(!W.navigator.permissions||!W.navigator.permissions.query)return'unknown';
    try{return (await W.navigator.permissions.query({name:'local-network'})).state||'unknown'}catch(_){}
    try{return (await W.navigator.permissions.query({name:'local-network-access'})).state||'unknown'}catch(_){}
  }catch(_){}
  return'unknown';
}
function statusNode(){
  if(!W)return null;
  const d=W.document,host=d.querySelector('#s134Engine .s132body');
  if(!host)return null;
  let n=d.getElementById('s135SyncGuardStatus');
  if(!n){
    n=d.createElement('div');n.id='s135SyncGuardStatus';
    n.style.cssText='margin:9px 0;padding:9px 10px;border-radius:10px;border:1px solid #b9d6c0;background:#f2fbf4;color:#176b35;font-size:11px;font-weight:800;line-height:1.4';
    n.textContent='🛡️ BLINDAJE DE SINCRONIZACIÓN ACTIVO';
    const anchor=d.getElementById('s134EngineStatus');
    if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(n,anchor.nextSibling);else host.prepend(n);
  }
  return n;
}
function paint(msg,kind){
  const n=statusNode();if(!n)return;
  n.textContent='🛡️ '+msg;
  if(kind==='err'){n.style.background='#fff4f2';n.style.borderColor='#f0b4ae';n.style.color='#b42318'}
  else if(kind==='wait'){n.style.background='#fff9e9';n.style.borderColor='#ead08b';n.style.color='#8a5a00'}
  else{n.style.background='#f2fbf4';n.style.borderColor='#b9d6c0';n.style.color='#176b35'}
}
function engineStatus(msg,err){
  try{const n=W.document.getElementById('s134EngineStatus');if(n){n.textContent=msg;n.style.color=err?'#b42318':'#667085'}}catch(_){}
}
function pendingText(){
  try{return W.localStorage.getItem(PENDING)==='1'?'CAMBIOS PENDIENTES: SÍ':'CAMBIOS PENDIENTES: NO'}catch(_){return'CAMBIOS PENDIENTES: DESCONOCIDO'}
}
function fmtDate(v){
  if(!v)return'SIN FECHA';
  try{return new Date(v).toLocaleString('es-ES')}catch(_){return String(v)}
}
function successText(s,rev){
  const who=String(s&&s.deviceName||'').trim();
  const writer=who?('ÚLTIMA ESCRITURA CENTRAL: '+who+' · '+fmtDate(s.updatedAt)):'ÚLTIMA ESCRITURA CENTRAL: SERVIDOR SIN METADATO DE DISPOSITIVO';
  return 'PC CENTRAL VALIDADO · REV. '+rev+' · '+writer+' · ESTE DISPOSITIVO: '+pendingText();
}
function fail(code,msg,extra){paint(msg,'err');engineStatus(msg,true);return Object.assign({ok:false,code,message:msg},extra||{})}
function timeoutFetch(url,opt,ms){
  const ctl=new W.AbortController(),tm=W.setTimeout(()=>ctl.abort(),ms||12000);
  return W.fetch(url,Object.assign({},opt||{},{signal:ctl.signal})).finally(()=>W.clearTimeout(tm));
}
async function preflight(opts){
  opts=opts||{};
  if(busy)return fail('BUSY','COMPROBACIÓN DE SEGURIDAD EN CURSO.');
  busy=true;
  try{
    const c=cfg(),url=clean(c.serverUrl),key=String(c.key||'').trim();
    if(!url||!key)return fail('NO_CONFIG','CONFIGURA EL PC CENTRAL Y LA CLAVE.');
    const sig=await signature(c),g=guardState(),perm=await permissionState();
    if(perm==='denied')return fail('LNA_DENIED','PERMISO DE RED LOCAL BLOQUEADO · HABILÍTALO EN CHROME PARA SOLTEC.');
    if(W.navigator&&W.navigator.onLine===false)return fail('OFFLINE','DISPOSITIVO SIN CONEXIÓN DE RED.');
    paint(perm==='prompt'?'PERMISO DE RED LOCAL PENDIENTE · ACEPTA EL AVISO DE CHROME':'COMPROBANDO PC CENTRAL…','wait');
    let r;
    try{
      r=await timeoutFetch(url+'/api/status?guard='+Date.now(),{cache:'no-store',headers:{'X-Soltec-Key':key},targetAddressSpace:'local'},12000);
    }catch(x){
      const p2=await permissionState();
      if(p2==='denied')return fail('LNA_DENIED','PERMISO DE RED LOCAL BLOQUEADO · CHROME → PERMISOS DEL SITIO → RED LOCAL → PERMITIR.');
      if(x&&x.name==='AbortError')return fail('TIMEOUT','PC CENTRAL SIN RESPUESTA · REVISA TAILSCALE/VPN Y QUE SOLTEC SYNC ESTÉ ABIERTO EN EL PC.');
      return fail('UNREACHABLE','PC CENTRAL NO DISPONIBLE · REVISA TAILSCALE/VPN Y EL PERMISO DE RED LOCAL.');
    }
    let s=null;try{s=await r.json()}catch(_){}
    if(r.status===401)return fail('BAD_KEY','CLAVE DE SINCRONIZACIÓN INCORRECTA.');
    if(!r.ok)return fail('HTTP','ERROR DEL SERVIDOR CENTRAL · HTTP '+r.status+'.');
    if(!s||s.ok!==true)return fail('BAD_JSON','RESPUESTA DEL PC CENTRAL NO VÁLIDA.');
    if(String(s.server||'')!=='SOLTEC-PC'||Number(s.version)!==134)return fail('WRONG_SERVER','SERVIDOR NO RECONOCIDO · BLOQUEADA LA SINCRONIZACIÓN.');
    const rev=Number(s.revision);
    if(!Number.isInteger(rev)||rev<0)return fail('BAD_REV','REVISIÓN CENTRAL NO VÁLIDA · BLOQUEADA LA SINCRONIZACIÓN.');
    const lastCfg=Number(c.lastRevision)||0,lastGuard=(g.signature===sig?Number(g.lastGoodRevision)||0:0),floor=Math.max(lastCfg,lastGuard);
    if(rev===0&&floor>0)return fail('EMPTY','PC CENTRAL APARECE EN REV. 0 PERO ESTE DISPOSITIVO CONOCE REV. '+floor+' · BLOQUEADO.',{revision:rev});
    if(rev<floor)return fail('REGRESSION','REVISIÓN CENTRAL HA RETROCEDIDO: '+rev+' < '+floor+' · BLOQUEADO.',{revision:rev});
    if(opts.requireBound&&g.signature!==sig)return fail('UNBOUND','CONFIGURACIÓN DEL PC CENTRAL SIN VALIDAR · PULSA PRIMERO “PROBAR CONEXIÓN”.',{revision:rev});
    if(opts.bind){
      saveGuard({schema:'SOLTEC_SYNC_GUARD_V135',signature:sig,serverUrl:url,server:'SOLTEC-PC',version:134,lastGoodRevision:Math.max(rev,lastGuard),lastGoodAt:new Date().toISOString()});
    }else if(g.signature===sig&&rev>lastGuard){
      g.lastGoodRevision=rev;g.lastGoodAt=new Date().toISOString();saveGuard(g);
    }
    paint(successText(s,rev),'ok');
    return{ok:true,revision:rev,status:s,signature:sig};
  }finally{busy=false}
}
async function manualTest(){
  const h=await preflight({bind:true});
  if(h.ok)engineStatus(successText(h.status,h.revision),false);
  return h;
}
async function manualSync(){
  const h=await preflight({requireBound:true});
  if(!h.ok)return{state:'guard-blocked',guard:h};
  if(typeof rawSyncNow!=='function')return fail('NO_ENGINE','MOTOR DE SINCRONIZACIÓN NO DISPONIBLE.');
  const r=await rawSyncNow(W);
  if(r&&['uploaded','current','received'].includes(r.state)){
    try{await preflight({requireBound:true})}catch(_){}
  }
  return r;
}
function installListeners(){
  const d=W.document;if(d.__soltecSyncGuard135)return;d.__soltecSyncGuard135=true;
  d.addEventListener('click',ev=>{
    const b=ev.target&&ev.target.closest?ev.target.closest('button'):null;if(!b||bypass)return;
    if(b.id==='s134EngineTest'){
      ev.preventDefault();ev.stopImmediatePropagation();manualTest();return;
    }
    if(b.id==='s134EngineSync'){
      ev.preventDefault();ev.stopImmediatePropagation();manualSync();return;
    }
    if(b.id==='s134EngineSave'){
      W.setTimeout(async()=>{const c=cfg(),g=guardState(),sig=await signature(c);if(g.signature&&g.signature!==sig)paint('CONFIGURACIÓN DEL PC CAMBIADA · PULSA “PROBAR CONEXIÓN” ANTES DE SINCRONIZAR.','wait')},50);
    }
  },true);
}
function init(w){
  W=w;if(!W)return;
  statusNode();
  if(OUT.Soltec134Engine&&typeof OUT.Soltec134Engine.syncNow==='function'&&!rawSyncNow){
    rawSyncNow=OUT.Soltec134Engine.syncNow.bind(OUT.Soltec134Engine);
    OUT.Soltec134Engine.syncNow=function(w2){if(w2)W=w2;return manualSync()};
  }
  installListeners();
  const g=guardState();
  if(g&&g.lastGoodRevision)paint('BLINDAJE ACTIVO · ÚLTIMO PC VALIDADO REV. '+(Number(g.lastGoodRevision)||0),'ok');
  else paint('BLINDAJE ACTIVO · VALIDA EL PC CON “PROBAR CONEXIÓN”.','wait');
}
OUT.Soltec135SyncGuard={init,check:preflight,test:manualTest,sync:manualSync,version:BUILD};
})();
