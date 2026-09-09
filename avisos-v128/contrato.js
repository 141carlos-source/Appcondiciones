(function(){'use strict';
var CFG='APP_AVISOS_CONFIG_V127',bound=new WeakSet();
function jget(k,d){try{var x=JSON.parse(localStorage.getItem(k)||'null');return x&&typeof x==='object'?x:d}catch(e){return d}}
function v(d,id){var e=d.getElementById(id);return e?String(e.value||'').trim():''}
function up(x){return String(x||'').trim().toUpperCase()}
function low(x){return String(x||'').trim().toLowerCase()}
function linea(k,x){return k+': '+(x||'—')}
function avisoVisible(d,msg){var ch=d.getElementById('v122Contrato');if(!ch)return;var host=ch.closest('.v122switch')||ch.parentElement,box=d.getElementById('v128ContratoAviso');if(!box){box=d.createElement('div');box.id='v128ContratoAviso';box.style.cssText='margin:8px 0;padding:9px 10px;border:1px solid #dc2626;border-radius:9px;background:#fff5f5;color:#b42318;font-size:12px;font-weight:800;line-height:1.4';if(host)host.insertAdjacentElement('afterend',box)}box.textContent=msg||'';box.style.display=msg?'block':'none'}
function abrirCorreo(d,w){
  var c=jget(CFG,{}),to=low(((c.emails||{}).comercializadora1)||'');
  if(!to){var msg='FALTA CONFIGURAR EL CORREO DE COMERCIALIZADORA 1.';avisoVisible(d,msg);alert(msg+'\n\nVE A CONFIGURACIÓN → CUENTAS DE CORREO Y GUÁRDALO.');try{if(w.App)w.App.show('config')}catch(e){}return false}
  avisoVisible(d,'');
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
  var a=d.createElement('a');a.href='mailto:'+encodeURIComponent(to)+'?subject='+encodeURIComponent('CONTRATO')+'&body='+encodeURIComponent(body);a.style.display='none';d.body.appendChild(a);a.click();setTimeout(function(){a.remove()},500);return true
}
function bind(d,w){var ch=d.getElementById('v122Contrato');if(!ch||bound.has(ch))return;bound.add(ch);ch.addEventListener('change',function(){if(ch.checked&&!abrirCorreo(d,w)){ch.checked=false;try{ch.dispatchEvent(new Event('change',{bubbles:false}))}catch(e){}}})}
function walk(w,s){if(!w||s.has(w))return;s.add(w);var d;try{d=w.document}catch(e){return}try{bind(d,w);Array.from(d.querySelectorAll('iframe')).forEach(function(f){try{walk(f.contentWindow,s)}catch(e){}})}catch(e){}}
function scan(){walk(window,new Set())}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan);else scan();setInterval(scan,700);
})();
