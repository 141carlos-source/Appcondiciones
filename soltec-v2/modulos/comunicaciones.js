// SOLTEC V2 · Ficha PDF del cliente, firma con el dedo, resumen de WhatsApp y correos.
// Preparar una comunicación no es enviarla: el historial lo distingue.

import { h, ico, toast, abrirBlob, compartir, puedeCompartirArchivos, descargar, fecha, lienzoFirma } from '../ui.js';
import { generarFicha, nombreFicha, resumenWhatsApp, enlaceWhatsApp, telefonoWhatsApp, correo, enlaceCorreo, TIPOS_CORREO } from '../core/documentos.js';
import { faltaParaFormulario } from '../core/empresa.js';
import { datosPendientes, normalizarAviso, hoyLocal, pdfCondicionesActual, boletinActual } from '../core/model.js';
import { leerEmpresa } from './empresa.js';
import { panelRecibir } from './recepcion.js';
import { paqueteFicha, enlaceFormulario, correoFormulario, emlBorrador, URL_PUBLICA } from '../core/fichaCliente.js';

let cargaPdfLib = null;
/** Carga pdf-lib solo cuando hace falta (pesa ~500 KB). */
export function cargarPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  cargaPdfLib ??= new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = './vendor/pdf-lib.min.js';
    s.onload = () => ok(window.PDFLib);
    s.onerror = () => { cargaPdfLib = null; mal(new Error('No se pudo cargar el generador de PDF.')); };
    document.head.append(s);
  });
  return cargaPdfLib;
}

/** Imagen guardada → {bytes, mime} en PNG o JPG (los demás formatos se convierten a PNG). */
export async function imagenParaPdf(app, ficha) {
  if (!ficha) return null;
  const f = await app.storage.getFile(ficha.hash);
  if (!f) return null;
  if (/png|jpe?g/.test(f.mime)) return { bytes: new Uint8Array(f.bytes), mime: f.mime };
  const url = URL.createObjectURL(new Blob([f.bytes], { type: f.mime }));
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth || 600; cv.height = img.naturalHeight || 200;
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise((ok) => cv.toBlob(ok, 'image/png'));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: 'image/png' };
  } finally { URL.revokeObjectURL(url); }
}

/** Logo pequeño (data:URL) para el enlace del formulario: el cliente ve quién le pide los datos.
 *  Se reduce hasta que ocupa poco (los enlaces muy largos los cortan algunas apps); si no cabe, no va. */
export async function logoParaEnlace(app, ficha, limite = 12000) {
  if (!ficha) return null;
  try {
    const f = await app.storage.getFile(ficha.hash);
    if (!f) return null;
    const url = URL.createObjectURL(new Blob([f.bytes], { type: f.mime }));
    try {
      const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
      const w0 = img.naturalWidth || 600, h0 = img.naturalHeight || 200;
      for (const [mw, mh] of [[240, 80], [180, 60], [130, 44]]) {
        const k = Math.min(1, mw / w0, mh / h0);
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(w0 * k)); cv.height = Math.max(1, Math.round(h0 * k));
        const cx = cv.getContext('2d');
        cx.drawImage(img, 0, 0, cv.width, cv.height);
        const png = cv.toDataURL('image/png');
        if (png.length <= limite) return png;
        cx.globalCompositeOperation = 'destination-over'; cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
        for (const q of [0.8, 0.6]) { const jpg = cv.toDataURL('image/jpeg', q); if (jpg.length <= limite) return jpg; }
      }
      return null;
    } finally { URL.revokeObjectURL(url); }
  } catch { return null; }
}

async function logoEdist() {
  try { const r = await fetch('./assets/logo_e-distribucion.jpg'); return { bytes: new Uint8Array(await r.arrayBuffer()), mime: 'image/jpeg' }; } catch { return null; }
}

export async function crearFichaPdf(app, aviso, firma = null) {
  const [PDFLib, empresa] = await Promise.all([cargarPdfLib(), leerEmpresa(app)]);
  const [logo, edist] = await Promise.all([imagenParaPdf(app, empresa.logo), logoEdist()]);
  const bytes = await generarFicha(PDFLib, { aviso, empresa, logo, edist, firma });
  return new Blob([bytes], { type: 'application/pdf' });
}

const nombreEmpresaCorta = (e) => e?.empresa?.nombreComercial || e?.empresa?.nombre || 'su instalador';

const proximoSeguimiento = async (app, avisoId) => {
  const c = (await app.storage.listByRef(avisoId, 'cita')).filter((x) => !x.deleted && !x.data.hecho).sort((a, b) => ((a.data.fecha || '') + (a.data.hora || '')).localeCompare((b.data.fecha || '') + (b.data.hora || '')))[0];
  return c ? { fecha: c.data.fecha, hora: c.data.hora } : null;
};

/** Bloque «Solicitudes y comunicaciones» de la ficha del aviso. */
export async function bloqueComunicaciones(app, avisoId) {
  const panel = h('div');
  const leer = async () => normalizarAviso((await app.storage.get(avisoId)).data);
  const sinGuardar = () => { if (app.guardia?.()) { toast('Guarda primero los cambios del aviso', true); return true; } return false; };
  const empresa = await leerEmpresa(app);
  const faltaEmpresa = faltaParaFormulario(empresa);

  const whatsapp = async () => {
    if (sinGuardar()) return;
    const aviso = await leer();
    const texto = h('textarea', { rows: 12, id: 'texto-whatsapp', value: resumenWhatsApp({ aviso, empresa, seguimiento: await proximoSeguimiento(app, avisoId) }) });
    const tel = telefonoWhatsApp(aviso.cliente?.telefono);
    panel.replaceChildren(h('div', { class: 'card' },
      h('b', {}, 'Resumen para WhatsApp'), h('p', { class: 'muted' }, 'Puedes editarlo antes de enviarlo.'), texto,
      tel ? null : h('div', { class: 'aviso info' }, 'El teléfono del cliente no es un móvil español: WhatsApp se abrirá sin destinatario.'),
      h('div', { class: 'fila' },
        h('button', { class: 'btn peq', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(texto.value); toast('Texto copiado'); } catch { texto.select(); toast('Selecciona y copia el texto', true); } } }, 'Copiar'),
        h('button', { class: 'btn peq prim', type: 'button', onclick: async () => {
          window.open(enlaceWhatsApp(aviso.cliente?.telefono, texto.value), '_blank', 'noopener');
          await app.storage.addEvent(avisoId, 'doc_preparada', 'Resumen abierto en WhatsApp (el envío se confirma en WhatsApp)');
          marcarEnviado('Resumen por WhatsApp');
        } }, 'Abrir WhatsApp'))));
  };

  const marcarEnviado = (que) => panel.append(h('div', { class: 'aviso info' }, `¿Has enviado el mensaje? `,
    h('button', { class: 'btn peq', type: 'button', onclick: async (e) => { await app.storage.addEvent(avisoId, 'doc_enviada', `${que}: enviado`); e.target.closest('.aviso').replaceChildren('Anotado como enviado en el historial.'); } }, 'Sí, marcar como enviado')));

  // --- Correos a la distribuidora y a la comercializadora: se ven (y se pueden cambiar) antes de enviarlos
  const ADJUNTOS_DE = { condiciones: ['memoria', 'plano_a5', 'plano', 'ficha_firmada', 'ficha_cliente'], contrato: ['condiciones', 'boletin', 'ficha_firmada', 'ficha_cliente', 'cert_tierra'] };
  const adjuntosAviso = (aviso) => {
    // Del boletín, solo la última versión
    const bol = boletinActual(aviso);
    const out = (aviso.archivos || []).filter((x) => x.tipo !== 'boletin' || x === bol).map((x) => ({ ...x }));
    const cond = pdfCondicionesActual(aviso);
    if (cond) out.unshift({ ...cond, tipo: 'condiciones' });
    if (aviso.plano?.hash && !out.some((x) => x.hash === aviso.plano.hash)) out.push({ ...aviso.plano, tipo: 'plano', name: aviso.plano.name || 'PLANO_SITUACION' });
    return out;
  };
  const vistaCorreo = (tipo) => async () => {
    if (sinGuardar()) return;
    const aviso = await leer();
    const t = TIPOS_CORREO[tipo];
    const c = correo(tipo, { aviso, empresa, seguimiento: await proximoSeguimiento(app, avisoId) });
    const pend = datosPendientes(aviso, t.destino);
    const para = h('input', { type: 'email', id: 'correo-para', value: c.para, 'data-minusculas': '', placeholder: 'correo@destino.es' });
    const asunto = h('input', { type: 'text', id: 'correo-asunto', value: c.asunto, 'data-minusculas': '' });
    const cuerpo = h('textarea', { rows: 14, id: 'correo-cuerpo', 'data-minusculas': '', value: c.cuerpo });
    const adj = adjuntosAviso(aviso);
    const marcas = adj.map((x) => h('input', { type: 'checkbox', checked: ADJUNTOS_DE[tipo].includes(x.tipo) || null, 'data-adjunto': x.hash }));
    const elegidos = () => adj.filter((_, i) => marcas[i].checked);
    const blobs = async () => {
      const out = [];
      for (const x of elegidos()) { const b = await app.storage.getFileBlob(x.hash); if (b) out.push(new File([b], x.name, { type: x.mime || 'application/pdf' })); else toast(`${x.name}: aún no está en este dispositivo`, true); }
      return out;
    };
    const anotar = async (como) => { await app.storage.addEvent(avisoId, 'doc_preparada', `Correo preparado (${como}): ${t.label}`); marcarEnviado(t.label); };
    const compartible = puedeCompartirArchivos();
    panel.replaceChildren(h('div', { class: 'card', id: 'vista-correo', 'data-tipo': tipo },
      h('b', {}, t.label), h('p', { class: 'muted' }, 'Revisa el correo antes de enviarlo: puedes cambiar cualquier cosa.'),
      pend.length ? h('div', { class: 'aviso err', id: 'correo-faltan' }, h('b', {}, `Faltan ${pend.length} dato(s) en el aviso: `), pend.map((p) => p.etiqueta).join(', '), '. Puedes enviarlo igualmente o completarlos antes.') : null,
      c.para ? null : h('div', { class: 'aviso info' }, tipo === 'condiciones' || tipo === 'contrato' ? 'Falta el correo de destino: escríbelo aquí o guárdalo en Empresa › Correos.' : 'Falta el correo de destino.'),
      h('label', { for: 'correo-para' }, 'Para'), para,
      h('label', { for: 'correo-asunto' }, 'Asunto'), asunto,
      h('label', { for: 'correo-cuerpo' }, 'Texto'), cuerpo,
      h('label', {}, 'Adjuntos'),
      adj.length ? h('ul', { class: 'lista-chk', id: 'correo-adjuntos' }, ...adj.map((x, i) => h('li', {}, h('label', { class: 'check-linea', style: 'flex:1' }, marcas[i], h('span', { class: 'cortar' }, x.name)),
        h('button', { class: 'btn peq', type: 'button', onclick: async () => { const b = await app.storage.getFileBlob(x.hash); b ? abrirBlob(b) : toast('Aún no está en este dispositivo: sincroniza.', true); } }, 'Ver'))))
        : h('p', { class: 'muted' }, 'El aviso no tiene documentos guardados para adjuntar.'),
      h('div', { class: 'acciones' },
        compartible ? h('button', { class: 'btn prim', type: 'button', id: 'correo-compartir', onclick: async () => {
          const files = await blobs();
          try { await navigator.clipboard.writeText(para.value); } catch { /* sin portapapeles */ }
          try { await navigator.share({ files, title: asunto.value, text: cuerpo.value }); toast('Elige tu correo. El destinatario está copiado: pégalo en «Para»'); await anotar('con adjuntos'); } catch (e) { if (e.name !== 'AbortError') toast('No se ha podido compartir', true); }
        } }, 'Enviar con los adjuntos') : null,
        h('button', { class: 'btn' + (compartible ? '' : ' prim'), type: 'button', id: 'correo-abrir', onclick: async () => {
          window.location.href = enlaceCorreo({ para: para.value.trim(), asunto: asunto.value, cuerpo: cuerpo.value });
          await anotar('en la aplicación de correo');
          if (elegidos().length) panel.querySelector('#vista-correo').append(h('div', { class: 'aviso info' }, h('b', {}, 'Adjunta los documentos en el correo: '), 'no se adjuntan solos. «Descargar adjuntos» los guarda en el equipo.'));
        } }, 'Abrir en el correo'),
        compartible ? null : h('button', { class: 'btn', type: 'button', id: 'correo-descargar', onclick: async () => { for (const f of await blobs()) descargar(f, f.name); } }, 'Descargar adjuntos'),
        h('button', { class: 'btn', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(cuerpo.value); toast('Texto copiado'); } catch { cuerpo.select(); toast('Selecciona y copia el texto', true); } } }, 'Copiar texto'))));
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // --- El cliente rellena la ficha él mismo (formulario web con sus datos dentro del enlace)
  const enlaceCliente = async () => {
    if (sinGuardar()) return;
    const aviso = { ...(await leer()), id: avisoId };
    const base = /github\.io$/.test(location.hostname) ? location.href.split('#')[0].replace(/[^/]*$/, '') : URL_PUBLICA;
    // Por correo el enlace va dentro de un botón: puede llevar el logo. Por WhatsApp se ve entero: sin logo, más corto.
    const url = enlaceFormulario(paqueteFicha(aviso, empresa, { logo: await logoParaEnlace(app, empresa.logo) }), base);
    const urlCorta = enlaceFormulario(paqueteFicha(aviso, empresa), base);
    const cl = aviso.cliente || {};
    const nombre = cl.contacto || cl.nombre ? (cl.contacto || cl.nombre).split(' ')[0] : '';
    const saludo = `Hola${nombre ? ' ' + nombre : ''}, le escribimos de ${nombreEmpresaCorta(empresa)}.`;
    const mensaje = `${saludo}\n\nPara tramitar su suministro${aviso.numero ? ' (aviso ' + aviso.numero + ')' : ''} necesitamos que revise y complete sus datos y firme aquí, desde el móvil:\n${urlCorta}\n\nAl terminar, pulse «Reenviar aquí» para devolvernos la ficha firmada. Gracias.`;
    const correoCli = correoFormulario({ url, empresa, nombre, numero: aviso.numero });
    const tel = telefonoWhatsApp(cl.telefono);
    const anotar = (por) => app.storage.addEvent(avisoId, 'doc_preparada', `Enlace del formulario de datos ${por} (el envío se confirma en ${por === 'por correo' ? 'el correo' : 'WhatsApp'})`);
    /** Copia el correo con el botón (formato) para pegarlo en Gmail, Outlook… Devuelve false si el navegador no deja. */
    const copiarCorreo = async () => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([correoCli.html], { type: 'text/html' }), 'text/plain': new Blob([correoCli.texto], { type: 'text/plain' }) })]);
        return true;
      } catch { return false; }
    };
    const pasos = h('div', { id: 'pasos-correo' });
    const paraCli = h('input', { type: 'email', id: 'para-cliente', value: cl.email || '', 'data-minusculas': '', placeholder: 'Correo del cliente' });
    const vistaPrevia = h('iframe', { id: 'vista-correo-cliente', class: 'vista-correo', title: 'Así le llega el correo al cliente', sandbox: '', srcdoc: `<!doctype html><meta charset="utf-8"><body style="margin:12px;background:#fff">${correoCli.html}</body>` });
    const enviarCorreo = async () => {
      if (!paraCli.value.trim()) toast('Falta el correo del cliente', true);
      const copiado = await copiarCorreo();
      // Con el correo copiado, el cuerpo va vacío para pegarlo; si no se pudo copiar, va en texto
      window.location.href = enlaceCorreo({ para: paraCli.value.trim(), asunto: correoCli.asunto, cuerpo: copiado ? '' : correoCli.texto });
      pasos.replaceChildren(h('div', { class: 'aviso ' + (copiado ? 'ok' : 'info') },
        copiado ? [h('b', {}, 'Correo copiado con el botón «ABRIR FORMULARIO AQUÍ». '), 'En el correo que se ha abierto, pega en el texto (Ctrl+V, o mantener pulsado › Pegar) y envía.']
          : [h('b', {}, 'Este navegador no deja copiar el correo con formato: '), 'se ha puesto en texto con el enlace. En el PC puedes usar «Correo para Outlook».']));
      await anotar('por correo'); marcarEnviado('Formulario de datos por correo');
    };
    panel.replaceChildren(h('div', { class: 'card', id: 'panel-enlace-cliente' },
      h('b', {}, 'Pedir los datos al cliente'),
      h('p', { class: 'muted' }, 'Le llega un botón «ABRIR FORMULARIO AQUÍ»: ve sus datos ya puestos, completa lo que falta, firma con el dedo y le devuelve la ficha firmada, que rellena el aviso sola. Los datos van dentro del enlace: no pasan por ningún servidor.'),
      h('label', {}, 'Así le llega el correo'), vistaPrevia,
      h('label', { for: 'para-cliente' }, 'Para'), paraCli,
      tel ? null : h('div', { class: 'aviso info' }, 'El teléfono del cliente no es un móvil español: WhatsApp se abrirá sin destinatario.'),
      h('div', { class: 'acciones' },
        h('button', { class: 'btn prim', type: 'button', id: 'enlace-correo', onclick: enviarCorreo }, 'Enviar por correo (con botón)'),
        h('button', { class: 'btn', type: 'button', id: 'enlace-whatsapp', onclick: async () => { window.open(enlaceWhatsApp(cl.telefono, mensaje), '_blank', 'noopener'); await anotar('por WhatsApp'); marcarEnviado('Formulario de datos por WhatsApp'); } }, 'Enviar por WhatsApp'),
        h('button', { class: 'btn', type: 'button', id: 'enlace-copiar-correo', onclick: async () => { const ok = await copiarCorreo(); toast(ok ? 'Correo copiado: pégalo en el texto del correo' : 'Este navegador no deja copiar con formato', !ok); } }, 'Copiar correo con botón'),
        h('button', { class: 'btn', type: 'button', id: 'enlace-eml', onclick: async () => {
          descargar(new Blob([emlBorrador({ para: paraCli.value.trim(), ...correoCli })], { type: 'message/rfc822' }), `Formulario datos ${aviso.numero || 'cliente'}.eml`);
          toast('Ábrelo: Outlook lo abre listo para enviar'); await anotar('por correo'); marcarEnviado('Formulario de datos por correo');
        } }, 'Correo para Outlook (PC)'),
        h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener', id: 'enlace-ver' }, 'Ver como el cliente')),
      pasos,
      h('details', {}, h('summary', { class: 'muted' }, 'Ver el enlace'),
        h('input', { type: 'text', readonly: true, id: 'enlace-cliente', value: url, 'data-minusculas': '', onclick: (e) => e.target.select() }),
        h('button', { class: 'btn peq', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(url); toast('Enlace copiado'); } catch { toast('Selecciona y copia el enlace', true); } } }, 'Copiar enlace'))));
  };

  // --- Leer lo que devuelve el cliente: se aplica solo al aviso (PDF o mensaje); se puede deshacer
  const leerDevuelta = () => { if (sinGuardar()) return; panel.replaceChildren(panelRecibir(app, { avisoId })); };

  // Pasos del trámite: datos del cliente → condiciones (distribuidora) → contrato (comercializadora)
  const av = await leer();
  const estadoDoc = (id) => av.docs?.[id] === 'recibido' ? h('span', { class: 'insignia ok' }, 'Recibido') : null;
  const paso = (n, titulo, insignia, desc, ...botones) => {
    const caja = h('div', { class: 'paso-com', 'data-paso': n });
    caja.addEventListener('click', (e) => { if (e.target.closest('button[data-accion]')) caja.append(panel); }, true);
    caja.append(h('div', { class: 'tarjeta-cab' }, h('b', {}, `${n} · ${titulo}`), insignia), h('p', { class: 'muted' }, desc), h('div', { class: 'acciones' }, ...botones));
    return caja;
  };
  const boton = (id, texto, onclick, prim) => h('button', { class: 'btn' + (prim ? ' prim' : ''), type: 'button', id, 'data-accion': '', onclick }, texto);
  return h('div', { id: 'comunicaciones' },
    faltaEmpresa.length ? h('div', { class: 'aviso info' }, `Configura ${faltaEmpresa.join(' y ')} de la empresa (sale en el formulario y en los PDF). `, h('a', { href: '#/empresa' }, 'Ir a Empresa')) : null,
    paso(1, 'Datos del cliente', estadoDoc('firmado'), 'Formulario web: el cliente completa y firma desde el móvil, y al devolverlo el aviso se rellena solo.',
      boton('btn-enlace-cliente', 'Pedir datos al cliente', enlaceCliente, true),
      boton('btn-leer-devuelta', 'Recibir ficha devuelta', leerDevuelta),
      h('a', { class: 'btn', href: `#/firma/${avisoId}` }, 'Firmar aquí (cliente delante)')),
    paso(2, 'Condiciones de suministro', av.lleva?.condiciones === 'no' || av.lleva?.boletin === 'no' ? h('span', { class: 'insignia' }, 'No lleva') : estadoDoc('condiciones') || (av.condiciones?.ref ? h('span', { class: 'insignia ok' }, 'Ref. ' + av.condiciones.ref) : null), 'Correo a la distribuidora con los datos del suministro y los documentos del aviso.',
      boton('btn-correo-condiciones', 'Solicitar condiciones', vistaCorreo('condiciones'), true)),
    paso(3, 'Contrato de electricidad', estadoDoc('contrato'), 'Correo a la comercializadora con el titular, el CUPS y la potencia. Se adjuntan el boletín y las condiciones si los tiene el aviso.',
      boton('btn-correo-contrato', 'Solicitar contrato', vistaCorreo('contrato'), true)),
    h('details', { class: 'paso-com otros' }, h('summary', {}, 'Otros mensajes'),
      h('div', { class: 'acciones' }, boton('btn-whatsapp', 'Resumen de lo pendiente por WhatsApp', whatsapp))),
    panel);
}

// ---------------------------------------------------------------- firma con el dedo
export async function vistaFirma(app, avisoId) {
  const reg = await app.storage.get(avisoId);
  if (!reg) return h('div', {}, h('h1', {}, 'Aviso no encontrado'));
  const aviso = normalizarAviso(reg.data);
  const empresa = await leerEmpresa(app);
  const falta = faltaParaFormulario(empresa);
  const lienzo = lienzoFirma('lienzo-firma');
  const nombre = h('input', { type: 'text', id: 'firmante', value: aviso.cliente?.contacto || aviso.cliente?.nombre || '' });
  const resultado = h('div');

  const generar = async () => {
    if (lienzo.vacio()) { toast('Falta la firma', true); return; }
    if (!nombre.value.trim()) { toast('Escribe el nombre de quien firma', true); nombre.focus(); return; }
    const png = await lienzo.png();
    const hoy = hoyLocal().split('-').reverse().join('/');
    try {
      const blob = await crearFichaPdf(app, { ...aviso, id: avisoId }, { png, nombre: nombre.value.trim(), fecha: hoy });
      const nom = nombreFicha(aviso, true);
      await app.storage.addEvent(avisoId, 'firma_pdf', `Firma de ${nombre.value.trim()} incorporada a la ficha`);
      resultado.replaceChildren(h('div', { class: 'aviso ok' }, h('b', {}, 'Ficha firmada: '), nom,
        h('div', { class: 'fila' },
          h('button', { class: 'btn peq', type: 'button', onclick: () => abrirBlob(blob) }, 'Ver'),
          h('button', { class: 'btn peq', type: 'button', onclick: () => compartir(blob, nom) }, 'Compartir'),
          h('button', { class: 'btn peq prim', type: 'button', id: 'guardar-firmada', onclick: async (e) => {
            const ficha = await app.storage.putFile({ name: nom, mime: 'application/pdf', bytes: new Uint8Array(await blob.arrayBuffer()) });
            const actual = normalizarAviso((await app.storage.get(avisoId)).data);
            if (!actual.archivos.some((x) => x.hash === ficha.hash)) actual.archivos.push({ tipo: 'ficha_firmada', ...ficha });
            await app.storage.save('aviso', actual, { id: avisoId, event: { kind: 'doc_preparada', text: `Copia de la ficha firmada guardada en el aviso: ${nom}` } });
            e.target.disabled = true; e.target.textContent = 'Guardada en el aviso';
          } }, 'Guardar copia en el aviso')),
        h('div', { class: 'muted' }, 'Guardar la copia no marca la firma como recibida: confírmalo en Documentación cuando corresponda.')));
    } catch (err) { toast(err.message, true); }
  };

  return h('div', {},
    h('div', { class: 'titulo-fila' }, h('h1', {}, 'Firma del cliente'), h('a', { class: 'btn', href: `#/aviso/${avisoId}` }, 'Volver al aviso')),
    falta.length ? h('div', { class: 'aviso err' }, `Falta configurar ${falta.join(' y ')} de la empresa. `, h('a', { href: '#/empresa' }, 'Configurar')) : null,
    h('div', { class: 'card' },
      h('div', {}, h('b', {}, `Aviso ${aviso.numero}`), ' · ', aviso.cliente?.nombre || ''),
      h('p', { class: 'muted' }, 'El cliente firma con el dedo en el recuadro. Se genera la ficha con sus datos y la firma.'),
      lienzo.el,
      h('div', { class: 'fila' }, h('button', { class: 'btn peq', type: 'button', onclick: () => lienzo.borrar() }, 'Borrar firma')),
      h('label', { for: 'firmante' }, 'Nombre de quien firma'), nombre,
      h('div', { class: 'fila' }, h('button', { class: 'btn prim ancho', type: 'button', id: 'generar-firmada', disabled: falta.length ? true : null, onclick: generar }, 'Generar ficha firmada'))),
    resultado);
}

/** Lista de documentos guardados en el aviso. */
export function listaArchivos(app, aviso) {
  if (!aviso.archivos?.length) return null;
  return h('div', {}, h('label', {}, 'Documentos guardados en el aviso'),
    h('ul', { class: 'lista-chk' }, ...aviso.archivos.map((a) => h('li', {},
      h('span', { class: 'ico' }, ico('documento')),
      h('span', { style: 'flex:1;min-width:0' }, h('div', { class: 'cortar' }, a.name), h('div', { class: 'muted' }, fecha(a.addedAt))),
      h('button', { class: 'btn peq', type: 'button', onclick: async () => { const b = await app.storage.getFileBlob(a.hash); b ? abrirBlob(b) : toast('Aún no está en este dispositivo: sincroniza.', true); } }, 'Ver'),
      h('button', { class: 'btn peq', type: 'button', onclick: async () => { const b = await app.storage.getFileBlob(a.hash); b ? compartir(b, a.name) : toast('Aún no está en este dispositivo: sincroniza.', true); } }, 'Compartir')))));
}
