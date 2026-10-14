// SOLTEC V2 · Utilidades de interfaz compartidas por la carcasa y los módulos.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v; // solo para iconos SVG propios, nunca datos
    else if (k === 'value' && (tag === 'input' || tag === 'textarea' || tag === 'select')) el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

export function toast(msg, err = false) {
  document.querySelector('.toast')?.remove();
  const t = h('div', { class: 'toast' + (err ? ' err' : ''), role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), err ? 6000 : 3000);
}

export const hace = (iso) => {
  if (!iso) return 'nunca';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

export function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function abrirBlob(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Compartir un archivo con el menú del dispositivo; si no se puede, se descarga. */
export async function compartir(blob, nombre, texto = '') {
  const file = new File([blob], nombre, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: nombre, ...(texto ? { text: texto } : {}) }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  descargar(blob, nombre);
  return false;
}
/** ¿Este navegador puede enviar archivos a WhatsApp, correo…? */
export const puedeCompartirArchivos = () => { try { return !!navigator.canShare?.({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] }); } catch { return false; } };

export const ir = (ruta) => { location.hash = '#/' + ruta; };
/** Va a la pantalla; si ya estás en ella, la vuelve a pintar con los datos nuevos. */
export const irORepintar = (ruta) => {
  if (location.hash === '#/' + ruta) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else ir(ruta);
};

/**
 * Recuadro para firmar con el dedo o el ratón.
 * @returns {{el: HTMLCanvasElement, vacio: () => boolean, borrar: () => void, png: () => Promise<Uint8Array>}}
 */
export function lienzoFirma(id = 'lienzo-firma') {
  const el = h('canvas', { class: 'firma-lienzo', id });
  let ctx = null, dibujando = false, ultimo = null, trazos = 0;
  const preparar = () => {
    const r = el.getBoundingClientRect();
    const k = window.devicePixelRatio || 1;
    el.width = Math.round(r.width * k); el.height = Math.round(r.height * k);
    const c = el.getContext('2d');
    c.scale(k, k); c.lineWidth = 2.4; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#14213d';
    return c;
  };
  const punto = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  el.addEventListener('pointerdown', (e) => { ctx ??= preparar(); dibujando = true; ultimo = punto(e); el.setPointerCapture(e.pointerId); e.preventDefault(); });
  el.addEventListener('pointermove', (e) => {
    if (!dibujando) return;
    const p = punto(e);
    ctx.beginPath(); ctx.moveTo(...ultimo); ctx.lineTo(...p); ctx.stroke();
    ultimo = p; trazos++;
  });
  const fin = () => { dibujando = false; };
  el.addEventListener('pointerup', fin);
  el.addEventListener('pointercancel', fin);
  return {
    el,
    vacio: () => trazos < 5,
    borrar: () => { ctx = preparar(); trazos = 0; },
    png: async () => new Uint8Array(await (await new Promise((ok) => el.toBlob(ok, 'image/png'))).arrayBuffer()),
  };
}

// ---------------------------------------------------------------- todo en MAYÚSCULAS (salvo correos)
const TIPOS_TEXTO = new Set(['text', 'search', '']);
const NO_MAYUS = /email|correo|mail|web|url|clave|key|buscador|buscar/i;
/** ¿Este campo se escribe en mayúsculas? Todos los de texto salvo correos, webs, claves y buscadores. */
export function vaEnMayusculas(el) {
  if (!el || el.readOnly || el.disabled) return false;
  const esTexto = el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && TIPOS_TEXTO.has((el.getAttribute('type') || '').toLowerCase()));
  if (!esTexto || el.type === 'search') return false;
  if (el.closest('[data-minusculas]')) return false;
  return !NO_MAYUS.test([el.id, el.name, el.className, el.getAttribute('autocomplete') || ''].join(' '));
}

/** Convierte a mayúsculas lo que se escribe o se pega, sin mover el cursor. */
export function activarMayusculas(raiz = document) {
  raiz.addEventListener('input', (e) => {
    const el = e.target;
    if (e.isComposing || !vaEnMayusculas(el)) return;
    const v = el.value;
    const m = v.toLocaleUpperCase('es-ES');
    if (m === v) return;
    const ini = el.selectionStart, fin = el.selectionEnd;
    el.value = m;
    if (m.length === v.length && ini != null) { try { el.setSelectionRange(ini, fin); } catch { /* sin cursor */ } }
  }, true); // en captura: el valor ya va en mayúsculas cuando lo lee el formulario
}
