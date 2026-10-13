// SOLTEC V2 · Capa 1 · Buscador único, duplicados y bandeja «Qué toca hoy».
// Funciones puras sobre listas de registros (las da Storage.list).

import { isExpediente, datosPendientes, docsPendientes, firmaPendiente, FASES_TRAMITE, direccionCompleta, calleNumero } from './model.js';
import { cupsBase } from './validate.js';

/** Minúsculas, sin acentos y sin separadores habituales. */
export const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[\s.,;:\-_/\\()º°ª#]+/g, ' ').trim();
const compacto = (s) => norm(s).replace(/ /g, '');

// Tipos de vía que se ignoran al comparar direcciones («C/», «Calle», «Avda.»...).
const TIPOS_VIA = /^(c|cl|calle|av|avda|avd|avenida|pz|pza|plaza|pl|ctra|carretera|cr|p|po|pº|paseo|ps|cm|camino|ronda|rda|travesia|trv|urb|urbanizacion|pol|poligono|glorieta|gta)\b ?/;
const compactoDir = (s) => {
  const n = norm(String(s ?? '').replace(/^\s*c\s*\//i, 'c '));
  return n.replace(TIPOS_VIA, '').replace(/\b(de|del|la|las|el|los)\b/g, '').replace(/ /g, '');
};
const digitos = (s) => String(s ?? '').replace(/\D/g, '');

function textoBusqueda(a) {
  const c = a.cliente || {}, s = a.suministro || {};
  return [c.nombre, c.contacto, calleNumero(s), s.piso, s.puerta, s.poblacion, a.numero, a.condiciones?.ref, s.cups, a.obra, a.v1?.id].map(norm).join(' | ');
}

/**
 * Buscador único. Excluye la papelera (Storage.list ya la excluye).
 * Coincide si TODAS las palabras aparecen; teléfono y CUPS también sin espacios.
 */
export function buscar(registros, consulta) {
  const q = norm(consulta);
  if (!q) return [];
  const palabras = q.split(' ');
  const qDig = digitos(consulta);
  const qComp = compacto(consulta);
  return registros.filter((r) => {
    const a = r.data;
    const t = textoBusqueda(a);
    if (palabras.every((p) => t.includes(p))) return true;
    if (qDig.length >= 6 && digitos(a.cliente?.telefono).includes(qDig)) return true;
    if (qComp.length >= 6 && [a.suministro?.cups, a.condiciones?.ref, a.numero, a.v1?.id].some((x) => compacto(x).includes(qComp))) return true;
    return false;
  }).map((r) => ({ registro: r, expediente: isExpediente(r.data) }));
}

/** Posibles duplicados por CUPS o por dirección+piso+puerta (+CP). No incluye el propio registro. */
export function duplicados(aviso, registros, idPropio) {
  const s = aviso.suministro || {};
  const cups = cupsBase(s.cups);
  const dir = compactoDir(calleNumero(s)) && [compactoDir(calleNumero(s)), compacto(s.piso), compacto(s.puerta), s.cp || ''].join('|');
  const out = [];
  for (const r of registros) {
    if (r.id === idPropio || r.deleted) continue;
    const o = r.data.suministro || {};
    const motivos = [];
    if (cups.length === 20 && cupsBase(o.cups) === cups) motivos.push('mismo CUPS');
    const odir = compactoDir(calleNumero(o)) && [compactoDir(calleNumero(o)), compacto(o.piso), compacto(o.puerta), o.cp || ''].join('|');
    if (dir && odir && (dir === odir || (!s.cp || !o.cp) && dir.split('|').slice(0, 3).join('|') === odir.split('|').slice(0, 3).join('|'))) motivos.push('misma dirección, piso y puerta');
    if (motivos.length) out.push({ registro: r, motivos });
  }
  return out;
}

export const FILTROS_BANDEJA = [
  { id: 'todo', label: 'Todo pendiente' },
  { id: 'hoy', label: 'Seguimientos para hoy' },
  { id: 'vencidos', label: 'Seguimientos vencidos' },
  { id: 'datos', label: 'Datos pendientes' },
  { id: 'firma', label: 'Firma del cliente' },
  { id: 'docs', label: 'Documentación pendiente' },
];

const hoyISO = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

/**
 * Bandeja «Qué toca hoy».
 * @param avisos  registros de tipo aviso (sin papelera)
 * @param citas   registros de tipo cita (sin papelera); los seguimientos tienen ref = id del aviso
 * @param filtro  id de FILTROS_BANDEJA
 * @param ahora   fecha de referencia (para pruebas)
 */
export function bandeja(avisos, citas, filtro = 'todo', ahora = new Date()) {
  const hoy = hoyISO(ahora);
  const segPorAviso = new Map();
  for (const c of citas) {
    if (!c.ref || c.data.hecho) continue;
    const prev = segPorAviso.get(c.ref);
    if (!prev || (c.data.fecha || '') < (prev.data.fecha || '')) segPorAviso.set(c.ref, c);
  }
  const out = [];
  for (const r of avisos) {
    const a = r.data;
    if (a.tramite === 'finalizado' || a.estado === 'Cerrado') continue;
    const seg = segPorAviso.get(r.id) || null;
    const f = seg?.data.fecha || '';
    const item = {
      registro: r,
      cliente: a.cliente?.nombre || '(sin nombre)',
      direccion: direccionCompleta(a.suministro),
      numero: a.numero,
      refCondiciones: a.condiciones?.ref || '',
      tramite: FASES_TRAMITE.find((x) => x.id === a.tramite)?.label || '',
      faltan: datosPendientes(a),
      docs: docsPendientes(a),
      firma: firmaPendiente(a),
      seguimiento: seg && { id: seg.id, texto: seg.data.titulo, fecha: f, hora: seg.data.hora || '', responsable: seg.data.responsable || '' },
      hoy: !!f && f === hoy,
      vencido: !!f && f < hoy,
    };
    const incluir = {
      todo: item.hoy || item.vencido || item.faltan.length || item.docs.length || item.firma,
      hoy: item.hoy,
      vencidos: item.vencido,
      datos: item.faltan.length > 0,
      firma: item.firma,
      docs: item.docs.length > 0,
    }[filtro];
    if (incluir) out.push(item);
  }
  // Primero vencidos, luego hoy, luego por fecha de seguimiento y por número.
  const peso = (i) => (i.vencido ? 0 : i.hoy ? 1 : i.seguimiento ? 2 : 3);
  return out.sort((x, y) => peso(x) - peso(y) || (x.seguimiento?.fecha || '').localeCompare(y.seguimiento?.fecha || '') || String(x.numero).localeCompare(String(y.numero)));
}
