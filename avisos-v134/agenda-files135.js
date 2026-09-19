(function(){'use strict';
const KEY='SOLTEC_AGENDA_V1',MAX_FILES=3,MAX_FILE=400000,MAX_TOTAL=900000;
const $=id=>document.getElementById(id);
let files=[],lastId='__boot__';
function rows(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function fmt(n){n=Number(n||0);return n<1024?n+' B':n<1048576?Math.round(n/1024)+' KB':(Math.round(n/104857.6)/10)+' MB'}
function style(){if($('agendaFilesStyle'))return;const s=document.createElement('style');s.id='agendaFilesStyle';s.textContent='.agendaFilesBlock{grid-column:1/-1;border:1px solid #dbe3ee;border-radius:12px;padding:12px;background:#fbfcfe}.agendaFilesHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.agendaFilesHead h3{margin:0;flex:1;font-size:13px;color:#172b4d}.agendaFilesList{display:grid;gap:7px;margin-top:9px}.agendaFileRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;border:1px solid #dbe3ee;border-radius:9px;background:#fff;padding:8px}.agendaFileName{font-size:12px;font-weight:800;color:#172b4d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.agendaFileMeta{font-size:10px;color:#667085;margin-top:2px}.agendaFilesHint{font-size:10px;color:#667085;margin-top:6px}@media(max-width:560px){.agendaFilesBlock{padding:9px}.agendaFileRow{grid-template-columns:1fr}.agendaFileRow .danger{width:100%}}';document.head.appendChild(s)}
function inject(){style();if($('agendaFilesBlock'))return;const grid=document.querySelector('#form .formgrid');if(!grid)return;const box=document.createElement('div');box.id='agendaFilesBlock';box.className='agendaFilesBlock';box.innerHTML='<div class="agendaFilesHead"><h3>Archivos adjuntos</h3><button type="button" class="ghost" id="agendaFileBtn">📎 Seleccionar archivo</button></div><div class="agendaFilesHint">Máximo 3 archivos · 400 KB por archivo · 900 KB en total.</div><input id="agendaFileInput" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,application/pdf,text/plain,text/csv,application/zip" hidden><div id="agendaFilesList" class="agendaFilesList"></div>';grid.appendChild(box);$('agendaFileBtn').onclick=()=>$('agendaFileInput').click();$('agendaFileInput').onchange=e=>{add(e.target.files);e.target.value=''};render();try{window.dispatchEvent(new CustomEvent('agenda:files-ready'))}catch(_){}}
function readFile(file){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result||''));r.onerror=no;r.readAsDataURL(file)})}
async function add(list){
 let arr=Array.from(list||[]);if(!arr.length)return;
 if(files.length>=MAX_FILES){alert('Máximo 3 archivos por cita.');return}
 arr=arr.slice(0,MAX_FILES-files.length);
 let total=files.reduce((s,f)=>s+Number(f.size||0),0);
 for(const file of arr){
  if(file.size>MAX_FILE){alert('El archivo '+file.name+' supera 400 KB y no se añadirá.');continue}
  if(total+file.size>MAX_TOTAL){alert('Se ha alcanzado el máximo total de 900 KB para archivos adjuntos.');break}
  try{const src=await readFile(file);files.push({id:'AF-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),name:String(file.name||'ARCHIVO'),type:String(file.type||'application/octet-stream'),size:file.size,src,createdAt:new Date().toISOString()});total+=file.size}catch(_){alert('No se pudo leer '+file.name)}
 }
 render()
}
function download(f){try{const a=document.createElement('a');a.href=f.src;a.download=f.name||'archivo';document.body.appendChild(a);a.click();a.remove()}catch(_){}}
function render(){const box=$('agendaFilesList');if(!box)return;box.innerHTML=files.length?files.map((f,i)=>'<div class="agendaFileRow"><div><div class="agendaFileName">'+esc(f.name)+'</div><div class="agendaFileMeta">'+esc(fmt(f.size))+'</div></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="ghost" data-fopen="'+i+'">Abrir</button><button type="button" class="danger" data-fdel="'+i+'">Eliminar</button></div></div>').join(''):'<div class="hint">Sin archivos adjuntos.</div>';box.querySelectorAll('[data-fdel]').forEach(b=>b.onclick=()=>{files.splice(Number(b.dataset.fdel),1);render()});box.querySelectorAll('[data-fopen]').forEach(b=>b.onclick=()=>download(files[Number(b.dataset.fopen)]));badge()}
function badge(){const fold=$('agendaFoldFiles');if(!fold)return;const sum=fold.querySelector('summary');if(!sum)return;let b=sum.querySelector('.agendaFoldBadge');if(!b){b=document.createElement('span');b.className='agendaFoldBadge';sum.appendChild(b)}b.textContent=files.length?'📎 '+files.length:''}
function loadFor(id){const r=id?rows().find(x=>String(x.id)===String(id)):null;files=r&&Array.isArray(r.attachments)?JSON.parse(JSON.stringify(r.attachments)):[];render()}
function monitor(){inject();const modal=$('modal'),id=String(($('id')||{}).value||'');if(modal&&modal.classList.contains('open')&&id!==lastId){lastId=id;loadFor(id)}if(modal&&!modal.classList.contains('open'))lastId='__closed__'}
window.addEventListener('agenda:new',()=>{lastId='';files=[];render()});
window.SoltecAgendaFiles135={getFiles:()=>JSON.parse(JSON.stringify(files)),version:'AGENDA-FILES1'};
inject();monitor();setInterval(monitor,400);
})();