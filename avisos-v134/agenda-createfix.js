(function(){'use strict';
const VERSION='AGENDA-CREATEFIX1';
const $=id=>document.getElementById(id);
function openNew(ev){
  if(ev){ev.preventDefault();ev.stopImmediatePropagation()}
  const form=$('form'),modal=$('modal'),title=$('title');
  if(!form||!modal||!title)return;
  try{form.reset()}catch(_){}
  const id=$('id');if(id)id.value='';
  const priority=$('priority');if(priority)priority.value='medium';
  const status=$('status');if(status)status.value='Pendiente';
  const del=$('deleteBtn');if(del)del.hidden=true;
  const head=$('formTitle');if(head)head.textContent='Nueva cita';
  title.disabled=false;title.readOnly=false;
  modal.classList.add('open');
  modal.style.display='flex';
  setTimeout(()=>{try{title.focus();title.click()}catch(_){}},80);
}
function close(ev){if(ev){ev.preventDefault();ev.stopImmediatePropagation()}const m=$('modal');if(m){m.classList.remove('open');m.style.removeProperty('display')}}
function bind(){
  const b=$('newBtn');if(b&&!b.dataset.createFix){b.dataset.createFix='1';b.addEventListener('click',openNew,true)}
  for(const id of ['closeBtn','cancelBtn']){const n=$(id);if(n&&!n.dataset.createFix){n.dataset.createFix='1';n.addEventListener('click',close,true)}}
}
bind();setInterval(bind,700);
window.SoltecAgendaCreateFix={version:VERSION,openNew};
})();