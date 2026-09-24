(function(){'use strict';
const B='V135-ONECLICK3-TECLADO';let done=false,planObs=null,started=false;
function loadSalida(){try{if(!document.getElementById('s135SafeExit')){let s=document.createElement('script');s.id='s135SafeExit';s.src='./safeexit135.js?build='+encodeURIComponent(B)+'&t='+Date.now();document.head.appendChild(s)}else if(window.Soltec135SafeExit&&window.Soltec135SafeExit.init)window.Soltec135SafeExit.init()}catch(e){}}
function frame(){try{let f=document.getElementById('app134');return f&&f.contentWindow&&f.contentWindow.document?f.contentWindow:null}catch(e){return null}}
function S(v){return String(v==null?'':v)}
function lab(d,id){let n=d.getElementById(id);return n&&n.closest?n.closest('label'):null}
function gv(d,id){let n=d.getElementById(id);return n?S(n.value).trim():''}
function iban(d){return gv(d,'s132Iban')}
function addUnits(fields,d){let i=fields.findIndex(function(f){return f[0]==='Dirección del suministro'});if(i>=0)fields.splice(i+1,0,['Piso',()=>gv(d,'avPiso')],['Puerta',()=>gv(d,'avPuerta')])}
function avisoText(d,tipo){let fields=[['Fecha',()=>gv(d,'avFecha')],['Estado',()=>gv(d,'avEstado')],['Dirección del suministro',()=>gv(d,'avDireccion')],['Cliente / Razón social',()=>gv(d,'avCliente')],['Nombre persona de contacto',()=>gv(d,'avContacto')],['DNI / NIF / CIF',()=>gv(d,'avNif')],['Teléfono',()=>gv(d,'avTelefono')],['Correo electrónico',()=>gv(d,'avEmail')],['IBAN',()=>iban(d)],['CP',()=>gv(d,'avCp')],['Población / Localidad',()=>gv(d,'avLocalidad')],['Provincia',()=>gv(d,'avProvincia')],['CUPS Electricidad',()=>gv(d,'avCupsE')],['CUPS Gas',()=>gv(d,'avCupsG')],['Referencia catastral',()=>gv(d,'avRefCatastral')],['Tensión',()=>gv(d,'avTension')],['IGA (A)',()=>gv(d,'avIga')],['Potencia instalación calculada (kW)',()=>gv(d,'avPotenciaCalculada')],['Potencia para condiciones de suministro (kW)',()=>gv(d,'avPotenciaSolicitada')],['Concepto aclarador',()=>gv(d,'avConcepto')],['Observaciones',()=>gv(d,'avObservaciones')]],out=['Buenos días.','','Solicitamos '+tipo+' para el suministro indicado.','','DATOS DE LA FICHA',''];addUnits(fields,d);if(tipo==='contrato de electricidad'){let p=fields.findIndex(function(f){return f[0]==='Correo electrónico'});fields.splice(p+1,0,['Dirección fiscal / facturación',()=>gv(d,'avDireccionFiscal')],['Correo fiscal / facturación',()=>gv(d,'avEmailFiscal')])}fields.forEach(function(f){out.push(f[0].toLocaleUpperCase('es-ES')+':');out.push(f[1]()||'—');out.push('')});out.push('Un saludo.');return out.join('\n')}
// PDF rellenable del cliente. No escribe datos de avisos ni de sincronización.
let clientePdfLibPromise=null;
function clientePdfLib(){
 if(window.PDFLib)return Promise.resolve(window.PDFLib);
 if(!clientePdfLibPromise)clientePdfLibPromise=new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.src=new URL('./assets/pdf-lib.min.js',window.location.href).href;
  s.onload=()=>window.PDFLib?resolve(window.PDFLib):reject(new Error('No se pudo iniciar el generador PDF.'));
  s.onerror=()=>{s.remove();clientePdfLibPromise=null;reject(new Error('No se pudo cargar el generador PDF. Conecta a Internet y vuelve a intentarlo.'))};document.head.appendChild(s);
 });return clientePdfLibPromise;
}
async function crearClientePdf(w,d,empresa,lib){
 const {PDFDocument,StandardFonts,rgb}=lib,pdf=await PDFDocument.create(),page=pdf.addPage([595.28,841.89]),form=pdf.getForm();
 const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const ink=rgb(.10,.15,.23),muted=rgb(.36,.41,.48),red=rgb(.90,.15,.11),line=rgb(.79,.83,.88),pale=rgb(.97,.98,1);
 const text=v=>Array.from(S(v).replace(/[\r\n\t]+/g,' ')).map(c=>{try{regular.encodeText(c);return c}catch(_){return '-'}}).join('');
 function write(v,x,top,size=9,font=regular,color=ink){page.drawText(text(v),{x,y:841.89-top-size,size,font,color})}
 function wrap(v,width,size=9,font=regular){const lines=[];let row='';for(const word of text(v).split(/\s+/)){if(!word)continue;let chunks=[''];for(const c of word){let k=chunks.length-1;if(font.widthOfTextAtSize(chunks[k]+c,size)>width)chunks.push(c);else chunks[k]+=c}for(const chunk of chunks){const next=row?row+' '+chunk:chunk;if(font.widthOfTextAtSize(next,size)>width&&row){lines.push(row);row=chunk}else row=next}}if(row)lines.push(row);return lines}
 async function logo(src,x,top,width,height){
  const data=await new Promise((resolve,reject)=>{const im=new Image(),tm=setTimeout(()=>reject(new Error('No se pudo cargar uno de los logos.')),12000);im.onload=()=>{clearTimeout(tm);try{const c=document.createElement('canvas');c.width=Math.min(im.naturalWidth,900);c.height=Math.max(1,Math.round(im.naturalHeight*c.width/im.naturalWidth));const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.95))}catch(e){reject(e)}};im.onerror=()=>{clearTimeout(tm);reject(new Error('No se pudo cargar uno de los logos.'))};im.src=src});
  const image=await pdf.embedJpg(data),scale=Math.min(width/image.width,height/image.height),iw=image.width*scale,ih=image.height*scale;
  page.drawImage(image,{x:x+(width-iw)/2,y:841.89-top-height+(height-ih)/2,width:iw,height:ih});
 }
 await logo(empresa.logoData,36,20,110,40);
 await logo(new URL('./assets/logo_e-distribucion.jpg',window.location.href).href,469,20,90,40);
 write('EMPRESA INSTALADORA',36,66,7,bold,muted);write('DISTRIBUIDORA',469,66,7,bold,muted);
 let top=82;
 const lines=[empresa.nombreComercial||empresa.nombre,empresa.nombreComercial&&empresa.nombre&&empresa.nombre!==empresa.nombreComercial?empresa.nombre:'',empresa.nif?'NIF/CIF: '+empresa.nif:'',[empresa.direccion,empresa.cp,empresa.localidad,empresa.provincia].filter(Boolean).join(' · '),[empresa.telefono,empresa.email,empresa.web].filter(Boolean).join(' · ')].filter(Boolean);
 lines.forEach((v,i)=>wrap(v,523,i?8:11,i?regular:bold).forEach(row=>{write(row,36,top,i?8:11,i?regular:bold);top+=i?10:15}));
 if(top>180)throw new Error('Los datos de empresa son demasiado largos para la cabecera. Revisa Configuración.');
 top+=7;page.drawRectangle({x:36,y:841.89-top,width:523,height:3,color:red});top+=10;
 write('FICHA DE DATOS DEL CLIENTE',36,top,16,bold);top+=23;
 write('Revise los datos y complete los campos para el boletín y/o contrato.',36,top,9);top+=12;
 write('Guarde el PDF antes de devolverlo.',36,top,9);top+=16;
 write('AVISO '+(gv(d,'avId')||'NUEVO')+'  ·  '+new Date().toLocaleDateString('es-ES'),36,top,8,bold,muted);top+=19;
 function section(label){write(label,36,top,9,bold,red);top+=17}
 function field(name,label,value,x,width,height=18,multi=false){write(label,x,top,7.5,bold,muted);const f=form.createTextField(name);if(multi)f.enableMultiline();f.setText(text(value));f.addToPage(page,{x,y:841.89-top-11-height,width,height,borderWidth:.6,borderColor:line,backgroundColor:pale,textColor:ink,font:regular});f.setFontSize(multi?8:0);f.updateAppearances(regular)}
 function pair(a,b){field(a[0],a[1],gv(d,a[2]),36,254);field(b[0],b[1],gv(d,b[2]),305,254);top+=34}
 function full(name,label,id,height=18,multi=false){field(name,label,gv(d,id),36,523,height,multi);top+=height+16}
 section('01  DATOS DEL CLIENTE');
 pair(['cliente','Nombre / Razón social','avCliente'],['nif','DNI / NIE / NIF / CIF','avNif']);
 field('contacto','Persona de contacto',gv(d,'avContacto'),36,167);field('telefono','Teléfono',gv(d,'avTelefono'),214,125);field('email','Correo electrónico',gv(d,'avEmail'),350,209);top+=34;
 section('02  DATOS DE SUMINISTRO');
 full('direccion','Dirección del suministro','avDireccion');
 field('piso','Piso',gv(d,'avPiso'),36,74);field('puerta','Puerta',gv(d,'avPuerta'),124,74);field('cp','Código postal',gv(d,'avCp'),212,90);field('localidad','Localidad',gv(d,'avLocalidad'),316,243);top+=34;
 pair(['provincia','Provincia','avProvincia'],['refCatastral','Referencia catastral','avRefCatastral']);
 pair(['cupsE','CUPS electricidad (si dispone de él)','avCupsE'],['cupsG','CUPS gas (si dispone de él)','avCupsG']);
 section('03  DATOS ELÉCTRICOS');
 field('tension','Tensión',gv(d,'avTension'),36,125);field('iga','IGA (A)',gv(d,'avIga'),172,70);field('potenciaInstalada','Potencia calculada (kW)',gv(d,'avPotenciaCalculada'),253,147);field('potenciaSolicitada','Potencia solicitada (kW)',gv(d,'avPotenciaSolicitada'),411,148);top+=34;
 section('04  FACTURACIÓN Y OBSERVACIONES');
 pair(['direccionFiscal','Dirección fiscal / facturación','avDireccionFiscal'],['emailFiscal','Correo de facturación','avEmailFiscal']);
 full('iban','IBAN (si procede para la contratación)','s132Iban');
 field('concepto','Concepto / motivo de la solicitud',gv(d,'avConcepto'),36,254,30,true);field('observaciones','Observaciones / correcciones',gv(d,'avObservaciones'),305,254,30,true);top+=46;
 // Keep the handwritten signature separate from text fields so mobile PDF readers can draw on it.
 if(top+116>783)throw new Error('Los datos de empresa ocupan demasiado espacio. Reduce la cabecera en Configuración.');
 section('05  FIRMA DEL CLIENTE');
 field('firmante','Nombre y apellidos del firmante','',36,350);field('fechaFirma','Fecha de firma (DD/MM/AAAA)','',400,159);top+=34;
 page.drawRectangle({x:36,y:841.89-top-46,width:523,height:46,borderWidth:.7,borderColor:line});
 write('Firma manuscrita del cliente',44,top+5,7.5,regular,muted);top+=52;
 write('En el móvil: abra el PDF en un lector con «Rellenar y firmar», firme con el dedo y guarde una copia.',36,top,7.5,regular,muted);
 const returnLines=wrap('Devuelva el PDF completado y firmado por WhatsApp en la conversación recibida'+(empresa.email?' o por correo a '+empresa.email:'')+'.',523,8);
 returnLines.forEach((row,i)=>write(row,36,799+i*11,8,regular,muted));
 pdf.setTitle('Ficha rellenable de datos del cliente');pdf.setAuthor(text(empresa.nombreComercial||empresa.nombre));pdf.setSubject('Datos del cliente y del suministro');
 form.updateFieldAppearances(regular);return pdf.save();
}
function telefonoClienteWhatsApp(value){
 const raw=S(value).trim();if(!/^[+\d\s().-]+$/.test(raw))return '';
 let n=raw.replace(/\D/g,'');if(n.startsWith('00'))n=n.slice(2);
 if(/^[6789]\d{8}$/.test(n)&&!raw.startsWith('+'))n='34'+n;
 return /^[1-9]\d{7,14}$/.test(n)?n:'';
}
async function formularioCliente(){
 const w=frame();if(!w)return;const d=w.document;
 let p;try{p=JSON.parse(w.localStorage.getItem('APP_AVISOS_WEB_DATOS_V116_PERSISTENTE')||'{}')}catch(_){p={}}
 const empresa=p.empresa||{};
 if(!(empresa.nombre||empresa.nombreComercial)||!empresa.logoData){w.alert('Guarda primero el nombre y el logo de vuestra empresa en Configuración para incluirlos en el formulario.');return}
 const existing=d.getElementById('s135ClientePdfDialog');if(existing){existing.focus();return}
 const dialog=d.createElement('dialog');dialog.id='s135ClientePdfDialog';dialog.setAttribute('aria-label','Formulario PDF para el cliente');dialog.style.cssText='max-width:520px;width:calc(100% - 40px);box-sizing:border-box;border:1px solid #dbe3ee;border-radius:16px;padding:22px;color:#182033;max-height:90vh;overflow:auto';
 dialog.innerHTML='<h2 style="margin-top:0">Formulario para el cliente</h2><p>PDF rellenable con vuestro logo, el de e-distribución y los datos de empresa. El cliente puede rellenarlo desde el móvil y añadir su firma con un lector PDF compatible.</p><p role="status" data-status>Preparando formulario…</p><div style="display:grid;gap:9px"><button type="button" data-preview disabled>VER PDF</button><button type="button" data-download disabled>DESCARGAR PDF</button><button type="button" data-share disabled>WHATSAPP / COMPARTIR PDF</button><button type="button" data-whatsapp disabled>ABRIR WHATSAPP DEL CLIENTE</button><button type="button" data-mail disabled>PREPARAR CORREO AL CLIENTE</button><button type="button" data-close>CERRAR</button></div><p style="font-size:12px;color:#667085">Para enviarlo por correo, descarga el PDF y adjúntalo al mensaje. El correo no añade el archivo automáticamente. En el móvil: abre el PDF en un lector con «Rellenar y firmar», completa los campos, firma con el dedo y guarda una copia. Para WhatsApp, pulsa compartir y elige WhatsApp. Si no es compatible, descarga el PDF y adjúntalo como Documento en el chat; abrir el chat no adjunta el archivo.</p>';
 d.body.appendChild(dialog);dialog.showModal();let url='',file=null;const status=dialog.querySelector('[data-status]');dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.remove();if(url)setTimeout(()=>URL.revokeObjectURL(url),60000)},{once:true});
 try{
  const lib=await clientePdfLib(),bytes=await crearClientePdf(w,d,empresa,lib);if(!dialog.isConnected)return;
  const filename='SOLTEC_DATOS_CLIENTE_'+(gv(d,'avId').replace(/[^a-zA-Z0-9_-]/g,'')||'NUEVO')+'.pdf';file=new File([bytes],filename,{type:'application/pdf'});url=URL.createObjectURL(file);
  status.textContent='Formulario listo. Revisa el PDF antes de enviarlo.';
  dialog.querySelectorAll('button').forEach(b=>b.disabled=false);
  dialog.querySelector('[data-preview]').onclick=()=>{const a=d.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.click()};
  dialog.querySelector('[data-download]').onclick=()=>{const a=d.createElement('a');a.href=url;a.download=filename;d.body.appendChild(a);a.click();a.remove()};
  const share=dialog.querySelector('[data-share]');
  share.onclick=async()=>{try{
   if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
    status.textContent='Elige WhatsApp y el contacto al que quieres enviar el PDF.';
    await navigator.share({files:[file],title:'Formulario de datos y firma del cliente',text:'Por favor, complete el PDF, firme con el dedo en un lector con Rellenar y firmar, guarde una copia y devuélvala por este chat.'});
   }else{dialog.querySelector('[data-download]').click();status.textContent='PDF descargado. Abre WhatsApp y adjúntalo como Documento en el chat del cliente.'}
  }catch(e){if(e.name!=='AbortError')status.textContent='No se pudo compartir. Descarga el PDF, abre WhatsApp y adjúntalo como Documento.'}};
  dialog.querySelector('[data-whatsapp]').onclick=()=>{
   const phone=telefonoClienteWhatsApp(gv(d,'avTelefono'));
   const message='Buenos días. Le enviaremos un PDF para revisar y completar los datos del boletín y/o contrato. Ábralo en un lector PDF con Rellenar y firmar, firme con el dedo, guarde una copia y devuélvala por este chat. Gracias.';
   const a=d.createElement('a');a.href='https://wa.me/'+phone+'?text='+encodeURIComponent(message);a.target='_blank';a.rel='noopener';d.body.appendChild(a);a.click();a.remove();
   status.textContent='Adjunta el PDF descargado como Documento. El chat no adjunta el archivo automáticamente.';
  };
  const to=gv(d,'avEmail'),subject='Formulario de datos - '+(gv(d,'avDireccion')||gv(d,'avCliente')||'suministro'),body=['Buenos días,','','Adjuntamos el formulario de datos del cliente. Por favor, revise los datos, complete los campos para el boletín y/o contrato, añada su firma y guarde el PDF antes de devolverlo'+(empresa.email?' a '+empresa.email: ' respondiendo a este correo')+'.','','Muchas gracias.',empresa.nombreComercial||empresa.nombre,empresa.telefono||'',empresa.email||''].filter((v,i,a)=>v||i<4).join('\n');
  dialog.querySelector('[data-mail]').onclick=()=>{w.location.href='mailto:'+encodeURIComponent(to)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);status.textContent='Adjunta al correo el PDF descargado antes de enviarlo.'};
 }catch(e){if(dialog.isConnected)status.textContent='No se pudo crear el formulario: '+(e.message||e)}
}

function datosClienteText(d){let fields=[['Dirección del suministro',()=>gv(d,'avDireccion')],['Cliente / Razón social',()=>gv(d,'avCliente')],['Nombre persona de contacto',()=>gv(d,'avContacto')],['DNI / NIF / CIF',()=>gv(d,'avNif')],['Teléfono',()=>gv(d,'avTelefono')],['Correo electrónico',()=>gv(d,'avEmail')],['IBAN',()=>iban(d)],['CP',()=>gv(d,'avCp')],['Población / Localidad',()=>gv(d,'avLocalidad')],['Provincia',()=>gv(d,'avProvincia')],['CUPS Electricidad',()=>gv(d,'avCupsE')],['CUPS Gas',()=>gv(d,'avCupsG')],['Referencia catastral',()=>gv(d,'avRefCatastral')],['Concepto aclarador',()=>gv(d,'avConcepto')],['Observaciones',()=>gv(d,'avObservaciones')]],out=['Buenos días.','','Por favor, revise y complete los siguientes datos para mantener actualizada la ficha del suministro.','','DATOS DEL CLIENTE',''];addUnits(fields,d);fields.forEach(function(f){out.push(f[0].toLocaleUpperCase('es-ES')+':');out.push(f[1]()||'____________________________');out.push('')});out.push('Gracias.','Un saludo.');return out.join('\n')}
function correoComercializadora(w,d){let chosen=gv(d,'s135Com1Notice');if(chosen)return chosen;try{let c=JSON.parse(w.localStorage.getItem('APP_AVISOS_CONFIG_V127')||'{}'),m=c.emails||{},a=Array.isArray(m.comercializadora1Lista)?m.comercializadora1Lista:[];return S(m.comercializadora1||a[0]||'').trim()}catch(e){return''}}function abrir(tipo){if(tipo==='cliente'){formularioCliente();return}let w=frame();if(!w)return;let d=w.document,dir=gv(d,'avDireccion'),to='',sub='',body='';if(tipo==='cliente'){to=gv(d,'avEmail');sub='Datos cliente - '+(dir||gv(d,'avCliente')||'suministro');body=datosClienteText(d)}else{to=correoComercializadora(w,d);sub=tipo==='contrato'?(dir||'Solicitud contrato de electricidad'):('Condiciones de suministro - '+(dir||gv(d,'avCliente')||'suministro'));body=avisoText(d,tipo==='contrato'?'contrato de electricidad':'condiciones de suministro')}let url='mailto:'+encodeURIComponent(to)+'?subject='+encodeURIComponent(sub)+'&body='+encodeURIComponent(body);try{w.location.href=url}catch(e){try{w.open(url,'_blank')}catch(x){}}}
function inject(d){let box=d.getElementById('av135Solicitudes');if(!box){box=d.createElement('div');box.id='av135Solicitudes';box.className='wide';box.innerHTML='<div class="sectionTitle">Solicitudes y datos por correo</div><div class="grid2" style="margin-bottom:10px"><label class="wide">Dirección fiscal / de facturación (solo contrato)<input id="avDireccionFiscal" autocomplete="street-address"></label><label class="wide">Correo fiscal / de facturación (solo contrato)<input id="avEmailFiscal" type="email" autocomplete="email"></label></div><div class="row" style="align-items:stretch"><button type="button" id="avBtnCondSum">Condiciones de suministro</button><button type="button" class="primary" id="avBtnContratoElec">Contrato de electricidad</button></div><button type="button" id="avBtnDatosCliente" class="full" style="margin-top:10px">✉ Datos al cliente · PDF rellenable</button><p class="muted" style="margin:8px 0 0">Los datos fiscales solo se incluyen en el contrato; no aparecen en la memoria CNMC.</p>'}let a=d.getElementById('avBtnCondSum'),b=d.getElementById('avBtnContratoElec'),c=d.getElementById('avBtnDatosCliente');if(a)a.onclick=function(){abrir('condiciones')};if(b)b.onclick=function(){abrir('contrato')};if(c)c.onclick=function(){abrir('cliente')};return box}
function editing(d){let a=d&&d.activeElement;if(!a||!a.closest||!a.closest('#formAviso'))return false;let t=String(a.tagName||'').toUpperCase();return t==='INPUT'||t==='TEXTAREA'||t==='SELECT'||!!a.isContentEditable}
function after(parent,node,ref){if(parent&&node&&ref&&ref.parentNode===parent&&ref.nextSibling!==node)parent.insertBefore(node,ref.nextSibling)}
function hideOldFlags(d){['s132CondFlag','s132Contrato'].forEach(function(id){let n=d.getElementById(id),sw=n&&n.closest?n.closest('.s132switch'):null;if(sw)sw.style.display='none'})}
function stableLayout(){layout();let w=frame(),d=w&&w.document;if(!d||editing(d))return;let address=lab(d,'avDireccion'),floor=lab(d,'avPiso'),door=lab(d,'avPuerta');if(!address||!floor||!door)return;if(address.nextElementSibling!==floor)address.insertAdjacentElement('afterend',floor);if(floor.nextElementSibling!==door)floor.insertAdjacentElement('afterend',door)}
function cartoDetails(d){let det=d.getElementById('av135CartoDetails'),old=det||d.querySelector('#formAviso .cartoBox');if(!old)return null;if(!det){if(old.tagName&&old.tagName.toLowerCase()==='details'){old.id='av135CartoDetails';det=old}else{det=d.createElement('details');det.id='av135CartoDetails';det.className=old.className;det.open=true;let sum=d.createElement('summary');sum.id='av135CartoSummary';sum.style.cssText='cursor:pointer;font-size:14px;font-weight:900;color:#24466e;padding:4px 0 8px';sum.textContent='📍 CartoCiudad · dirección y coordenadas';det.appendChild(sum);while(old.firstChild)det.appendChild(old.firstChild);old.replaceWith(det);let first=det.querySelector(':scope > strong');if(first)first.style.display='none'}}let res=d.getElementById('cartoResultados');if(res&&!res.dataset.av135Collapse){res.dataset.av135Collapse='1';res.addEventListener('click',function(ev){let b=ev.target&&ev.target.closest?ev.target.closest('.cartoResult'):null;if(!b)return;setTimeout(function(){let x=d.getElementById('av135CartoDetails');if(x&&gv(d,'avDireccion')){x.open=false;x.dataset.av135Key=[gv(d,'avId'),gv(d,'avDireccion'),gv(d,'avLatitud'),gv(d,'avLongitud')].join('|');let s=d.getElementById('av135CartoSummary');if(s)s.textContent='📍 CartoCiudad · '+gv(d,'avDireccion')}let p=d.getElementById('s133PlanBox');if(p&&p.tagName.toLowerCase()==='details'&&!planSaved(d))p.open=true},450)},true)}let key=[gv(d,'avId'),gv(d,'avDireccion'),gv(d,'avLatitud'),gv(d,'avLongitud')].join('|');if(det.dataset.av135Key!==key){det.dataset.av135Key=key;let ready=!!(gv(d,'avDireccion')&&gv(d,'avLatitud')&&gv(d,'avLongitud'));det.open=!ready;let s=d.getElementById('av135CartoSummary');if(s)s.textContent=ready?'📍 CartoCiudad · '+gv(d,'avDireccion'):'📍 CartoCiudad · dirección y coordenadas'}return det}
function planSaved(d){let im=d.getElementById('s133PlanImg'),st=d.getElementById('s133PlanStatus');return !!((im&&im.style.display==='block'&&im.getAttribute('src'))||(st&&/PLANO GUARDADO/i.test(st.textContent||'')))}
function syncPlan(d,collapse){let det=d.getElementById('s133PlanBox');if(!det||det.tagName.toLowerCase()!=='details')return;let sum=d.getElementById('av135PlanSummary'),saved=planSaved(d),prev=det.dataset.av135Saved;if(sum)sum.textContent=saved?'✅ Plano de situación guardado':'🗺 Plano de situación';if(saved&&(collapse||prev!=='1'))det.open=false;if(!saved&&prev==='1')det.open=true;det.dataset.av135Saved=saved?'1':'0'}
function planDetails(d){let box=d.getElementById('s133PlanBox');if(!box)return null;if(box.tagName.toLowerCase()!=='details'){let det=d.createElement('details');det.id='s133PlanBox';det.className=box.className;det.open=!planSaved(d);let sum=d.createElement('summary');sum.id='av135PlanSummary';sum.style.cssText='cursor:pointer;font-size:14px;font-weight:900;color:#24466e;padding:4px 0 8px';sum.textContent='🗺 Plano de situación';det.appendChild(sum);while(box.firstChild)det.appendChild(box.firstChild);box.replaceWith(det);let title=det.querySelector(':scope > .sectionTitle');if(title)title.style.display='none';box=det}syncPlan(d,false);let st=d.getElementById('s133PlanStatus');if(st&&!st.dataset.av135Observe){st.dataset.av135Observe='1';try{planObs=new MutationObserver(function(){syncPlan(d,true)});planObs.observe(st,{childList:true,subtree:true,characterData:true})}catch(e){}}return box}
function layout(){loadSalida();let w=frame();if(!w)return;let d=w.document,grid=d.querySelector('#formAviso .grid2');if(!grid||editing(d))return;hideOldFlags(d);let title=Array.from(grid.querySelectorAll('.sectionTitle')).find(function(x){return /FICHA DE CLIENTE|CLIENTE Y SUMINISTRO/i.test(x.textContent||'')});let address=lab(d,'avDireccion'),client=lab(d,'avCliente'),contact=lab(d,'avContacto'),nif=lab(d,'avNif'),phone=lab(d,'avTelefono'),email=lab(d,'avEmail'),ibanLab=lab(d,'s132Iban'),cp=lab(d,'avCp'),local=lab(d,'avLocalidad'),prov=lab(d,'avProvincia'),ref=lab(d,'avRefCatastral'),cupsE=lab(d,'avCupsE'),cupsG=lab(d,'avCupsG');if(!title||!address||!phone||!email||!ibanLab||!cp||!local||!prov)return;[address,client,contact,nif,phone,email,ibanLab,cp,local,prov,ref].forEach(function(n){if(n)n.classList.add('wide')});let chain=title;[address,client,contact,nif,phone,email,ibanLab,cp,local,prov,ref].forEach(function(n){if(n){after(grid,n,chain);chain=n}});let cli=d.getElementById('s132CliExtra');if(cli)cli.style.display='none';let cart=cartoDetails(d);if(cart){after(grid,cart,chain);chain=cart}let plan=planDetails(d);if(plan){after(grid,plan,chain);chain=plan}if(cupsE){cupsE.classList.add('wide');after(grid,cupsE,chain);chain=cupsE}if(cupsG){cupsG.classList.add('wide');after(grid,cupsG,chain);chain=cupsG}let note=cupsG?cupsG.nextElementSibling:null;if(!(note&&note.classList&&note.classList.contains('muted')))note=null;if(note){note.classList.add('wide');after(grid,note,chain);chain=note}let cupsReq=d.getElementById('s132CupsReq');if(cupsReq){after(grid,cupsReq,chain);chain=cupsReq}let mail=inject(d);if(mail){after(grid,mail,chain);chain=mail}let i=d.getElementById('avCupsE'),j=d.getElementById('avCupsG');if(i){i.placeholder='CUPS electricidad';i.autocomplete='off'}if(j){j.placeholder='CUPS gas';j.autocomplete='off'}done=true}
function init(){stableLayout();if(started)return;started=true;setTimeout(stableLayout,300);setTimeout(stableLayout,1000);setTimeout(stableLayout,2200)}
window.Soltec135AvisosCliente={init:init,version:B,contrato:function(){abrir('contrato')},condiciones:function(){abrir('condiciones')},datosCliente:function(){abrir('cliente')}};init();
})();


