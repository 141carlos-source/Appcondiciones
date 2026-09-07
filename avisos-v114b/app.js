'use strict';
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
  guardarAviso:function(){
    var id=Number(getValue('avId'))||0,ahora=new Date().toISOString();
    var aviso={id:id||Date.now(),creado:ahora,actualizado:ahora,fecha:getValue('avFecha')||hoyISO(),estado:getValue('avEstado')||'pendiente',
      cliente:getValue('avCliente'),contacto:getValue('avContacto'),nif:getValue('avNif'),telefono:getValue('avTelefono'),email:getValue('avEmail'),
      refCatastral:getValue('avRefCatastral'),direccion:getValue('avDireccion'),cp:getValue('avCp'),localidad:getValue('avLocalidad'),provincia:getValue('avProvincia'),
      cupsE:getValue('avCupsE'),cupsG:getValue('avCupsG'),concepto:getValue('avConcepto'),observaciones:getValue('avObservaciones')};
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
