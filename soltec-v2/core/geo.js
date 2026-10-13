// SOLTEC V2 · Localización: CartoCiudad (direcciones), Catastro (referencias) e IGN (plano).
// Solo funciones puras: construyen direcciones de consulta e interpretan respuestas.

export const CARTO = 'https://www.cartociudad.es/geocoder/api/geocoder';
export const CATASTRO = 'https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero';

// Se usan las respuestas JSON normales (no JSONP): el navegador las pide directamente y, si
// CartoCiudad no lo permite, se piden a través del PC de casa (ver consultarGeo en ubicacion.js).
export const urlCandidatos = (q, limite = 8) => `${CARTO}/candidates?q=${encodeURIComponent(q)}&limit=${limite}`;
export const urlBuscar = (c) => `${CARTO}/find?q=${encodeURIComponent(c.address || '')}&type=${encodeURIComponent(c.type || '')}&tip_via=${encodeURIComponent(c.tip_via || '')}&id=${encodeURIComponent(c.id || '')}&portal=${encodeURIComponent(c.portalNumber ?? '')}`;
export const urlInversa = (lat, lon) => `${CARTO}/reverseGeocode?lat=${lat}&lon=${lon}`;
/** Versión JSONP (respaldo si la petición normal falla). */
export const aJsonp = (url) => url.replace(/\/(candidates|find|reverseGeocode)\?/, (m, x) => `/${x}Jsonp?`);
export const NOMINATIM = 'https://nominatim.openstreetmap.org';
/** Respaldo cuando CartoCiudad no responde: OpenStreetMap (Nominatim). */
export const urlNominatim = ({ calle, numero, poblacion, cp }) => {
  const p = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', countrycodes: 'es', limit: '6', 'accept-language': 'es' });
  if (calle) p.set('street', [numero, calle].filter(Boolean).join(' '));
  if (poblacion) p.set('city', poblacion);
  if (cp) p.set('postalcode', cp);
  return `${NOMINATIM}/search?${p}`;
};
export const urlParcelaCercana = (lat, lon) => `${CATASTRO}/COVCCoordenadas.svc/json/Consulta_RCCOOR_Distancia?CoorX=${lon}&CoorY=${lat}&SRS=EPSG:4326`;
export const urlInmuebles = (rc14) => `${CATASTRO}/COVCCallejero.svc/json/Consulta_DNPRC?RefCat=${encodeURIComponent(rc14)}`;
export const urlSedeCatastro = (rc14) => `https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?refcat=${encodeURIComponent(rc14 || '')}`;

const num = (v) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : null; };
export const coordsValidas = (lat, lon) => { const a = num(lat), b = num(lon); return a !== null && b !== null && a > 27 && a < 44.5 && b > -18.5 && b < 4.6; };
export const redondear = (v, d = 6) => String(Math.round(num(v) * 10 ** d) / 10 ** d);

const MAY = (v) => String(v || '').trim().toLocaleUpperCase('es-ES');

/** Candidato de CartoCiudad → campos del aviso (calle y número por separado, en mayúsculas). */
export function desdeCartoCiudad(c = {}) {
  const via = MAY([c.tip_via, c.address].filter(Boolean).join(' '));
  const numero = c.portalNumber && String(c.portalNumber) !== '0' ? MAY(c.portalNumber) + MAY(c.extension || '') : '';
  return {
    direccion: via,
    numero,
    cp: c.postalCode || '',
    poblacion: MAY(c.poblacion || c.muni || ''),
    provincia: MAY(c.province || ''),
    lat: c.lat != null ? redondear(c.lat) : '',
    lon: c.lng != null ? redondear(c.lng) : '',
    refCatastral: c.refCatastral && /^[0-9A-Z]{14}/.test(c.refCatastral) ? c.refCatastral : '',
    texto: [[via, numero].filter(Boolean).join(' '), c.postalCode, MAY(c.poblacion || c.muni), MAY(c.province)].filter(Boolean).join(', '),
  };
}

/** Resultado de Nominatim (OpenStreetMap) → mismos campos. */
export function desdeNominatim(n = {}) {
  const a = n.address || {};
  const via = MAY(a.road || a.pedestrian || a.footway || a.square || '');
  const numero = MAY(a.house_number || '');
  const poblacion = MAY(a.city || a.town || a.village || a.municipality || a.hamlet || '');
  const provincia = MAY(a.province || a.county || a.state_district || '');
  return {
    direccion: via, numero, cp: a.postcode || '', poblacion, provincia,
    lat: n.lat != null ? redondear(n.lat) : '', lon: n.lon != null ? redondear(n.lon) : '', refCatastral: '',
    texto: [[via, numero].filter(Boolean).join(' '), a.postcode, poblacion, provincia].filter(Boolean).join(', '),
  };
}

/** Respuesta de Consulta_RCCOOR_Distancia → parcelas cercanas [{rc14, direccion, distancia}]. */
export function parcelasCercanas(json) {
  const r = json?.Consulta_RCCOOR_DistanciaResult;
  if (!r || r.lerr) return [];
  const lista = [];
  for (const cd of [].concat(r.coordenadas_distancias?.coordd || [])) {
    for (const p of [].concat(cd.lpcd || [])) {
      if (p?.pc?.pc1 && p?.pc?.pc2) lista.push({ rc14: p.pc.pc1 + p.pc.pc2, direccion: p.ldt || '', distancia: num(p.dis) });
    }
  }
  return lista.sort((a, b) => (a.distancia ?? 1e9) - (b.distancia ?? 1e9));
}

const rc20 = (rc) => (rc?.pc1 && rc?.pc2 && rc?.car ? rc.pc1 + rc.pc2 + rc.car + (rc.cc1 || '') + (rc.cc2 || '') : '');

/** Respuesta de Consulta_DNPRC → inmuebles [{rc, escalera, planta, puerta, uso, direccion}]. */
export function inmueblesParcela(json) {
  const r = json?.consulta_dnprcResult;
  if (!r || r.lerr) return [];
  if (r.bico?.bi) {
    const bi = r.bico.bi;
    const li = bi.dt?.locs?.lous?.lourb?.loint || {};
    return [{ rc: rc20(bi.idbi?.rc), escalera: li.es || '', planta: li.pt || '', puerta: li.pu || '', uso: bi.debi?.luso || '', direccion: bi.ldt || '' }].filter((x) => x.rc);
  }
  return [].concat(r.lrcdnp?.rcdnp || []).map((x) => {
    const li = x.dt?.locs?.lous?.lourb?.loint || {};
    const dir = x.dt?.locs?.lous?.lourb?.dir || {};
    return { rc: rc20(x.rc), escalera: li.es || '', planta: li.pt || '', puerta: li.pu || '', uso: x.debi?.luso || '', direccion: [dir.tv, dir.nv, dir.pnp].filter(Boolean).join(' ') };
  }).filter((x) => x.rc);
}

const normPlanta = (s) => String(s || '').toUpperCase().replace(/[ºª°.\s]/g, '').replace(/^0+(?=\d)/, '');
/** El inmueble que coincide con el piso y la puerta del aviso (si hay uno claro). */
export function inmuebleQueCoincide(lista, piso, puerta) {
  if (lista.length === 1) return lista[0];
  const p = normPlanta(piso), q = normPlanta(puerta);
  if (!p && !q) return null;
  const ok = lista.filter((x) => (!p || normPlanta(x.planta) === p) && (!q || normPlanta(x.puerta) === q));
  return ok.length === 1 ? ok[0] : null;
}

/** Coordenadas geográficas → Web Mercator (EPSG:3857). */
export function mercator(lat, lon) {
  const R = 20037508.34;
  const x = (num(lon) * R) / 180;
  const y = (Math.log(Math.tan(((90 + num(lat)) * Math.PI) / 360)) / (Math.PI / 180)) * (R / 180);
  return { x, y };
}

/** Mapa base del IGN centrado en el punto (≈ 440 × 330 m). */
export function urlPlanoIgn(lat, lon, ancho = 1000, alto = 760, semiX = 220, semiY = 165) {
  const p = mercator(lat, lon);
  const bbox = [p.x - semiX, p.y - semiY, p.x + semiX, p.y + semiY].join(',');
  return `https://www.ign.es/wms-inspire/ign-base?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=IGNBaseTodo&STYLES=&CRS=EPSG:3857&BBOX=${encodeURIComponent(bbox)}&WIDTH=${ancho}&HEIGHT=${alto}&FORMAT=image/png&TRANSPARENT=FALSE`;
}
