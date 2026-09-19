(function(){'use strict';
const KEY='SOLTEC_AGENDA_V1',BACKUP='SOLTEC_AGENDA_V1_AUTOBACKUP';
const $=id=>document.getElementById(id);
function rows(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
function write(all){try{const raw=JSON.stringify(all);localStorage.setItem(KEY,raw);localStorage.setItem(BACKUP,raw);return true}catch(e){if(e&&(e.name==='QuotaExceededError'||e.code===22))alert('No hay espacio suficiente para duplicar la cita.');else alert('No se pudo duplicar la cita.');return false}}
function currentId(){return String(($('id')||{}).value||'')}
function duplicate(){
 const id=currentId();if(!id)return;
 const all=rows(),src=all.find(x=>String(x.id)===id);if(!src)return;
 const copy=JSON.parse(JSON.stringify(src));
 copy.id='AG-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
 copy.status='Pendiente';copy.realStart='';copy.realEnd='';
 all.push(copy);if(!write(all))return;
 try{window.dispatchEvent(new CustomEvent('agenda:saved',{detail:{id:copy.id,duplicatedFrom:id}}))}catch(_){}
 setTimeout(()=>{try{window.SoltecAgendaCore&&window.SoltecAgendaCore.openEdit(copy.id)}catch(_){}},40)
}
function saveNew(){
 const title=$('title');if(!title||!title.value.trim()){if(title)title.focus();return}
 const c=window.SoltecAgendaCore;if(!c||typeof c.save!=='function')return;
 try{c.save({preventDefault(){}})}catch(e){alert('No se pudo guardar la cita: '+(e&&e.message||e));return}
 setTimeout(()=>{try{c.openNew()}catch(_){}},100)
}
function refresh(){
 const dup=$('agendaDuplicateBtn'),id=currentId();if(dup)dup.hidden=!id
}
function bind(){
 const d=$('agendaDuplicateBtn');if(d&&!d.dataset.actions135){d.dataset.actions135='1';d.onclick=duplicate}
 const s=$('agendaSaveNewBtn');if(s&&!s.dataset.actions135){s.dataset.actions135='1';s.onclick=saveNew}
 refresh()
}
window.addEventListener('agenda:new',()=>setTimeout(refresh,20));
window.addEventListener('agenda:saved',()=>setTimeout(refresh,20));
setInterval(bind,500);bind();
})();