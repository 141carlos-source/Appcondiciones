(function(){'use strict';
const BUILD='V135-AVISOS-MODOS1';
let appWindow=null,patched=false,timer=0;
function d(){return appWindow&&appWindow.document}
function el(id){const x=d();return x&&x.getElementById(id)}
function lab(id){const n=el(id);return n&&n.closest?n.closest('label'):null}
function setHidden(node,on){if(!node)return;node.dataset.s135ModeHidden=on?'1':'0';node.style.display=on?'none':''}
function section(re){const x=d();if(!x)return null;return Array.from(x.querySelectorAll('#formAviso .sectionTitle')).find(n=>re.test(String(n.textContent||'')))||null}
function technicalNodes(){const x=d();if(!x)return[];const nodes=[];
 ['s132Loc','av135CartoDetails','s133PlanBox','s132CupsReq','s132Extra','s132CliExtra','av135Solicitudes'].forEach(id=>{const n=el(id);if(n)nodes.push(n)});
 ['avRefCatastral','avDireccion','avPiso','avPuerta','avCp','avLocalidad','avProvincia','avLatitud','avLongitud','avCupsE','avCupsG','avTension','avIga','avPotenciaCalculada','avPotenciaSolicitada'].forEach(id=>{const n=lab(id);if(n)nodes.push(n)});
 const cart=x.querySelector('#formAviso .cartoBox');if(cart)nodes.push(cart);
 const loc=section(/UBICACI[ÓO]N DEL SUMINISTRO/i);if(loc)nodes.push(loc);
 const elec=section(/DATOS EL[EÉ]CTRICOS/i);if(elec)nodes.push(elec);
 const pot=el('potenciaAviso');if(pot)nodes.push(pot);
 const cupsE=lab('avCupsE'),cupsG=lab('avCupsG');
 [cupsE,cupsG].forEach(n=>{if(n&&n.nextElementSibling&&n.nextElementSibling.classList&&n.nextElementSibling.classList.contains('muted'))nodes.push(n.nextElementSibling)});
 return Array.from(new Set(nodes));
}
function applyMode(mode){const f=el('formAviso');if(!f)return;const simple=mode==='simple';f.dataset.s135AvisoMode=simple?'simple':'full';technicalNodes().forEach(n=>setHidden(n,simple));
 const title=el('formAvisoTitulo');if(title&&simple)title.textContent='Nuevo aviso';
}
function ensureSelector(){const s=el('crearAvisoModo');if(!s)return false;const wanted=[['','Seleccionar…'],['nuevo','Nuevo'],['condiciones','Con condiciones de suministro'],['duplicar','Duplicar aviso existente']];
 const cur=Array.from(s.options).map(o=>o.value+'|'+o.textContent).join('||'),next=wanted.map(o=>o[0]+'|'+o[1]).join('||');if(cur!==next){const v=s.value;s.innerHTML=wanted.map(o=>'<option value="'+o[0]+'">'+o[1]+'</option>').join('');if(wanted.some(o=>o[0]===v))s.value=v}return true}
function patch(){const w=appWindow;if(!w||!w.App)return false;ensureSelector();if(patched)return true;patched=true;
 const A=w.App,origMode=A.crearAvisoModo&&A.crearAvisoModo.bind(A),origNew=A.nuevoAviso&&A.nuevoAviso.bind(A),origEdit=A.editarAviso&&A.editarAviso.bind(A),origDup=A.duplicarAviso&&A.duplicarAviso.bind(A),origCancel=A.cancelarAviso&&A.cancelarAviso.bind(A);
 A.crearAvisoModo=function(){const s=el('crearAvisoModo'),v=s?String(s.value||''):'';if(v==='condiciones'){if(s)s.value='nuevo';if(origMode)origMode();else if(origNew)origNew();applyMode('full');if(s)s.value='';return}if(v==='nuevo'){if(origMode)origMode();else if(origNew)origNew();applyMode('simple');return}if(origMode)origMode();if(v==='duplicar')applyMode('full')};
 if(origNew)A.nuevoAviso=function(){const r=origNew();applyMode('simple');return r};
 if(origEdit)A.editarAviso=function(id){const r=origEdit(id);applyMode('full');return r};
 if(origDup)A.duplicarAviso=function(id){const r=origDup(id);applyMode('full');return r};
 if(origCancel)A.cancelarAviso=function(){const r=origCancel();applyMode('full');return r};
 const form=el('formAviso');if(form){try{new MutationObserver(()=>{if(form.dataset.s135AvisoMode==='simple')applyMode('simple')}).observe(form,{childList:true,subtree:true})}catch(_){}}
 return true}
function init(w){appWindow=w||appWindow;if(!appWindow)return;patch();clearInterval(timer);timer=setInterval(()=>{ensureSelector();patch();const f=el('formAviso');if(f&&f.dataset.s135AvisoMode==='simple')applyMode('simple')},800)}
window.Soltec135AvisosModos={init,version:BUILD};
})();
