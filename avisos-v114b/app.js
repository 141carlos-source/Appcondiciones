'use strict';
// V1.15 · añade datos eléctricos sin tocar la estructura estable de V1.14B.
KEY='APP_AVISOS_WEB_DATOS_V115_ELECTRICO';
SOURCE_KEY='APP_AVISOS_WEB_DATOS_V114B_CLIENTE';

document.title='APP Avisos V1.15';
(function(){var s=document.querySelector('header .headerText small');if(s)s.textContent='V1.15 PRUEBA · Suministro eléctrico';})();

var _normalizarAvisoV115=normalizarAviso;
normalizarAviso=function(a){
  var x=_normalizarAvisoV115(a),o=a||{};
  x.tension=String(o.tension||'').includes('400')?'400 V TRIFÁSICA':'230 V MONOFÁSICA';
  x.iga=text(o.iga);x.potenciaCalculada=text(o.potenciaCalculada);x.potenciaSolicitada=text(o.potenciaSolicitada);
  return x;
};

function numeroV115(v){var n=parseFloat(String(v==null?'':v).replace(',','.'));return Number.isFinite(n)?n:null;}
function potenciaV115(tension,iga){var i=numeroV115(iga);if(i===null||i<=0)return null;return (String(tension||'').includes('400')?Math.sqrt(3)*400*i:230*i)/1000;}
function kwV115(v){if(v===null||!Number.isFinite(v))return '';return (Math.round(v*1000)/1000).toFixed(3).replace(/\.?0+$/,'');}
function construirElectricosV115(){
  if(el('avTension'))return;
  var datos=[].slice.call(document.querySelectorAll('#formAviso .sectionTitle'));
  var antes=datos.find(function(n){return n.textContent.trim()==='Datos del aviso';});
  if(!antes||!antes.parentNode)return;
  var h=document.createElement('div');h.className='sectionTitle wide';h.textContent='Datos eléctricos del suministro';
  var wrap=document.createElement('div');wrap.className='wide';
  wrap.innerHTML='<div class="grid2"><label>Tensión<select id="avTension"><option value="230 V MONOFÁSICA">230 V MONOFÁSICA</option><option value="400 V TRIFÁSICA">400 V TRIFÁSICA</option></select></label><label>IGA (A)<input id="avIga" type="number" min="0" step="1" inputmode="decimal" placeholder="Ej.: 25"></label><label>Potencia instalación calculada (kW)<input id="avPotenciaCalculada" readonly></label><label>Potencia para condiciones de suministro (kW)<input id="avPotenciaSolicitada" type="number" min="0" step="0.1" inputmode="decimal" placeholder="Potencia solicitada"></label></div><div id="potenciaAviso" class="muted" style="margin:0 0 8px"></div>';
  antes.parentNode.insertBefore(h,antes);antes.parentNode.insertBefore(wrap,antes);
  el('avTension').addEventListener('change',actualizarPotenciaV115);el('avIga').addEventListener('input',actualizarPotenciaV115);el('avPotenciaSolicitada').addEventListener('input',actualizarPotenciaV115);
}
function actualizarPotenciaV115(){
  if(!el('avTension'))return;
  var calc=potenciaV115(getValue('avTension'),getValue('avIga')),sol=numeroV115(getValue('avPotenciaSolicitada')),box=el('potenciaAviso');
  setValue('avPotenciaCalculada',kwV115(calc));if(!box)return;
  if(calc===null){box.textContent='Introduce el IGA para calcular automáticamente la potencia de la instalación.';box.style.color='';return;}
  var t='Potencia calculada: '+kwV115(calc)+' kW.';
  if(sol!==null&&sol>0){if(sol<=calc){t+=' La potencia para condiciones de suministro debe ser superior a la potencia calculada.';box.style.color='#b42318';}else{t+=' Potencia solicitada superior a la calculada.';box.style.color='#15803d';}}
  else{t+=' Introduce aparte la potencia que se solicitará en condiciones de suministro.';box.style.color='';}
  box.textContent=t;
}
construirElectricosV115();
var _resetAvisoV115=resetAviso;
resetAviso=function(){_resetAvisoV115();setValue('avTension','230 V MONOFÁSICA');setValue('avIga','');setValue('avPotenciaCalculada','');setValue('avPotenciaSolicitada','');actualizarPotenciaV115();};
var _cargarAvisoV115=cargarAvisoEnFormulario;
cargarAvisoEnFormulario=function(a,duplicando){_cargarAvisoV115(a,duplicando);setValue('avTension',a.tension||'230 V MONOFÁSICA');setValue('avIga',a.iga);setValue('avPotenciaCalculada',a.potenciaCalculada);setValue('avPotenciaSolicitada',a.potenciaSolicitada);actualizarPotenciaV115();};

window.App={
  show:function(id){
    try{
      ['inicio','avisos','config'].forEach(function(s){el(s).className='screen'+(s===id?' active':'');});
      el('navInicio').className=id==='inicio'?'active':'';
      el('navAvisos').className=id==='avisos'?'active':'';
      el('navConfig').className=id==='config'?'active':'';
      if(id==='inicio')renderInicio();
      if(id==='avisos')renderAvisos();
      if(id==='config')renderEmpresa();
      window.scrollTo(0,0);
    }catch(err){el('bootState').textContent='ERROR DE NAVEGACIÓN: '+err.message;el('bootState').className='err';}
  },
  guardarEmpresa:function(){
    data.empresa={
      nombre:getValue('empresaNombre'),nombreComercial:getValue('empresaNombreComercial'),nif:getValue('empresaNif'),
      telefono:getValue('empresaTelefono'),email:getValue('empresaEmail'),web:getValue('empresaWeb'),
      direccion:getValue('empresaDireccion'),cp:getValue('empresaCp'),localidad:getValue('empresaLocalidad'),provincia:getValue('empresaProvincia'),
      logoData:logoPendiente||''
    };
    data.tecnico={nombre:getValue('tecnicoNombre'),nif:getValue('tecnicoNif'),telefono:getValue('tecnicoTelefono'),email:getValue('tecnicoEmail'),numero:getValue('tecnicoNumero'),colegiado:getValue('tecnicoColegiado')};
    data.solicitante={nombre:getValue('solNombre'),nif:getValue('solNif'),telefono:getValue('solTelefono'),email:getValue('solEmail'),direccion:getValue('solDireccion'),cp:getValue('solCp'),localidad:getValue('solLocalidad'),provincia:getValue('solProvincia')};
    el('estadoEmpresa').textContent=save()?'Configuración guardada.':'No se pudo guardar.';
    renderInicio();
  },
  quitarLogo:function(){logoPendiente='';renderLogo();el('estadoEmpresa').textContent='Logo quitado. Pulsa Guardar configuración para confirmar.';},
  crearAvisoModo:function(){
    var modo=getValue('crearAvisoModo');
    el('duplicarBox').style.display=modo==='duplicar'?'block':'none';
    if(modo==='nuevo'){App.nuevoAviso();setValue('crearAvisoModo','');}
  },
  nuevoAviso:function(){resetAviso();el('formAviso').style.display='block';window.scrollTo(0,Math.max(0,el('formAviso').offsetTop-70));setTimeout(function(){try{el('avCliente').focus();}catch(e){}},50);},
  cancelarAviso:function(){el('formAviso').style.display='none';resetAviso();},
  editarAviso:function(id){var a=byId(id);if(a)cargarAvisoEnFormulario(a,false);},
  duplicarAviso:function(id){var a=byId(id);if(a)cargarAvisoEnFormulario(a,true);},
  duplicarSeleccionado:function(){var id=getValue('duplicarAvisoId');if(!id)return;App.duplicarAviso(Number(id));setValue('crearAvisoModo','');el('duplicarBox').style.display='none';},
  filtrarAvisos:function(){renderAvisos();},
  recalcularPotencia:function(){actualizarPotenciaV115();},
  guardarAviso:function(){
    var id=Number(getValue('avId'))||0,ahora=new Date().toISOString();
    var aviso={id:id||Date.now(),creado:ahora,actualizado:ahora,fecha:getValue('avFecha')||hoyISO(),estado:getValue('avEstado')||'pendiente',
      cliente:getValue('avCliente'),contacto:getValue('avContacto'),nif:getValue('avNif'),telefono:getValue('avTelefono'),email:getValue('avEmail'),
      refCatastral:getValue('avRefCatastral'),direccion:getValue('avDireccion'),cp:getValue('avCp'),localidad:getValue('avLocalidad'),provincia:getValue('avProvincia'),
      cupsE:getValue('avCupsE'),cupsG:getValue('avCupsG'),tension:getValue('avTension')||'230 V MONOFÁSICA',iga:getValue('avIga'),potenciaCalculada:kwV115(potenciaV115(getValue('avTension'),getValue('avIga'))),potenciaSolicitada:getValue('avPotenciaSolicitada'),concepto:getValue('avConcepto'),observaciones:getValue('avObservaciones')};
    if(!aviso.cliente&&!aviso.direccion&&!aviso.concepto){el('estadoAviso').textContent='Escribe al menos cliente, dirección o concepto.';return;}
    if(id){var existente=byId(id);if(existente){aviso.creado=existente.creado||ahora;var pos=data.avisos.indexOf(existente);data.avisos[pos]=aviso;}}else{data.avisos.push(aviso);}
    if(save()){el('formAviso').style.display='none';resetAviso();renderAvisos();renderInicio();}
    else{el('estadoAviso').textContent='No se pudo guardar.';}
  }
};

el('empresaLogoFile').addEventListener('change',function(ev){
  var f=ev.target.files&&ev.target.files[0];if(!f)return;
  resizeLogo(f).then(function(src){logoPendiente=src;renderLogo();el('estadoEmpresa').textContent='Logo cargado. Pulsa Guardar configuración para confirmar.';})
  .catch(function(err){el('estadoEmpresa').textContent=err.message;});
  ev.target.value='';
});

try{
  load();renderInicio();renderEmpresa();renderAvisos();
  el('bootState').textContent='APP LISTA';el('bootState').className='ok';
}catch(err){el('bootState').textContent='ERROR AL INICIAR: '+err.message;el('bootState').className='err';}
