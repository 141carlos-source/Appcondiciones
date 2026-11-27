// SOLTEC V2 · Cuadro desde foto dentro del aviso y pestaña «Cuadros».
// La herramienta (assets/cuadrofoto.html) se abre a pantalla completa y habla con la ficha por mensajes:
// no guarda nada por su cuenta. Los datos vuelven al aviso (draft.cuadroFoto); las fotos y los PDF van a draft.archivos.
// La clave de la API de Claude se guarda solo en este dispositivo (meta, no se sincroniza).

import { h, toast, hace, confirmar } from '../ui.js';
import { normalizarCuadroFoto, datosCuadroFoto, resumenCuadroFoto, obraDeAviso, empresaParaCajetin, fichaArchivoCuadro, base64ABytes } from '../core/cuadroFoto.js';
import { leerEmpresa } from './empresa.js';
import { buscar } from '../core/search.js';

const RUTA = './assets/cuadrofoto.html'; // en el caché del service worker; «#host» activa el modo incrustado
const aDataUrl = (blob) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(blob); });
const META_CLAVE = 'claudeClave', META_MODELO = 'claudeModelo';

/**
 * Abre la herramienta a pantalla completa.
 * @param {object} app
 * @param {object} op  { draft?, titulo, alCambiar?, alArchivo?(ficha), alCerrar?(tocado) }  sin draft funciona sin aviso (los PDF se descargan)
 */
export async function abrirCuadroFoto(app, op) {
  let empresa, logo = null;
  try {
    const e = await leerEmpresa(app);
    empresa = empresaParaCajetin(e);
    if (e.logo) { const b = await app.storage.getFileBlob(e.logo.hash); if (b) logo = await aDataUrl(b); }
  } catch (err) { toast('No se pudieron leer los datos de empresa: ' + err.message, true); return; }
  const clave = (await app.storage.getMeta(META_CLAVE)) || '';
  const modelo = (await app.storage.getMeta(META_MODELO)) || '';
  const draft = op.draft || null;
  const iframe = h('iframe', { src: RUTA + '#host', title: 'Cuadro desde foto', id: 'iframe-cuadrofoto' });
  let tocado = false;
  const cerrar = async () => {
    window.removeEventListener('message', alMensaje);
    capa.remove();
    document.body.classList.remove('con-capa');
    if (op.alCerrar) {
      try { await op.alCerrar(tocado); } catch (err) { toast('No se pudo guardar el aviso: ' + err.message, true); }
    }
  };
  const capa = h('div', { class: 'capa-cuadro', role: 'dialog', 'aria-label': 'Cuadro desde foto' },
    h('div', { class: 'barra-cuadro' },
      h('b', {}, op.titulo || 'Cuadro desde foto'),
      h('button', { class: 'btn peq', type: 'button', id: 'volver-cuadrofoto', onclick: cerrar }, draft ? '← Volver al aviso' : '← Volver')),
    iframe);
  async function guardarArchivo(clase, nombre, bytes, mime) {
    const ficha = await app.storage.putFile({ name: nombre, mime, bytes });
    if (!draft) return ficha;
    const f = fichaArchivoCuadro(clase, ficha);
    draft.archivos = draft.archivos || [];
    if (clase !== 'foto') draft.archivos = draft.archivos.filter((x) => x.tipo !== f.tipo); // el PDF nuevo sustituye al anterior en la lista
    if (!draft.archivos.some((x) => x.hash === f.hash)) draft.archivos.push(f);
    tocado = true;
    op.alCambiar?.();
    return ficha;
  }
  async function alMensaje(e) {
    if (e.origin !== location.origin || e.source !== iframe.contentWindow) return;
    const m = e.data || {};
    if (m.tipo === 'cf-listo') {
      iframe.contentWindow.postMessage({
        tipo: 'cf-cargar',
        datos: draft?.cuadroFoto?.datos || null,
        leido: draft?.cuadroFoto?.leido || null,
        obra: draft ? obraDeAviso(draft) : '',
        empresa, logo, clave, modelo: modelo || undefined,
      }, location.origin);
    } else if (m.tipo === 'cf-cambio' && m.datos && typeof m.datos === 'object') {
      if (!draft) return;
      draft.cuadroFoto = { v: 1, datos: datosCuadroFoto(m.datos), leido: datosCuadroFoto(m.leido), actualizado: new Date().toISOString() };
      tocado = true;
      op.alCambiar?.();
    } else if (m.tipo === 'cf-clave' && typeof m.clave === 'string') {
      await app.storage.setMeta(META_CLAVE, m.clave.trim());
    } else if (m.tipo === 'cf-foto' && typeof m.dataUrl === 'string' && draft) {
      try { await guardarArchivo('foto', String(m.nombre || 'Foto cuadro.jpg'), base64ABytes(m.dataUrl), 'image/jpeg'); } catch (err) { toast('No se pudo guardar la foto: ' + err.message, true); }
    } else if (m.tipo === 'cf-pdf' && typeof m.base64 === 'string') {
      try {
        const bytes = base64ABytes(m.base64), nombre = String(m.nombre || 'Cuadro.pdf');
        if (draft) await guardarArchivo(m.clase === 'unifilar' ? 'unifilar' : 'chint', nombre, bytes, 'application/pdf');
        else {
          const a = h('a', { href: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), download: nombre });
          document.body.append(a); a.click(); a.remove();
        }
      } catch (err) { toast('No se pudo guardar el PDF: ' + err.message, true); }
    } else if (m.tipo === 'cf-volver') cerrar();
  }
  window.addEventListener('message', alMensaje);
  document.body.classList.add('con-capa');
  document.body.append(capa);
}

/** Bloque de la ficha del aviso. Modifica draft.cuadroFoto y draft.archivos; al volver con cambios llama a alVolver() (guarda el aviso). */
export function bloqueCuadroFoto(app, draft, alCambiar, alVolver) {
  draft.cuadroFoto = normalizarCuadroFoto(draft.cuadroFoto);
  const caja = h('div', { id: 'bloque-cuadrofoto' });
  const pintar = () => {
    const r = resumenCuadroFoto(draft.cuadroFoto);
    caja.replaceChildren(
      h('label', {}, 'Cuadro desde foto y cuadro CHINT'),
      h('p', { class: r.hay ? '' : 'muted', id: 'cuadrofoto-resumen' }, h('b', {}, r.texto), r.actualizado ? h('span', { class: 'muted' }, ` · ${hace(r.actualizado)}`) : null),
      h('div', { class: 'fila' },
        h('button', { class: 'btn prim', type: 'button', id: 'abrir-cuadrofoto', onclick: abrir }, r.hay ? 'Abrir cuadro desde foto' : 'Cuadro desde foto'),
        r.hay ? h('button', { class: 'btn', type: 'button', onclick: quitar }, 'Quitar') : null),
      h('p', { class: 'muted' }, 'Haz la foto del cuadro y Claude saca el unifilar (modelo Palomar 5) y el cuadro con aparamenta CHINT y su pedido. Las fotos y los PDF se quedan en los documentos del aviso.'));
  };
  const quitar = async () => {
    if (!(await confirmar('¿Quitar el cuadro desde foto de este aviso? Los PDF y fotos guardados se quedan.', { si: 'Quitar', peligro: true }))) return;
    draft.cuadroFoto = { v: 1, datos: null, leido: null, actualizado: new Date().toISOString() };
    alCambiar(); pintar();
  };
  async function abrir() {
    await abrirCuadroFoto(app, {
      draft,
      titulo: 'Cuadro desde foto' + (draft.numero ? ` · Aviso ${draft.numero}` : ''),
      alCambiar,
      alCerrar: async (tocado) => { pintar(); if (tocado && alVolver) await alVolver(); },
    });
  }
  caja.abrir = abrir;
  pintar();
  return caja;
}

/** Pestaña «Cuadros»: pregunta si se abre un aviso para coger sus datos. */
export async function vistaCuadros(app) {
  const avisos = (await app.storage.list('aviso')).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const lista = h('ul', { class: 'lista-chk', id: 'cuadros-avisos' });
  const q = h('input', { class: 'buscador', type: 'search', id: 'cuadros-buscar', placeholder: 'Buscar aviso: nº, cliente, dirección…', autocomplete: 'off' });
  const pintarLista = () => {
    const t = q.value.trim();
    const rs = (t ? buscar(avisos, t).map((x) => x.registro) : avisos).slice(0, 30);
    lista.replaceChildren(...(rs.length ? rs.map((r) => {
      const a = r.data, hay = resumenCuadroFoto(a.cuadroFoto).hay;
      return h('li', {},
        h('a', { href: `#/aviso/${r.id}?cuadro=1`, class: 'enlace-card', style: 'flex:1;min-width:0;text-decoration:none;color:inherit' },
          h('div', { class: 'cortar' }, h('b', {}, `${a.numero || ''} · ${a.cliente?.nombre || 'Sin cliente'}`)),
          h('div', { class: 'muted cortar' }, obraDeAviso(a) || 'Sin dirección', hay ? ' · ya tiene cuadro' : '')));
    }) : [h('li', { class: 'muted' }, 'No hay avisos que coincidan.')]));
  };
  q.addEventListener('input', pintarLista);
  pintarLista();
  return h('div', {},
    h('h1', {}, 'Cuadros'),
    h('p', { class: 'muted' }, 'Foto del cuadro → unifilar → cuadro con aparamenta CHINT y pedido. ¿Para qué aviso es?'),
    h('div', { class: 'card' },
      h('h2', {}, 'Abrir un aviso'),
      h('p', { class: 'muted' }, 'Coge del aviso la dirección y la población, y guarda en él las fotos, los datos y los PDF.'),
      q, lista),
    h('div', { class: 'card' },
      h('h2', {}, 'Otras opciones'),
      h('div', { class: 'fila' },
        h('a', { class: 'btn', href: '#/aviso/nuevo', id: 'cuadros-nuevo' }, '+ Crear aviso nuevo'),
        h('button', { class: 'btn', type: 'button', id: 'cuadros-sin-aviso', onclick: () => abrirCuadroFoto(app, { titulo: 'Cuadro desde foto · sin aviso' }) }, 'Sin aviso')),
      h('p', { class: 'muted' }, 'Sin aviso no se guarda nada en la app: los PDF se descargan al momento. Al crear un aviso nuevo, guárdalo y abre «Cuadro desde foto» en su apartado de cuadros.')));
}
