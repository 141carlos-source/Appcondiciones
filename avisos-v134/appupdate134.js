(function(){'use strict';
const BUILD='V135-FINAL1';
let checking=false,lastCheck=0;
async function check(){if(checking)return false;const now=Date.now();if(now-lastCheck<3000)return false;lastCheck=now;checking=true;try{const r=await fetch('./build134.json?t='+now,{cache:'no-store'});if(!r.ok)return false;const x=await r.json();const remote=String(x&&x.build||'');if(!remote||remote===BUILD)return false;try{if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.getRegistration('./');if(reg)await reg.update()}}catch(e){}setTimeout(()=>location.reload(),100);return true}catch(e){return false}finally{checking=false}}
window.Soltec134AppUpdate={BUILD,check};
window.addEventListener('pageshow',()=>setTimeout(check,250));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(check,500)});
})();
