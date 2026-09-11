(function(){'use strict';
const MAIN='APP_AVISOS_WEB_DATOS_V116_PERSISTENTE',CFG='APP_AVISOS_CONFIG_V127',SCHEMA='SOLTEC_EMPRESA_BASE_V1',VERSION=1;
function parse(raw,d){try{const x=JSON.parse(String(raw||''));return x&&typeof x==='object'?x:d}catch(e){return d}}
function pick(o,keys){const r={};o=o&&typeof o==='object'?o:{};for(const k of keys)r[k]=o[k]==null?'':o[k];return r}
function delay(ms){return new Promise(r=>setTimeout(r,ms))}
function read(w){const p=parse(w.localStorage.getItem(MAIN),{}),c=parse(w.localStorage.getItem(CFG),{}),emp=p.empresa||{},tec=p.tecnico||{},sol=p.solicitante||{};return{
 schema:SCHEMA,
 version:VERSION,
 creadoEn:new Date().toISOString(),
 origen:{aplicacion:'SOLTEC AVISOS',version:'1.34'},
 empresa:pick(emp,['nombre','nombreComercial','nif','telefono','email','web','direccion','cp','localidad','provincia']),
 tecnico:pick(tec,['nombre','nif','telefono','email','numero','colegiado']),
 solicitante:pick(sol,['nombre','nif','telefono','email','direccion','cp','localidad','provincia']),
 identidadVisual:{logoData:String(emp.logoData||''),firmaData:String(c.firmaData||''),selloData:String(c.selloData||'')},
 contactos:{emails:(c.emails&&typeof c.emails==='object')?c.emails:{}}
 }}
function valid(x){return !!(x&&x.schema===SCHEMA&&Number(x.version)===VERSION&&x.empresa&&x.identidadVisual)}
function filename(x){let n=String(x&&x.empresa&&(x.empresa.nombreComercial||x.empresa.nombre)||'SOLTEC').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');if(!n)n='SOLTEC';return n+'_EMPRESA_BASE_V1.json'}
async function create(w,saveFirst){if(saveFirst!==false&&w.App&&typeof w.App.guardarEmpresa==='function'){w.App.guardarEmpresa();await delay(120)}return read(w)}
async function download(w){const d=w.document,st=d.getElementById('s134CompanyBaseStatus');try{if(st)st.textContent='GUARDANDO DATOS DE EMPRESA…';const x=await create(w,true);if(!x.empresa.nombre&&!x.empresa.nombreComercial&&!x.empresa.nif)throw new Error('Completa y guarda primero los datos principales de la empresa.');const blob=new w.Blob([JSON.stringify(x,null,2)],{type:'application/json;charset=utf-8'}),a=d.createElement('a');a.href=w.URL.createObjectURL(blob);a.download=filename(x);d.body.appendChild(a);a.click();setTimeout(()=>{try{w.URL.revokeObjectURL(a.href)}catch(e){}a.remove()},1500);if(st){const visual=[];if(x.identidadVisual.logoData)visual.push('LOGO');if(x.identidadVisual.firmaData)visual.push('FIRMA');if(x.identidadVisual.selloData)visual.push('SELLO');st.textContent='BASE DE EMPRESA DESCARGADA'+(visual.length?' · INCLUYE '+visual.join(' + '):' · SIN RECURSOS GRÁFICOS GUARDADOS')}}catch(e){if(st)st.textContent='ERROR: '+(e.message||String(e))}}
function inject(w){const d=w.document;if(d.getElementById('s134CompanyBase'))return;const card=d.querySelector('#config .card');if(!card)return;const box=d.createElement('details');box.id='s134CompanyBase';box.className='s132acc';box.innerHTML='<summary>🏢 BASE DE EMPRESA PARA OTROS MÓDULOS</summary><div class="s132body"><p class="muted">Crea un archivo independiente de los avisos con los datos de empresa, técnico y solicitante. Incluye el logo y, si están configurados, firma, sello y correos. No incluye avisos ni claves de sincronización.</p><button type="button" id="s134CompanyBaseDownload" class="primary full">⬇ GUARDAR Y DESCARGAR BASE DE EMPRESA</button><div id="s134CompanyBaseStatus" class="muted" style="margin-top:8px"></div></div>';card.appendChild(box);d.getElementById('s134CompanyBaseDownload').onclick=()=>download(w)}
window.Soltec134CompanyBase={SCHEMA,VERSION,init:function(w){try{inject(w)}catch(e){console.error('V1.34 COMPANY BASE',e)}},create,download,valid};
})();
