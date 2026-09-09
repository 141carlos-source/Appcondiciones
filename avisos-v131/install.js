(function(){'use strict';
const b=document.getElementById('installBtn');let deferred=null;
const standalone=matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
if(standalone)document.body.classList.add('installed');
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;if(!standalone)b.classList.add('show')});
setTimeout(()=>{if(!standalone)b.classList.add('show')},1200);
b.onclick=async()=>{if(deferred){deferred.prompt();try{await deferred.userChoice}catch(e){}deferred=null;b.classList.remove('show');return}
alert('PARA INSTALAR SOLTEC AVISOS V1.31:\n\nAndroid / Brave / Chrome: menú ⋮ → Instalar aplicación o Añadir a pantalla de inicio.\n\niPhone / iPad: Compartir → Añadir a pantalla de inicio.\n\nPC: usa el icono de instalación de la barra del navegador.');};
window.addEventListener('appinstalled',()=>{document.body.classList.add('installed');b.classList.remove('show')});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
