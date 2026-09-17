(function(){'use strict';
const BUILD='V135-SALIDA-AUTOHIDE1';let timer=0,started=false;
function frame(){try{const f=document.getElementById('app134');return f&&f.contentWindow&&f.contentWindow.document?f.contentWindow:null}catch(e){return null}}
function hideLater(w,b){clearTimeout(timer);timer=setTimeout(()=>{try{if(b&&/YA PUEDES CERRAR SOLTEC/i.test(String(b.textContent||'')))b.style.display='none'}catch(e){}},3500)}
function watch(){const w=frame();if(!w)return false;const d=w.document,b=d.getElementById('safeExit135Box');if(!b)return false;if(/YA PUEDES CERRAR SOLTEC/i.test(String(b.textContent||''))&&b.style.display!=='none')hideLater(w,b);if(!b.dataset.s135AutoHide){b.dataset.s135AutoHide='1';try{new MutationObserver(()=>{if(/YA PUEDES CERRAR SOLTEC/i.test(String(b.textContent||''))&&b.style.display!=='none')hideLater(w,b)}).observe(b,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['style']})}catch(e){}}return true}
function init(){watch();if(started)return;started=true;setInterval(watch,700)}
window.Soltec135SafeExitAutoHide={init,version:BUILD};init();
})();