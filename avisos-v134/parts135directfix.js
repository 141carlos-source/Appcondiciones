(function(){'use strict';
const VERSION='V135-PARTES-DIRECTO1';
const bound=new WeakSet();
function frame(){try{const f=document.getElementById('app134');return f&&f.contentWindow&&f.contentWindow.document?f.contentWindow:null}catch(e){return null}}
function init(w){if(!w||!w.document||bound.has(w))return;bound.add(w);const d=w.document;d.addEventListener('click',function(ev){const b=ev.target&&ev.target.closest?ev.target.closest('#pt135-new'):null;if(!b)return;const close=d.getElementById('pt135-close'),another=d.getElementById('pt135-another');if(another){ev.preventDefault();ev.stopImmediatePropagation();another.click();return}if(close){ev.preventDefault();ev.stopImmediatePropagation();close.click();w.setTimeout(function(){const n=d.getElementById('pt135-new');if(n)n.click()},60)}},true)}
function boot(){const w=frame();if(w)init(w);setTimeout(boot,800)}
window.Soltec135PartesDirectFix={init:init,version:VERSION};boot();
})();
