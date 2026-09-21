(function(){'use strict';
const VERSION='AGENDA-CREATEFIX3';
const $=id=>document.getElementById(id);
function openNew(ev){
  if(ev){ev.preventDefault();ev.stopImmediatePropagation()}
  const form=$('form'),modal=$('modal'),title=$('title');
  if(!form||!modal||!title)return;
  try{
    if(window.SoltecAgendaCore&&typeof window.SoltecAgendaCore.openNew==='function')window.SoltecAgendaCore.openNew();
    else form.reset();
  }catch(_){try{form.reset()}catch(__){}}
  const id=$('id');if(id)id.value='';
  const priority=$('priority');if(priority)priority.value='medium';
  const status=$('status');if(status)status.value='Pendiente';
  const del=$('deleteBtn');if(del)del.hidden=true;
  const head=$('formTitle');if(head)head.textContent='Nueva cita';
  const input=$('photoInput');if(input)input.value='';
  title.disabled=false;title.readOnly=false;
  try{window.dispatchEvent(new CustomEvent('agenda:new'))}catch(_){}
  try{const v=window.SoltecAgendaView135;if(v&&v.getMode&&v.getSelectedDate&&v.getMode()!=='week'){const dt=$('date');if(dt)dt.value=v.getSelectedDate()}}catch(_){}
  modal.classList.add('open');
  modal.style.display='flex';
  setTimeout(()=>{try{title.focus();title.click()}catch(_){}},80);
}
function close(ev){if(ev){ev.preventDefault();ev.stopImmediatePropagation()}const m=$('modal');if(m){m.classList.remove('open');m.style.removeProperty('display')}try{window.SoltecAgendaFullscreen135&&window.SoltecAgendaFullscreen135.exit&&window.SoltecAgendaFullscreen135.exit()}catch(_){}}
function bind(){
  const b=$('newBtn');if(b&&!b.dataset.createFix){b.dataset.createFix='1';b.addEventListener('click',openNew,true)}
  for(const id of ['closeBtn','cancelBtn']){const n=$(id);if(n&&!n.dataset.createFix){n.dataset.createFix='1';n.addEventListener('click',close,true)}}
}
bind();setInterval(bind,700);
window.SoltecAgendaCreateFix={version:VERSION,openNew};
})();