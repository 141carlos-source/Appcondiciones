(function(){'use strict';
var CFG='APP_AVISOS_CONFIG_V127',bound=new WeakSet();
function jget(k,d){try{var x=JSON.parse(localStorage.getItem(k)||'null');return x&&typeof x==='object'?x:d}catch(e){return d}}
function v(d,id){var e=d.getElementById(id);return e?String(e.value||'').trim():''}
function up(x){return String(x||'').trim().toUpperCase()}
function low(x){return String(x||'').trim().toLowerCase()}
function linea(k,x){return k+': '+(x||'—')}
function abrirCorreo(d,w){
  var c=jget(CFG,{}),to=low(((c.emails||{}).comercializadora1)||'');
  if(!to){alert('CONFIGURA PRIMERO LA CUENTA "COMERCIALIZADORA 1" EN CONFIGURACIÓN.');try{if(w.App)w.App.show('config')}catch(e){}return}
  var body=[
    'DATOS DEL CLIENTE','',
    linea('CLIENTE / RAZÓN SOCIAL',up(v(d,'avCliente'))),
    linea('NIF / CIF',up(v(d,'avNif'))),
    linea('PERSONA DE CONTACTO',up(v(d,'avContacto'))),
    linea('TELÉFONO',up(v(d,'avTelefono'))),
    linea('CORREO ELECTRÓNICO',low(v(d,'avEmail'))),
    '',
    'DATOS DEL SUMINISTRO','',
    linea('DIRECCIÓN',up(v(d,'avDireccion'))),
    linea('CÓDIGO POSTAL',up(v(d,'avCp'))),
    linea('LOCALIDAD',up(v(d,'avLocalidad'))),
    linea('PROVINCIA',up(v(d,'avProvincia'))),
    linea('REFERENCIA CATASTRAL',up(v(d,'avRefCatastral'))),
    linea('CUPS ELECTRICIDAD',up(v(d,'avCupsE'))),
    linea('CUPS GAS',up(v(d,'avCupsG'))),
    linea('TENSIÓN',up(v(d,'avTension'))),
    linea('POTENCIA SOLICITADA',v(d,'avPotenciaSolicitada')?up(v(d,'avPotenciaSolicitada'))+' kW':'—'),
    '',
    'DATOS BANCARIOS','',
    linea('IBAN',up(v(d,'v122Iban')))
  ].join('\n');
  var a=d.createElement('a');
  a.href='mailto:'+encodeURIComponent(to)+'?subject='+encodeURIComponent('CONTRATO')+'&body='+encodeURIComponent(body);
  a.style.display='none';d.body.appendChild(a);a.click();setTimeout(function(){a.remove()},500)
}
function bind(d,w){var ch=d.getElementById('v122Contrato');if(!ch||bound.has(ch))return;bound.add(ch);ch.addEventListener('change',function(){if(ch.checked)abrirCorreo(d,w)})}
function walk(w,s){if(!w||s.has(w))return;s.add(w);var d;try{d=w.document}catch(e){return}try{bind(d,w);Array.from(d.querySelectorAll('iframe')).forEach(function(f){try{walk(f.contentWindow,s)}catch(e){}})}catch(e){}}
function scan(){walk(window,new Set())}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan);else scan();setInterval(scan,700);
})();
