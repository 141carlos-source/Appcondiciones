var KEY='APP_AVISOS_WEB_DATOS_V114B_CLIENTE';
var SOURCE_KEY='APP_AVISOS_WEB_DATOS_V112_AVISOS';
var logoPendiente='';
var data={schema:2,empresa:{},tecnico:{},solicitante:{},avisos:[]};

function el(id){return document.getElementById(id);}
function text(v){return v==null?'':String(v);}
function esc(v){return text(v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
function obj(defaults,src){var out={};src=src||{};Object.keys(defaults).forEach(function(k){out[k]=text(src[k]);});return out;}
function blankEmpresa(){return {nombre:'',nombreComercial:'',nif:'',telefono:'',email:'',web:'',direccion:'',cp:'',localidad:'',provincia:'',logoData:''};}
function blankTecnico(){return {nombre:'',nif:'',telefono:'',email:'',numero:'',colegiado:''};}
function blankSolicitante(){return {nombre:'',nif:'',telefono:'',email:'',direccion:'',cp:'',localidad:'',provincia:''};}

function normalizarAviso(a){
  a=a||{};
  return {
    id:Number(a.id)||Date.now(),
    creado:text(a.creado)||new Date().toISOString(),
    actualizado:text(a.actualizado)||text(a.creado)||new Date().toISOString(),
    fecha:text(a.fecha)||text(a.creado).slice(0,10)||hoyISO(),
    estado:['pendiente','en_curso','finalizado'].indexOf(a.estado)>=0?a.estado:'pendiente',
    cliente:text(a.cliente),contacto:text(a.contacto),nif:text(a.nif),telefono:text(a.telefono),email:text(a.email),
    refCatastral:text(a.refCatastral),direccion:text(a.direccion),cp:text(a.cp),localidad:text(a.localidad),provincia:text(a.provincia),
    cupsE:text(a.cupsE),cupsG:text(a.cupsG),concepto:text(a.concepto),observaciones:text(a.observaciones)
  };
}

function load(){
  try{
    var raw=window.localStorage.getItem(KEY);
    var origen='V1.14B';
    if(!raw){raw=window.localStorage.getItem(SOURCE_KEY);origen='V1.12';}
    if(raw){
      var p=JSON.parse(raw);
      if(p&&typeof p==='object'){
        data.schema=2;
        data.empresa=obj(blankEmpresa(),p.empresa);
        data.tecnico=obj(blankTecnico(),p.tecnico);
        data.solicitante=obj(blankSolicitante(),p.solicitante);
        data.avisos=(Array.isArray(p.avisos)?p.avisos:[]).map(normalizarAviso);
      }
    }else{
      data.empresa=blankEmpresa();data.tecnico=blankTecnico();data.solicitante=blankSolicitante();data.avisos=[];
    }
    logoPendiente=data.empresa.logoData||'';
    if(origen!=='V1.14B')save();
  }catch(err){console.error('LOAD',err);data.empresa=blankEmpresa();data.tecnico=blankTecnico();data.solicitante=blankSolicitante();data.avisos=[];}
}

function save(){
  try{window.localStorage.setItem(KEY,JSON.stringify(data));return true;}
  catch(err){console.error('SAVE',err);return false;}
}

function setValue(id,v){var n=el(id);if(n)n.value=text(v);}
function getValue(id){var n=el(id);return n?n.value.trim():'';}
function hoyISO(){var d=new Date(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return d.getFullYear()+'-'+m+'-'+day;}
function estadoTexto(v){return v==='en_curso'?'EN CURSO':v==='finalizado'?'FINALIZADO':'PENDIENTE';}
function fechaES(v){if(!v)return '';var p=v.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:v;}
function byId(id){id=Number(id);return data.avisos.find(function(a){return Number(a.id)===id;})||null;}

function renderLogo(){
  var img=el('empresaLogoPreview'),empty=el('empresaLogoEmpty'),head=el('headerLogo');
  var src=logoPendiente||data.empresa.logoData||'';
  if(src){img.src=src;img.style.display='block';empty.style.display='none';head.src=src;head.style.display='block';}
  else{img.removeAttribute('src');img.style.display='none';empty.style.display='inline';head.removeAttribute('src');head.style.display='none';}
}

function renderInicio(){
  var nom=data.empresa.nombreComercial||data.empresa.nombre||'Empresa no configurada';
  el('resumenInicio').innerHTML='<div class="notice"><strong>'+esc(nom)+'</strong><small>'+data.avisos.length+' aviso(s) guardado(s)</small></div>';
  renderLogo();
}

function renderEmpresa(){
  var e=data.empresa,t=data.tecnico,s=data.solicitante;
  setValue('empresaNombre',e.nombre);setValue('empresaNombreComercial',e.nombreComercial);setValue('empresaNif',e.nif);
  setValue('empresaTelefono',e.telefono);setValue('empresaEmail',e.email);setValue('empresaWeb',e.web);
  setValue('empresaDireccion',e.direccion);setValue('empresaCp',e.cp);setValue('empresaLocalidad',e.localidad);setValue('empresaProvincia',e.provincia);
  setValue('tecnicoNombre',t.nombre);setValue('tecnicoNif',t.nif);setValue('tecnicoTelefono',t.telefono);setValue('tecnicoEmail',t.email);setValue('tecnicoNumero',t.numero);setValue('tecnicoColegiado',t.colegiado);
  setValue('solNombre',s.nombre);setValue('solNif',s.nif);setValue('solTelefono',s.telefono);setValue('solEmail',s.email);
  setValue('solDireccion',s.direccion);setValue('solCp',s.cp);setValue('solLocalidad',s.localidad);setValue('solProvincia',s.provincia);
  logoPendiente=e.logoData||logoPendiente||'';renderLogo();
}

function renderConceptos(){
  var seen={},vals=[];data.avisos.forEach(function(a){var c=text(a.concepto).trim();if(c&&!seen[c.toLowerCase()]){seen[c.toLowerCase()]=1;vals.push(c);}});
  vals.sort(function(a,b){return a.localeCompare(b,'es');});
  el('conceptosPrevios').innerHTML=vals.map(function(c){return '<option value="'+esc(c)+'"></option>';}).join('');
}

function renderDuplicables(){
  var sel=el('duplicarAvisoId');if(!sel)return;
  var arr=data.avisos.slice().sort(function(a,b){return text(b.fecha).localeCompare(text(a.fecha))||Number(b.id)-Number(a.id);});
  sel.innerHTML=arr.length?arr.map(function(a){return '<option value="'+a.id+'">'+esc(fechaES(a.fecha)+' · '+(a.cliente||'SIN CLIENTE')+' · '+(a.concepto||''))+'</option>';}).join(''):'<option value="">No hay avisos para duplicar</option>';
}

function renderAvisos(){
  renderConceptos();renderDuplicables();
  var box=el('listaAvisos'),q=text(el('avBuscar')&&el('avBuscar').value).toLowerCase().trim(),f=text(el('avFiltroEstado')&&el('avFiltroEstado').value);
  var arr=data.avisos.slice().filter(function(a){
    if(f&&a.estado!==f)return false;
    if(!q)return true;
    return [a.cliente,a.contacto,a.nif,a.telefono,a.email,a.refCatastral,a.direccion,a.cp,a.localidad,a.provincia,a.cupsE,a.cupsG,a.concepto,a.observaciones].join(' ').toLowerCase().indexOf(q)>=0;
  }).sort(function(a,b){return text(b.fecha).localeCompare(text(a.fecha))||Number(b.id)-Number(a.id);});
  el('contadorAvisos').textContent=arr.length+' de '+data.avisos.length+' aviso(s)';
  if(!arr.length){box.innerHTML='<div class="empty">No hay avisos que coincidan.</div>';return;}
  box.innerHTML=arr.map(function(a){
    var contacto=[a.contacto,a.telefono,a.email].filter(Boolean).join(' · ');
    var ubicacion=[a.cp,a.localidad,a.provincia].filter(Boolean).join(' · ');
    var cups=[a.cupsE&&('CUPS E: '+a.cupsE),a.cupsG&&('CUPS G: '+a.cupsG)].filter(Boolean).join(' · ');
    return '<div class="avisoCard">'+
      '<div class="avisoTop"><strong>'+esc(a.cliente||'SIN CLIENTE')+'</strong><span class="badge '+esc(a.estado)+'">'+estadoTexto(a.estado)+'</span></div>'+
      '<div class="avisoMeta">'+esc(fechaES(a.fecha))+(a.direccion?' · '+esc(a.direccion):'')+(ubicacion?' · '+esc(ubicacion):'')+'</div>'+ 
      (contacto?'<div class="avisoMeta">'+esc(contacto)+'</div>':'')+
      (a.nif?'<div class="avisoMeta">NIF/CIF: '+esc(a.nif)+'</div>':'')+
      (cups?'<div class="avisoMeta">'+esc(cups)+'</div>':'')+
      (a.concepto?'<div class="avisoConcepto"><b>'+esc(a.concepto)+'</b></div>':'')+
      (a.observaciones?'<div class="avisoConcepto">'+esc(a.observaciones)+'</div>':'')+
      '<div class="actions"><button type="button" onclick="App.editarAviso('+a.id+')">Editar</button><button type="button" onclick="App.duplicarAviso('+a.id+')">Duplicar</button></div>'+ 
      '</div>';
  }).join('');
}

function resetAviso(){
  ['avId','avCliente','avContacto','avNif','avTelefono','avEmail','avRefCatastral','avDireccion','avCp','avLocalidad','avProvincia','avCupsE','avCupsG','avConcepto','avObservaciones'].forEach(function(id){setValue(id,'');});
  setValue('avFecha',hoyISO());setValue('avEstado','pendiente');el('estadoAviso').textContent='';el('formAvisoTitulo').textContent='Nuevo aviso';
}

function cargarAvisoEnFormulario(a,duplicando){
  resetAviso();
  setValue('avId',duplicando?'':a.id);setValue('avFecha',duplicando?hoyISO():a.fecha);setValue('avEstado',duplicando?'pendiente':a.estado);
  setValue('avCliente',a.cliente);setValue('avContacto',a.contacto);setValue('avNif',a.nif);setValue('avTelefono',a.telefono);setValue('avEmail',a.email);
  setValue('avRefCatastral',a.refCatastral);setValue('avDireccion',a.direccion);setValue('avCp',a.cp);setValue('avLocalidad',a.localidad);setValue('avProvincia',a.provincia);
  setValue('avCupsE',a.cupsE);setValue('avCupsG',a.cupsG);setValue('avConcepto',a.concepto);setValue('avObservaciones',a.observaciones);
  el('formAvisoTitulo').textContent=duplicando?'Duplicar aviso':'Editar aviso';el('formAviso').style.display='block';window.scrollTo(0,Math.max(0,el('formAviso').offsetTop-70));
}

function resizeLogo(file){
  return new Promise(function(resolve,reject){
    var r=new FileReader();
    r.onerror=function(){reject(new Error('No se pudo leer el logo'));};
    r.onload=function(){
      var im=new Image();
      im.onerror=function(){reject(new Error('Imagen no válida'));};
      im.onload=function(){
        var maxW=900,maxH=360,scale=Math.min(1,maxW/im.width,maxH/im.height);
        var c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*scale));c.height=Math.max(1,Math.round(im.height*scale));
        var ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(im,0,0,c.width,c.height);
        resolve(c.toDataURL('image/png'));
      };
      im.src=r.result;
    };
    r.readAsDataURL(file);
  });
}
