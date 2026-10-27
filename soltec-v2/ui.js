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
  telefono: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  correo: '<path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/>',
  whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1a4 4 0 0 1-2-2l1-1-1-2z"/>',
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
  // El campo se prepara (mayúsculas en el teclado y a la vista) ANTES de recibir el foco: al tocarlo.
  // Cambiar un campo ya enfocado hace que algunos teclados de Android se reinicien: el teclado sale y se esconde.
  const preparar = (el) => {
    if (!vaEnMayusculas(el) || el.dataset.mayusPreparado) return;
    el.dataset.mayusPreparado = '1';
    if (!el.hasAttribute('autocapitalize')) el.setAttribute('autocapitalize', 'characters');
    if (tactil()) el.style.textTransform = 'uppercase';
  };
  raiz.addEventListener('pointerdown', (e) => preparar(e.target), true);
  raiz.addEventListener('touchstart', (e) => preparar(e.target), { capture: true, passive: true });
  // Con el teclado del PC (tabulador) no hay toque: se prepara al entrar (ahí no hay teclado en pantalla que reiniciar)
  raiz.addEventListener('focusin', (e) => { if (!tactil()) preparar(e.target); }, true);
  // Los campos que ya están en pantalla se preparan al pintarse (así ni siquiera cambian al tocarlos)
  const prepararTodo = (n) => {
    if (!tactil() || !n || n.nodeType !== 1) return;
    if (n.matches?.('input,textarea')) preparar(n);
    n.querySelectorAll?.('input,textarea').forEach(preparar);
  };
  if (typeof MutationObserver === 'function' && raiz.body !== undefined) {
    new MutationObserver((ms) => { for (const m of ms) m.addedNodes.forEach(prepararTodo); }).observe(raiz.body || raiz, { childList: true, subtree: true });
  }
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

// --- Diagnóstico del teclado del móvil: si un campo pierde el foco solo (sin tocar otra cosa) mientras se escribe,
// se anota en el registro de errores con los detalles, para saber qué lo provoca en ese teléfono.
export function vigilarFocoTeclado(anotar) {
  if (typeof matchMedia !== 'function' || !matchMedia('(pointer: coarse)').matches) return;
  let ultimoToque = 0, ultimaTecla = 0;
  const vv = () => (window.visualViewport ? Math.round(window.visualViewport.height) : window.innerHeight);
  let alto = vv();
  document.addEventListener('pointerdown', () => { ultimoToque = Date.now(); }, true);
  document.addEventListener('input', () => { ultimaTecla = Date.now(); }, true);
  document.addEventListener('focusout', (e) => {
    const el = e.target;
    if (!el.matches?.('input,textarea') || document.visibilityState !== 'visible') return;
    const ahora = Date.now();
    if (ahora - ultimoToque < 700) return; // lo ha cambiado el usuario tocando otra cosa
    if (ahora - ultimaTecla > 4000 && ahora - ultimoToque > 4000) return; // no estaba escribiendo
    const id = el.id || el.name || el.className || el.tagName;
    setTimeout(() => {
      const act = document.activeElement;
      anotar({
        mensaje: `Teclado: el campo «${id}» perdió el foco solo mientras se escribía`,
        pila: [`pasa a: ${act ? (act.id || act.tagName) : 'nada'}`, `relatedTarget: ${e.relatedTarget ? (e.relatedTarget.id || e.relatedTarget.tagName) : 'ninguno'}`,
          `campo en pantalla: ${el.isConnected ? 'sí' : 'no (se ha redibujado)'}`, `alto visible: ${alto} → ${vv()} px`, `ruta: ${location.hash}`].join('\n'),
        origen: 'teclado',
      });
    }, 300);
  }, true);
  window.visualViewport?.addEventListener('resize', () => { setTimeout(() => { alto = vv(); }, 1000); });
}

// --- Llamar, WhatsApp y correo desde un campo (teléfono / correo del cliente)
/** Enlace «tel:» de un teléfono (españoles con +34), o null si no parece un teléfono. */
export function hrefTelefono(t) {
  const d = String(t || '').replace(/[\s.\-()]/g, '');
  if (/^(\+34|0034)?[6789]\d{8}$/.test(d)) return 'tel:+34' + d.slice(-9);
  if (/^(\+|00)\d{8,15}$/.test(d)) return 'tel:' + d.replace(/^00/, '+');
  return null;
}
/** Enlace de WhatsApp de un móvil español (6 o 7), o null. */
export function hrefWhatsApp(t) {
  const d = String(t || '').replace(/[\s.\-()]/g, '').replace(/^(\+34|0034)/, '');
  return /^[67]\d{8}$/.test(d) ? 'https://wa.me/34' + d : null;
}
/** Enlace «mailto:» de un correo, o null si no parece un correo. */
export function hrefCorreo(e, asunto = '') {
  const c = String(e || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(c)) return null;
  return 'mailto:' + c + (asunto ? '?subject=' + encodeURIComponent(asunto) : '');
}
/**
 * Botones bajo un campo: «Llamar» (+ «WhatsApp» si es móvil) o «Enviar correo». Solo se ven con un dato válido
 * y se actualizan al escribir o cuando el autorrelleno pone el valor (evento «soltec:valor»).
 * @param {'telefono'|'correo'} tipo
 */
export function accionesContacto(input, tipo, { asunto = '' } = {}) {
  const caja = h('div', { class: 'acciones-contacto', 'data-tipo': tipo });
  const pintar = () => {
    const v = input.value;
    const hijos = [];
    if (tipo === 'telefono') {
      const t = hrefTelefono(v), w = hrefWhatsApp(v);
      if (t) hijos.push(h('a', { class: 'btn peq', href: t, 'data-accion': 'llamar' }, ico('telefono'), 'Llamar'));
      if (w) hijos.push(h('a', { class: 'btn peq', href: w, target: '_blank', rel: 'noopener', 'data-accion': 'whatsapp' }, ico('whatsapp'), 'WhatsApp'));
    } else {
      const m = hrefCorreo(v, typeof asunto === 'function' ? asunto() : asunto);
      // El asunto se calcula al pulsar (con los datos del aviso de ese momento)
      if (m) hijos.push(h('a', { class: 'btn peq', href: m, 'data-accion': 'correo', onclick: (e) => { e.currentTarget.href = hrefCorreo(input.value, typeof asunto === 'function' ? asunto() : asunto) || m; } }, ico('correo'), 'Enviar correo'));
    }
    caja.replaceChildren(...hijos);
    caja.hidden = !hijos.length;
  };
  input.addEventListener('input', pintar);
  input.addEventListener('soltec:valor', pintar);
  pintar();
  return caja;
}
