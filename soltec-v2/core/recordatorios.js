// SOLTEC V2 · Recordatorios automáticos: cosas enviadas o pedidas que llevan días sin respuesta.
//   · Condiciones solicitadas hace N días sin respuesta (de la distribuidora)
//   · Autorización enviada hace N días sin firmar
//   · Documentación enviada al cliente hace N días sin respuesta
// Salen del historial del aviso y de sus datos: no hay que apuntar nada aparte.
// «Reclamado hoy» vuelve a contar los días desde hoy; «Ya está» lo quita hasta que se vuelva a pedir.
// Funciones puras: reciben los registros y la fecha de referencia.

/** Días por defecto antes de avisar (0 = no avisar). Se cambian en Ajustes y se guardan con la empresa. */
export const PLAZOS_RECORDATORIO = { condiciones: 15, autorizacion: 7, documentacion: 10 };

export const TIPOS_RECORDATORIO = [
  { id: 'condiciones', label: 'Condiciones solicitadas sin respuesta', texto: (n) => `Condiciones solicitadas hace ${n} días sin respuesta` },
  { id: 'autorizacion', label: 'Autorización enviada sin firmar', texto: (n) => `Autorización enviada hace ${n} días sin firmar` },
  { id: 'documentacion', label: 'Documentación enviada al cliente sin respuesta', texto: (n) => `Documentación enviada al cliente hace ${n} días sin respuesta` },
];

/** Plazos de la empresa (registro «empresa».recordatorios) con los de por defecto para lo que falte. */
export function plazosDe(empresa) {
  const p = { ...PLAZOS_RECORDATORIO };
  const e = empresa?.recordatorios || {};
  for (const k of Object.keys(p)) {
    const n = Number(e[k]);
    if (e[k] !== undefined && e[k] !== '' && Number.isFinite(n) && n >= 0) p[k] = Math.round(n);
  }
  return p;
}

const DIA = 86400000;
/** Medianoche local de una fecha. */
const dia0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** Días naturales entre una fecha (ISO o Date) y ahora. */
export function diasDesde(desde, ahora = new Date()) {
  const d = desde instanceof Date ? desde : new Date(desde);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((dia0(ahora) - dia0(d)) / DIA);
}

/**
 * Fecha de envío de la autorización: «22/10/2026 17:30» (como la guarda el formulario) o ISO.
 * @returns {string|null} ISO
 */
export function fechaEnvio(txt) {
  const s = String(txt || '').trim();
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?/.exec(s);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 12), +(m[5] || 0)).toISOString();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** El trámite pasó a «Presentado» o «Esperando distribuidora» (texto «… → Presentado»). */
const esSolicitud = (e) => e.kind === 'solicitud_presentada' || (e.kind === 'tramite' && /→\s*(Presentado|Esperando distribuidora)\s*$/.test(e.text || ''));
const ultima = (evs, cond) => evs.filter(cond).reduce((m, e) => (!m || e.at > m ? e.at : m), null);
const despues = (evs, desde, cond) => evs.some((e) => e.at > desde && cond(e));

/**
 * Recordatorios de todos los avisos abiertos.
 * @param avisos   registros de tipo aviso (sin papelera)
 * @param eventos  registros de tipo evento (historial: {ref, data:{at, kind, text, tipo?}})
 * @param ahora    fecha de referencia
 * @param plazos   días por tipo (plazosDe(empresa))
 * @returns {Array<{registro, tipo, dias, desde, texto, numero, cliente}>} los más antiguos primero
 */
export function recordatorios(avisos, eventos, ahora = new Date(), plazos = PLAZOS_RECORDATORIO) {
  const porAviso = new Map();
  for (const ev of eventos) {
    if (ev.deleted || !ev.ref) continue;
    if (!porAviso.has(ev.ref)) porAviso.set(ev.ref, []);
    porAviso.get(ev.ref).push(ev.data || {});
  }
  const out = [];
  for (const r of avisos) {
    const a = r.data || {};
    if (r.deleted || a.tramite === 'finalizado' || a.estado === 'Cerrado') continue;
    const evs = porAviso.get(r.id) || [];
    const reclamado = (tipo) => ultima(evs, (e) => e.kind === 'reclamado' && e.tipo === tipo);
    const resuelto = (tipo, desde) => despues(evs, desde, (e) => e.kind === 'recordatorio_resuelto' && e.tipo === tipo);
    const poner = (tipo, desde) => {
      const plazo = plazos[tipo];
      if (!plazo || !desde || resuelto(tipo, desde)) return;
      const rec = reclamado(tipo);
      const cuenta = rec && rec > desde ? rec : desde; // desde el último «Reclamado»
      const dias = diasDesde(cuenta, ahora);
      if (dias == null || dias < plazo) return;
      const t = TIPOS_RECORDATORIO.find((x) => x.id === tipo);
      out.push({ registro: r, tipo, dias, desde: cuenta, reclamado: cuenta !== desde, texto: t.texto(dias), numero: a.numero || '', cliente: a.cliente?.nombre || '(sin nombre)' });
    };

    // 1. Condiciones: pedidas a la distribuidora y sin PDF de condiciones ni «Condiciones recibidas» después
    const sol = ultima(evs, esSolicitud);
    if (sol) {
      const pdfDespues = (a.condiciones?.pdfs || []).some((p) => (p.addedAt || '') > sol);
      const recibidas = ['recibido', 'na'].includes(a.docs?.condiciones) || pdfDespues
        || despues(evs, sol, (e) => e.kind === 'condiciones_pdf' || e.kind === 'condiciones_recibidas');
      if (!recibidas) poner('condiciones', sol);
    }

    // 2. Autorización: enviada por correo y sin la firma del solicitante (ni marcada como recibida)
    const d = a.autorizacion?.datos;
    const env = d && d.env_correo !== 'no' ? fechaEnvio(d.env_fecha) : null;
    if (env && !d.firma_sol && !['recibido', 'na'].includes(a.docs?.autorizacion)) poner('autorizacion', env);

    // 3. Documentación enviada al cliente sin que lleguen sus datos o la firma
    const doc = ultima(evs, (e) => e.kind === 'doc_enviada');
    if (doc && !despues(evs, doc, (e) => ['doc_recibida', 'firma_recibida', 'firma_pdf'].includes(e.kind))) poner('documentacion', doc);
  }
  return out.sort((x, y) => y.dias - x.dias || String(x.numero).localeCompare(String(y.numero)));
}
