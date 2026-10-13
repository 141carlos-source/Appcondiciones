// SOLTEC V2 · Ficha PDF del cliente, firma con el dedo, resumen de WhatsApp y correos.
// Preparar una comunicación no es enviarla: el historial lo distingue.

import { h, toast, abrirBlob, compartir, descargar, fecha, lienzoFirma } from '../ui.js';
import { generarFicha, nombreFicha, resumenWhatsApp, enlaceWhatsApp, telefonoWhatsApp, correo, enlaceCorreo, TIPOS_CORREO } from '../core/documentos.js';
import { faltaParaFormulario } from '../core/empresa.js';
import { datosPendientes, normalizarAviso, hoyLocal } from '../core/model.js';
import { leerEmpresa } from './empresa.js';

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

async function logoEdist() {
  try { const r = await fetch('./assets/logo_e-distribucion.jpg'); return { bytes: new Uint8Array(await r.arrayBuffer()), mime: 'image/jpeg' }; } catch { return null; }
}

export async function crearFichaPdf(app, aviso, firma = null) {
  const [PDFLib, empresa] = await Promise.all([cargarPdfLib(), leerEmpresa(app)]);
  const [logo, edist] = await Promise.all([imagenParaPdf(app, empresa.logo), logoEdist()]);
  const bytes = await generarFicha(PDFLib, { aviso, empresa, logo, edist, firma });
  return new Blob([bytes], { type: 'application/pdf' });
}

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

  // Revisión de datos antes de preparar un documento o correo
  const revisar = (aviso, destino, continuar) => {
    const pend = destino ? datosPendientes(aviso, destino) : [];
    if (!pend.length) return continuar();
    panel.replaceChildren(h('div', { class: 'aviso info' },
      h('b', {}, `Faltan ${pend.length} dato(s): `), pend.map((p) => p.etiqueta).join(', '),
      h('div', { class: 'fila' },
        h('button', { class: 'btn peq', type: 'button', onclick: () => { panel.replaceChildren(); document.querySelector('.ficha .aviso.err button.enlace')?.click(); } }, 'Volver al aviso'),
        h('button', { class: 'btn peq prim', type: 'button', onclick: () => { panel.replaceChildren(); continuar(); } }, 'Continuar con el borrador'))));
  };

  const fichaPdf = async () => {
    if (sinGuardar()) return;
    if (faltaEmpresa.length) {
      panel.replaceChildren(h('div', { class: 'aviso err' }, `Para la ficha hace falta configurar: ${faltaEmpresa.join(' y ')} de la empresa. `, h('a', { href: '#/empresa' }, 'Configurar empresa')));
      return;
    }
    const aviso = await leer();
    revisar(aviso, 'ficha', async () => {
      try {
        const blob = await crearFichaPdf(app, aviso);
        const nombre = nombreFicha(aviso);
        await app.storage.addEvent(avisoId, 'formulario', `Ficha PDF preparada: ${nombre}`);
        panel.replaceChildren(h('div', { class: 'aviso ok' }, h('b', {}, 'Ficha preparada. '), nombre,
          h('div', { class: 'fila' },
            h('button', { class: 'btn peq', type: 'button', onclick: () => abrirBlob(blob) }, 'Ver'),
            h('button', { class: 'btn peq prim', type: 'button', onclick: () => compartir(blob, nombre) }, 'Compartir'),
            h('button', { class: 'btn peq', type: 'button', onclick: () => descargar(blob, nombre) }, 'Descargar')),
          h('div', { class: 'muted' }, 'Para enviarla por WhatsApp usa «Compartir» o adjúntala como documento: abrir el chat no adjunta el PDF.')));
      } catch (e) { toast(e.message, true); }
    });
  };

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

  const enviarCorreo = (tipo) => async () => {
    if (sinGuardar()) return;
    const aviso = await leer();
    revisar(aviso, TIPOS_CORREO[tipo].destino, async () => {
      const c = correo(tipo, { aviso, empresa, seguimiento: await proximoSeguimiento(app, avisoId) });
      if (!c.para) toast(tipo === 'datos' ? 'El cliente no tiene correo: escríbelo en el aviso' : 'Falta el correo de destino en Empresa › Correos', true);
      window.location.href = enlaceCorreo(c);
      await app.storage.addEvent(avisoId, 'doc_preparada', `Correo preparado: ${TIPOS_CORREO[tipo].label}`);
      panel.replaceChildren(h('div', { class: 'aviso info' }, 'Correo preparado en tu aplicación de correo. ', h('b', {}, 'Adjunta el PDF antes de enviarlo: no se adjunta solo.')));
      marcarEnviado(TIPOS_CORREO[tipo].label);
    });
  };

  return h('div', {},
    faltaEmpresa.length ? h('div', { class: 'aviso info' }, `Configura ${faltaEmpresa.join(' y ')} de la empresa para la ficha PDF. `, h('a', { href: '#/empresa' }, 'Ir a Empresa')) : null,
    h('div', { class: 'acciones' },
      h('button', { class: 'btn', type: 'button', id: 'btn-ficha-pdf', onclick: fichaPdf }, 'Ficha PDF para el cliente'),
      h('a', { class: 'btn', href: `#/firma/${avisoId}` }, 'Firmar en este dispositivo'),
      h('button', { class: 'btn', type: 'button', id: 'btn-whatsapp', onclick: whatsapp }, 'Resumen para WhatsApp'),
      ...Object.entries(TIPOS_CORREO).map(([k, t]) => h('button', { class: 'btn', type: 'button', onclick: enviarCorreo(k) }, 'Correo: ' + t.label.toLowerCase()))),
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
      const blob = await crearFichaPdf(app, aviso, { png, nombre: nombre.value.trim(), fecha: hoy });
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
      h('span', { class: 'ico' }, '📄'),
      h('span', { style: 'flex:1;min-width:0' }, h('div', { class: 'cortar' }, a.name), h('div', { class: 'muted' }, fecha(a.addedAt))),
      h('button', { class: 'btn peq', type: 'button', onclick: async () => { const b = await app.storage.getFileBlob(a.hash); b ? abrirBlob(b) : toast('Aún no está en este dispositivo: sincroniza.', true); } }, 'Ver'),
      h('button', { class: 'btn peq', type: 'button', onclick: async () => { const b = await app.storage.getFileBlob(a.hash); b ? compartir(b, a.name) : toast('Aún no está en este dispositivo: sincroniza.', true); } }, 'Compartir')))));
}
