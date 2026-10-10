// SOLTEC V2 · Capa 1 · Modelo de dominio: avisos, expedientes, documentación, trámite.
// Funciones puras: no leen ni escriben en la base de datos.

import {
  validarNif, validarCups, validarIban, validarTelefono, validarEmail,
  validarCp, validarRefCatastral, validarNumero,
} from './validate.js';

export const ESTADOS_AVISO = ['Abierto', 'En curso', 'Cerrado'];

export const FASES_TRAMITE = [
  { id: 'datos', label: 'Pendiente de datos' },
  { id: 'firma', label: 'Pendiente de firma' },
  { id: 'presentado', label: 'Presentado' },
  { id: 'distribuidora', label: 'Esperando distribuidora' },
  { id: 'finalizado', label: 'Finalizado' },
];

export const DOCUMENTOS = [
  { id: 'dni', label: 'DNI o CIF' },
  { id: 'autorizacion', label: 'Autorización' },
  { id: 'boletin', label: 'Boletín' },
  { id: 'condiciones', label: 'Condiciones de suministro' },
  { id: 'contrato', label: 'Contrato' },
  { id: 'firmado', label: 'PDF firmado del cliente' },
];

export const ESTADOS_DOC = [
  { id: 'revisar', label: 'Por revisar' },
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'recibido', label: 'Recibido' },
  { id: 'na', label: 'No aplica' },
];

/** Tipos de evento del historial. Los «manuales» se pueden añadir a mano desde la ficha. */
export const EVENTOS = {
  creado: 'Aviso creado',
  actualizado: 'Aviso actualizado',
  tramite: 'Cambio de estado del trámite',
  documento: 'Cambio en documentación',
  condiciones_pdf: 'PDF de condiciones añadido',
  formulario: 'Formulario del cliente preparado',
  firma_pdf: 'Firma incorporada al PDF',
  seguimiento: 'Seguimiento programado',
  seguimiento_hecho: 'Seguimiento completado',
  seguimiento_reabierto: 'Seguimiento reabierto',
  papelera: 'Enviado a la papelera',
  restaurado: 'Recuperado de la papelera',
  // Manuales
  solicitud_presentada: 'Solicitud presentada',
  condiciones_recibidas: 'Condiciones recibidas',
  doc_preparada: 'Documentación preparada',
  doc_enviada: 'Documentación enviada',
  contrato_tramitado: 'Contrato tramitado',
  cliente_informado: 'Cliente informado',
  firma_recibida: 'Firma recibida',
  nota: 'Nota',
};
export const EVENTOS_MANUALES = ['solicitud_presentada', 'condiciones_recibidas', 'doc_preparada', 'doc_enviada', 'contrato_tramitado', 'cliente_informado', 'firma_recibida', 'nota'];

/** Fecha de hoy en hora local (toISOString daría el día anterior entre las 00:00 y las 02:00 en España). */
export function hoyLocal(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

/** Aviso vacío con todos los campos. */
export function nuevoAviso(extra = {}) {
  return {
    numero: '',
    fecha: hoyLocal(),
    estado: 'Abierto',
    concepto: '',
    observaciones: '',
    obra: '',
    presupuesto: { es: false, numero: '' },
    cliente: { nombre: '', contacto: '', nif: '', telefono: '', email: '', iban: '' },
    facturacion: { mismoCliente: true, nombre: '', nif: '', direccion: '', cp: '', poblacion: '', provincia: '' },
    suministro: { direccion: '', piso: '', puerta: '', cp: '', poblacion: '', provincia: '', refCatastral: '', lat: '', lon: '', cups: '' },
    electrico: { potenciaKw: '', tension: '', fases: '', uso: '' },
    condiciones: { ref: '', pdfs: [] }, // pdfs: versiones {hash,name,mime,size,addedAt}, la última es la actual
    tramite: 'datos',
    docs: Object.fromEntries(DOCUMENTOS.map((d) => [d.id, 'revisar'])),
    fotos: [],
    archivos: [], // documentos guardados en el aviso (p. ej. ficha firmada): {tipo, hash, name, mime, size, addedAt}
    ...extra,
  };
}

/**
 * Completa un aviso guardado por otra versión o dispositivo con los campos que le falten,
 * sin cambiar los que ya tiene. Evita fallos al abrir registros antiguos.
 */
export function normalizarAviso(d = {}) {
  const base = nuevoAviso();
  const out = { ...base, ...d, fecha: d.fecha ?? '' };
  for (const k of ['presupuesto', 'cliente', 'facturacion', 'suministro', 'electrico', 'condiciones', 'docs']) {
    out[k] = { ...base[k], ...(d[k] && typeof d[k] === 'object' ? d[k] : {}) };
  }
  out.condiciones.pdfs = Array.isArray(out.condiciones.pdfs) ? out.condiciones.pdfs : [];
  out.fotos = Array.isArray(d.fotos) ? d.fotos : [];
  out.archivos = Array.isArray(d.archivos) ? d.archivos : [];
  return out;
}

/** Grupos de avisos con el mismo número (pasa si dos dispositivos crean avisos sin conexión a la vez). */
export function numerosRepetidos(avisos) {
  const grupos = new Map();
  for (const r of avisos) {
    const n = r.data?.numero;
    if (!n) continue;
    if (!grupos.has(n)) grupos.set(n, []);
    grupos.get(n).push(r);
  }
  return [...grupos.entries()].filter(([, rs]) => rs.length > 1)
    .map(([numero, rs]) => ({ numero, registros: rs.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)) }));
}

/** Siguiente número de aviso del año: 2026-0001, 2026-0002... */
export function siguienteNumero(avisos, fecha = new Date()) {
  const anio = String(fecha.getFullYear());
  let max = 0;
  for (const a of avisos) {
    const m = /^(\d{4})-(\d+)$/.exec(a.data?.numero || '');
    if (m && m[1] === anio) max = Math.max(max, +m[2]);
  }
  return `${anio}-${String(max + 1).padStart(4, '0')}`;
}

/** Regla de Expedientes: tiene referencia de condiciones o algún PDF de condiciones. */
export const isExpediente = (aviso) => !!(aviso?.condiciones?.ref?.trim() || aviso?.condiciones?.pdfs?.length);

export const pdfCondicionesActual = (aviso) => aviso?.condiciones?.pdfs?.at(-1) || null;

/** Añade una versión de PDF de condiciones sin tocar las anteriores. */
export function conPdfCondiciones(aviso, ficha) {
  const pdfs = aviso.condiciones?.pdfs || [];
  if (pdfs.some((p) => p.hash === ficha.hash)) return aviso; // mismo archivo: no se duplica
  return { ...aviso, condiciones: { ...aviso.condiciones, pdfs: [...pdfs, ficha] } };
}

export const direccionCompleta = (s = {}) =>
  [s.direccion, s.piso && `Piso ${s.piso}`, s.puerta && `Puerta ${s.puerta}`].filter(Boolean).join(', ');

/** Nombre de archivo seguro: mayúsculas, sin acentos, separado por guiones bajos. */
export const nombreArchivo = (...partes) =>
  partes.filter(Boolean).join('_').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Nombre del PDF de la memoria CNMC: incluye dirección, piso y puerta. */
export const nombreMemoria = (aviso) => {
  const s = aviso.suministro || {};
  return nombreArchivo('CNMC_CIRCULAR_1_2024_ENDESA', s.direccion || aviso.numero, s.piso && `PISO ${s.piso}`, s.puerta && `PUERTA ${s.puerta}`) + '.pdf';
};

// ---------- Datos pendientes ----------
// Cada comprobación: [ruta del campo, etiqueta, validador, destinos donde se exige]
const v = (fn) => (x) => fn(x);
const requerido = (etq) => (x) => (String(x ?? '').trim() ? null : `Falta ${etq.toLowerCase()}`);

const CHECKS = [
  ['cliente.nombre', 'Cliente', requerido('el nombre del cliente'), ['ficha', 'contrato', 'boletin']],
  ['cliente.nif', 'DNI/NIF/CIF', v(validarNif), ['ficha', 'contrato', 'boletin']],
  ['cliente.telefono', 'Teléfono', v(validarTelefono), ['ficha', 'contrato']],
  ['cliente.email', 'Correo', v(validarEmail), ['ficha', 'contrato']],
  ['cliente.iban', 'IBAN', v(validarIban), ['contrato']],
  ['suministro.direccion', 'Dirección', requerido('la dirección del suministro'), ['ficha', 'contrato', 'boletin']],
  ['suministro.cp', 'Código postal', v(validarCp), ['ficha', 'contrato', 'boletin']],
  ['suministro.poblacion', 'Población', requerido('la población'), ['ficha', 'contrato', 'boletin']],
  ['suministro.provincia', 'Provincia', requerido('la provincia'), ['ficha', 'contrato', 'boletin']],
  ['suministro.cups', 'CUPS', v(validarCups), ['contrato']],
  ['suministro.refCatastral', 'Referencia catastral', v(validarRefCatastral), ['boletin']],
  ['electrico.potenciaKw', 'Potencia (kW)', (x) => validarNumero(x, { etiqueta: 'La potencia' }), ['contrato', 'boletin']],
  ['electrico.tension', 'Tensión', (x) => (['230', '400', '230/400'].includes(String(x)) ? null : 'Indica la tensión: 230 V o 400 V'), ['contrato', 'boletin']],
];

export const DESTINOS = { ficha: 'Ficha de datos del cliente', contrato: 'Contrato', boletin: 'Boletín / memoria CNMC' };

const leer = (obj, ruta) => ruta.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

/**
 * Lista de datos pendientes o con formato incorrecto.
 * @param aviso  data del aviso
 * @param destino  'ficha' | 'contrato' | 'boletin' | undefined (todos)
 * @returns {{campo:string, etiqueta:string, problema:string}[]}
 */
export function datosPendientes(aviso, destino) {
  const out = [];
  for (const [campo, etiqueta, check, destinos] of CHECKS) {
    if (destino && !destinos.includes(destino)) continue;
    const problema = check(leer(aviso, campo));
    if (problema) out.push({ campo, etiqueta, problema });
  }
  // Coherencia potencia/tensión: en monofásico 230 V la potencia normalizada máxima es 14,49 kW.
  const p = Number(String(aviso.electrico?.potenciaKw ?? '').replace(',', '.'));
  if (String(aviso.electrico?.tension) === '230' && p > 14.49 && (!destino || destino !== 'ficha')) {
    out.push({ campo: 'electrico.potenciaKw', etiqueta: 'Potencia (kW)', problema: 'Más de 14,49 kW en 230 V: revisa si debe ser trifásico (400 V)' });
  }
  return out;
}

export const docsPendientes = (aviso) =>
  DOCUMENTOS.filter((d) => aviso.docs?.[d.id] === 'pendiente').map((d) => d.label);

export const firmaPendiente = (aviso) =>
  aviso.tramite === 'firma' || aviso.docs?.firmado === 'pendiente';
