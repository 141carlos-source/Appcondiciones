(function(){'use strict';
const KEY='SOLTEC_AGENDA_V1',BACKUP='SOLTEC_AGENDA_V1_AUTOBACKUP',MARK='SOLTEC_AGENDA_AUDIT_SEED_20260921';
function read(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
function run(){
 if(localStorage.getItem(MARK)==='1')return;
 const rows=read();
 const defs=[
  ['AG-MONASTERIO-20260921-1','Monasterio de Piedra 1','2026-09-21'],
  ['AG-MONASTERIO-20260922-2','Monasterio de Piedra 2','2026-09-22'],
  ['AG-MONASTERIO-20260923-3','Monasterio de Piedra 3','2026-09-23'],
  ['AG-MONASTERIO-20260924-4','Monasterio de Piedra 4','2026-09-24']
 ];
 let changed=false;
 for(const [id,name,date] of defs){
   if(rows.some(r=>String(r&&r.id)===id))continue;
   rows.push({id,title:name,client:'',work:name,address:'',phone:'',tech:'',date,time:'09:00',duration:'1',priority:'medium',status:'Pendiente',alarm:'',notes:'',photos:[],voiceNotes:[],materials:[],checklist:[],realStart:'',realEnd:''});
   changed=true;
 }
 try{
   if(changed){const raw=JSON.stringify(rows);localStorage.setItem(KEY,raw);localStorage.setItem(BACKUP,raw)}
   localStorage.setItem(MARK,'1');
   if(changed){window.dispatchEvent(new CustomEvent('agenda:saved',{detail:{id:'AG-MONASTERIO-20260921-1',seed:true}}))}
 }catch(e){console.warn('Agenda seed no aplicado',e)}
}
setTimeout(run,250);
})();