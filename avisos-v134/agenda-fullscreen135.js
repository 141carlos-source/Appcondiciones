(function(){'use strict';
const $=id=>document.getElementById(id);
let active=false;
function send(v){try{window.parent.postMessage({type:'SOLTEC_AGENDA_FULLSCREEN',active:!!v},'*')}catch(_){}}
function apply(v){
  active=!!v;
  document.body.classList.toggle('agendaFormFullscreen',active);
  send(active);
}
function sync(){
  const m=$('modal');
  const open=!!(m&&m.classList.contains('open'));
  if(open!==active)apply(open)
}
function style(){
 if($('agendaFullscreenStyle'))return;
 const s=document.createElement('style');s.id='agendaFullscreenStyle';
 s.textContent='body.agendaFormFullscreen{overflow:hidden;background:#fff}body.agendaFormFullscreen>.app{display:none!important}body.agendaFormFullscreen #modal{display:flex!important;position:fixed!important;inset:0!important;z-index:999999!important;background:#fff!important;padding:0!important;align-items:stretch!important;justify-content:stretch!important}body.agendaFormFullscreen #modal .sheet{width:100%!important;max-width:none!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important;padding:10px 12px!important;overflow:auto!important}body.agendaFormFullscreen .sheethead{position:sticky;top:-10px;z-index:20;background:#fff;border-bottom:1px solid #dbe3ee;padding:8px 0;margin-bottom:6px}body.agendaFormFullscreen .sheethead h2{font-size:17px!important;text-transform:uppercase}body.agendaFormFullscreen .formgrid{max-width:900px;margin:8px auto 0}body.agendaFormFullscreen .formactions{max-width:900px;margin:10px auto 0;padding-bottom:14px}@media(max-width:700px){body.agendaFormFullscreen #modal .sheet{padding:7px!important}body.agendaFormFullscreen .agendaFold>summary{padding:9px 10px!important}body.agendaFormFullscreen .agendaFoldBody{padding:7px 8px 9px!important;gap:7px!important}body.agendaFormFullscreen .formactions{gap:5px!important}body.agendaFormFullscreen .formactions button{font-size:11px!important;padding:8px!important}}';
 document.head.appendChild(s)
}
function boot(){
 style();
 const m=$('modal');if(!m)return setTimeout(boot,100);
 const o=new MutationObserver(sync);o.observe(m,{attributes:true,attributeFilter:['class','style']});
 window.addEventListener('pagehide',()=>send(false));
 sync()
}
boot();
window.SoltecAgendaFullscreen135={sync,version:'AGENDA-FULLSCREEN1'};
})();