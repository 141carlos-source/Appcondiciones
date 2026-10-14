// SOLTEC V2 · Ficha que rellena el propio cliente (formulario web o PDF rellenable) y lectura
// automática de lo que devuelve. Los mismos campos sirven para el PDF, el formulario y el lector.

import { validarNif, validarTelefono, validarEmail, validarIban, validarCp, validarCups, validarRefCatastral } from './validate.js';

/** URL pública del formulario (GitHub Pages). Desde el PC instalado se usa también esta. */
export const URL_PUBLICA = 'https://141carlos-source.github.io/Appcondiciones/soltec-v2/';

// [ruta, etiqueta, opciones]  · grupo: cliente | suministro | electrico
export const CAMPOS_FICHA = [
  ['cliente.nombre', 'Nombre y apellidos o razón social', { grupo: 'cliente', peso: 3, req: true }],
  ['cliente.nif', 'DNI / NIF / CIF', { grupo: 'cliente', peso: 1.2, req: true, val: validarNif }],
  ['cliente.contacto', 'Persona de contacto', { grupo: 'cliente', peso: 2 }],
  ['cliente.telefono', 'Teléfono', { grupo: 'cliente', peso: 1.2, req: true, val: validarTelefono, tipo: 'tel' }],
  ['cliente.email', 'Correo electrónico', { grupo: 'cliente', peso: 2, req: true, val: validarEmail, tipo: 'email' }],
  ['cliente.iban', 'IBAN (para el contrato)', { grupo: 'cliente', peso: 2, val: validarIban }],
  ['suministro.direccion', 'Calle / vía', { grupo: 'suministro', peso: 3.4, req: true }],
  ['suministro.numero', 'Número', { grupo: 'suministro', peso: 0.7 }],
  ['suministro.piso', 'Piso', { grupo: 'suministro', peso: 0.7 }],
  ['suministro.puerta', 'Puerta', { grupo: 'suministro', peso: 0.7 }],
  ['suministro.cp', 'Código postal', { grupo: 'suministro', peso: 1, req: true, val: validarCp, inputmode: 'numeric' }],
  ['suministro.poblacion', 'Población', { grupo: 'suministro', peso: 2, req: true }],
  ['suministro.provincia', 'Provincia', { grupo: 'suministro', peso: 1.6, req: true }],
  ['suministro.cups', 'CUPS (está en la factura de la luz)', { grupo: 'suministro', peso: 2, val: validarCups }],
  ['suministro.refCatastral', 'Referencia catastral', { grupo: 'suministro', peso: 2, val: validarRefCatastral }],
];
export const REQUERIDOS_FICHA = new Set(CAMPOS_FICHA.filter(([, , o]) => o.req).map(([r]) => r));
export const GRUPOS_FICHA = { cliente: 'DATOS DEL CLIENTE', suministro: 'DATOS DEL SUMINISTRO' };

/** Nombre del campo en el PDF (sin puntos: en los PDF el punto crea campos anidados). */
export const nombreCampoPdf = (ruta) => ruta.replace('.', '__');
export const rutaDeCampoPdf = (nombre) => (CAMPOS_FICHA.some(([r]) => nombreCampoPdf(r) === nombre) ? nombre.replace('__', '.') : null);

const leer = (o, ruta) => ruta.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const limpio = (v) => String(v ?? '').trim();

/** Problema de un valor según su campo (null si está bien o vacío y opcional). */
export function problemaCampo(ruta, valor) {
  const def = CAMPOS_FICHA.find(([r]) => r === ruta);
  if (!def) return null;
  const v = limpio(valor);
  if (!v) return def[2].req ? 'Obligatorio' : null;
  return def[2].val ? def[2].val(v) : null;
}

// ---------------------------------------------------------------- enlace
const aB64 = (s) => {
  const b = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const deB64 = (s) => {
  const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
};

/** Datos que viajan en el enlace: solo los de la ficha, el número de aviso y cómo contactar con la empresa. */
export function paqueteFicha(aviso, empresa) {
  const e = empresa?.empresa || {};
  const d = {};
  for (const [ruta] of CAMPOS_FICHA) { const v = limpio(leer(aviso, ruta)); if (v) d[ruta] = v; }
  return {
    v: 1,
    id: aviso.id || '',
    n: aviso.numero || '',
    ref: aviso.condiciones?.ref || '',
    e: { n: e.nombreComercial || e.nombre || '', t: e.telefono || '', m: e.email || '' },
    d,
  };
}

/** Enlace al formulario con los datos dentro (tras «#»: no se envían a ningún servidor). */
export const enlaceFormulario = (paquete, base = URL_PUBLICA) => `${base}cliente.html#${aB64(JSON.stringify(paquete))}`;
export function leerEnlace(hash) {
  const h = String(hash || '').replace(/^#/, '');
  if (!h) return null;
  try { const p = JSON.parse(deB64(h)); return p && p.v === 1 && p.d ? p : null; } catch { return null; }
}

// ---------------------------------------------------------------- vuelta: datos del cliente
const MARCA = 'SOLTEC-DATOS:';
/** Línea con los datos del cliente codificados (va en el PDF y al final del mensaje). */
export const lineaDatos = (respuesta) => MARCA + aB64(JSON.stringify(respuesta));

/** Busca la línea SOLTEC-DATOS en un texto (PDF, mensaje de WhatsApp o correo pegado). */
export function leerDatos(texto) {
  const m = String(texto || '').match(/SOLTEC-DATOS:([A-Za-z0-9_-]{8,})/);
  if (!m) return null;
  try { const r = JSON.parse(deB64(m[1])); return r && r.d ? r : null; } catch { return null; }
}

/** Datos de un PDF devuelto: primero los SOLTEC-DATOS del formulario web; si no, los campos rellenables. */
export async function datosDePdf(PDFLib, bytes) {
  const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const r = leerDatos(doc.getSubject() || '') || leerDatos(doc.getKeywords() || '');
  if (r) return { ...r, origen: 'formulario' };
  const d = {};
  let conforme = false, firmante = '', fechaFirma = '';
  try {
    for (const f of doc.getForm().getFields()) {
      const nombre = f.getName();
      if (nombre === 'conformidad' && typeof f.isChecked === 'function') {
        // Algunos visores guardan la marca en el recuadro y no en el campo: se miran los dos
        let marcada = false;
        try { marcada = f.isChecked(); } catch { /* valor raro */ }
        try { marcada ||= f.acroField.getWidgets().some((w) => { const as = w.getAppearanceState?.()?.toString(); return as && as !== '/Off'; }); } catch { /* sin recuadros */ }
        conforme = marcada;
        continue;
      }
      if (typeof f.getText !== 'function') continue;
      const v = limpio(f.getText());
      if (nombre === 'firma__nombre') { firmante = v; continue; }
      if (nombre === 'firma__fecha') { fechaFirma = v; continue; }
      const ruta = rutaDeCampoPdf(nombre);
      if (ruta && v) d[ruta] = v;
    }
  } catch { /* sin formulario */ }
  // ¿Ha firmado dibujando en el PDF? (iPhone: Marcación › Firma; Android/Acrobat: Rellenar y firmar)
  let dibujada = false;
  try {
    for (const pg of doc.getPages()) {
      const annots = pg.node.Annots?.();
      if (!annots) continue;
      for (let i = 0; i < annots.size(); i++) {
        const a = annots.lookup(i);
        const sub = a?.get?.(PDFLib.PDFName.of('Subtype'))?.toString();
        if (['/Ink', '/Stamp', '/FreeText'].includes(sub)) dibujada = true;
      }
    }
  } catch { /* sin anotaciones */ }
  if (!Object.keys(d).length && !conforme && !dibujada) return null;
  const firma = dibujada || conforme ? { nombre: firmante || d['cliente.contacto'] || d['cliente.nombre'] || '', fecha: fechaFirma, dibujada, conforme } : null;
  return { v: 1, d, origen: 'pdf', firma, conforme };
}

/** Cambios que traen los datos del cliente respecto al aviso: [{ruta, etiqueta, antes, ahora, problema}]. */
export function cambiosFicha(aviso, datos) {
  const out = [];
  for (const [ruta, etiqueta] of CAMPOS_FICHA) {
    if (!(ruta in (datos || {}))) continue;
    const ahora = limpio(datos[ruta]).toLocaleUpperCase('es-ES');
    const final = ruta === 'cliente.email' ? limpio(datos[ruta]) : ahora;
    const antes = limpio(leer(aviso, ruta));
    if (!final || final === antes) continue;
    out.push({ ruta, etiqueta, antes, ahora: final, problema: problemaCampo(ruta, final) });
  }
  return out;
}

/** Aplica los cambios elegidos a una copia del aviso. */
export function aplicarCambios(aviso, cambios) {
  const a = structuredClone(aviso);
  for (const c of cambios) {
    const [g, k] = c.ruta.split('.');
    a[g] = { ...(a[g] || {}), [k]: c.ahora };
  }
  return a;
}
