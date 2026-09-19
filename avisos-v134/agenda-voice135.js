(function(){'use strict';
const KEY='SOLTEC_AGENDA_V1',MAX_NOTES=3,MAX_MS=30000,MAX_BYTES=280000;
const $=id=>document.getElementById(id);
let notes=[],rec=null,chunks=[],stream=null,timer=null,started=0,lastId='__boot__';
function rows(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function style(){if($('agendaVoiceStyle'))return;const s=document.createElement('style');s.id='agendaVoiceStyle';s.textContent='.agendaVoiceBlock{grid-column:1/-1;border:1px solid #dbe3ee;border-radius:12px;padding:12px;background:#fbfcfe}.agendaVoiceHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.agendaVoiceHead h3{margin:0;flex:1;font-size:13px;color:#172b4d}.agendaVoiceList{display:grid;gap:8px;margin-top:10px}.agendaVoiceRow{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;border:1px solid #dbe3ee;border-radius:10px;background:#fff;padding:8px}.agendaVoiceRow audio{width:100%;max-width:100%}.agendaVoiceRec{color:#b42318;font-weight:900;font-size:12px}.agendaVoiceHint{font-size:11px;color:#667085;margin-top:6px}@media(max-width:560px){.agendaVoiceRow{grid-template-columns:1fr}.agendaVoiceRow .danger{width:100%}}';document.head.appendChild(s)}
function inject(){style();if($('agendaVoiceBlock'))return;const grid=document.querySelector('#form .formgrid');if(!grid)return;const box=document.createElement('div');box.id='agendaVoiceBlock';box.className='agendaVoiceBlock';box.innerHTML='<div class="agendaVoiceHead"><h3>Notas de voz</h3><span id="agendaVoiceState" class="agendaVoiceRec"></span><button type="button" class="ghost" id="agendaVoiceBtn">🎙 Grabar nota</button></div><div class="agendaVoiceHint">Máximo 3 notas · 30 segundos por nota.</div><div id="agendaVoiceList" class="agendaVoiceList"></div>';grid.appendChild(box);$('agendaVoiceBtn').onclick=toggle;render();try{window.dispatchEvent(new CustomEvent('agenda:voice-ready'))}catch(_){}}
function stopTracks(){if(stream){try{stream.getTracks().forEach(t=>t.stop())}catch(_){}stream=null}}
function dataUrl(blob){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result||''));r.onerror=no;r.readAsDataURL(blob)})}
function mimeType(){const opts=['audio/webm;codecs=opus','audio/webm','audio/mp4'];for(const x of opts){try{if(window.MediaRecorder&&MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(x))return x}catch(_){}}return''}
async function start(){
 if(notes.length>=MAX_NOTES){alert('Máximo 3 notas de voz por cita.');return}
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){alert('Este navegador no permite grabar notas de voz.');return}
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:true});
  chunks=[];const type=mimeType();rec=new MediaRecorder(stream,type?{mimeType:type,audioBitsPerSecond:24000}:{audioBitsPerSecond:24000});
  rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  rec.onstop=finish;rec.start(500);started=Date.now();$('agendaVoiceBtn').textContent='■ Parar grabación';tick();timer=setInterval(tick,500)
 }catch(e){stopTracks();alert('No se pudo acceder al micrófono. Revisa el permiso del navegador.')}
}
function tick(){const sec=Math.min(30,Math.floor((Date.now()-started)/1000));const n=$('agendaVoiceState');if(n)n.textContent=rec&&rec.state==='recording'?'Grabando · '+sec+' s':'';if(sec>=30)stop()}
function stop(){if(timer){clearInterval(timer);timer=null}if(rec&&rec.state==='recording'){try{rec.stop()}catch(_){}}else{stopTracks();resetUi()}}
function resetUi(){const b=$('agendaVoiceBtn'),s=$('agendaVoiceState');if(b)b.textContent='🎙 Grabar nota';if(s)s.textContent=''}
async function finish(){
 const blob=new Blob(chunks,{type:(rec&&rec.mimeType)||'audio/webm'});stopTracks();resetUi();rec=null;chunks=[];
 if(!blob.size)return;
 if(blob.size>MAX_BYTES){alert('La nota de voz ocupa demasiado espacio. Intenta una grabación más corta para poder guardar la cita.');return}
 try{
  const src=await dataUrl(blob);notes.push({id:'VN-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),src,type:blob.type||'audio/webm',seconds:Math.max(1,Math.min(30,Math.round((Date.now()-started)/1000))),createdAt:new Date().toISOString()});render()
 }catch(_){alert('No se pudo guardar la nota de voz.')}
}
function toggle(){if(rec&&rec.state==='recording')stop();else start()}
function render(){const box=$('agendaVoiceList');if(!box)return;box.innerHTML=notes.length?notes.map((n,i)=>'<div class="agendaVoiceRow"><div><div class="hint">Nota '+(i+1)+(n.seconds?' · '+n.seconds+' s':'')+'</div><audio controls preload="metadata" src="'+esc(n.src)+'"></audio></div><button type="button" class="danger" data-vdel="'+i+'">Eliminar</button></div>').join(''):'<div class="hint">Sin notas de voz.</div>';box.querySelectorAll('[data-vdel]').forEach(b=>b.onclick=()=>{notes.splice(Number(b.dataset.vdel),1);render()});badge()}
function badge(){const fold=$('agendaFoldWork');if(!fold)return;const sum=fold.querySelector('summary');if(!sum)return;let b=sum.querySelector('.agendaVoiceBadge');if(!b){b=document.createElement('span');b.className='agendaFoldBadge agendaVoiceBadge';sum.appendChild(b)}b.textContent=notes.length?'🎙 '+notes.length:''}
function loadFor(id){
 if(rec&&rec.state==='recording')stop();
 const r=id?rows().find(x=>String(x.id)===String(id)):null;notes=r&&Array.isArray(r.voiceNotes)?JSON.parse(JSON.stringify(r.voiceNotes)):[];
 render()
}
function monitor(){
 inject();const modal=$('modal'),id=String(($('id')||{}).value||'');
 if(modal&&modal.classList.contains('open')&&id!==lastId){lastId=id;loadFor(id)}
 if(modal&&!modal.classList.contains('open'))lastId='__closed__';
}
window.addEventListener('agenda:new',()=>{lastId='';notes=[];render()});
window.addEventListener('agenda:voice-ready',()=>setTimeout(badge,20));
window.addEventListener('beforeunload',()=>{try{stop()}catch(_){}});
window.SoltecAgendaVoice135={getNotes:()=>JSON.parse(JSON.stringify(notes)),version:'AGENDA-VOICE1'};
inject();monitor();setInterval(monitor,400);
})();