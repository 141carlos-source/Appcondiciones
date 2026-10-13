// SOLTEC V2 · Localización (CartoCiudad), referencia catastral (Catastro), plano (IGN) y fotografías.
// Si un servicio público no responde, se puede seguir a mano: nada bloquea el aviso.

import { h, toast, descargar } from '../ui.js';
import { calleNumero, normalizarAviso } from '../core/model.js';
import { generarPlanoA5, nombrePlanoA5 } from '../core/plano.js';
import { leerEmpresa } from './empresa.js';
import { cargarPdfLib, imagenParaPdf } from './comunicaciones.js';
import {
  urlCandidatos, urlBuscar, urlInversa, urlParcelaCercana, urlInmuebles, urlSedeCatastro, aJsonp, encuadreA5, urlNominatim,
  desdeCartoCiudad, desdeNominatim, parcelasCercanas, inmueblesParcela, inmuebleQueCoincide, coordsValidas, redondear,
} from '../core/geo.js';

/** Petición JSONP (CartoCiudad no siempre permite peticiones directas desde el navegador). */
export function jsonp(url, ms = 9000) {
  return new Promise((ok, mal) => {
    const cb = '__soltec' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const s = document.createElement('script');
    let hecho = false;
    const fin = () => { if (hecho) return; hecho = true; clearTimeout(t); delete window[cb]; s.remove(); };
    window[cb] = (r) => { fin(); ok(r); };
    s.onerror = () => { fin(); mal(new Error('El servicio no responde')); };
    s.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cb;
    const t = setTimeout(() => { fin(); mal(new Error('El servicio tarda demasiado')); }, ms);
    document.head.append(s);
  });
}

async function json(url, ms = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`Respuesta ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

/**
 * Consulta un servicio público de localización probando, por orden:
 *  1. directamente desde el navegador;
 *  2. a través del PC de casa (si la sincronización está configurada);
 *  3. JSONP (solo CartoCiudad).
 * Así funciona aunque el servicio no deje pedirle datos desde una web.
 */
export async function consultarGeo(app, url, { jsonpOk = false } = {}) {
  const errores = [];
  try { return await json(url, 7000); } catch (e) { errores.push('directo: ' + e.message); }
  if (app?.sync && app.estado?.configurado) {
    try { return await app.sync.geo(url); } catch (e) { errores.push('PC: ' + e.message); }
  }
  if (jsonpOk) {
    try { return await jsonp(aJsonp(url)); } catch (e) { errores.push('JSONP: ' + e.message); }
  }
  throw new Error(errores.join(' · '));
}

/**
 * Bloque de localización. «poner(ruta, valor)» escribe en el aviso y en su campo de la ficha.
 */
export function bloqueUbicacion(app, draft, poner, alCambiar, { alEncontrar } = {}) {
  const estado = h('div', { class: 'muted', id: 'estado-ubicacion', 'aria-live': 'polite' });
  const lista = h('div', { class: 'lista' });
  const di = (t, err = false) => { estado.textContent = t; estado.classList.toggle('error-texto', err); };

  const aplicar = (r, { soloVacios = false } = {}) => {
    for (const k of ['direccion', 'numero', 'cp', 'poblacion', 'provincia', 'lat', 'lon', 'refCatastral']) {
      if (!r[k]) continue;
      if (soloVacios && String(draft.suministro[k] || '').trim()) continue;
      poner('suministro.' + k, r[k]);
    }
  };

  const pintarResultados = (rs, origen) => {
    di(`Elige la dirección correcta (${origen}):`);
    lista.replaceChildren(...rs.slice(0, 8).map(({ r, completar }) => h('button', { class: 'tarjeta', type: 'button', style: 'text-align:left;width:100%', onclick: async () => {
      let fin = r;
      if ((!r.lat || !r.lon) && completar) {
        try { fin = { ...r, ...Object.fromEntries(Object.entries(await completar()).filter(([, v]) => v)) }; } catch { /* sin coordenadas */ }
      }
      aplicar(fin);
      lista.replaceChildren();
      di(fin.lat ? `Dirección aplicada con coordenadas ${fin.lat}, ${fin.lon}.` : 'Dirección aplicada (sin coordenadas: usa «Mi ubicación» en el sitio).');
      if (fin.lat && alEncontrar) alEncontrar();
    } }, r.texto)));
  };

  const buscarDireccion = async () => {
    const su = draft.suministro;
    if (!su.direccion) { di('Escribe primero la calle (y mejor también el número y la población).', true); return; }
    const q = [calleNumero(su), su.poblacion || su.cp, su.provincia].filter(Boolean).join(', ');
    di('Buscando la dirección…');
    lista.replaceChildren();
    let fallo = '';
    try {
      const cands = [].concat(await consultarGeo(app, urlCandidatos(q), { jsonpOk: true }) || []);
      if (cands.length) {
        pintarResultados(cands.map((c) => ({ r: desdeCartoCiudad(c), completar: async () => desdeCartoCiudad(await consultarGeo(app, urlBuscar(c), { jsonpOk: true })) })), 'CartoCiudad');
        return;
      }
    } catch (e) { fallo = e.message; }
    // Respaldo: OpenStreetMap
    try {
      const rs = [].concat(await consultarGeo(app, urlNominatim({ calle: su.direccion, numero: su.numero, poblacion: su.poblacion, cp: su.cp })) || []);
      if (rs.length) { pintarResultados(rs.map((n) => ({ r: desdeNominatim(n) })), fallo ? 'CartoCiudad no responde; resultados de OpenStreetMap' : 'OpenStreetMap'); return; }
      di('No se encuentra esa dirección. Revisa la calle, el número y la población, o sigue a mano.', true);
    } catch (e) {
      di(`No se ha podido buscar la dirección (${fallo || e.message}). Puedes seguir rellenando a mano o usar «Mi ubicación» en el sitio.`, true);
    }
  };

  const miUbicacion = () => {
    if (!navigator.geolocation) { di('Este dispositivo no da la ubicación.', true); return; }
    di('Obteniendo la ubicación del dispositivo…');
    navigator.geolocation.getCurrentPosition(async (p) => {
      const lat = redondear(p.coords.latitude), lon = redondear(p.coords.longitude);
      poner('suministro.lat', lat);
      poner('suministro.lon', lon);
      di(`Ubicación: ${lat}, ${lon} (precisión ±${Math.round(p.coords.accuracy)} m). Buscando la dirección…`);
      try {
        const r = desdeCartoCiudad(await consultarGeo(app, urlInversa(lat, lon), { jsonpOk: true }));
        aplicar({ ...r, lat: '', lon: '' }, { soloVacios: true });
        di(`Ubicación guardada: ${lat}, ${lon}. Dirección aproximada: ${r.texto || 'no disponible'} (solo se han rellenado los campos vacíos).`);
      } catch { di(`Ubicación guardada: ${lat}, ${lon}. No se pudo obtener la dirección.`); }
    }, (e) => di(e.code === 1 ? 'Permiso de ubicación denegado. Actívalo en el navegador para usar esta opción.' : 'No se pudo obtener la ubicación.', true), { enableHighAccuracy: true, timeout: 15000 });
  };

  const buscarCatastro = async () => {
    const { lat, lon, piso, puerta } = draft.suministro;
    if (!coordsValidas(lat, lon)) { di('Faltan las coordenadas: usa «Buscar dirección» o «Mi ubicación» primero.', true); return; }
    di('Consultando el Catastro…');
    lista.replaceChildren();
    try {
      const parcelas = parcelasCercanas(await consultarGeo(app, urlParcelaCercana(lat, lon)));
      if (!parcelas.length) { di('El Catastro no tiene parcelas en esas coordenadas.', true); return; }
      const parcela = parcelas[0];
      const inm = inmueblesParcela(await consultarGeo(app, urlInmuebles(parcela.rc14)));
      const elegir = (x) => { poner('suministro.refCatastral', x.rc); lista.replaceChildren(); di(`Referencia catastral aplicada: ${x.rc}`); };
      const claro = inmuebleQueCoincide(inm, piso, puerta);
      if (claro) { elegir(claro); di(`Referencia aplicada: ${claro.rc} (${parcela.direccion}${claro.planta ? ` · planta ${claro.planta}` : ''}${claro.puerta ? ` puerta ${claro.puerta}` : ''}). Compruébala.`); return; }
      di(`Parcela ${parcela.rc14} · ${parcela.direccion} (a ${Math.round(parcela.distancia || 0)} m). Elige el inmueble:`);
      lista.replaceChildren(...inm.slice(0, 60).map((x) => h('button', { class: 'tarjeta', type: 'button', style: 'text-align:left;width:100%', onclick: () => elegir(x) },
        h('span', { class: 'mono' }, x.rc), ' · ', [x.escalera && `Esc. ${x.escalera}`, x.planta && `Planta ${x.planta}`, x.puerta && `Puerta ${x.puerta}`, x.uso].filter(Boolean).join(' · ') || x.direccion)));
    } catch (e) {
      di('No se ha podido consultar el Catastro desde el navegador. ', true);
      estado.append(h('a', { href: urlSedeCatastro(''), target: '_blank', rel: 'noopener' }, 'Abrir la Sede del Catastro'), ' y copia la referencia en su campo.');
    }
  };

  return h('div', {},
    h('div', { class: 'acciones' },
      h('button', { class: 'btn', type: 'button', id: 'btn-buscar-direccion', onclick: buscarDireccion }, 'Buscar dirección'),
      h('button', { class: 'btn', type: 'button', onclick: miUbicacion }, 'Mi ubicación (en el sitio)'),
      h('button', { class: 'btn', type: 'button', id: 'btn-catastro', onclick: buscarCatastro }, 'Buscar referencia catastral')),
    estado, lista);
}

// ---------------------------------------------------------------- plano de situación
async function dibujarMarcador(blob) {
  const img = await createImageBitmap(blob);
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  const k = cv.width / 1000; // todo a escala del tamaño de la imagen
  const x = cv.width / 2, y = cv.height / 2;
  g.lineWidth = 6 * k; g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(x, y, 26 * k, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 4 * k; g.strokeStyle = '#c4161c'; g.beginPath(); g.arc(x, y, 26 * k, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#c4161c'; g.beginPath(); g.arc(x, y, 7 * k, 0, Math.PI * 2); g.fill();
  // Norte
  g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(cv.width - 70 * k, 14 * k, 50 * k, 84 * k);
  g.fillStyle = '#1e2226'; g.font = `bold ${30 * k}px Arial`; g.textAlign = 'center'; g.fillText('N', cv.width - 45 * k, 46 * k);
  g.beginPath(); g.moveTo(cv.width - 45 * k, 54 * k); g.lineTo(cv.width - 56 * k, 90 * k); g.lineTo(cv.width - 34 * k, 90 * k); g.closePath(); g.fill();
  return new Promise((ok) => cv.toBlob(ok, 'image/png'));
}

/** Crea el PDF A5 del plano con los datos actuales del aviso y lo guarda en sus archivos. */
async function crearPlanoA5(app, draft) {
  if (!draft.plano) return null;
  const [PDFLib, empresa, mapa] = await Promise.all([cargarPdfLib(), leerEmpresa(app), app.storage.getFile(draft.plano.hash)]);
  const logo = await imagenParaPdf(app, empresa.logo).catch(() => null);
  const aviso = normalizarAviso(draft);
  const bytes = await generarPlanoA5(PDFLib, { aviso, empresa, logo, mapa: mapa && { bytes: new Uint8Array(mapa.bytes), mime: mapa.mime }, escala: draft.plano.escala || 2000 });
  const ficha = await app.storage.putFile({ name: nombrePlanoA5(aviso), mime: 'application/pdf', bytes });
  draft.archivos = (draft.archivos || []).filter((x) => x.tipo !== 'plano_a5');
  draft.archivos.push({ tipo: 'plano_a5', hash: ficha.hash, name: ficha.name, mime: 'application/pdf', size: ficha.size, addedAt: new Date().toISOString() });
  return { ficha, bytes };
}

/**
 * Plano de situación. Devuelve el bloque con .generar({auto}) para que se pueda pedir solo
 * al encontrar la dirección. Un plano subido a mano no se sustituye automáticamente.
 */
export function bloquePlano(app, draft, alCambiar) {
  const vista = h('div', { class: 'logo-caja', id: 'vista-plano' });
  const estado = h('div', { class: 'muted', id: 'estado-plano', 'aria-live': 'polite' });
  const pintar = async () => {
    const b = draft.plano && await app.storage.getFileBlob(draft.plano.hash);
    vista.replaceChildren(b ? h('img', { src: URL.createObjectURL(b), alt: 'Plano de situación', style: 'max-height:260px' }) : h('span', { class: 'muted' }, 'Sin plano de situación'));
  };
  const guardar = async (blob, nombre, extra = {}) => {
    const f = await app.storage.putFile({ name: nombre, mime: blob.type || 'image/png', bytes: new Uint8Array(await blob.arrayBuffer()) });
    draft.plano = { ...f, ...extra };
    alCambiar(); pintar();
  };
  const descargarA5 = async () => {
    try {
      estado.textContent = 'Preparando el plano A5…';
      const r = await crearPlanoA5(app, draft);
      if (!r) { estado.textContent = 'Primero genera o sube el plano.'; return; }
      alCambiar();
      descargar(new Blob([r.bytes], { type: 'application/pdf' }), r.ficha.name);
      estado.textContent = `Plano A5 descargado (${r.ficha.name}). Queda también en los documentos del aviso.`;
    } catch (e) { estado.textContent = 'No se pudo crear el PDF del plano: ' + e.message; }
  };
  const generar = async ({ auto = false } = {}) => {
    const { lat, lon } = draft.suministro;
    if (!coordsValidas(lat, lon)) { if (!auto) estado.textContent = 'Faltan las coordenadas del suministro.'; return; }
    if (auto && draft.plano && !draft.plano.auto) { estado.textContent = 'Hay un plano subido a mano: no se cambia. Pulsa «Generar plano» si quieres el del IGN.'; return; }
    if (auto && draft.plano?.auto && draft.plano.lat === lat && draft.plano.lon === lon) return;
    estado.textContent = 'Generando el plano de situación (IGN, A5 a escala 1:2.000)…';
    try {
      const e = encuadreA5(lat, lon);
      let mapa;
      try {
        const r = await fetch(e.url);
        if (!r.ok) throw new Error();
        mapa = await r.blob();
      } catch (err) {
        // El IGN no deja pedirlo desde el navegador o no responde: se pide a través del PC
        if (!app.estado?.configurado) throw err;
        mapa = await app.sync.geoBlob(e.url);
      }
      const blob = await dibujarMarcador(mapa);
      await guardar(blob, `PLANO_SITUACION_${redondear(lat, 5)}_${redondear(lon, 5)}.png`, { auto: true, lat, lon, escala: e.escala });
      await crearPlanoA5(app, draft);
      alCambiar();
      estado.replaceChildren(`Plano de situación listo (A5, escala 1:2.000)${auto ? ' a partir de la dirección' : ''}; se usará en la memoria. Pulsa Guardar en el aviso. `,
        h('button', { class: 'btn peq', type: 'button', onclick: descargarA5 }, 'Descargar PDF A5'));
    } catch {
      estado.textContent = 'El IGN no ha respondido. Puedes subir una captura del plano con «Subir plano».';
    }
  };
  const subir = h('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    await guardar(await reducirImagen(f), f.name.replace(/\.[^.]+$/, '') + '.jpg');
    estado.textContent = 'Plano añadido. Pulsa Guardar en el aviso.';
  } });
  pintar();
  const el = h('div', {}, vista,
    h('div', { class: 'fila' },
      h('button', { class: 'btn peq prim', type: 'button', id: 'btn-plano', onclick: () => generar() }, 'Generar plano (IGN)'),
      h('button', { class: 'btn peq', type: 'button', id: 'btn-plano-a5', onclick: descargarA5 }, 'Descargar plano A5 (PDF)'),
      h('button', { class: 'btn peq', type: 'button', onclick: () => subir.click() }, 'Subir plano'), subir,
      h('button', { class: 'btn peq', type: 'button', onclick: () => { draft.plano = null; draft.archivos = (draft.archivos || []).filter((x) => x.tipo !== 'plano_a5'); alCambiar(); pintar(); } }, 'Quitar')),
    estado);
  el.generar = generar;
  return el;
}

// ---------------------------------------------------------------- fotografías
/** Reduce una foto a 1600 px como máximo (JPEG) para que la app y la sincronización vayan ágiles. */
export async function reducirImagen(file, max = 1600, calidad = 0.82) {
  try {
    const img = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', calidad));
  } catch { return file; } // formato que el navegador no sabe leer: se guarda tal cual
}

export function bloqueFotos(app, draft, alCambiar, { cgp = true } = {}) {
  const lista = h('div', { class: 'fotos' });
  const pintar = async () => {
    const items = await Promise.all(draft.fotos.map(async (f, i) => {
      const b = await app.storage.getFileBlob(f.hash);
      return h('div', { class: 'foto' + (f.cgp ? ' cgp' : '') },
        b ? h('img', { src: URL.createObjectURL(b), alt: f.nombre || f.name }) : h('div', { class: 'muted' }, 'Sin descargar'),
        h('input', { type: 'text', value: f.nombre || '', placeholder: 'Descripción', 'aria-label': 'Descripción de la foto', oninput: (e) => { f.nombre = e.target.value; alCambiar(); } }),
        cgp ? h('label', { class: 'check-linea' }, h('input', { type: 'radio', name: 'foto-cgp', checked: f.cgp || null, onchange: () => { draft.fotos.forEach((x) => { x.cgp = x === f; }); alCambiar(); pintar(); } }), ' Ubicación CGP') : null,
        h('button', { class: 'btn peq', type: 'button', onclick: () => { draft.fotos.splice(i, 1); alCambiar(); pintar(); } }, 'Quitar'));
    }));
    lista.replaceChildren(...(items.length ? items : [h('p', { class: 'muted' }, 'Sin fotografías.')]));
  };
  const anadir = async (files) => {
    for (const f of files) {
      const blob = await reducirImagen(f);
      const ficha = await app.storage.putFile({ name: f.name.replace(/\.[^.]+$/, '') + '.jpg', mime: blob.type || f.type, bytes: new Uint8Array(await blob.arrayBuffer()) });
      if (!draft.fotos.some((x) => x.hash === ficha.hash)) draft.fotos.push({ ...ficha, nombre: '', cgp: false });
    }
    alCambiar(); pintar();
    toast(`${files.length} foto(s) añadida(s). Pulsa Guardar.`);
  };
  const galeria = h('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none', id: 'fotos-galeria', onchange: (e) => { const f = [...e.target.files]; e.target.value = ''; if (f.length) anadir(f); } });
  const camara = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none', onchange: (e) => { const f = [...e.target.files]; e.target.value = ''; if (f.length) anadir(f); } });
  pintar();
  return h('div', {},
    h('div', { class: 'fila' },
      h('button', { class: 'btn peq prim', type: 'button', onclick: () => camara.click() }, 'Hacer foto'),
      h('button', { class: 'btn peq', type: 'button', onclick: () => galeria.click() }, 'Añadir de la galería'), camara, galeria),
    cgp ? h('p', { class: 'muted' }, 'Marca la foto de la ubicación propuesta de la CGP: irá en el apartado 7 de la memoria; las demás, en el anexo.') : null,
    lista);
}
