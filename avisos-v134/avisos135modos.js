(function(){'use strict';
const BUILD='V135-AVISOS-SIMPLE4';
let appWindow=null,patched=false,timer=0;
function findWindow(){try{const f=document.getElementById('app134');return f&&f.contentWindow&&f.contentWindow.document?f.contentWindow:null}catch(e){return null}}
function d(){return appWindow&&appWindow.document}
function el(id){const x=d();return x&&x.getElementById(id)}
function lab(id){const n=el(id);return n&&n.closest?n.closest('label'):null}
function mark(node,on){if(!node)return;node.dataset.s135ModeHidden=on?'1':'0';if(!on&&node.dataset.s135ModeHidden==='0')node.style.removeProperty('display')}
function installCss(){const x=d();if(!x||x.getElementById('s135AvisosModosStyle'))return;const s=x.createElement('style');s.id='s135AvisosModosStyle';s.textContent='#formAviso[data-s135-aviso-mode="simple"] [data-s135-mode-hidden="1"]{display:none!important}';x.head.appendChild(s)}
function allTechnical(){const x=d(),f=el('formAviso');if(!x||!f)return[];const out=[];
 ['s132Loc','av135CartoDetails','s133PlanBox','s132CupsReq','s132Extra','s132CliExtra','av135Solicitudes','s132MemBox','mem132','s132CondFile','s132ActBox'].forEach(id=>{const n=el(id);if(n)out.push(n)});
 ['avRefCatastral','avDireccion','avPiso','avPuerta','avCp','avLocalidad','avProvincia','avLatitud','avLongitud','avCupsE','avCupsG','avTension','avIga','avPotenciaCalculada','avPotenciaSolicitada'].forEach(id=>{const n=lab(id);if(n)out.push(n)});
 f.querySelectorAll('.cartoBox').forEach(n=>out.push(n));
 const grid=f.querySelector('.grid2');if(grid){let hide=false;Array.from(grid.children).forEach(n=>{if(n.classList&&n.classList.contains('sectionTitle')){const t=String(n.textContent||'').toUpperCase();if(/DATOS DEL AVISO/.test(t)){hide=false;return}hide=/UBICACI|DATOS EL[ÉE]CTRICOS|DATOS ADICIONALES|CNMC|SUMINISTRO/.test(t)}if(hide)out.push(n)})}
 f.querySelectorAll('details,.s132box,.s132acc,.cartoBox').forEach(n=>{const t=String(n.textContent||'').toUpperCase();if(/CNMC|CARTOCIUDAD|PLANO DE SITUACI|CUPS|DATOS EL[ÉE]CTRICOS|CONDICIONES DE SUMINISTRO ACTUALES|ACTUACIONES DE CONDICIONES|DATOS ADICIONALES DEL SUMINISTRO/.test(t))out.push(n)});
 const pot=el('potenciaAviso');if(pot)out.push(pot);return Array.from(new Set(out))}
function applyMode(mode){const f=el('formAviso');if(!f)return;installCss();const simple=mode==='simple';f.dataset.s135AvisoMode=simple?'simple':'full';allTechnical().forEach(n=>mark(n,simple));if(!simple)f.querySelectorAll('[data-s135-mode-hidden]').forEach(n=>mark(n,false));const title=el('formAvisoTitulo');if(title&&simple)title.textContent='Nuevo aviso'}
function ensureSelector(){const s=el('crearAvisoModo');if(!s)return false;const wanted=[['','Seleccionar…'],['nuevo','Nuevo'],['condiciones','Con condiciones de suministro'],['duplicar','Duplicar aviso existente']];const cur=Array.from(s.options).map(o=>o.value+'|'+o.textContent).join('||'),next=wanted.map(o=>o[0]+'|'+o[1]).join('||');if(cur!==next){const v=s.value;s.innerHTML=wanted.map(o=>'<option value="'+o[0]+'">'+o[1]+'</option>').join('');if(wanted.some(o=>o[0]===v))s.value=v}return true}
function patch(){if(!appWindow)appWindow=findWindow();const w=appWindow;if(!w||!w.App)return false;ensureSelector();if(patched)return true;patched=true;const A=w.App,origMode=A.crearAvisoModo&&A.crearAvisoModo.bind(A),origNew=A.nuevoAviso&&A.nuevoAviso.bind(A),origEdit=A.editarAviso&&A.editarAviso.bind(A),origDup=A.duplicarAviso&&A.duplicarAviso.bind(A),origCancel=A.cancelarAviso&&A.cancelarAviso.bind(A);
 A.crearAvisoModo=function(){const s=el('crearAvisoModo'),v=s?String(s.value||''):'';if(v==='condiciones'){if(origNew)origNew();applyMode('full');if(s)s.value='';return}if(v==='nuevo'){if(origNew)origNew();applyMode('simple');if(s)s.value='';return}if(origMode)origMode();if(v==='duplicar')applyMode('full')};
 if(origNew)A.nuevoAviso=function(){const r=origNew();applyMode('simple');return r};
 if(origEdit)A.editarAviso=function(id){const r=origEdit(id);applyMode('full');return r};
 if(origDup)A.duplicarAviso=function(id){const r=origDup(id);applyMode('full');return r};
 if(origCancel)A.cancelarAviso=function(){const r=origCancel();applyMode('full');return r};return true}
function tick(){if(!appWindow)appWindow=findWindow();if(!appWindow)return;ensureSelector();patch();const f=el('formAviso');if(f&&f.dataset.s135AvisoMode==='simple')applyMode('simple')}
function init(w){if(w)appWindow=w;tick();if(timer)return;timer=setInterval(tick,300);setTimeout(tick,100);setTimeout(tick,600);setTimeout(tick,1500)}
window.Soltec135AvisosModos={init,version:BUILD};init();
})();