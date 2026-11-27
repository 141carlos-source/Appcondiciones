// SOLTEC V2 · Cuadro desde foto: foto del cuadro → unifilar (modelo Palomar 5) → cuadro CHINT con pedido.
// La herramienta es assets/cuadrofoto.html (un único archivo que también funciona suelto).
// Sus datos se guardan dentro del aviso (aviso.cuadroFoto), igual que el resto. Funciones puras.

export const VERSION_CUADRO_FOTO = 1;
export const TIPOS_ARCHIVO_CUADRO = { unifilar: 'unifilar', chint: 'cuadro-chint', foto: 'foto-cuadro' };

const POLOS = ['1P', '1P+N', '2P', '3P', '3P+N', '4P'];
const txt = (v, max = 120) => String(v ?? '').slice(0, max);
const num = (v) => (v === '' || v == null || !Number.isFinite(+v) ? '' : +v);

/** Solo los campos conocidos, con su tipo. Lo demás se descarta. */
export function datosCuadroFoto(d) {
  if (!d || typeof d !== 'object') return null;
  const difs = (Array.isArray(d.difs) ? d.difs : []).slice(0, 40).map((x) => (x?.none
    ? { id: txt(x.id, 30) || 'SD', none: true }
    : { id: txt(x?.id, 30), cal: num(x?.cal) || 40, sens: num(x?.sens) || 30, po: x?.po === '4P' ? '4P' : '2P', tipo: txt(x?.tipo, 6) }));
  const ids = new Set(difs.map((x) => x.id));
  const circ = (Array.isArray(d.circ) ? d.circ : []).slice(0, 200).filter((c) => c && ids.has(c.d)).map((c) => ({
    id: txt(c.id, 30), n: txt(c.n, 60), cal: num(c.cal), cu: ['B', 'C', 'D'].includes(c.cu) ? c.cu : 'C',
    po: POLOS.includes(c.po) ? c.po : '1P+N', d: txt(c.d, 30), l: txt(c.l, 12), p: txt(c.p, 12), s: txt(c.s, 6),
  }));
  const iga = d.iga && typeof d.iga === 'object' ? d.iga : {};
  return {
    obra: txt(d.obra, 160), fecha: txt(d.fecha, 20), rev: txt(d.rev, 10), red: txt(d.red, 60),
    tipoInst: d.tipoInst === 'general' ? 'general' : 'vivienda',
    iga: { cal: num(iga.cal), cu: txt(iga.cu, 2) || 'C', po: iga.po === '2P' ? '2P' : '4P', pdc: txt(iga.pdc, 12) },
    sob: txt(d.sob, 120), perm: !!d.perm,
    difs, circ,
    comprobar: (Array.isArray(d.comprobar) ? d.comprobar : []).slice(0, 40).map((x) => txt(x, 300)).filter(Boolean),
  };
}

export function cuadroFotoVacio() { return { v: VERSION_CUADRO_FOTO, datos: null, leido: null, actualizado: '' }; }

export function normalizarCuadroFoto(c) {
  if (!c || typeof c !== 'object') return cuadroFotoVacio();
  return {
    v: VERSION_CUADRO_FOTO,
    datos: datosCuadroFoto(c.datos),
    leido: datosCuadroFoto(c.leido),
    actualizado: typeof c.actualizado === 'string' ? c.actualizado : '',
  };
}

/** Resumen para la ficha del aviso. */
export function resumenCuadroFoto(c) {
  const d = c?.datos;
  if (!d || !d.circ?.length) return { hay: false, texto: 'Sin cuadro desde foto', actualizado: c?.actualizado || '' };
  const nd = d.difs.filter((x) => !x.none).length;
  const comp = d.comprobar.length ? ` · ${d.comprobar.length} por comprobar en obra` : '';
  return { hay: true, texto: `${nd} diferencial${nd === 1 ? '' : 'es'} y ${d.circ.length} circuitos${comp}`, actualizado: c.actualizado || '' };
}

/** Dirección de la obra a partir del aviso: dirección y población del suministro. */
export function obraDeAviso(a) {
  const s = a?.suministro || {};
  const calle = [s.direccion, s.numero].map((x) => String(x || '').trim()).filter(Boolean).join(' ');
  return [calle, s.poblacion].map((x) => String(x || '').trim()).filter(Boolean).join(', ');
}

/** Datos de empresa para el cajetín, a partir de Ajustes › Empresa. */
export function empresaParaCajetin(e) {
  const em = e?.empresa || {}, t = e?.tecnico || {};
  return {
    nombre: em.nombre || em.nombreComercial || '', nif: (em.nif || '').toUpperCase(), dir: em.direccion || '', cp: em.cp || '',
    loc: em.localidad || '', prov: em.provincia || '', tel: em.telefono || '', email: em.email || '', web: em.web || '',
    instalador: t.numero || '', tecnico: t.nombre || '',
  };
}

/** Ficha de archivo para aviso.archivos. Un PDF nuevo del mismo tipo sustituye al anterior en la lista (la versión vieja sigue guardada). */
export function fichaArchivoCuadro(clase, ficha) {
  const tipo = TIPOS_ARCHIVO_CUADRO[clase] || 'foto-cuadro';
  return { tipo, hash: ficha.hash, name: ficha.name, mime: ficha.mime, size: ficha.size, addedAt: ficha.addedAt || new Date().toISOString() };
}

/** Bytes de un base64 (sin cabecera data:). */
export function base64ABytes(b64) {
  const bin = atob(String(b64).replace(/^data:[^,]*,/, ''));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
