(function(){'use strict';
const BUILD='V135-EXP-EDIST-FORCE1';
let W=null,obs=null,timer=0;
const SRC=(function(){try{return new URL('./assets/logo_e-distribucion.jpg',window.location.href).href}catch(_){return './assets/logo_e-distribucion.jpg'}})();

function style(){
  const d=W&&W.document;if(!d||d.getElementById('s135ExpEdistStyle'))return;
  const s=d.createElement('style');s.id='s135ExpEdistStyle';
  s.textContent='.s135-exp-edist-logo{width:62px!important;height:34px!important;object-fit:contain!important;display:block!important;visibility:visible!important;opacity:1!important;flex:0 0 auto!important;background:#fff!important;border-radius:3px!important}.s135-exp-edist-fallback{display:none;flex:0 0 auto;font-weight:900;font-size:12px;line-height:1.05;color:#e60000;background:#fff;padding:5px 6px;border-radius:4px;text-align:center}.s135-exp-edist-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;width:100%}.s135-exp-edist-left{min-width:0;flex:1}';
  d.head.appendChild(s);
}
function fallback(img){
  try{
    img.style.display='none';
    let f=img.nextElementSibling;
    if(!f||!f.classList.contains('s135-exp-edist-fallback')){
      f=W.document.createElement('span');f.className='s135-exp-edist-fallback';f.innerHTML='e-<br>distribución';img.insertAdjacentElement('afterend',f);
    }
    f.style.display='block';
  }catch(_){}
}
function makeLogo(){
  const img=W.document.createElement('img');
  img.className='s135-exp-edist-logo';img.src=SRC;img.alt='e-distribución';img.title='e-distribución';
  img.onerror=()=>fallback(img);
  return img;
}
function decorate(){
  if(!W||!W.document)return;
  style();
  const box=W.document.getElementById('s132ExpBox');if(!box)return;
  const cards=Array.from(box.querySelectorAll('.s132card')).filter(c=>c.querySelector('[data-edit]'));
  for(const card of cards){
    let img=card.querySelector('img[alt="e-distribución"],img[title="e-distribución"]');
    if(img){
      img.classList.add('s135-exp-edist-logo');
      img.style.cssText='width:62px!important;height:34px!important;object-fit:contain!important;display:block!important;visibility:visible!important;opacity:1!important;flex:0 0 auto!important;background:#fff!important;border-radius:3px!important';
      img.onerror=()=>fallback(img);
      continue;
    }
    const aviso=Array.from(card.querySelectorAll('b')).find(n=>/^AVISO\s/i.test(String(n.textContent||'').trim()));
    if(!aviso)continue;
    let ref=null;
    const nodes=Array.from(card.querySelectorAll('div'));
    ref=nodes.find(n=>/^REF\.\s*CONDICIONES:/i.test(String(n.textContent||'').trim()))||null;
    const row=W.document.createElement('div');row.className='s135-exp-edist-row';
    const left=W.document.createElement('div');left.className='s135-exp-edist-left';
    const avisoLine=W.document.createElement('div');avisoLine.innerHTML='<b>'+String(aviso.textContent||'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))+'</b>';
    left.appendChild(avisoLine);
    if(ref){const r=W.document.createElement('div');r.innerHTML=ref.innerHTML;left.appendChild(r);ref.style.display='none'}
    aviso.style.display='none';
    row.appendChild(left);row.appendChild(makeLogo());
    card.insertBefore(row,card.firstChild);
  }
}
function bind(){
  if(!W||!W.document)return;
  const box=W.document.getElementById('s132ExpBox');
  if(!box)return;
  if(obs)try{obs.disconnect()}catch(_){}
  obs=new W.MutationObserver(()=>{clearTimeout(timer);timer=W.setTimeout(decorate,30)});
  obs.observe(box,{childList:true,subtree:true});
  decorate();
}
function init(w){
  W=w||W;if(!W)return;
  style();bind();
  W.setTimeout(bind,150);W.setTimeout(bind,700);W.setTimeout(bind,1800);
}
window.Soltec135ExpedientesEdist={init,version:BUILD};
})();
