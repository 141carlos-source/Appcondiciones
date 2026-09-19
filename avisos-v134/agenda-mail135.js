(function(){'use strict';
const $=id=>document.getElementById(id);
function snapshot(){try{return window.SoltecAgendaCore&&typeof window.SoltecAgendaCore.formSnapshot==='function'?window.SoltecAgendaCore.formSnapshot():null}catch(_){return null}}
function line(label,value){value=String(value||'').trim();return value?label+': '+value:''}
function body(r){
 const rows=[
  'SOLTEC · Cita de Agenda',
  '',
  line('Trabajo',r.title),
  line('Cliente',r.client),
  line('Obra',r.work),
  line('Dirección',r.address),
  line('Teléfono',r.phone),
  line('Técnico',r.tech),
  line('Fecha',r.date),
  line('Hora',r.time),
  line('Duración',r.duration?r.duration+' h':''),
  line('Prioridad',r.priority),
  line('Estado',r.status),
  line('Alarma',r.alarm),
  '',
  r.notes?('Notas:\n'+r.notes):''
 ].filter((x,i,a)=>x!==''||a[i-1]!=='');
 return rows.join('\n')
}
function send(){
 const r=snapshot();if(!r){alert('No hay datos de cita para enviar.');return}
 const subject=String(r.address||'Cita SOLTEC').trim()||'Cita SOLTEC';
 const uri='mailto:?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body(r));
 window.location.href=uri
}
function bind(){const b=$('agendaMailBtn');if(b&&!b.dataset.mail){b.dataset.mail='1';b.onclick=send}}
bind();setInterval(bind,700);window.SoltecAgendaMail135={send};
})();