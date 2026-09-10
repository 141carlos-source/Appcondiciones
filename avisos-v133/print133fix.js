(function(){'use strict';
function addStyle(d){if(d.getElementById('s133PrintFix'))return;const s=d.createElement('style');s.id='s133PrintFix';s.textContent=`@media print{
body > main:not(#mem132){display:block!important}
body > main:not(#mem132) > .screen:not(#mem132){display:none!important}
body > main:not(#mem132) > #mem132{display:block!important}
#mem132{display:block!important;margin:0!important;padding:0!important}
#mem132 > .card:first-child{display:block!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;background:#fff!important}
#mem132 > .card:first-child > h2,#mem132 > .card:first-child > label,#mem132 > .card:first-child > #s132MemPrint{display:none!important}
#s132MemBox{display:block!important;padding:0!important;margin:0!important;background:#fff!important}
#s132MemBox .cnmc-page{display:block!important;visibility:visible!important;box-shadow:none!important;margin:0!important;page-break-after:always!important;break-after:page!important;min-height:270mm!important}
#s132MemBox .cnmc-page:last-child{page-break-after:auto!important;break-after:auto!important}
#s132MemBox img{visibility:visible!important;max-width:100%!important}
}`;d.head.appendChild(s)}
function waitImages(d){const imgs=Array.from(d.querySelectorAll('#s132MemBox img'));return Promise.all(imgs.map(im=>{if(im.complete)return Promise.resolve();return new Promise(ok=>{const done=()=>ok();im.addEventListener('load',done,{once:true});im.addEventListener('error',done,{once:true});setTimeout(done,2500)})}))}
window.Soltec133PrintFix={init:function(w){try{const d=w.document;addStyle(d);const bt=d.getElementById('s132MemPrint');if(!bt)return;const current=bt.onclick;bt.onclick=async function(ev){const box=d.getElementById('s132MemBox');if(!box||!box.querySelector('.cnmc-page')){if(current)return current.call(this,ev);w.alert('GENERA PRIMERO LA MEMORIA.');return}bt.disabled=true;const oldText=bt.textContent;bt.textContent='PREPARANDO PDF…';try{await waitImages(d);await new Promise(r=>setTimeout(r,120));w.print()}finally{setTimeout(()=>{bt.disabled=false;bt.textContent=oldText},500)}}}catch(e){console.error('V1.33 PRINT FIX',e)}}};
})();