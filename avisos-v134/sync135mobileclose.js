(function(){'use strict';
const VERSION='V135-SYNC-MOVIL-CIERRE1';
const CTX=new WeakMap();
function okText(t){t=String(t||'').toUpperCase();return t.includes('PC SOLTEC CONECTADO')||t.includes('TODO GUARDADO Y SINCRONIZADO')||t.includes('TODO SINCRONIZADO')||t.includes('SINCRONIZACIÓN COMPLETADA')||t.includes('DATOS ACTUALIZADOS DESDE EL PC')||t.includes('DATOS DEL PC RECIBIDOS')||t.includes('PC ACTUALIZADO')}
function badText(t){t=String(t||'').toUpperCase();return t.includes('ERROR')||t.includes('CONFLICTO')||t.includes('NO RESPONDE')||t.includes('OFFLINE')||t.includes('INCORRECTA')||t.includes('PENDIENTE')}
function closePanel(w){try{const d=w.document,p=d.getElementById('s134Engine');if(p&&p.open){p.open=false;try{p.scrollIntoView({block:'nearest',behavior:'smooth'})}catch(_){}}}catch(_){}}
function init(w){if(!w||!w.document||CTX.has(w))return;const d=w.document,c={obs:null,timer:0};CTX.set(w,c);function bind(){const s=d.getElementById('s134EngineStatus');if(!s)return false;const apply=()=>{const t=String(s.textContent||'').trim();if(!t||badText(t)||!okText(t))return;clearTimeout(c.timer);c.timer=setTimeout(()=>closePanel(w),650)};c.obs=new MutationObserver(apply);c.obs.observe(s,{childList:true,characterData:true,subtree:true});apply();return true}if(!bind()){let n=0;const tm=setInterval(()=>{if(bind()||++n>40)clearInterval(tm)},250)}}
window.Soltec135SyncMobileClose={init,version:VERSION};
})();
