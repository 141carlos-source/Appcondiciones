(function(){'use strict';
const $=id=>document.getElementById(id);
function style(){if($('agendaFormFoldStyle'))return;const s=document.createElement('style');s.id='agendaFormFoldStyle';s.textContent='.agendaFold{grid-column:1/-1;border:1px solid #dbe3ee;border-radius:12px;background:#fbfcfe;overflow:hidden}.agendaFold>summary{cursor:pointer;padding:11px 12px;font-weight:900;color:#172b4d;background:#fff}.agendaFoldBody{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px 12px 12px}.agendaFold .wide,.agendaFold .workOps,.agendaFold .agTaskBlock{grid-column:1/-1}.agendaFold .agTaskBlock{margin:0}.agendaFoldBadge{float:right;font-size:10px;color:#667085;font-weight:800}@media(max-width:700px){.agendaFoldBody{grid-template-columns:1fr}.agendaFold .wide,.agendaFold .workOps,.agendaFold .agTaskBlock{grid-column:1}.agendaFold>summary{padding:12px}}';document.head.appendChild(s)}
function nodeFor(id){const n=$(id);if(!n)return null;return n.closest('label')||n}
function fold(id,title,open){let d=$(id);if(d)return d;const grid=document.querySelector('#form .formgrid');if(!grid)return null;d=document.createElement('details');d.id=id;d.className='agendaFold';d.open=!!open;d.innerHTML='<summary>'+title+'</summary><div class="agendaFoldBody"></div>';grid.appendChild(d);return d}
function move(body,node){if(node&&node.parentNode!==body)body.appendChild(node)}
function inject(){
 style();const grid=document.querySelector('#form .formgrid');if(!grid)return;
 const basic=fold('agendaFoldBasic','Datos de la cita',true),plan=fold('agendaFoldPlan','Planificación',true),work=fold('agendaFoldWork','Notas y control del trabajo',false),extras=fold('agendaFoldExtras','Materiales y checklist',false),photos=fold('agendaFoldPhotos','Fotografías',false);
 if(!basic||!plan||!work||!extras||!photos)return;
 const b=basic.querySelector('.agendaFoldBody'),p=plan.querySelector('.agendaFoldBody'),w=work.querySelector('.agendaFoldBody'),x=extras.querySelector('.agendaFoldBody'),ph=photos.querySelector('.agendaFoldBody');
 ['title','client','work','address','phone','tech'].forEach(id=>move(b,nodeFor(id)));
 ['date','time','quickMove','duration','priority','status','alarm'].forEach(id=>move(p,nodeFor(id)));
 move(w,nodeFor('notes'));move(w,$('agendaVoiceBlock'));move(w,$('workOps'));
 move(x,$('agendaMaterialsBlock'));move(x,$('agendaChecklistBlock'));
 const pi=$('photoInput');move(ph,pi&&pi.closest('.wide'));
 updateBadges()
}
function badge(details,text){if(!details)return;const s=details.querySelector('summary');if(!s)return;let b=s.querySelector('.agendaFoldBadge');if(!b){b=document.createElement('span');b.className='agendaFoldBadge';s.appendChild(b)}b.textContent=text||''}
function updateBadges(){
 const mats=document.querySelectorAll('#agendaMaterialsList .agMatRow').length;
 const checks=[...document.querySelectorAll('#agendaChecklistList [data-cdone]')],done=checks.filter(n=>n.checked).length;
 const pics=document.querySelectorAll('#gallery .pic').length;
 badge($('agendaFoldExtras'),(mats?'🧰 '+mats:'')+(checks.length?(mats?' · ':'')+'☑ '+done+'/'+checks.length:''));
 badge($('agendaFoldPhotos'),pics?'📷 '+pics:'');
}
function resetFolds(){const a=$('agendaFoldBasic'),b=$('agendaFoldPlan'),c=$('agendaFoldWork'),d=$('agendaFoldExtras'),e=$('agendaFoldPhotos');if(a)a.open=true;if(b)b.open=true;if(c)c.open=false;if(d)d.open=false;if(e)e.open=false;setTimeout(updateBadges,30)}
window.addEventListener('agenda:new',resetFolds);
window.addEventListener('agenda:saved',()=>setTimeout(updateBadges,80));
document.addEventListener('input',()=>setTimeout(updateBadges,20));
document.addEventListener('change',()=>setTimeout(updateBadges,20));
setInterval(()=>{try{inject();updateBadges()}catch(_){}},500);
inject();
})();