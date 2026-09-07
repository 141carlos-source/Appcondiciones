(function(){
'use strict';
var DATA_KEY='APP_AVISOS_WEB_DATOS_V112_AVISOS';
var TRASH_KEY='APP_AVISOS_WEB_PAPELERA_V113';
var EXTRA_KEY='APP_AVISOS_WEB_CLIENTE_SUMINISTRO_V114';
function el(id){return document.getElementById(id);} 
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
function readJson(k,d){try{var r=localStorage.getItem(k);return r?JSON.parse(r):d;}catch(e){return d;}}
function writeJson(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){console.error('V114 SAVE',e);return false;}}
function mapExtra(){var x=readJson(EXTRA_KEY,{});return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}
function blank(){return {contacto:'',nif:'',refCatastral:'',cp:'',localidad:'',provincia:'',cupsE:'',cupsG:''};}
function normal(v){var b=blank(),o=v||{};Object.keys(b).forEach(function(k){b[k]=String(o[k]||'');});return b;}
function setv(id,v){var n=el(id);if(n)n.value=v||'';}
function getv(id){var n=el(id);return n?String(n.value||'').trim():'';}
function recoger(){return {contacto:getv('avContacto'),nif:getv('avNif'),refCatastral:getv('avRefCatastral'),cp:getv('avCp'),localidad:getv('avLocalidad'),provincia:getv('avProvincia'),cupsE:getv('avCupsE'),cupsG:getv('avCupsG')};}
function limpiar(){Object.keys({avContacto:1,avNif:1,avRefCatastral:1,avCp:1,avLocalidad:1,avProvincia:1,avCupsE:1,avCupsG:1}).forEach(function(id){setv(id,'');});}
function cargar(id){var x=normal(mapExtra()[String(id)]);setv('avContacto',x.contacto);setv('avNif',x.nif);setv('avRefCatastral',x.refCatastral);setv('avCp',x.cp);setv('avLocalidad',x.localidad);setv('avProvincia',x.provincia);setv('avCupsE',x.cupsE);setv('avCupsG',x.cupsG);}
function guardarExtra(id,x){if(!id)return;var m=mapExtra();m[String(id)]=normal(x);writeJson(EXTRA_KEY,m);}
function idDeCard(card){var b=card.querySelector('button[onclick*="App.editarAviso("]');if(!b)return 0;var m=(b.getAttribute('onclick')||'').match(/App\.editarAviso\((\d+)\)/);return m?Number(m[1]):0;}
function insertarDespues(ref,node){if(ref&&ref.parentNode)ref.parentNode.insertBefore(node,ref.nextSibling);}
function mkLabel(text,id,attrs){var l=document.createElement('label');l.appendChild(document.createTextNode(text));var i=document.createElement('input');i.id=id;if(attrs)Object.keys(attrs).forEach(function(k){i.setAttribute(k,attrs[k]);});l.appendChild(i);return l;}
function cambiarTextoLabel(inputId,text){var i=el(inputId);if(!i||!i.parentElement)return;var l=i.parentElement;for(var n=l.firstChild;n;n=n.nextSibling){if(n.nodeType===3){n.nodeValue=text;return;}}}
function construirCampos(){if(el('avContacto'))return;var cliente=el('avCliente');if(!cliente)return;var grid=cliente.closest('.grid2');if(!grid)return;
  cambiarTextoLabel('avCliente','Cliente / Razón social');cambiarTextoLabel('avDireccion','Dirección del suministro');
  var clienteLabel=cliente.parentElement;
  var titulo=document.createElement('div');titulo.className='sectionTitle wide';titulo.textContent='Cliente y suministro';grid.insertBefore(titulo,clienteLabel);
  var contacto=mkLabel('Nombre persona de contacto','avContacto',{autocomplete:'off'});insertarDespues(clienteLabel,contacto);
  var nif=mkLabel('DNI / NIF / CIF','avNif',{autocomplete:'off'});insertarDespues(contacto,nif);
  var dir=el('avDireccion').parentElement;
  var refcat=mkLabel('Referencia catastral','avRefCatastral',{autocomplete:'off'});insertarDespues(el('avEmail').parentElement,refcat);
  var cp=mkLabel('CP','avCp',{inputmode:'numeric',autocomplete:'postal-code'});insertarDespues(dir,cp);
  var loc=mkLabel('Población / Localidad','avLocalidad',{autocomplete:'address-level2'});insertarDespues(cp,loc);
  var prov=mkLabel('Provincia','avProvincia',{autocomplete:'address-level1'});prov.className='wide';insertarDespues(loc,prov);
  var ce=mkLabel('CUPS Electricidad','avCupsE',{placeholder:'ES...',autocomplete:'off'});insertarDespues(prov,ce);
  var cg=mkLabel('CUPS Gas','avCupsG',{placeholder:'ES...',autocomplete:'off'});insertarDespues(ce,cg);
  var ayuda=document.createElement('div');ayuda.className='muted wide';ayuda.style.margin='0 0 8px';ayuda.textContent='CUPS + dirección identifican el punto de suministro. No reutilices un CUPS en otra dirección.';insertarDespues(cg,ayuda);
}
function datosAvisos(){var d=readJson(DATA_KEY,{avisos:[]});return d&&Array.isArray(d.avisos)?d.avisos:[];}
function idsAntes(){var o={};datosAvisos().forEach(function(a){o[String(a.id)]=1;});return o;}
function nuevoIdDespues(antes){var arr=datosAvisos().filter(function(a){return !antes[String(a.id)];});if(arr.length){arr.sort(function(a,b){return Number(b.id)-Number(a.id);});return Number(arr[0].id)||0;}return 0;}
function enriquecerTarjetas(){document.querySelectorAll('#listaAvisos .avisoCard').forEach(function(card){var id=idDeCard(card);if(!id)return;var x=normal(mapExtra()[String(id)]);var viejo=card.querySelector('.v114ClienteExtra');if(viejo)viejo.remove();var datos=[x.contacto&&('Contacto: '+x.contacto),x.nif&&('NIF/CIF: '+x.nif),[x.cp,x.localidad,x.provincia].filter(Boolean).join(' · '),x.cupsE&&('CUPS E: '+x.cupsE),x.cupsG&&('CUPS G: '+x.cupsG)].filter(Boolean);if(!datos.length)return;var d=document.createElement('div');d.className='v114ClienteExtra';d.style.cssText='font-size:11px;color:#667085;margin-top:7px;line-height:1.45';d.innerHTML=datos.map(esc).join('<br>');var actions=card.querySelector('.actions');card.insertBefore(d,actions||null);});}
function podarHuerfanos(){var vivos={};datosAvisos().forEach(function(a){vivos[String(a.id)]=1;});var p=readJson(TRASH_KEY,[]);if(Array.isArray(p))p.forEach(function(a){vivos[String(a.id)]=1;});var m=mapExtra(),c=false;Object.keys(m).forEach(function(id){if(!vivos[id]){delete m[id];c=true;}});if(c)writeJson(EXTRA_KEY,m);}
function cambiarVersion(){var small=document.querySelector('header .headerText small');if(small)small.textContent='V1.14 PRUEBA · Cliente y suministro';}
function envolverApp(){if(!window.App||App.__v114)return;var base={nuevo:App.nuevoAviso,editar:App.editarAviso,duplicar:App.duplicarAviso,guardar:App.guardarAviso,filtrar:App.filtrarAvisos};
  App.nuevoAviso=function(){base.nuevo.apply(App,arguments);limpiar();};
  App.editarAviso=function(id){base.editar.apply(App,arguments);cargar(id);};
  App.duplicarAviso=function(id){base.duplicar.apply(App,arguments);cargar(id);};
  App.guardarAviso=function(){var antes=idsAntes(),id=Number(getv('avId'))||0,x=recoger();base.guardar.apply(App,arguments);setTimeout(function(){var target=id||nuevoIdDespues(antes);if(target)guardarExtra(target,x);enriquecerTarjetas();},0);};
  App.filtrarAvisos=function(){base.filtrar.apply(App,arguments);setTimeout(enriquecerTarjetas,0);};
  App.__v114=true;
}
function aplicar(){construirCampos();envolverApp();cambiarVersion();enriquecerTarjetas();podarHuerfanos();}
var lista=el('listaAvisos');if(lista)new MutationObserver(function(){enriquecerTarjetas();}).observe(lista,{childList:true,subtree:true});
setTimeout(aplicar,0);setTimeout(aplicar,250);setTimeout(aplicar,800);
})();
