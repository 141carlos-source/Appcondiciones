// SOLTEC V2 · Datos de empresa (registro «config» con id «empresa», se sincroniza).
// Funciones puras + importación desde la V1.35 (misma web, lectura sin modificar nada).

export const ID_EMPRESA = 'empresa';

export function empresaVacia() {
  return {
    empresa: { nombre: '', nombreComercial: '', nif: '', telefono: '', email: '', web: '', direccion: '', cp: '', localidad: '', provincia: '' },
    tecnico: { nombre: '', nif: '', telefono: '', email: '', numero: '', colegiado: '' },
    solicitante: { nombre: '', nif: '', telefono: '', email: '', direccion: '', cp: '', localidad: '', provincia: '' },
    correos: { nuevosSuministros: '', solicitarCups: '', comercializadora: '', inspeccion: '' },
    logo: null, firma: null, sello: null, // fichas de archivo {hash, name, mime, size}
  };
}

export function normalizarEmpresa(d = {}) {
  const b = empresaVacia();
  const out = { ...b, ...d };
  for (const k of ['empresa', 'tecnico', 'solicitante', 'correos']) out[k] = { ...b[k], ...(d[k] && typeof d[k] === 'object' ? d[k] : {}) };
  return out;
}

/** Lo mínimo para el formulario PDF del cliente: nombre y logo. */
export function faltaParaFormulario(e) {
  const f = [];
  if (!e?.empresa?.nombre && !e?.empresa?.nombreComercial) f.push('nombre de la empresa');
  if (!e?.logo) f.push('logo');
  return f;
}

export const nombreEmpresa = (e) => e?.empresa?.nombreComercial || e?.empresa?.nombre || 'SOLTEC';

const parse = (raw) => { try { const x = JSON.parse(raw || ''); return x && typeof x === 'object' ? x : null; } catch { return null; } };
const pick = (o, ks) => Object.fromEntries(ks.map((k) => [k, o && o[k] != null ? String(o[k]) : '']));

/**
 * Convierte los datos de la V1.35 (localStorage o archivo «Base de empresa») al formato V2.
 * @returns {{datos, imagenes:{logo?:string, firma?:string, sello?:string}} | null}  imágenes como data:URL
 */
export function desdeV1({ main, cfg, base } = {}) {
  let emp, tec, sol, emails, img;
  if (base && base.schema === 'SOLTEC_EMPRESA_BASE_V1') {
    emp = base.empresa; tec = base.tecnico; sol = base.solicitante; emails = base.contactos?.emails; img = base.identidadVisual || {};
  } else {
    const p = parse(main) || {}, c = parse(cfg) || {};
    emp = p.empresa; tec = p.tecnico; sol = p.solicitante; emails = c.emails;
    img = { logoData: p.empresa?.logoData, firmaData: c.firmaData, selloData: c.selloData };
  }
  if (!emp && !tec && !sol) return null;
  const v = empresaVacia();
  const datos = {
    ...v,
    empresa: { ...v.empresa, ...pick(emp, Object.keys(v.empresa)) },
    tecnico: { ...v.tecnico, ...pick(tec, Object.keys(v.tecnico)) },
    solicitante: { ...v.solicitante, ...pick(sol, Object.keys(v.solicitante)) },
    correos: { ...v.correos, ...pick(emails, Object.keys(v.correos)) },
  };
  const esImg = (s) => typeof s === 'string' && /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/.test(s);
  const imagenes = {};
  if (esImg(img.logoData)) imagenes.logo = img.logoData;
  if (esImg(img.firmaData)) imagenes.firma = img.firmaData;
  if (esImg(img.selloData)) imagenes.sello = img.selloData;
  if (!Object.values(datos.empresa).some(Boolean) && !imagenes.logo) return null;
  return { datos, imagenes };
}

export function dataUrlAArchivo(dataUrl, nombre) {
  const [cab, b64] = dataUrl.split(',');
  const mime = cab.slice(5, cab.indexOf(';'));
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  const ext = mime.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  return { name: `${nombre}.${ext}`, mime, bytes };
}
