(function(){'use strict';
const KEY='SOLTEC_AGENDA_V1';
const $=id=>document.getElementById(id);
let selected=new Date();selected.setHours(12,0,0,0);let mode='week';
function pad(n){return String(n).padStart(2,'0')}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function rows(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
function core(){return window.SoltecAgendaCore||{}}
function style(){if($('agendaViewStyle'))return;const s=document.createElement('style');s.id='agendaViewStyle';s.textContent='.agendaViewBar{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin:0 0 12px;padding:10px;border:1px solid #dbe3ee;border-radius:12px;background:#fbfcfe}.agendaViewBar label{min-width:150px}.agendaViewBar select,.agendaViewBar input{margin-top:4px}.agendaViewBar .grow{flex:1}.agendaToolsDrop,.agendaSummaryDrop{border:1px solid #dbe3ee;border-radius:10px;background:#fff}.agendaToolsDrop summary,.agendaSummaryDrop summary{cursor:pointer;font-weight:800;padding:10px 12px;color:#172b4d}.agendaToolsInner{display:flex;gap:8px;flex-wrap:wrap;padding:0 10px 10px}.agendaCustomView{display:none}.agendaCustomView.active{display:block}.agendaDayNav,.agendaMonthNav{display:flex;gap:8px;align-items:center;margin-bottom:10px}.agendaDayNav h2,.agendaMonthNav h2{margin:0;flex:1;font-size:18px;color:#172b4d}.agendaDayList{display:grid;gap:9px}.agendaDayCard{border:1px solid #dbe3ee;border-left:5px solid #2463eb;border-radius:12px;padding:11px;background:#fff;cursor:pointer}.agendaDayCard.high{border-left-color:#e7281c}.agendaDayCard.medium{border-left-color:#b7791f}.agendaDayCard.low{border-left-color:#2463eb}.agendaDayCard h3{margin:4px 0;font-size:14px}.agendaDayCard p{margin:2px 0;color:#667085;font-size:12px}.agendaMonthGrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}.agendaMonthHead{text-align:center;font-size:11px;font-weight:800;color:#667085;padding:4px}.agendaMonthCell{min-height:105px;border:1px solid #dbe3ee;border-radius:9px;background:#fff;padding:6px;overflow:hidden;cursor:pointer}.agendaMonthCell.muted{background:#f8fafc;color:#98a2b3}.agendaMonthCell.today{box-shadow:0 0 0 2px rgba(231,40,28,.2)}.agendaMonthDate{font-size:11px;font-weight:900;margin-bottom:4px}.agendaMonthJob{font-size:10px;border-radius:6px;background:#eef2f6;padding:3px 4px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.agendaMonthMore{font-size:10px;color:#667085;margin-top:3px;font-weight:800}.agendaCompactHidden{display:none!important}@media(max-width:860px){.agendaMonthGrid{gap:2px}.agendaMonthCell{min-height:54px;padding:2px;border-radius:6px}.agendaMonthDate{font-size:10px;margin-bottom:1px}.agendaMonthJob{font-size:8px;padding:1px 2px;margin-top:1px;border-radius:4px;line-height:1.15}.agendaMonthMore{font-size:8px;margin-top:1px}.agendaViewBar{padding:6px;gap:6px}.agendaViewBar label{min-width:105px;font-size:11px}.agendaSummaryDrop{margin:0 8px 6px}.side.agendaSideCollapsed{display:none}.agendaMonthHead{font-size:9px;padding:2px}.agendaMonthNav{margin-bottom:6px}.agendaMonthNav h2{font-size:15px}.agendaMonthNav .ghost{padding:7px 8px}.main{padding:7px!important}}';document.head.appendChild(s)}
function inject(){
  style();
  const main=document.querySelector('main.main');if(!main||$('agendaViewBar'))return;
  const bar=document.createElement('div');bar.id='agendaViewBar';bar.className='agendaViewBar';
  bar.innerHTML='<label>Visualización<select id="agendaViewMode"><option value="day">Día</option><option value="week" selected>Semana</option><option value="month">Mes</option></select></label><label id="agendaDateWrap">Fecha<input id="agendaViewDate" type="date"></label><div class="grow"></div><details class="agendaToolsDrop"><summary>Más opciones</summary><div class="agendaToolsInner" id="agendaToolsInner"></div></details>';
  main.insertBefore(bar,main.firstChild);
  const tools=$('agendaToolsInner');
  ['exportBtn','importBtn','notifyBtn'].forEach(id=>{const n=$(id);if(n)tools.appendChild(n)});
  ['viewWeekBtn','viewTodayBtn','viewPendingBtn'].forEach(id=>{const n=$(id);if(n)n.classList.add('agendaCompactHidden')});
  const search=document.querySelector('.searchbar');
  const day=document.createElement('section');day.id='agendaDayView';day.className='agendaCustomView';day.innerHTML='<div class="agendaDayNav"><button type="button" class="ghost" id="agendaDayPrev">‹</button><h2 id="agendaDayTitle"></h2><button type="button" class="ghost" id="agendaDayToday">Hoy</button><button type="button" class="ghost" id="agendaDayNext">›</button></div><div id="agendaDayList" class="agendaDayList"></div>';
  const month=document.createElement('section');month.id='agendaMonthView';month.className='agendaCustomView';month.innerHTML='<div class="agendaMonthNav"><button type="button" class="ghost" id="agendaMonthPrev">‹</button><h2 id="agendaMonthTitle"></h2><button type="button" class="ghost" id="agendaMonthToday">Este mes</button><button type="button" class="ghost" id="agendaMonthNext">›</button></div><div id="agendaMonthGrid" class="agendaMonthGrid"></div>';
  if(search){search.insertAdjacentElement('afterend',day);day.insertAdjacentElement('afterend',month)}else{main.append(day,month)}
  const side=document.querySelector('.side');if(side){const det=document.createElement('details');det.className='agendaSummaryDrop';det.open=window.innerWidth>860;const sum=document.createElement('summary');sum.textContent='Resumen y filtros';side.parentNode.insertBefore(det,side);det.append(sum,side);side.classList.toggle('agendaSideCollapsed',!det.open);det.addEventListener('toggle',()=>side.classList.toggle('agendaSideCollapsed',!det.open))}
  bind();setMode('week');renderAll()
}
function bind(){
  $('agendaViewMode').onchange=e=>setMode(e.target.value);
  $('agendaViewDate').onchange=e=>{const p=e.target.value.split('-').map(Number);if(p.length===3){selected=new Date(p[0],p[1]-1,p[2],12);renderAll()}};
  $('agendaDayPrev').onclick=()=>{selected.setDate(selected.getDate()-1);renderAll()};
  $('agendaDayNext').onclick=()=>{selected.setDate(selected.getDate()+1);renderAll()};
  $('agendaDayToday').onclick=()=>{selected=new Date();selected.setHours(12,0,0,0);renderAll()};
  $('agendaMonthPrev').onclick=()=>{selected.setMonth(selected.getMonth()-1,1);renderAll()};
  $('agendaMonthNext').onclick=()=>{selected.setMonth(selected.getMonth()+1,1);renderAll()};
  $('agendaMonthToday').onclick=()=>{selected=new Date();selected.setHours(12,0,0,0);renderAll()};
  window.addEventListener('agenda:saved',()=>setTimeout(renderAll,100));
  window.addEventListener('agenda:deleted',()=>setTimeout(renderAll,60));
  window.addEventListener('storage',e=>{if(e.key===KEY)renderAll()});
}
function setMode(v){
  mode=v;const week=$('weekWrap'),today=$('todayView'),pending=$('pendingView'),day=$('agendaDayView'),month=$('agendaMonthView');
  if(week)week.classList.toggle('hidden',v!=='week');
  if(today)today.classList.remove('active');if(pending)pending.classList.remove('active');
  day.classList.toggle('active',v==='day');month.classList.toggle('active',v==='month');
  $('agendaDateWrap').style.display=v==='week'?'none':'block';
  $('agendaViewMode').value=v;renderAll()
}
function renderAll(){$('agendaViewDate').value=iso(selected);renderDay();renderMonth()}
function open(id){const c=core();if(c.openEdit)c.openEdit(id)}
function renderDay(){
  const ds=iso(selected),arr=rows().filter(r=>r.date===ds).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));
  $('agendaDayTitle').textContent=selected.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  $('agendaDayList').innerHTML=arr.length?arr.map(r=>'<article class="agendaDayCard '+esc(r.priority||'medium')+'" data-agenda-open="'+esc(r.id)+'"><div class="jobtop"><strong>'+esc(r.time||'—')+'</strong><span class="status">'+esc(String(r.status||'Pendiente').toUpperCase())+'</span></div><h3>'+esc(r.title||'Sin título')+'</h3><p>'+esc(r.client||'Sin cliente')+(r.tech?' · '+esc(r.tech):'')+'</p><p>'+esc(r.address||'')+'</p></article>').join(''):'<div class="empty">No hay citas este día.</div>';
  $('agendaDayList').querySelectorAll('[data-agenda-open]').forEach(n=>n.onclick=()=>open(n.dataset.agendaOpen))
}
function renderMonth(){
  const y=selected.getFullYear(),m=selected.getMonth(),first=new Date(y,m,1,12),start=new Date(first),day=first.getDay()||7;start.setDate(first.getDate()-day+1);
  $('agendaMonthTitle').textContent=first.toLocaleDateString('es-ES',{month:'long',year:'numeric'});
  const names=['L','M','X','J','V','S','D'];let html=names.map(x=>'<div class="agendaMonthHead">'+x+'</div>').join(''),all=rows(),today=iso(new Date());
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const ds=iso(d),items=all.filter(r=>r.date===ds).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||''))),muted=d.getMonth()!==m;
    html+='<div class="agendaMonthCell '+(muted?'muted ':'')+(ds===today?'today':'')+'" data-agenda-day="'+ds+'"><div class="agendaMonthDate">'+d.getDate()+'</div>'+items.slice(0,2).map(r=>'<div class="agendaMonthJob" data-agenda-open="'+esc(r.id)+'">'+esc(r.time||'')+' '+esc(r.title||'Sin título')+'</div>').join('')+(items.length>2?'<div class="agendaMonthMore">+'+(items.length-2)+'</div>':'')+'</div>'
  }
  $('agendaMonthGrid').innerHTML=html;
  $('agendaMonthGrid').querySelectorAll('[data-agenda-open]').forEach(n=>n.onclick=e=>{e.stopPropagation();open(n.dataset.agendaOpen)});
  $('agendaMonthGrid').querySelectorAll('[data-agenda-day]').forEach(n=>n.onclick=()=>{const p=n.dataset.agendaDay.split('-').map(Number);selected=new Date(p[0],p[1]-1,p[2],12);setMode('day')})
}
window.SoltecAgendaView135={getMode:()=>mode,getSelectedDate:()=>iso(selected),setMode};
inject();
})();