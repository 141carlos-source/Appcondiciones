(function(){'use strict';
function up(v){return String(v==null?'':v).trim().toLocaleUpperCase('es-ES')}
function set(d,id,fn){const x=d.getElementById(id);if(x&&typeof x.value==='string')x.value=fn(x.value)}
const avisoUpper=['avCliente','avContacto','avNif','avRefCatastral','avDireccion','avLocalidad','avProvincia','avCupsE','avCupsG','avConcepto'];
const empresaUpper=['empresaNombre','empresaNombreComercial','empresaNif','empresaDireccion','empresaLocalidad','empresaProvincia','tecnicoNombre','tecnicoNif','tecnicoNumero','tecnicoColegiado','solNombre','solNif','solDireccion','solLocalidad','solProvincia'];
function normalizeAviso(d){avisoUpper.forEach(id=>set(d,id,up))}
function normalizeEmpresa(d){empresaUpper.forEach(id=>set(d,id,up))}
function init(w){try{if(w.__s134normalize)return;w.__s134normalize=true;const d=w.document,A=w.App;if(!A)return;if(typeof A.guardarAviso==='function'){const old=A.guardarAviso.bind(A);A.guardarAviso=function(){normalizeAviso(d);return old.apply(A,arguments)}}if(typeof A.guardarEmpresa==='function'){const old=A.guardarEmpresa.bind(A);A.guardarEmpresa=function(){normalizeEmpresa(d);return old.apply(A,arguments)}}const blurIds=avisoUpper.concat(empresaUpper);d.addEventListener('blur',ev=>{const t=ev.target;if(t&&blurIds.includes(t.id))t.value=up(t.value)},true)}catch(x){console.error('V1.34 NORMALIZE',x)}}
window.Soltec134Normalize={init};
})();
