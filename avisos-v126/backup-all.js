(function(){'use strict';
var DB_NAME='APP_AVISOS_PERSISTENCIA',DB_VERSION=2,APP_PREFIX='APP_AVISOS_',SCHEMA='APP_AVISOS_BACKUP_TOTAL_V126';
var shade=document.getElementById('shade'),status=document.getElementById('status');
function setStatus(s){status.textContent=s||''}
function openDb(){return new Promise(function(ok,no){var r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=function(){var d=r.result;if(!d.objectStoreNames.contains('estado'))d.createObjectStore('estado');if(!d.objectStoreNames.contains('planos'))d.createObjectStore('planos')};r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error||new Error('No se pudo abrir la base de datos'))}})}
function req(r){return new Promise(function(ok,no){r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error)}})}
function blobToData(blob){return new Promise(function(ok,no){var r=new FileReader();r.onload=function(){ok(String(r.result))};r.onerror=function(){no(r.error)};r.readAsDataURL(blob)})}
function dataToBlob(s,mime){var p=String(s||'').split(','),bin=atob(p[1]||''),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type:mime||((p[0].match(/data:([^;]+)/)||[])[1]||'application/octet-stream')})}
async function encode(v){
  if(v instanceof Blob)return {__appType:'Blob',mime:v.type||'',name:(typeof File!=='undefined'&&v instanceof File)?v.name:'',lastModified:(typeof File!=='undefined'&&v instanceof File)?v.lastModified:0,data:await blobToData(v)};
  if(v instanceof Date)return {__appType:'Date',value:v.toISOString()};
  if(Array.isArray(v)){var a=[];for(var i=0;i<v.length;i++)a.push(await encode(v[i]));return a}
  if(v&&typeof v==='object'){var o={};for(var k of Object.keys(v))o[k]=await encode(v[k]);return o}
  if(typeof v==='undefined')return {__appType:'Undefined'};
  return v;
}
function decode(v){
  if(Array.isArray(v))return v.map(decode);
  if(v&&typeof v==='object'){
    if(v.__appType==='Blob'){var b=dataToBlob(v.data,v.mime);if(v.name&&typeof File!=='undefined')try{return new File([b],v.name,{type:v.mime||b.type,lastModified:v.lastModified||Date.now()})}catch(e){}return b}
    if(v.__appType==='Date')return new Date(v.value);
    if(v.__appType==='Undefined')return undefined;
    var o={};Object.keys(v).forEach(function(k){o[k]=decode(v[k])});return o;
  }
  return v;
}
async function storeEntries(db,store){
  var tx=db.transaction(store,'readonly'),os=tx.objectStore(store);
  var keys=await req(os.getAllKeys()),vals=await req(os.getAll()),out=[];
  for(var i=0;i<keys.length;i++)out.push({key:await encode(keys[i]),value:await encode(vals[i])});
  return out;
}
function appLocalStorage(){
  var out={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf(APP_PREFIX)===0)out[k]=localStorage.getItem(k)}return out;
}
function countAvisos(ls){
  try{var raw=ls.APP_AVISOS_WEB_DATOS_V116_PERSISTENTE,p=JSON.parse(raw||'{}');return Array.isArray(p.avisos)?p.avisos.length:0}catch(e){return 0}
}
async function exportAll(){
  setStatus('Preparando copia total… No cierres esta pantalla.');
  try{
    var db=await openDb(),stores={},names=Array.from(db.objectStoreNames);
    for(var i=0;i<names.length;i++)stores[names[i]]=await storeEntries(db,names[i]);
    var ls=appLocalStorage(),pack={schema:SCHEMA,version:126,creadoEn:new Date().toISOString(),origin:location.origin,localStorage:ls,indexedDB:{name:DB_NAME,version:db.version,stores:stores},resumen:{avisos:countAvisos(ls),clavesLocalStorage:Object.keys(ls).length,almacenes:names.length}};
    db.close();
    var blob=new Blob([JSON.stringify(pack)],{type:'application/json'}),d=new Date(),fn='APP_AVISOS_COPIA_TOTAL_'+d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'_'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')+'.json',a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download=fn;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1600);
    setStatus('Copia total creada: '+fn+' · '+pack.resumen.avisos+' aviso(s).');
  }catch(e){setStatus('ERROR AL EXPORTAR: '+(e&&e.message?e.message:e))}
}
async function clearStore(db,name){return new Promise(function(ok,no){var tx=db.transaction(name,'readwrite');tx.objectStore(name).clear();tx.oncomplete=function(){ok()};tx.onerror=function(){no(tx.error)}})}
async function putEntries(db,name,entries){
  return new Promise(function(ok,no){var tx=db.transaction(name,'readwrite'),os=tx.objectStore(name);try{(entries||[]).forEach(function(e){os.put(decode(e.value),decode(e.key))})}catch(err){try{tx.abort()}catch(x){}no(err);return}tx.oncomplete=function(){ok()};tx.onerror=function(){no(tx.error)}});
}
function clearAppLocalStorage(){var a=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf(APP_PREFIX)===0)a.push(k)}a.forEach(function(k){localStorage.removeItem(k)})}
async function importV126(pack){
  if(!pack||pack.schema!==SCHEMA)throw new Error('La copia no es una copia total V1.26 válida.');
  var db=await openDb(),existing=Array.from(db.objectStoreNames),src=(pack.indexedDB&&pack.indexedDB.stores)||{};
  for(var i=0;i<existing.length;i++)await clearStore(db,existing[i]);
  for(var name of Object.keys(src)){if(existing.indexOf(name)>=0)await putEntries(db,name,src[name])}
  db.close();
  clearAppLocalStorage();
  var ls=pack.localStorage||{};Object.keys(ls).forEach(function(k){if(k.indexOf(APP_PREFIX)===0)localStorage.setItem(k,String(ls[k]))});
}
async function importLegacy(pack){
  if(!pack||pack.schema!=='APP_AVISOS_BACKUP_V123')throw new Error('Formato de copia no reconocido.');
  var db=await openDb(),existing=Array.from(db.objectStoreNames);
  for(var i=0;i<existing.length;i++)await clearStore(db,existing[i]);
  clearAppLocalStorage();
  localStorage.setItem('APP_AVISOS_WEB_DATOS_V116_PERSISTENTE',JSON.stringify(pack.main||{}));
  localStorage.setItem('APP_AVISOS_FLAGS_V120',JSON.stringify(pack.flags||{}));
  var plans=pack.plans||{};
  if(existing.indexOf('planos')>=0){var pe=[];for(var k of Object.keys(plans)){var p=plans[k];pe.push({key:k,value:{blob:dataToBlob(p.data),nombre:p.nombre||'',generadoEn:p.generadoEn||'',latitud:p.latitud||'',longitud:p.longitud||'',direccion:p.direccion||'',refCatastral:p.refCatastral||''}})}await putEntries(db,'planos',await Promise.all(pe.map(async function(e){return{key:await encode(e.key),value:await encode(e.value)}})))}
  var photos=pack.photos||{};
  if(existing.indexOf('estado')>=0){var fe=[];for(var id of Object.keys(photos)){var arr=(photos[id]||[]).map(function(p){return{blob:dataToBlob(p.data),nombre:p.nombre||'',creadaEn:p.creadaEn||'',cgp:!!p.cgp}});fe.push({key:'APP_AVISOS_FOTOS_V123_'+id,value:arr})}await putEntries(db,'estado',await Promise.all(fe.map(async function(e){return{key:await encode(e.key),value:await encode(e.value)}})))}
  db.close();
}
async function importAll(file){
  try{
    setStatus('Leyendo copia…');
    var pack=JSON.parse(await file.text()),desc=pack.schema===SCHEMA?'COPIA TOTAL V1.26':pack.schema==='APP_AVISOS_BACKUP_V123'?'COPIA V1.23 (compatible)':'ARCHIVO DESCONOCIDO';
    if(desc==='ARCHIVO DESCONOCIDO')throw new Error('El archivo no corresponde a una copia de APP Avisos.');
    if(!confirm('¿IMPORTAR '+desc+'?\n\nSe reemplazarán TODOS los datos actuales de APP Avisos en este dispositivo.')){setStatus('Importación cancelada.');return}
    setStatus('Importando todo…');
    if(pack.schema===SCHEMA)await importV126(pack);else await importLegacy(pack);
    setStatus('Importación completada. Reiniciando APP Avisos…');
    setTimeout(function(){location.reload()},900);
  }catch(e){setStatus('ERROR AL IMPORTAR: '+(e&&e.message?e.message:e))}
}
document.getElementById('backupBtn').onclick=function(){shade.style.display='block';setStatus('')};
document.getElementById('closeBtn').onclick=function(){shade.style.display='none'};
document.getElementById('exportBtn').onclick=exportAll;
document.getElementById('importFile').onchange=function(){var f=this.files&&this.files[0];this.value='';if(f)importAll(f)};
shade.addEventListener('click',function(e){if(e.target===shade)shade.style.display='none'});
})();