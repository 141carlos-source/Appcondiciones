// SOLTEC V2 · Utilidades de interfaz compartidas por la carcasa y los módulos.
import './assets/soltec-dialogo.js';

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

const ICO = {
  campana: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  documento: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 15.5h5"/>',
};
/** Icono SVG propio (sin emojis). Con «texto» se anuncia a los lectores de pantalla; sin él, es decorativo. */
export function ico(nombre, texto = '') {
  const svg = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICO[nombre] || ''}</svg>`;
  return texto ? h('span', { class: 'ico-svg', role: 'img', 'aria-label': texto, title: texto, html: svg })
    : h('span', { class: 'ico-svg', 'aria-hidden': 'true', html: svg });
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
export function lienzoFirma(id = 'lienzo-firma', { color = '#14213d', boli = false, recortarPng = false } = {}) {
  const el = h('canvas', { class: 'firma-lienzo', id });
  let ctx = null, dibujando = false, trazos = 0;
  let pts = [], ancho = 2.4;
  const grosor = boli ? 2.6 : 2.4;
  const preparar = () => {
    const r = el.getBoundingClientRect();
    const k = window.devicePixelRatio || 1;
    el.width = Math.round(r.width * k); el.height = Math.round(r.height * k);
    const c = el.getContext('2d');
    c.scale(k, k); c.lineWidth = grosor; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = color; c.fillStyle = color;
    return c;
  };
  const punto = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp || performance.now() }; };
  // Tramo con efecto bolígrafo: más fino si se va rápido y tinta algo irregular
  const tramo = () => {
    const n = pts.length;
    if (n < 2) return;
    const a = pts[n - 2], b = pts[n - 1];
    if (boli) {
      const v = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, b.t - a.t);
      const objetivo = Math.max(grosor * 0.45, Math.min(grosor * 1.15, grosor * (1.2 - v * 0.35)));
      ancho = ancho * 0.6 + objetivo * 0.4;
      ctx.lineWidth = ancho;
      ctx.globalAlpha = 0.82 + Math.random() * 0.16;
    }
    const p0 = n > 2 ? { x: (pts[n - 3].x + a.x) / 2, y: (pts[n - 3].y + a.y) / 2 } : a;
    const p2 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(a.x, a.y, p2.x, p2.y); ctx.stroke();
  };
  el.addEventListener('pointerdown', (e) => {
    ctx ??= preparar(); dibujando = true; pts = [punto(e)]; ancho = grosor;
    ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, grosor * 0.45, 0, Math.PI * 2); ctx.fill();
    el.setPointerCapture(e.pointerId); e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (!dibujando) return;
    const lista = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (lista.length ? lista : [e])) { pts.push(punto(ev)); tramo(); trazos++; }
  });
  const fin = () => { dibujando = false; };
  el.addEventListener('pointerup', fin);
  el.addEventListener('pointercancel', fin);
  const aPng = async (cv) => new Uint8Array(await (await new Promise((ok) => cv.toBlob(ok, 'image/png'))).arrayBuffer());
  return {
    el,
    vacio: () => trazos < 5,
    borrar: () => { ctx = preparar(); trazos = 0; },
    png: async () => {
      if (!recortarPng) return aPng(el);
      const { recortar } = await import('./core/tinta.js');
      return aPng(recortar(el) || el);
    },
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

/**
 * Mayúsculas en todos los campos de texto (salvo correos, webs, claves y buscadores).
 * · Con ratón y teclado físico (PC): se convierte al escribir, sin mover el cursor.
 * · En pantalla táctil (móvil y tablet) NO se toca el texto mientras se escribe: cambiar el valor
 *   a mitad de palabra hace que algunos teclados (Samsung, Gboard) se cierren o pierdan lo escrito.
 *   Se ve en mayúsculas (CSS) y se convierte al salir del campo.
 */
export function activarMayusculas(raiz = document) {
  const tactil = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const convertir = (el) => {
    const v = el.value, m = v.toLocaleUpperCase('es-ES');
    if (m === v) return false;
    el.value = m;
    return true;
  };
  raiz.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!vaEnMayusculas(el)) return;
    if (!el.hasAttribute('autocapitalize')) el.setAttribute('autocapitalize', 'characters');
    if (tactil()) el.style.textTransform = 'uppercase';
  }, true);
  raiz.addEventListener('input', (e) => {
    const el = e.target;
    if (e.isComposing || tactil() || !vaEnMayusculas(el)) return;
    const ini = el.selectionStart, fin = el.selectionEnd, largo = el.value.length;
    if (!convertir(el)) return;
    if (el.value.length === largo && ini != null) { try { el.setSelectionRange(ini, fin); } catch { /* sin cursor */ } }
  }, true); // en captura: el valor ya va en mayúsculas cuando lo lee el formulario
  // Al salir del campo (o al confirmar) se guarda en mayúsculas: se avisa al formulario con un «input»
  const alSalir = (e) => {
    const el = e.target;
    if (!vaEnMayusculas(el) || !convertir(el)) return;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  raiz.addEventListener('focusout', alSalir, true);
  raiz.addEventListener('change', alSalir, true);
}

// --- Ventanas de aviso / confirmación / pregunta (las mismas que CuadroLab y la autorización: assets/soltec-dialogo.js)
const ventana = () => globalThis.SoltecDialogo;
/** Aviso con un botón «Aceptar». */
export const aviso = (mensaje, o) => ventana().aviso(mensaje, o);
/** Pregunta Sí/No: devuelve true si se acepta. o = { si, no, peligro, titulo } */
export const confirmar = (mensaje, o) => ventana().confirmar(mensaje, o);
/** Pide un texto (o elegir de una lista con o.opciones): devuelve el valor o null si se cancela. */
export const preguntar = (mensaje, o) => ventana().preguntar(mensaje, o);

// --- Sugerencias bajo un campo de texto (autorrelleno con lo ya trabajado)
/**
 * Lista desplegable bajo un campo con lo que encaja con lo escrito. Tocar una opción (o Intro / flechas en el PC) la elige.
 * No quita el foco al campo (el teclado del móvil no se cierra) y no cambia nada hasta que se elige.
 * @param {HTMLInputElement} input
 * @param {{buscar: (texto:string) => Array<{titulo:string, sub?:string}>, elegir: (item) => void, alEnfocar?: boolean}} o
 *        alEnfocar: también al entrar en el campo vacío (p. ej. las direcciones del cliente elegido)
 */
export function sugerencias(input, { buscar, elegir, alEnfocar = false }) {
  const lista = h('div', { class: 'sugerencias', role: 'listbox', hidden: true });
  let items = [], activo = -1, cerrarT = null;
  const cerrar = () => { lista.hidden = true; lista.replaceChildren(); items = []; activo = -1; input.removeAttribute('aria-expanded'); };
  const marcar = (i) => { activo = i; [...lista.children].forEach((el, k) => el.classList.toggle('activa', k === i)); };
  const escoger = (it) => { cerrar(); elegir(it); };
  const abrir = () => {
    clearTimeout(cerrarT);
    items = (input.value.trim() || alEnfocar) ? (buscar(input.value) || []) : [];
    if (!items.length) { cerrar(); return; }
    lista.replaceChildren(...items.map((it, i) => h('div', {
      class: 'sugerencia', role: 'option',
      // pointerdown + preventDefault: el campo no pierde el foco y el teclado sigue abierto
      onpointerdown: (e) => { e.preventDefault(); }, onmousedown: (e) => e.preventDefault(),
      onclick: () => escoger(it), onmousemove: () => marcar(i),
    }, h('b', {}, it.titulo), it.sub ? h('span', { class: 'muted' }, it.sub) : null)));
    lista.hidden = false; activo = -1;
    input.setAttribute('aria-expanded', 'true');
  };
  input.addEventListener('input', abrir);
  input.addEventListener('focus', () => { if (alEnfocar || input.value.trim()) abrir(); });
  input.addEventListener('blur', () => { cerrarT = setTimeout(cerrar, 150); });
  input.addEventListener('keydown', (e) => {
    if (lista.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); marcar(Math.min(items.length - 1, activo + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); marcar(Math.max(0, activo - 1)); }
    else if (e.key === 'Enter' && activo >= 0) { e.preventDefault(); escoger(items[activo]); }
    else if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
  });
  input.setAttribute('aria-autocomplete', 'list');
  return lista;
}
