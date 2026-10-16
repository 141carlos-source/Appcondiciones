// SOLTEC V2 · Autorización de representatividad y destinatario de facturación (modelo de e-distribución).
// El formulario es assets/autorizacion.html (un único archivo que también funciona suelto).
// Sus datos se guardan dentro del aviso (aviso.autorizacion), igual que el resto. Funciones puras.

export const VERSION_AUTORIZACION = 1;

/** Claves del formulario (todas texto). Deben coincidir con las de assets/autorizacion.html. */
export const CLAVES_AUTORIZACION = [
  'sol_nombre', 'sol_nif', 'sol_municipio', 'sol_via', 'sol_email', 'sol_tel', 'sol_opcion',
  'ent_nombre', 'ent_cargo', 'ent_nif', 'ent_email', 'ent_tel',
  'fact_opcion',
  'rf_nombre', 'rf_nif', 'rf_calle', 'rf_cp', 'rf_municipio', 'rf_provincia', 'rf_pais',
  'tf_nombre', 'tf_nif', 'tf_calle', 'tf_cp', 'tf_municipio', 'tf_provincia', 'tf_pais', 'tf_contacto', 'tf_mail',
  'dir3_oc', 'dir3_oc_d', 'dir3_og', 'dir3_og_d', 'dir3_ut', 'dir3_ut_d', 'dir3_exp',
  'aut_nombre', 'aut_nif', 'aut_municipio', 'aut_via', 'aut_email', 'aut_tel',
  'sum_dir', 'sum_dir2', 'sum_municipio', 'sum_provincia', 'sum_potencia',
  'firma_lugar', 'firma_dia', 'firma_mes', 'firma_anio', 'firma_sol', 'firma_rep', 'firma_dest',
];
const FIRMAS = ['firma_sol', 'firma_rep', 'firma_dest'];
const esFirma = (v) => typeof v === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(v);

/** Solo las claves conocidas, como texto. Las firmas solo si son imágenes. */
export function datosAutorizacion(d) {
  const o = {};
  for (const k of CLAVES_AUTORIZACION) {
    const v = d && d[k] != null ? String(d[k]) : '';
    o[k] = FIRMAS.includes(k) ? (esFirma(v) ? v : '') : v;
  }
  return o;
}

export function autorizacionVacia() { return { v: VERSION_AUTORIZACION, datos: null, actualizado: '' }; }

export function normalizarAutorizacion(a) {
  if (!a || typeof a !== 'object' || !a.datos || typeof a.datos !== 'object') return { ...autorizacionVacia(), actualizado: typeof a?.actualizado === 'string' ? a.actualizado : '' };
  return { v: VERSION_AUTORIZACION, datos: datosAutorizacion(a.datos), actualizado: typeof a.actualizado === 'string' ? a.actualizado : '' };
}

const unir = (...p) => p.map((x) => String(x || '').trim()).filter(Boolean).join(', ');

/** Datos del representante (autorizado) a partir de Ajustes › Empresa. */
export function representanteDeEmpresa(e) {
  const em = e?.empresa || {};
  return {
    aut_nombre: em.nombre || em.nombreComercial || '',
    aut_nif: (em.nif || '').toUpperCase(),
    aut_municipio: em.localidad || '',
    aut_via: em.direccion || '',
    aut_email: em.email || '',
    aut_tel: em.telefono || '',
  };
}

/**
 * Datos sugeridos para un formulario nuevo, sacados del aviso y de la empresa.
 * El formulario solo los usa en los campos que estén vacíos: nunca pisa lo ya escrito.
 */
export function sugerenciasAutorizacion(aviso = {}, empresa = {}) {
  const c = aviso.cliente || {}, s = aviso.suministro || {}, el = aviso.electrico || {};
  const piso = [s.piso, s.puerta].filter(Boolean).join(' ');
  const dirSum = [[s.direccion, s.numero].filter(Boolean).join(' '), piso].filter(Boolean).join(', ');
  const rep = representanteDeEmpresa(empresa);
  const o = {
    sol_nombre: c.nombre || '',
    sol_nif: (c.nif || '').toUpperCase(),
    sol_email: c.email || '',
    sol_tel: c.telefono || '',
    sol_opcion: '',
    // Domicilio del promotor: el de facturación si es distinto; si no, el del suministro (se puede cambiar)
    sol_via: (aviso.facturacion?.mismoCliente === false ? '' : (aviso.facturacion?.direccion || '')) || dirSum,
    sol_municipio: (aviso.facturacion?.mismoCliente === false ? '' : (aviso.facturacion?.poblacion || '')) || s.poblacion || '',
    sum_dir: dirSum,
    sum_dir2: unir(s.refCatastral ? `Ref. catastral ${s.refCatastral}` : '', s.cups ? `CUPS ${s.cups}` : ''),
    sum_municipio: s.poblacion || '',
    sum_provincia: s.provincia || '',
    sum_potencia: String(el.potenciaKw || '').replace('.', ','),
    firma_lugar: rep.aut_municipio,
    ...rep,
  };
  // Facturación a otro titular indicada en el aviso → se propone «Tercero»
  const f = aviso.facturacion || {};
  if (f.mismoCliente === false && f.nombre) {
    Object.assign(o, { fact_opcion: 'ter', tf_nombre: f.nombre, tf_nif: (f.nif || '').toUpperCase(), tf_calle: f.direccion || '', tf_cp: f.cp || '', tf_municipio: f.poblacion || '', tf_provincia: f.provincia || '', tf_pais: 'España' });
  }
  return datosAutorizacion(o);
}

/** Resumen para la ficha del aviso. */
export function resumenAutorizacion(a) {
  const x = normalizarAutorizacion(a);
  const d = x.datos;
  if (!d) return { hay: false, texto: 'Sin preparar', firmas: 0, actualizado: x.actualizado };
  const firmas = FIRMAS.filter((k) => d[k]).length;
  const fact = { rep: 'factura al representante', ter: 'factura a un tercero' }[d.fact_opcion] || 'factura al solicitante';
  const quien = d.sol_nombre || 'solicitante sin nombre';
  return { hay: true, texto: `${quien} · ${fact} · ${firmas ? `${firmas} firma${firmas > 1 ? 's' : ''}` : 'sin firmas'}`, firmas, actualizado: x.actualizado };
}
