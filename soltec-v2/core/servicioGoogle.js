// SOLTEC V2 · Servicio de formularios en la cuenta de Google de la empresa (Apps Script).
// Enlace corto: los datos del formulario se guardan CIFRADOS en el servicio y la clave solo va en el enlace
// (después de «#», no llega a ningún servidor). Correo automático: lo envía el servicio desde Gmail.
// Código del servicio: servicio-google/SOLTEC_Formularios.gs

const B64 = {
  de: (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  a: (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
};

/** «https://script.google.com/macros/s/AKfy…/exec» → «AKfy…» (o '' si no es una URL de Apps Script). */
export function idServicio(url) {
  const m = /^https:\/\/script\.google\.com\/(?:a\/macros\/[^/]+|macros)\/s\/([A-Za-z0-9_-]{20,})\/(?:exec|dev)\b/.exec(String(url || '').trim());
  return m ? m[1] : '';
}
export const urlServicio = (id) => `https://script.google.com/macros/s/${id}/exec`;

/** ¿Está configurado el envío automático? (empresa.envio = {url, clave}) */
export const servicioListo = (empresa) => !!(idServicio(empresa?.envio?.url) && String(empresa?.envio?.clave || '').length >= 12);

/** Clave nueva para el servicio (se pega en el código del servicio). */
export function claveNueva() {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return B64.de(b);
}

// ---------------------------------------------------------------- cifrado (AES-GCM 128)
export async function cifrar(obj) {
  const k = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const clave = await crypto.subtle.importKey('raw', k, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, new TextEncoder().encode(JSON.stringify(obj))));
  const todo = new Uint8Array(iv.length + ct.length); todo.set(iv); todo.set(ct, iv.length);
  return { datos: B64.de(todo), clave: B64.de(k) };
}
export async function descifrar(datos, k) {
  const b = B64.a(datos);
  const clave = await crypto.subtle.importKey('raw', B64.a(k), 'AES-GCM', false, ['decrypt']);
  const txt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, clave, b.slice(12));
  return JSON.parse(new TextDecoder().decode(txt));
}

// ---------------------------------------------------------------- enlace corto
/** «…/cliente.html#g.<servicio>.<código>.<clave>» */
export const enlaceCorto = (base, servicio, codigo, clave) => `${base}cliente.html#g.${servicio}.${codigo}.${clave}`;
export function leerEnlaceCorto(hash) {
  const m = /^#?g\.([A-Za-z0-9_-]{20,})\.([A-Za-z0-9]{4,16})\.([A-Za-z0-9_-]{16,})$/.exec(String(hash || ''));
  return m ? { servicio: m[1], codigo: m[2], clave: m[3] } : null;
}

// ---------------------------------------------------------------- llamadas
/** POST al servicio (texto plano: sin consulta previa del navegador). */
export async function llamar(url, cuerpo, { fetchFn = fetch } = {}) {
  let r;
  try { r = await fetchFn(url, { method: 'POST', body: JSON.stringify(cuerpo), redirect: 'follow' }); } catch { throw new Error('No hay conexión con el servicio de Google'); }
  let j;
  try { j = await r.json(); } catch { throw new Error('El servicio de Google no responde bien: revisa la URL (debe terminar en /exec y estar implementado para «Cualquier usuario»)'); }
  if (!j.ok) throw new Error(j.error === 'clave' ? 'La clave no coincide con la del servicio de Google' : 'Servicio de Google: ' + (j.error || 'error'));
  return j;
}

/** Guarda el paquete del formulario y devuelve el enlace corto. */
export async function crearEnlaceCorto(empresa, base, paquete, o) {
  const { datos, clave } = await cifrar(paquete);
  const j = await llamar(empresa.envio.url, { accion: 'guardar', clave: empresa.envio.clave, datos }, o);
  return enlaceCorto(base, idServicio(empresa.envio.url), j.id, clave);
}

/** El formulario del cliente lee sus datos (y el logo) del servicio. */
export async function cargarEnlaceCorto(enlace, { fetchFn = fetch } = {}) {
  const url = urlServicio(enlace.servicio);
  const r = await fetchFn(`${url}?id=${encodeURIComponent(enlace.codigo)}`);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error === 'caducado' ? 'Este enlace ha caducado. Pida a la empresa que se lo vuelva a enviar.' : 'No se han podido cargar sus datos.');
  const p = await descifrar(j.datos, enlace.clave);
  if (p?.e?.lg && !p.e.l) {
    try { const g = await (await fetchFn(`${url}?logo=1`)).json(); if (/^data:image\/(png|jpeg);base64,/.test(g.logo || '')) p.e.l = g.logo; } catch { /* sin logo */ }
  }
  return p;
}
