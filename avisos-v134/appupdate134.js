(function(){'use strict';
const BUILD='V135-SALIDA2';
let checking=false,lastCheck=0;
function loadSafe(){try{if(!document.getElementById('s135SafeExit')){let s=document.createElement('script');s.id='s135SafeExit';s.src='./safeexit135.js?build='+encodeURIComponent(BUILD)+'&t='+Date.now();document.head.appendChild(s)}else if(window.Soltec135SafeExit&&window.Soltec135SafeExit.init){window.Soltec135SafeExit.init()}}catch(e){}}
function loadAvisosCliente(){try{if(!document.getElementById('s135AvisosCliente')){let s=document.createElement('script');s.id='s135AvisosCliente';s.src='./avisos135cliente.js?build='+encodeURIComponent(BUILD)+'&t='+Date.now();document.head.appendChild(s)}else if(window.Soltec135AvisosCliente&&window.Soltec135AvisosCliente.init){window.Soltec135AvisosCliente.init()}loadSafe()}catch(e){}}
async function check(){loadAvisosCliente();if(checking)return false;const now=Date.now();if(now-lastCheck<3000)return false;lastCheck=now;checking=true;try{const r=await fetch('./build134.json?t='+now,{cache:'no-store'});if(!r.ok)return false;const x=await r.json();const remote=String(x&&x.build||'');if(!remote||remote===BUILD)return false;try{if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.getRegistration('./');if(reg)await reg.update()}}catch(e){}setTimeout(()=>location.reload(),100);return true}catch(e){return false}finally{checking=false}}
window.Soltec134AppUpdate={BUILD,check,loadAvisosCliente,loadSafe};
loadAvisosCliente();
window.addEventListener('pageshow',()=>setTimeout(check,250));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(check,500)});
})();