// SOLTEC V2 · Localización (CartoCiudad), referencia catastral (Catastro), plano (IGN) y fotografías.
// Si un servicio público no responde, se puede seguir a mano: nada bloquea el aviso.

import { h, toast } from '../ui.js';
import {
  urlCandidatos, urlBuscar, urlInversa, urlParcelaCercana, urlInmuebles, urlSedeCatastro, urlPlanoIgn,
  desdeCartoCiudad, parcelasCercanas, inmueblesParcela, inmuebleQueCoincide, coordsValidas, redondear,
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
 * Bloque de localización. «poner(ruta, valor)» escribe en el aviso y en su campo de la ficha.
 */
export function bloqueUbicacion(app, draft, poner, alCambiar) {
  const estado = h('div', { class: 'muted', id: 'estado-ubicacion', 'aria-live': 'polite' });
  const lista = h('div', { class: 'lista' });
  const di = (t, err = false) => { estado.textContent = t; estado.classList.toggle('error-texto', err); };

  const aplicar = (r, { soloVacios = false } = {}) => {
    for (const k of ['direccion', 'cp', 'poblacion', 'provincia', 'lat', 'lon', 'refCatastral']) {
      if (!r[k]) continue;
      if (soloVacios && String(draft.suministro[k] || '').trim()) continue;
      poner('suministro.' + k, r[k]);
    }
  };

  const buscarDireccion = async () => {
    const q = [draft.suministro.direccion, draft.suministro.poblacion || draft.suministro.cp, draft.suministro.provincia].filter(Boolean).join(', ');
    if (!draft.suministro.direccion) { di('Escribe primero la dirección (y mejor también la población).', true); return; }
    di('Buscando en CartoCiudad…');
    lista.replaceChildren();
    try {
      const cands = [].concat(await jsonp(urlCandidatos(q)) || []);
      if (!cands.length) { di('CartoCiudad no encuentra esa dirección. Revisa la calle y el número, o sigue a mano.', true); return; }
      di('Elige la dirección correcta:');
      lista.replaceChildren(...cands.slice(0, 8).map((c) => {
        const r = desdeCartoCiudad(c);
        return h('button', { class: 'tarjeta', type: 'button', style: 'text-align:left;width:100%', onclick: async () => {
          let fin = r;
          if (!r.lat || !r.lon) {
            try { fin = { ...r, ...Object.fromEntries(Object.entries(desdeCartoCiudad(await jsonp(urlBuscar(c)))).filter(([, v]) => v)) }; } catch { /* sin coordenadas */ }
          }
          aplicar(fin);
          lista.replaceChildren();
          di(fin.lat ? `Dirección aplicada con coordenadas ${fin.lat}, ${fin.lon}.` : 'Dirección aplicada (sin coordenadas: usa «Mi ubicación» en el sitio).');
        } }, r.texto || c.address);
      }));
    } catch (e) { di(`CartoCiudad no responde (${e.message}). Puedes seguir rellenando a mano.`, true); }
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
        const r = desdeCartoCiudad(await jsonp(urlInversa(lat, lon)));
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
      const parcelas = parcelasCercanas(await json(urlParcelaCercana(lat, lon)));
      if (!parcelas.length) { di('El Catastro no tiene parcelas en esas coordenadas.', true); return; }
      const parcela = parcelas[0];
      const inm = inmueblesParcela(await json(urlInmuebles(parcela.rc14)));
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
      h('button', { class: 'btn', type: 'button', id: 'btn-buscar-direccion', onclick: buscarDireccion }, 'Buscar dirección (CartoCiudad)'),
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
  const x = cv.width / 2, y = cv.height / 2;
  g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(x, y, 26, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 4; g.strokeStyle = '#c4161c'; g.beginPath(); g.arc(x, y, 26, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#c4161c'; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
  // Norte
  g.fillStyle = '#1e2226'; g.font = 'bold 30px Arial'; g.fillText('N', cv.width - 52, 52);
  g.beginPath(); g.moveTo(cv.width - 42, 62); g.lineTo(cv.width - 52, 92); g.lineTo(cv.width - 32, 92); g.closePath(); g.fill();
  // Fuente
  g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(0, cv.height - 30, 360, 30);
  g.fillStyle = '#1e2226'; g.font = '16px Arial'; g.fillText('Cartografía: © Instituto Geográfico Nacional', 10, cv.height - 10);
  return new Promise((ok) => cv.toBlob(ok, 'image/png'));
}

export function bloquePlano(app, draft, alCambiar) {
  const vista = h('div', { class: 'logo-caja', id: 'vista-plano' });
  const estado = h('div', { class: 'muted' });
  const pintar = async () => {
    const b = draft.plano && await app.storage.getFileBlob(draft.plano.hash);
    vista.replaceChildren(b ? h('img', { src: URL.createObjectURL(b), alt: 'Plano de situación', style: 'max-height:260px' }) : h('span', { class: 'muted' }, 'Sin plano de situación'));
  };
  const guardar = async (blob, nombre) => {
    draft.plano = await app.storage.putFile({ name: nombre, mime: blob.type || 'image/png', bytes: new Uint8Array(await blob.arrayBuffer()) });
    alCambiar(); pintar();
  };
  const generar = async () => {
    const { lat, lon } = draft.suministro;
    if (!coordsValidas(lat, lon)) { estado.textContent = 'Faltan las coordenadas del suministro.'; return; }
    estado.textContent = 'Generando el plano con cartografía del IGN…';
    try {
      const r = await fetch(urlPlanoIgn(lat, lon));
      if (!r.ok) throw new Error();
      const blob = await dibujarMarcador(await r.blob());
      await guardar(blob, `PLANO_SITUACION_${redondear(lat, 5)}_${redondear(lon, 5)}.png`);
      estado.textContent = 'Plano generado. Pulsa Guardar en el aviso.';
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
  return h('div', {}, vista,
    h('div', { class: 'fila' },
      h('button', { class: 'btn peq prim', type: 'button', id: 'btn-plano', onclick: generar }, 'Generar plano (IGN)'),
      h('button', { class: 'btn peq', type: 'button', onclick: () => subir.click() }, 'Subir plano'), subir,
      h('button', { class: 'btn peq', type: 'button', onclick: () => { draft.plano = null; alCambiar(); pintar(); } }, 'Quitar')),
    estado);
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
