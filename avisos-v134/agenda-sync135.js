(function(){'use strict';
const LOCAL='SOLTEC_AGENDA_V1',BACKUP='SOLTEC_AGENDA_V1_AUTOBACKUP',META='SOLTEC_AGENDA_V1_META';
const MIRROR='APP_AVISOS_AGENDA_V135',PENDING='SOLTEC_SYNC_PENDING_V134',CFG='SOLTEC_SYNC_CONFIG_V134';
const SCHEMA='SOLTEC_AGENDA_SYNC_V1';
let lastLocal='',lastMirror='',syncTimer=0,applying=false;
function parse(raw,d){try{const x=JSON.parse(String(raw||''));return x==null?d:x}catch(_){return d}}
function rows(){const x=parse(localStorage.getItem(LOCAL),'__bad__');return Array.isArray(x)?x:[]}
function meta(){const x=parse(localStorage.getItem(META),{});return x&&typeof x==='object'?x:{}}
function mirror(){const x=parse(localStorage.getItem(MIRROR),null);return x&&x.schema===SCHEMA&&Array.isArray(x.rows)?x:null}
function device(){const c=parse(localStorage.getItem(CFG),{});return String(c.deviceId||c.deviceName||'SOLTEC')}
function stamp(v){const n=Date.parse(String(v||''));return Number.isFinite(n)?n:0}
function setLocal(data,updatedAt){
  applying=true;
  try{
    const raw=JSON.stringify(Array.isArray(data)?data:[]);
    localStorage.setItem(LOCAL,raw);localStorage.setItem(BACKUP,raw);
    localStorage.setItem(META,JSON.stringify({updatedAt:updatedAt||new Date().toISOString(),source:'sync'}));
    lastLocal=raw;
    window.dispatchEvent(new CustomEvent('agenda:remote',{detail:{updatedAt:updatedAt||''}}));
  }finally{applying=false}
}
function markPending(){
  try{localStorage.setItem(PENDING,'1')}catch(_){}
  try{window.top.document.getElementById('app134')?.contentWindow?.dispatchEvent(new CustomEvent('soltec:datachange'))}catch(_){}
  clearTimeout(syncTimer);syncTimer=setTimeout(()=>{try{const top=window.top,frame=top.document.getElementById('app134');if(top.Soltec134Engine&&typeof top.Soltec134Engine.autoOpen==='function')top.Soltec134Engine.autoOpen(frame&&frame.contentWindow)}catch(_){}},1200)
}
function publish(data,updatedAt,mark){
  const pack={schema:SCHEMA,updatedAt:updatedAt||new Date().toISOString(),deviceId:device(),rows:Array.isArray(data)?data:[]};
  const raw=JSON.stringify(pack);localStorage.setItem(MIRROR,raw);lastMirror=raw;
  localStorage.setItem(META,JSON.stringify({updatedAt:pack.updatedAt,source:'local'}));
  if(mark!==false)markPending()
}
function merge(a,b){
  const map=new Map();for(const r of [...(a||[]),...(b||[])]){if(!r||!r.id)continue;if(!map.has(String(r.id)))map.set(String(r.id),r)}
  return Array.from(map.values())
}
function init(){
  const lr=rows(),m=mirror(),lm=meta(),lt=stamp(lm.updatedAt),mt=stamp(m&&m.updatedAt);
  if(!m){if(lr.length||lt)publish(lr,lm.updatedAt||new Date().toISOString(),true)}
  else if(!lr.length&&!lt){setLocal(m.rows,m.updatedAt)}
  else if(lt>mt){publish(lr,lm.updatedAt,true)}
  else if(mt>lt){setLocal(m.rows,m.updatedAt)}
  else if(!lt&&lr.length&&m.rows.length){const joined=merge(lr,m.rows),now=new Date().toISOString();setLocal(joined,now);publish(joined,now,true)}
  lastLocal=localStorage.getItem(LOCAL)||'';
  lastMirror=localStorage.getItem(MIRROR)||'';
  updateStatus();
}
function tick(){
  const rawL=localStorage.getItem(LOCAL)||'',rawM=localStorage.getItem(MIRROR)||'';
  if(!applying&&rawL!==lastLocal){
    lastLocal=rawL;const now=new Date().toISOString();localStorage.setItem(META,JSON.stringify({updatedAt:now,source:'local'}));publish(rows(),now,true);updateStatus();return
  }
  if(rawM!==lastMirror){
    lastMirror=rawM;const m=mirror(),lm=meta();
    if(m&&stamp(m.updatedAt)>stamp(lm.updatedAt)){setLocal(m.rows,m.updatedAt);updateStatus()}
  }
}
function updateStatus(){
  const n=document.getElementById('agendaSyncStatus');if(!n)return;
  const m=mirror(),lm=meta();n.textContent=m?'🔄 Agenda sincronizada con SOLTEC central · '+(lm.updatedAt?new Date(lm.updatedAt).toLocaleString('es-ES'):'preparada'):'🔄 Agenda preparada para sincronización central';
}
function inject(){
  const h=document.querySelector('.top');if(!h||document.getElementById('agendaSyncStatus'))return;
  const s=document.createElement('div');s.id='agendaSyncStatus';s.style.cssText='width:100%;font-size:10px;font-weight:800;color:#667085;text-align:right';h.appendChild(s);updateStatus()
}
init();inject();setInterval(()=>{try{tick();inject()}catch(_){}},900);
window.addEventListener('agenda:saved',()=>setTimeout(tick,20));
window.addEventListener('agenda:remote',()=>setTimeout(()=>{try{window.SoltecAgendaCore&&location.reload()}catch(_){}},120));
})();