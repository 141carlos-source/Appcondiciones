(function(){'use strict';
const BUILD='V135-LOGO-EMPRESA-INICIO1';
const MAIN='APP_AVISOS_WEB_DATOS_V116_PERSISTENTE';
let timer=0,last='';
function parse(v){try{return JSON.parse(String(v||''))||{}}catch(e){return{}}}
function readLogo(w){try{const x=parse(w.localStorage.getItem(MAIN)),e=x&&x.empresa||{};return String(e.logoData||'')}catch(e){return''}}
function ensureStyle(d){if(d.getElementById('s135HomeLogoStyle'))return;const s=d.createElement('style');s.id='s135HomeLogoStyle';s.textContent='#s135HomeCompanyLogo{display:flex;align-items:center;justify-content:center;width:100%;min-height:120px;max-height:220px;margin:0 0 14px;padding:10px;background:#fff;border:1px solid #dbe3ee;border-radius:16px;overflow:hidden}#s135HomeCompanyLogo img{display:block;max-width:100%;width:auto;max-height:190px;height:auto;object-fit:contain;object-position:center}';d.head.appendChild(s)}
function render(w){try{if(!w||!w.document)return;const d=w.document,home=d.getElementById('inicio');if(!home)return;ensureStyle(d);const logo=readLogo(w);let box=d.getElementById('s135HomeCompanyLogo');if(!logo){if(box)box.remove();last='';return}if(!box){const card=home.querySelector('.card');if(!card)return;box=d.createElement('div');box.id='s135HomeCompanyLogo';const img=d.createElement('img');img.alt='Logo de empresa';box.appendChild(img);const h2=card.querySelector('h2');if(h2&&h2.nextSibling)card.insertBefore(box,h2.nextSibling);else card.insertBefore(box,card.firstChild)}const img=box.querySelector('img');if(img&&last!==logo){img.src=logo;last=logo}}catch(e){}}
function tick(){try{const f=document.getElementById('app134'),w=f&&f.contentWindow;if(w&&w.document&&w.document.readyState!=='loading')render(w)}catch(e){}}
function init(){tick();if(!timer)timer=setInterval(tick,1000)}
window.Soltec135HomeCompanyLogo={init,version:BUILD};init();
})();
