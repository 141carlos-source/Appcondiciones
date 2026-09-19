(function(){'use strict';
const $=id=>document.getElementById(id);
function bind(){
 const form=$('form'),btn=$('agendaSaveBtn');if(!form||!btn||btn.dataset.saveFix)return;
 btn.dataset.saveFix='1';
 btn.addEventListener('click',ev=>{
   ev.preventDefault();ev.stopImmediatePropagation();
   if(typeof form.reportValidity==='function'&&!form.reportValidity())return;
   try{
     if(window.SoltecAgendaCore&&typeof window.SoltecAgendaCore.save==='function'){
       window.SoltecAgendaCore.save({preventDefault(){}});
       setTimeout(()=>{const m=$('modal');if(m){m.classList.remove('open');m.style.removeProperty('display')}},30);
     }
   }catch(e){alert('No se pudo guardar la cita: '+(e&&e.message||e))}
 },true);
}
bind();setInterval(bind,700);
})();