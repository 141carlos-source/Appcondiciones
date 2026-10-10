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
export async function compartir(blob, nombre) {
  const file = new File([blob], nombre, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: nombre }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  descargar(blob, nombre);
}

export const ir = (ruta) => { location.hash = '#/' + ruta; };
