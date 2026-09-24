(function(){'use strict';
const BUILD='V135-OBRA-PRES1',KEY='APP_AVISOS_OBRA_PRESUPUESTO_V135',MAIN='APP_AVISOS_WEB_DATOS_V116_PERSISTENTE',PENDING='SOLTEC_SYNC_PENDING_V134';let W=null,timer=0;
function d(){return W&&W.document}function e(id){return d()&&d().getElementById(id)}function txt(v){return String(v==null?'':v).trim()}function j(v,x){try{return JSON.parse(v||'')||x}catch(_){return x}}
function read(){const x=j(W.localStorage.getItem(KEY),{});return x&&typeof x==='object'?x:{}}
function write(x){W.localStorage.setItem(KEY,JSON.stringify(x));W.localStorage.setItem(PENDING,'1');try{W.dispatchEvent(new W.CustomEvent('soltec:datachange',{detail:{module:'avisos',field:'obraPresupuesto',at:new Date().toISOString()}}))}catch(_){}}
function current(){return{obra:txt((e('av135Obra')||{}).value),presupuesto:txt((e('av135Presupuesto')||{}).value)||'NO',numero:txt((e('av135PresupuestoNumero')||{}).value)}}
function set(v){v=v||{};if(e('av135Obra'))e('av135Obra').value=v.obra||'';if(e('av135Presupuesto'))e('av135Presupuesto').value=v.presupuesto||'NO';if(e('av135PresupuestoNumero'))e('av135PresupuestoNumero').value=v.numero||'';toggle()}
function toggle(){const s=e('av135Presupuesto'),n=e('av135PresupuestoNumeroWrap');if(n)n.style.display=s&&s.value==='SI'?'':'none';if(s&&s.value!=='SI'&&e('av135PresupuestoNumero'))e('av135PresupuestoNumero').value=''}
function inject(){const dir=e('avDireccion'),form=e('formAviso');if(!dir||!form)return false;let wrap=e('av135ObraPresWrap');if(!wrap){wrap=d().createElement('div');wrap.id='av135ObraPresWrap';wrap.style.gridColumn='1/-1';wrap.innerHTML='<div style="display:grid;grid-template-columns:1fr 180px 220px;gap:8px;align-items:end"><label style="margin:0">Nombre de obra<input id="av135Obra" autocomplete="off" placeholder="Ej.: Reforma vivienda, Nave Polígono…"></label><label style="margin:0">Según presupuesto<select id="av135Presupuesto"><option value="NO">No</option><option value="SI">Sí</option></select></label><label id="av135PresupuestoNumeroWrap" style="margin:0;display:none">Nº de presupuesto<input id="av135PresupuestoNumero" autocomplete="off" placeholder="Ej.: P-2026-015"></label></div>';const lab=dir.closest('label'),anchor=lab&&lab.parentNode;if(anchor)anchor.parentNode.insertBefore(wrap,anchor);else form.insertBefore(wrap,form.firstChild);const st=d().createElement('style');st.id='av135ObraPresStyle';st.textContent='@media(max-width:650px){#av135ObraPresWrap>div{grid-template-columns:minmax(0,1fr) 108px!important;gap:6px!important}#av135PresupuestoNumeroWrap{grid-column:1/-1}}';d().head.appendChild(st);e('av135Presupuesto').addEventListener('change',toggle)}return true}
function load(id){inject();set(id?read()[String(id)]||{}:{})}
function save(id,v){if(!id)return;const x=read();x[String(id)]=v||current();write(x)}
function ids(){const p=j(W.localStorage.getItem(MAIN),{avisos:[]});return new Set((p.avisos||[]).map(a=>Number(a.id)||0))}
function patch(){if(!W||!W.App||W.App.__obraPres135)return false;const A=W.App;A.__obraPres135=true;const ed=A.editarAviso&&A.editarAviso.bind(A),nu=A.nuevoAviso&&A.nuevoAviso.bind(A),du=A.duplicarAviso&&A.duplicarAviso.bind(A),sv=A.guardarAviso&&A.guardarAviso.bind(A),ca=A.cancelarAviso&&A.cancelarAviso.bind(A);
if(nu)A.nuevoAviso=function(){const r=nu();setTimeout(()=>load(0),0);return r};
if(ed)A.editarAviso=function(id){const r=ed(id);setTimeout(()=>load(id),0);return r};
if(du)A.duplicarAviso=function(id){const source=read()[String(id)]||{};const r=du(id);setTimeout(()=>{inject();set(source)},0);return r};
if(ca)A.cancelarAviso=function(){const r=ca();setTimeout(()=>load(0),0);return r};
if(sv)A.guardarAviso=function(){inject();const v=current(),explicit=Number((e('avId')||{}).value)||0,before=ids(),r=sv();setTimeout(()=>{let id=explicit;if(!id){const after=Array.from(ids()).filter(x=>x&&!before.has(x)).sort((a,b)=>b-a);id=after[0]||0}if(id)save(id,v)},60);return r};return true}
function tick(){if(!W){try{const f=document.getElementById('app134');if(f&&f.contentWindow&&f.contentWindow.document)W=f.contentWindow}catch(_){}}if(!W)return;inject();patch()}
function init(w){if(w)W=w;tick();if(timer)return;timer=setInterval(tick,500);setTimeout(tick,100);setTimeout(tick,700);setTimeout(tick,1500)}
window.Soltec135AvisosObraPresupuesto={init,version:BUILD};init();
})();
