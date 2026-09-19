(function(){'use strict';
const BUILD='V135-AGENDA-MAINUI1';let W=null,timer=0,full=false;
function d(){return W&&W.document}function e(id){return d()&&d().getElementById(id)}
function layout(){const nav=d()&&d().querySelector('nav.bottom');if(!nav)return;const buttons=Array.from(nav.querySelectorAll(':scope > button'));nav.style.gridTemplateColumns='repeat('+Math.max(1,buttons.length)+',minmax(0,1fr))';buttons.forEach(b=>{b.style.minHeight='52px';b.style.padding='8px 3px';b.style.fontSize='12px'})}
function ensureStyle(){if(e('agenda135-style'))return;const s=d().createElement('style');s.id='agenda135-style';s.textContent='#agenda135{padding:0!important;overflow:hidden!important;background:#eef2f6}#agenda135.agenda135-full{position:fixed!important;inset:0!important;z-index:99999!important;width:100vw!important;height:100dvh!important;background:#fff!important}#agenda135.agenda135-full .agenda135-note{display:none!important}#agenda135.agenda135-full .agenda135-frame{height:100dvh!important}#agenda135 .agenda135-frame{display:block;width:100%;height:calc(100vh - 112px);height:calc(100dvh - 112px);border:0;background:#fff}#agenda135 .agenda135-note{font-size:11px;color:#667085;background:#fff8e8;border-bottom:1px solid #f0c36d;padding:6px 10px;text-align:center}@media(max-width:620px){#agenda135 .agenda135-frame{height:calc(100vh - 116px);height:calc(100dvh - 116px)}}';d().head.appendChild(s)}
function ensureScreen(){if(e('agenda135'))return e('agenda135');ensureStyle();const main=d().querySelector('main');if(!main)return null;const section=d().createElement('section');section.id='agenda135';section.className='screen';section.innerHTML='<div class="agenda135-note">Agenda integrada · datos locales con sincronización SOLTEC central</div><iframe id="agenda135-frame" class="agenda135-frame" title="SOLTEC Agenda" loading="eager"></iframe>';main.appendChild(section);return section}
function ensureFrame(){const f=e('agenda135-frame');if(f&&!f.getAttribute('src'))f.src='./agenda.html?embedded=1&v=V135-AGENDA-MAINUI1'}
function setFullscreen(active){full=!!active;const s=e('agenda135');if(s)s.classList.toggle('agenda135-full',full);try{d().documentElement.style.overflow=full?'hidden':'';d().body.style.overflow=full?'hidden':''}catch(_){}}
function onMessage(ev){try{const f=e('agenda135-frame');if(!f||ev.source!==f.contentWindow)return;const data=ev.data||{};if(data.type==='SOLTEC_AGENDA_FULLSCREEN')setFullscreen(!!data.active)}catch(_){}}
function toggleSelectAviso(hide){
 const doc=d();if(!doc)return;
 const nodes=[...doc.querySelectorAll('button,label,div,span,p,h1,h2,h3,h4,small')];
 nodes.forEach(n=>{
   const txt=String(n.textContent||'').trim().replace(/\s+/g,' ');
   if(!/seleccionar aviso/i.test(txt))return;
   if(hide){
     if(n.dataset.agendaPrevDisplay==null)n.dataset.agendaPrevDisplay=n.style.display||'';
     n.style.display='none';
   }else if(n.dataset.agendaPrevDisplay!=null){
     n.style.display=n.dataset.agendaPrevDisplay;
     delete n.dataset.agendaPrevDisplay;
   }
 });
}
function show(){const doc=d();if(!doc)return;ensureScreen();ensureFrame();doc.querySelectorAll('.screen').forEach(n=>n.classList.remove('active'));const screen=e('agenda135');if(screen)screen.classList.add('active');toggleSelectAviso(true);doc.querySelectorAll('nav.bottom button').forEach(n=>n.classList.remove('active'));const b=e('navAgenda');if(b)b.classList.add('active');try{W.scrollTo(0,0)}catch(_){}}
function ensureNav(){const nav=d()&&d().querySelector('nav.bottom');if(!nav)return;if(!nav.__agendaRestore){nav.__agendaRestore=true;nav.addEventListener('click',ev=>{const b=ev.target&&ev.target.closest&&ev.target.closest('button');if(b&&b.id!=='navAgenda')toggleSelectAviso(false)},true)}let b=e('navAgenda');if(!b){b=d().createElement('button');b.type='button';b.id='navAgenda';const config=e('navConfig'),finish=e('navFinalizar');nav.insertBefore(b,config||finish||null)}b.innerHTML='📅<br>Agenda';b.onclick=show;layout()}
function ensure(){if(!W||!d())return;ensureStyle();ensureScreen();ensureNav()}
function init(w){W=w||W;if(!W)return;ensure();if(!W.__agendaFullListener){W.__agendaFullListener=true;W.addEventListener('message',onMessage)}if(timer)return;timer=W.setInterval(ensure,1200);W.setTimeout(ensure,150);W.setTimeout(ensure,700)}
window.Soltec135Agenda={init,show,version:BUILD};
(function boot(){try{const f=document.getElementById('app134');if(f&&f.contentWindow&&f.contentWindow.document)return init(f.contentWindow)}catch(_){}setTimeout(boot,250)})();
})();