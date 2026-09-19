(function(){'use strict';
const $=id=>document.getElementById(id);
function snap(){try{return window.SoltecAgendaCore&&typeof window.SoltecAgendaCore.formSnapshot==='function'?window.SoltecAgendaCore.formSnapshot():null}catch(_){return null}}
function line(label,v){v=String(v||'').trim();return v?label+': '+v:''}
function text(r){return [
 'SOLTEC · Cita de Agenda',
 line('Trabajo',r.title),line('Cliente',r.client),line('Obra',r.work),line('Dirección',r.address),
 line('Teléfono',r.phone),line('Técnico',r.tech),line('Fecha',r.date),line('Hora',r.time),
 line('Duración',r.duration?r.duration+' h':''),line('Estado',r.status),r.notes?('Notas: '+r.notes):''
].filter(Boolean).join('\n')}
async function share(){
 const r=snap();if(!r)return alert('No hay datos de cita para compartir.');
 const payload={title:r.address||r.title||'Cita SOLTEC',text:text(r)};
 try{
   if(navigator.share){await navigator.share(payload);return}
 }catch(e){if(e&&e.name==='AbortError')return}
 try{await navigator.clipboard.writeText(payload.text);alert('Cita copiada. Puedes pegarla en WhatsApp, Mensajes o correo.')}catch(_){alert(payload.text)}
}
function pad(n){return String(n).padStart(2,'0')}
function dt(date,time,plusMinutes){
 if(!date)return'';
 const t=(time||'08:00').split(':').map(Number),d=new Date(date+'T'+pad(t[0]||0)+':'+pad(t[1]||0)+':00');
 if(plusMinutes)d.setMinutes(d.getMinutes()+plusMinutes);
 return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'T'+pad(d.getHours())+pad(d.getMinutes())+'00'
}
function escIcs(v){return String(v||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')}
function calendar(){
 const r=snap();if(!r)return alert('No hay datos de cita para añadir al calendario.');
 if(!r.date)return alert('Indica una fecha para añadir la cita al calendario.');
 const mins=Math.max(30,Math.round((parseFloat(String(r.duration||'1').replace(',','.'))||1)*60));
 const start=dt(r.date,r.time,0),end=dt(r.date,r.time,mins),now=new Date(),stamp=now.getUTCFullYear()+pad(now.getUTCMonth()+1)+pad(now.getUTCDate())+'T'+pad(now.getUTCHours())+pad(now.getUTCMinutes())+pad(now.getUTCSeconds())+'Z';
 const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SOLTEC//Agenda//ES','BEGIN:VEVENT','UID:'+(r.id||('AG-'+Date.now()))+'@soltec','DTSTAMP:'+stamp,'DTSTART:'+start,'DTEND:'+end,'SUMMARY:'+escIcs(r.title||'Cita SOLTEC'),'LOCATION:'+escIcs(r.address||''),'DESCRIPTION:'+escIcs(text(r)),'END:VEVENT','END:VCALENDAR'].join('\r\n');
 const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='SOLTEC_CITA_'+(r.date||'agenda')+'.ics';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)
}
function bind(){
 const s=$('agendaShareBtn');if(s&&!s.dataset.bound){s.dataset.bound='1';s.onclick=share}
 const c=$('agendaCalendarBtn');if(c&&!c.dataset.bound){c.dataset.bound='1';c.onclick=calendar}
}
bind();setInterval(bind,700);
window.SoltecAgendaShare135={share,calendar};
})();