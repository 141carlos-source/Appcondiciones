// SOLTEC V2 · Importación de los datos de la V1.35 (solo lectura: la V1.35 no se toca).
//
// Fuentes admitidas (mismo formato interno):
//  - el archivo del PC central de la V1.35: soltec-sync-pc\data\soltec-central.json
//  - el snapshot que la V2 arma leyendo la V1.35 de este mismo navegador
//
// Reglas:
//  - Cada registro importado tiene un identificador fijo derivado del de la V1.35 (p. ej. «v1-1789…»),
//    así que importar dos veces no duplica nada y nunca pisa lo que ya se cambió en la V2.
//  - Los avisos de la papelera de la V1.35 se importan a la papelera de la V2 (no se pierde nada).
//  - Los avisos reciben un número V2 (2026-0001…) por orden de creación; el número de la V1.35
//    queda guardado en «v1.id» y se puede buscar.

import { nuevoAviso, siguienteNumero, normalizarAviso } from './model.js';
import { memoriaVacia } from './memoria.js';
import { nuevoParte } from './partes.js';
import { desdeV1 } from './empresa.js';
import { canonico } from './backup.js';
import { sha256Hex } from './storage.js';

/** Firma rápida (FNV-1a) del contenido de origen en la V1.35: si cambia, hay algo nuevo que traer. */
function firma(x) {
  const s = typeof x === 'string' ? x : JSON.stringify(x, (k, v) => (typeof v === 'string' && v.length > 2000 ? `${v.length}:${v.slice(0, 64)}:${v.slice(-64)}` : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}
/** Huella de lo importado (sin la ficha «v1»): si no coincide, el registro se ha cambiado en la V2. */
export async function huellaV2(data) {
  const { v1, ...resto } = data || {};
  return sha256Hex(new TextEncoder().encode(canonico(resto)));
}

const K = {
  MAIN: 'APP_AVISOS_WEB_DATOS_V116_PERSISTENTE', CFG: 'APP_AVISOS_CONFIG_V127', FLAGS: 'APP_AVISOS_FLAGS_V120',
  CUPS: 'APP_AVISOS_CUPS_V127', SUM: 'APP_AVISOS_SUMINISTRO_V129', OBRA: 'APP_AVISOS_OBRA_PRESUPUESTO_V135',
  MEMOBS: 'APP_AVISOS_MEMORIA_OBS_V128', GEST: 'APP_AVISOS_GESTION_V135', AGENDA: 'APP_AVISOS_AGENDA_V135',
  PARTES: 'APP_AVISOS_PARTES_V134', PFOTOS: 'APP_AVISOS_PARTES_FOTOS_V135',
};
const P = { COND: 'APP_AVISOS_CONDICIONES_V129_', HIST: 'APP_AVISOS_CONDICIONES_HIST_V135_', FOTOS: 'APP_AVISOS_FOTOS_V123_', TRAB: 'APP_AVISOS_TRABAJOS_V129_' };

const json = (s, d) => { try { const x = typeof s === 'string' ? JSON.parse(s) : s; return x ?? d; } catch { return d; } };
const txt = (v) => (v == null ? '' : String(v).trim());

/** Normaliza el archivo central o un snapshot local a {ls, estado: Map, planos: Map}. */
export function leerSnapshot(entrada) {
  const snap = entrada?.snapshot || entrada;
  if (!snap || !snap.localStorage) throw new Error('El archivo no tiene datos de la V1.35 (falta el snapshot).');
  const ls = snap.localStorage;
  if (!ls[K.MAIN]) throw new Error('El archivo no contiene avisos de la V1.35.');
  const stores = snap.indexedDB?.stores || {};
  const mapa = (lista) => new Map((Array.isArray(lista) ? lista : []).map((x) => [String(x.key), x.value]));
  return { ls, estado: mapa(stores.estado), planos: mapa(stores.planos), revision: entrada?.revision ?? null, fecha: entrada?.updatedAt || null };
}

const tension = (v) => { const s = txt(v).toUpperCase(); return /400|TRIF|3X/.test(s) ? '400' : /230|MONOF/.test(s) ? '230' : ''; };
const kw = (v) => txt(v).replace('.', ',');
const ESTADO = { en_curso: 'En curso', pendiente: 'Abierto', finalizado: 'Cerrado', cerrado: 'Cerrado', abierto: 'Abierto' };

/** Datos técnicos de la V1.35 (tablas con «concepto») → memoria V2 (filas con «aplica»). */
function memoriaDesde(sum) {
  const m = memoriaVacia();
  m.tipoSolicitud = txt(sum?.tipoSolicitud);
  m.usoFinca = txt(sum?.usoFinca);
  const t = sum?.tecnica || {};
  const filas = (dest, orig, campos) => (orig || []).forEach((r, i) => {
    if (!dest[i] || !r) return;
    const aplica = !!txt(r.concepto);
    dest[i] = { ...dest[i], aplica, ...Object.fromEntries(campos.map((c) => [c, txt(r[c])])) };
  });
  filas(m.viviendas, t.viviendas, ['escalera', 'piso', 'puerta', 'potencia', 'tension', 'grado']);
  filas(m.locales, t.locales, ['aclarador', 'potencia', 'tension', 'superficie']);
  filas(m.servicios, t.servicios, ['aclarador', 'potencia', 'tension']);
  filas(m.garajes, t.garajes, ['tipo', 'potencia', 'tension', 'superficie']);
  const si = (v) => /^S[IÍ]$/i.test(txt(v));
  if (t.acumulacion) m.acumulacion = { aplica: si(t.acumulacion.aplica), tipo: txt(t.acumulacion.tipo), potencia: txt(t.acumulacion.potencia), capacidad: txt(t.acumulacion.capacidad) };
  if (t.autoconsumo) m.autoconsumo = { aplica: si(t.autoconsumo.aplica), consumo: txt(t.autoconsumo.consumo), generacion: txt(t.autoconsumo.generacion) };
  return m;
}

/**
 * Prepara la importación sin tocar nada. Devuelve qué se va a crear y las referencias a archivos.
 * Archivo = cualquier valor de la V1.35 que contenga una imagen o un PDF (se decodifica después).
 */
export function planificar(snapshot, { avisosExistentes = [] } = {}) {
  const { ls, estado, planos } = snapshot;
  const main = json(ls[K.MAIN], {});
  const flags = json(ls[K.FLAGS], {}), cups = json(ls[K.CUPS], {}), sum = json(ls[K.SUM], {}), obra = json(ls[K.OBRA], {});
  const memObs = json(ls[K.MEMOBS], {}), gest = json(ls[K.GEST], {})?.byAviso || {};

  const v1avisos = [
    ...(main.avisos || []).map((a) => ({ a, borrado: false })),
    ...(main.papelera || []).map((a) => ({ a, borrado: true })),
  ].filter((x) => x.a && x.a.id != null)
    // Primero los activos y luego los de la papelera, cada grupo por fecha de creación: así los números de los activos van seguidos
    .sort((x, y) => (x.borrado - y.borrado) || txt(x.a.creado || x.a.fecha).localeCompare(txt(y.a.creado || y.a.fecha)));

  // Numeración V2 por año de creación, a continuación de lo que ya haya en la V2
  const numerados = [...avisosExistentes];
  const numeroPrevio = new Map(avisosExistentes.map((r) => [r.id, r.data?.numero]));
  const avisos = v1avisos.map(({ a, borrado }) => {
    const id = String(a.id);
    const f = flags[id] || {}, s = sum[id] || {}, o = obra[id] || {};
    const fechaCreacion = new Date(a.creado || a.fecha || Date.now());
    // Si ya se importó antes, conserva su número V2
    const numero = numeroPrevio.get('v1-' + id) || siguienteNumero(numerados, fechaCreacion);
    if (!numeroPrevio.has('v1-' + id)) numerados.push({ data: { numero } });
    const ref = txt(a.refCondiciones) || txt(s.refCondiciones);
    const observaciones = [txt(a.observaciones), txt(memObs[id]) && txt(memObs[id]) !== txt(a.observaciones) ? txt(memObs[id]) : ''].filter(Boolean).join('\n\n');
    const estadoV1 = txt(a.estado).toLowerCase();
    const d = nuevoAviso({
      numero,
      fecha: txt(a.fecha).slice(0, 10) || fechaCreacion.toISOString().slice(0, 10),
      estado: ESTADO[estadoV1] || 'Abierto',
      concepto: txt(a.concepto),
      observaciones,
      obra: txt(o.obra),
      presupuesto: { es: /^S[IÍ]$/i.test(txt(o.presupuesto)), numero: txt(o.numero) },
      cliente: { nombre: txt(a.cliente), contacto: txt(a.contacto), nif: txt(a.nif).toUpperCase(), telefono: txt(a.telefono), email: txt(a.email), iban: txt(f.iban).toUpperCase() },
      facturacion: { mismoCliente: !txt(s.direccionFiscal), nombre: '', nif: '', direccion: txt(s.direccionFiscal), cp: '', poblacion: '', provincia: '', email: txt(s.emailFiscal) },
      suministro: { direccion: txt(a.direccion), piso: txt(a.piso), puerta: txt(a.puerta), cp: txt(a.cp), poblacion: txt(a.localidad), provincia: txt(a.provincia),
        refCatastral: txt(a.refCatastral).toUpperCase(), lat: txt(a.latitud), lon: txt(a.longitud), cups: txt(a.cupsE).toUpperCase() },
      electrico: { potenciaKw: kw(a.potenciaSolicitada || a.potenciaCalculada), tension: tension(a.tension), fases: '', uso: '',
        potenciaCalculada: kw(a.potenciaCalculada), iga: txt(a.iga), contador: txt(s.contador), contadorCercano: txt(s.contadorCercano) },
      condiciones: { ref, pdfs: [] },
      tramite: estadoV1 === 'finalizado' ? 'finalizado' : 'datos',
      memoria: memoriaDesde(s),
    });
    d.memoria.cupsGas = txt(a.cupsG).toUpperCase();
    d.v1 = { id, creado: txt(a.creado), actualizado: txt(a.actualizado), estado: txt(a.estado), pideCondiciones: !!f.condicionesSuministro, pideContrato: !!f.contratoElectricidad, cupsSolicitado: !!cups[id], importado: null };

    // Archivos (se decodifican al ejecutar)
    const cond = estado.get(P.COND + id);
    const hist = estado.get(P.HIST + id);
    const pdfs = [...(Array.isArray(hist) ? hist : []), ...(cond ? [cond] : [])].map((x) => ({ fuente: x?.blob ?? x, nombre: txt(x?.nombre || x?.blob?.name) || 'CONDICIONES.pdf', fecha: txt(x?.guardadoEn) }));
    const fotos = (Array.isArray(estado.get(P.FOTOS + id)) ? estado.get(P.FOTOS + id) : []).map((x) => ({ fuente: x?.blob ?? x, nombre: txt(x?.nombre), cgp: !!x?.cgp, fecha: txt(x?.creadaEn) }));
    const trabajos = (Array.isArray(estado.get(P.TRAB + id)) ? estado.get(P.TRAB + id) : []).map((x) => ({ fuente: x?.blob ?? x, nombre: txt(x?.nombre) || 'Foto de trabajos', fecha: txt(x?.creadaEn) }));
    const pl = planos.get(id);
    const plano = pl ? { fuente: pl.blob ?? pl, nombre: txt(pl.nombre) || 'PLANO_SITUACION.png' } : null;
    const eventos = ((gest[id] || {}).events || []).map((e) => ({ at: txt(e.at), texto: [txt(e.title), txt(e.note)].filter(Boolean).join(': ') }));
    const fuente = firma([a, f, s, o, memObs[id] || '', gest[id] || null, cond || null, hist || null, estado.get(P.FOTOS + id) || null, estado.get(P.TRAB + id) || null, pl || null, !!cups[id]]);
    return { id: 'v1-' + id, v1Id: id, borrado, data: d, pdfs, fotos, trabajos, plano, eventos, creado: txt(a.creado), fuente };
  });
  const porV1 = new Map(avisos.map((x) => [x.v1Id, x]));

  // Agenda (citas sueltas de la V1.35)
  const agenda = json(ls[K.AGENDA], {});
  const citas = (Array.isArray(agenda.rows) ? agenda.rows : []).filter((r) => r && r.id != null).map((r) => ({
    id: 'v1cita-' + r.id, fuente: firma(r),
    data: {
      titulo: txt(r.title) || txt(r.work) || 'Cita', fecha: txt(r.date), hora: txt(r.time), responsable: txt(r.tech),
      notas: [txt(r.client) && `Cliente: ${txt(r.client)}`, txt(r.address) && `Dirección: ${txt(r.address)}`, txt(r.phone) && `Teléfono: ${txt(r.phone)}`, txt(r.work) && txt(r.work) !== txt(r.title) && `Trabajo: ${txt(r.work)}`, txt(r.notes)].filter(Boolean).join('\n'),
      alarma: !!r.alarm && r.alarm !== '', hecho: /hech|complet|finaliz|termin/i.test(txt(r.status)),
    },
  }));

  // Partes de trabajo
  const pfotos = json(ls[K.PFOTOS], {});
  const partes = (json(ls[K.PARTES], []) || []).filter((p) => p && p.id).map((p) => {
    const aviso = porV1.get(txt(p.avisoId) || txt(p.avisoNo));
    const d = nuevoParte();
    Object.assign(d, {
      numero: txt(p.partNo), fecha: txt(p.fecha).slice(0, 10), avisoNumero: aviso ? aviso.data.numero : txt(p.avisoNo), tecnico: txt(p.tecnico),
      cliente: { nombre: txt(p.cliente), nif: txt(p.nif), contacto: txt(p.contacto), telefono: txt(p.telefono), email: txt(p.email),
        direccion: txt(p.direccion), piso: txt(p.piso), puerta: txt(p.puerta), cp: txt(p.cp), localidad: txt(p.localidad), provincia: txt(p.provincia) },
      trabajos: txt(p.trabajos), conceptos: { desplazamiento: !!p.conceptos?.desplazamiento, disponibilidad: !!p.conceptos?.disponibilidad, urgencia: !!p.conceptos?.urgencia },
      horas: txt(p.manoObraHoras), observaciones: txt(p.observaciones), resultado: txt(p.resultado),
      materiales: (Array.isArray(p.materiales) ? p.materiales : []).map((m) => ({ ref: txt(m.referencia), desc: [txt(m.descripcion), txt(m.observaciones)].filter(Boolean).join(' · '), cantidad: txt(m.cantidad) })),
      cerrado: !!p.locked || /sent|closed|final|cerrad/i.test(txt(p.status)), cerradoAt: txt(p.signedAt) || txt(p.updatedAt) || null,
    });
    d.v1 = { id: txt(p.id), status: txt(p.status), enviado: txt(p.sentAt), via: txt(p.sentVia) };
    return {
      id: 'v1parte-' + p.id, ref: aviso ? aviso.id : null, data: d, fuente: firma([p, pfotos[txt(p.partNo)] || null]),
      firma: p.firmaCliente ? { fuente: p.firmaCliente, nombre: txt(p.firmante), nif: txt(p.firmanteNif).toUpperCase(), fecha: txt(p.signedAt) } : null,
      fotos: (Array.isArray(pfotos[txt(p.partNo)]) ? pfotos[txt(p.partNo)] : []).map((f, i) => ({ fuente: f, nombre: `Foto ${i + 1}` })),
    };
  });

  const empresa = desdeV1({ main: ls[K.MAIN], cfg: ls[K.CFG] });
  const resumen = {
    avisos: avisos.filter((x) => !x.borrado).length, papelera: avisos.filter((x) => x.borrado).length,
    expedientes: avisos.filter((x) => !x.borrado && (x.data.condiciones.ref || x.pdfs.length)).length,
    pdfs: avisos.reduce((n, x) => n + x.pdfs.length, 0), fotos: avisos.reduce((n, x) => n + x.fotos.length + x.trabajos.length, 0) + partes.reduce((n, p) => n + p.fotos.length, 0),
    planos: avisos.filter((x) => x.plano).length, citas: citas.length, partes: partes.length, empresa: !!empresa,
  };
  return { avisos, citas, partes, empresa, resumen, origen: { revision: snapshot.revision, fecha: snapshot.fecha } };
}

// ---------------------------------------------------------------- archivos
/** Valor de archivo de la V1.35 → {bytes, mime}. Admite data:URL, {__soltecBlob,data}, Blob o {blob}. */
export async function decodificar(fuente) {
  if (!fuente) return null;
  if (typeof Blob !== 'undefined' && fuente instanceof Blob) return { bytes: new Uint8Array(await fuente.arrayBuffer()), mime: fuente.type || 'application/octet-stream' };
  if (fuente.blob) return decodificar(fuente.blob);
  const url = typeof fuente === 'string' ? fuente : fuente.data;
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url || '');
  if (!m) return null;
  const mime = m[1] || fuente.mime || 'application/octet-stream';
  let bytes;
  if (m[2]) {
    const s = atob(m[3]);
    bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  } else bytes = new TextEncoder().encode(decodeURIComponent(m[3]));
  return { bytes, mime };
}

const ext = (mime) => ({ 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime] || 'bin');

/**
 * Ejecuta la importación. No pisa nada que ya exista en la V2.
 * @param progreso (texto) => void
 * @returns informe {nuevos:{avisos,citas,partes}, yaEstaban, archivos, errores:[]}
 */
export async function ejecutar(storage, plan, { progreso = () => {}, empresaVaciaRellenar = null } = {}) {
  const inf = { nuevos: { avisos: 0, papelera: 0, citas: 0, partes: 0 }, actualizados: 0, yaEstaban: 0, conservados: [], archivos: 0, errores: [] };
  const guardarArchivo = async (fuente, nombre) => {
    try {
      const f = await decodificar(fuente);
      if (!f || !f.bytes.length) return null;
      const n = /\.[a-z0-9]{2,4}$/i.test(nombre || '') ? nombre : `${nombre || 'archivo'}.${ext(f.mime)}`;
      const ficha = await storage.putFile({ name: n, mime: f.mime, bytes: f.bytes });
      inf.archivos++;
      return ficha;
    } catch (e) { inf.errores.push(`${nombre}: ${e.message}`); return null; }
  };

  /**
   * Decide qué hacer con un registro que viene de la V1.35:
   *  'nuevo'       no existe en la V2
   *  'igual'       la V1.35 no ha cambiado desde la última importación
   *  'actualizar'  la V1.35 cambió y en la V2 no se ha tocado
   *  'conservar'   cambió en las dos: se queda como está en la V2
   */
  const decidir = async (id, fuente) => {
    const e = await storage.get(id);
    if (!e) return { accion: 'nuevo' };
    if (e.data?.v1?.fuente === fuente) return { accion: 'igual', e };
    if (e.data?.v1?.huella && (await huellaV2(e.data)) === e.data.v1.huella) return { accion: 'actualizar', e };
    return { accion: 'conservar', e };
  };
  const sellar = async (d, fuente) => { d.v1 = { ...(d.v1 || {}), fuente, importado: new Date().toISOString() }; d.v1.huella = await huellaV2(d); return d; };

  let i = 0;
  for (const x of plan.avisos) {
    progreso(`Avisos ${++i} de ${plan.avisos.length}…`);
    const { accion, e } = await decidir(x.id, x.fuente);
    if (accion === 'igual') { inf.yaEstaban++; continue; }
    if (accion === 'conservar') { inf.conservados.push(e.data.numero || x.id); continue; }
    const d = normalizarAviso(structuredClone(x.data));
    // Lo que la V1.35 no guarda (trámite y documentación) se mantiene como estaba en la V2
    if (e) { d.numero = e.data.numero; d.tramite = d.tramite === 'finalizado' ? 'finalizado' : e.data.tramite; d.docs = { ...d.docs, ...e.data.docs }; }
    for (const p of x.pdfs) {
      const f = await guardarArchivo(p.fuente, p.nombre);
      if (f && !d.condiciones.pdfs.some((q) => q.hash === f.hash)) d.condiciones.pdfs.push({ ...f, addedAt: p.fecha || f.addedAt });
    }
    if (d.condiciones.pdfs.length && d.docs.condiciones === 'revisar') d.docs.condiciones = 'recibido';
    for (const p of x.fotos) {
      const f = await guardarArchivo(p.fuente, p.nombre || 'foto');
      if (f && !d.fotos.some((q) => q.hash === f.hash)) d.fotos.push({ ...f, nombre: p.nombre, cgp: p.cgp });
    }
    for (const p of x.trabajos) {
      const f = await guardarArchivo(p.fuente, p.nombre);
      if (f && !d.archivos.some((q) => q.hash === f.hash)) d.archivos.push({ tipo: 'foto_trabajos', ...f });
    }
    if (x.plano) d.plano = await guardarArchivo(x.plano.fuente, x.plano.nombre);
    await sellar(d, x.fuente);
    if (!e) {
      await storage.save('aviso', d, { id: x.id, event: { kind: 'nota', text: `Importado de la V1.35 (aviso ${x.v1Id})` } });
      for (const ev of x.eventos) await storage.addEvent(x.id, 'nota', `V1.35 · ${ev.texto}${ev.at ? ' (' + ev.at.slice(0, 10) + ')' : ''}`);
      if (x.borrado) { await storage.trash(x.id, 'estaba en la papelera de la V1.35'); inf.nuevos.papelera++; } else inf.nuevos.avisos++;
    } else {
      await storage.save('aviso', d, { id: x.id, event: { kind: 'nota', text: 'Actualizado con los cambios de la V1.35' } });
      if (x.borrado && !e.deleted) await storage.trash(x.id, 'enviado a la papelera en la V1.35');
      if (!x.borrado && e.deleted) await storage.restore(x.id);
      inf.actualizados++;
    }
  }

  for (const c of plan.citas) {
    const { accion, e } = await decidir(c.id, c.fuente);
    if (accion === 'igual') { inf.yaEstaban++; continue; }
    if (accion === 'conservar') { inf.conservados.push(`cita «${e.data.titulo}»`); continue; }
    const d = await sellar(structuredClone(c.data), c.fuente);
    await storage.save('cita', d, { id: c.id });
    if (e) inf.actualizados++; else inf.nuevos.citas++;
  }

  i = 0;
  for (const p of plan.partes) {
    progreso(`Partes ${++i} de ${plan.partes.length}…`);
    const { accion, e } = await decidir(p.id, p.fuente);
    if (accion === 'igual') { inf.yaEstaban++; continue; }
    if (accion === 'conservar') { inf.conservados.push(`parte ${e.data.numero}`); continue; }
    const d = structuredClone(p.data);
    if (p.firma) {
      const f = await guardarArchivo(p.firma.fuente, 'firma-cliente.png');
      if (f) d.firma = { ...f, nombre: p.firma.nombre, nif: p.firma.nif, fecha: p.firma.fecha ? new Date(p.firma.fecha).toLocaleDateString('es-ES') : '' };
    }
    for (const fo of p.fotos) {
      const f = await guardarArchivo(fo.fuente, fo.nombre);
      if (f) d.fotos.push({ ...f, nombre: fo.nombre });
    }
    await sellar(d, p.fuente);
    await storage.save('parte', d, { id: p.id, ref: p.ref });
    if (e) inf.actualizados++; else inf.nuevos.partes++;
  }

  if (plan.empresa && empresaVaciaRellenar) {
    progreso('Datos de empresa…');
    await empresaVaciaRellenar(plan.empresa);
  }
  progreso('Importación terminada');
  return inf;
}
