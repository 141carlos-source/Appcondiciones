(function(){'use strict';
var MAIN='APP_AVISOS_WEB_DATOS_V116_PERSISTENTE',deferred=null,btn=document.getElementById('installBtn');
function jget(k,d){try{var x=JSON.parse(localStorage.getItem(k)||'null');return x&&typeof x==='object'?x:d}catch(e){return d}}
function applySavedLogo(){try{var p=jget(MAIN,{}),logo=((p.empresa||{}).logoData)||'';if(!logo)return;var f=document.getElementById('appIcon'),a=document.getElementById('appleIcon');if(f)f.href=logo;if(a)a.href=logo}catch(e){}}
function standalone(){return window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true}
if(standalone())document.documentElement.classList.add('installed');
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferred=e;if(btn)btn.classList.add('show')});
if(btn)btn.addEventListener('click',async function(){if(deferred){deferred.prompt();try{await deferred.userChoice}catch(e){}deferred=null;btn.classList.remove('show');return}alert('PARA INSTALAR APP AVISOS:\n\nEN BRAVE/CHROME ABRE EL MENÚ DEL NAVEGADOR Y ELIGE “INSTALAR APP” O “AÑADIR A PANTALLA DE INICIO”.')});
window.addEventListener('appinstalled',function(){document.documentElement.classList.add('installed');if(btn)btn.classList.remove('show')});
applySavedLogo();setInterval(applySavedLogo,2500);
if('serviceWorker' in navigator)window.addEventListener('load',function(){navigator.serviceWorker.register('./sw.js').catch(function(e){console.warn('SW',e)})});
})();
