// SOLTEC V2 · Certificados del aviso. Primer tipo: medición de la resistencia de la toma de tierra.
// Datos de empresa, cliente, emplazamiento (CartoCiudad/Catastro), plano, fotos, equipo de medida
// (se da de alta una vez en la empresa y queda para siempre), firma y sello.
//
// Criterios que se comprueban (REBT, RD 842/2002):
//  · ITC-BT-18 / ITC-BT-24: tensión de contacto Uc = R · IΔn ≤ 50 V (24 V en locales húmedos o conductores).
//  · ITC-BT-26 (edificios de viviendas): R ≤ 37 Ω sin pararrayos, ≤ 15 Ω con pararrayos (valor de referencia).

import { calleNumero, nombreArchivo } from './model.js';
import { nombreEmpresa } from './empresa.js';
import { textoPdf } from './documentos.js';

export const TIPOS_CERTIFICADO = [
  { id: 'tierra', label: 'Certificado de medición de la toma de tierra' },
];

export const METODOS_TIERRA = ['Telurómetro, método de caída de potencial (3 picas)', 'Pinza de tierra (sin desconectar)', 'Medidor de bucle / impedancia de defecto'];
export const ELECTRODOS = ['Pica', 'Varias picas en paralelo', 'Conductor enterrado (anillo de cimentación)', 'Placa', 'Otro'];
export const TERRENOS = ['Seco', 'Normal', 'Húmedo'];
export const SENSIBILIDADES = ['30', '300', '500'];

export function certTierraVacio() {
  return {
    fecha: '', electrodo: 'Pica', numPicas: '1', longitud: '2', seccion: '', terreno: 'Normal', clima: '',
    metodo: METODOS_TIERRA[0], medida: '', diferencial: '30', humedo: false, pararrayos: false, refViviendas: true,
    medidorId: '', observaciones: '', fotos: [],
  };
}
export function normalizarCertTierra(c = {}) {
  const b = certTierraVacio();
  const out = { ...b, ...(c && typeof c === 'object' ? c : {}) };
  out.fotos = Array.isArray(out.fotos) ? out.fotos.slice(0, 6) : [];
  return out;
}
export const MAX_FOTOS_CERT = 6;

const num = (v) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : null; };
export const fmt = (v, d = 2) => (v == null ? '' : v.toLocaleString('es-ES', { maximumFractionDigits: d }));

/** Resultado de la medida: tensión de contacto, límites y si es apto. */
export function evaluarTierra(c) {
  const R = num(c.medida);
  const I = num(c.diferencial) || 30;
  const limiteUc = c.humedo ? 24 : 50;
  const limiteR = c.pararrayos ? 15 : 37;
  if (R == null || R < 0) return { completo: false };
  const uc = (R * I) / 1000;
  const okUc = uc <= limiteUc;
  const okR = !c.refViviendas || R <= limiteR;
  return { completo: true, R, I, uc, limiteUc, limiteR, okUc, okR, apto: okUc && okR, rMaxUc: (limiteUc * 1000) / I };
}

// ---------------------------------------------------------------- equipos de medida (en la empresa)
export function medidorVacio() {
  return { id: '', tipo: 'Telurómetro', marca: '', modelo: '', serie: '', calibracion: '', validoHasta: '', certificado: '' };
}
export const nombreMedidor = (m) => [m?.tipo, m?.marca, m?.modelo, m?.serie && `nº ${m.serie}`].filter(Boolean).join(' · ');
/** «caducada» si la calibración ya no es válida en la fecha dada. */
export function estadoCalibracion(m, fechaIso) {
  if (!m?.validoHasta) return 'sin fecha';
  return m.validoHasta < (fechaIso || '') ? 'caducada' : 'vigente';
}

export const nombreCertTierra = (aviso) => {
  const s = aviso.suministro || {};
  return nombreArchivo('CERTIFICADO_TOMA_TIERRA', calleNumero(s) || aviso.numero, s.piso && `PISO ${s.piso}`, s.puerta && `PUERTA ${s.puerta}`) + '.pdf';
};

const fechaEs = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

/**
 * PDF del certificado.
 * @param {{aviso, empresa, cert, medidor, logo?, firma?, sello?, plano?, fotos?:{bytes,mime,nombre}[], fecha?:string}} o
 */
export async function generarCertTierra(PDFLib, { aviso, empresa, cert, medidor, logo, firma, sello, plano, fotos = [] }) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const c = normalizarCertTierra(cert);
  const ev = evaluarTierra(c);
  const pdf = await PDFDocument.create();
  pdf.setTitle(textoPdf(nombreCertTierra(aviso).replace(/\.pdf$/, '')));
  pdf.setAuthor(textoPdf(nombreEmpresa(empresa)));
  pdf.setCreator('SOLTEC V2');
  const F = await pdf.embedFont(StandardFonts.Helvetica);
  const B = await pdf.embedFont(StandardFonts.HelveticaBold);
  const PW = 595.28, PH = 841.89, M = 32, W = PW - 2 * M;
  const NEGRO = rgb(0.12, 0.13, 0.15), ACERO = rgb(0.35, 0.38, 0.41), ROJO = rgb(0.77, 0.09, 0.11), FONDO = rgb(0.95, 0.96, 0.97);
  const VERDE = rgb(0.11, 0.42, 0.25), LINEA = rgb(0.82, 0.84, 0.87);
  const imgs = new Map();
  const emb = async (img) => {
    if (!img?.bytes) return null;
    if (!imgs.has(img)) { try { imgs.set(img, /png/.test(img.mime) ? await pdf.embedPng(img.bytes) : await pdf.embedJpg(img.bytes)); } catch { imgs.set(img, null); } }
    return imgs.get(img);
  };
  let page, y;
  const t = (s, x, yy, { size = 9, font = F, color = NEGRO, maxW } = {}) => {
    let str = textoPdf(s);
    if (maxW) while (str.length > 1 && font.widthOfTextAtSize(str, size) > maxW) str = str.slice(0, -1);
    page.drawText(str, { x, y: yy, size, font, color });
  };
  const envolver = (s, size, maxW, font = F) => {
    const out = [];
    for (const parrafo of textoPdf(s).split('\n')) {
      let l = '';
      for (const p of parrafo.split(' ')) {
        const prueba = l ? l + ' ' + p : p;
        if (font.widthOfTextAtSize(prueba, size) > maxW && l) { out.push(l); l = p; } else l = prueba;
      }
      out.push(l);
    }
    return out;
  };
  const img = async (im, x, top, maxW, maxH, centrar = true) => {
    const e = await emb(im);
    if (!e) return 0;
    const k = Math.min(maxW / e.width, maxH / e.height);
    const w = e.width * k, hh = e.height * k;
    page.drawImage(e, { x: centrar ? x + (maxW - w) / 2 : x, y: top - hh, width: w, height: hh });
    return hh;
  };
  const e = empresa?.empresa || {}, tec = empresa?.tecnico || {};
  const nueva = async () => {
    page = pdf.addPage([PW, PH]);
    y = PH - M;
    page.drawRectangle({ x: 0, y: PH - 5, width: PW, height: 5, color: ROJO });
    await img(logo, M, y + 6, 160, 56, false);
    const tit = 'CERTIFICADO DE MEDICIÓN DE LA TOMA DE TIERRA';
    t(tit, PW - M - B.widthOfTextAtSize(textoPdf(tit), 11.5), y - 14, { size: 11.5, font: B });
    const sub = `Reglamento Electrotécnico para Baja Tensión (RD 842/2002) · ITC-BT-18 / ITC-BT-26${aviso.numero ? ' · Aviso ' + aviso.numero : ''}`;
    t(sub, PW - M - F.widthOfTextAtSize(textoPdf(sub), 7), y - 26, { size: 7, color: ACERO });
    y -= 58;
  };
  const seccion = (titulo) => {
    y -= 4;
    page.drawRectangle({ x: M, y: y - 13, width: W, height: 15, color: FONDO });
    page.drawRectangle({ x: M, y: y - 13, width: 3, height: 15, color: ROJO });
    t(titulo, M + 8, y - 8.5, { size: 8.5, font: B });
    y -= 20;
  };
  // Rejilla de campos: cada uno ocupa 1 columna (o «span» columnas); salta de fila al llenarse
  const campos = (lista, cols = 3) => {
    const cw = (W - (cols - 1) * 10) / cols;
    let col = 0, alto = 0;
    const cerrar = () => { y -= alto + 4; col = 0; alto = 0; };
    for (const [k, v, span = 1] of lista) {
      if (col + span > cols) cerrar();
      const x = M + col * (cw + 10);
      const ancho = cw * span + 10 * (span - 1);
      if (k) {
        t(String(k).toUpperCase(), x, y, { size: 6, font: B, color: ACERO, maxW: ancho });
        const lineas = envolver(v || '—', 8.5, ancho);
        lineas.slice(0, 2).forEach((l, n) => t(l, x, y - 10 - n * 10, { size: 8.5, maxW: ancho }));
        alto = Math.max(alto, 10 + Math.min(lineas.length, 2) * 10);
      }
      col += span;
      if (col >= cols) cerrar();
    }
    if (col) cerrar();
  };
  // Imagen centrada en su recuadro (también en vertical)
  const imgCaja = async (im, x, top, w, hh) => {
    const e2 = await emb(im);
    if (!e2) return;
    const k = Math.min(w / e2.width, hh / e2.height);
    page.drawImage(e2, { x: x + (w - e2.width * k) / 2, y: top - hh + (hh - e2.height * k) / 2, width: e2.width * k, height: e2.height * k });
  };

  // ---- Página 1
  await nueva();
  const su = aviso.suministro || {}, cl = aviso.cliente || {};
  seccion('1. EMPRESA INSTALADORA');
  campos([
    ['Razón social', e.nombre || nombreEmpresa(empresa)], ['NIF', e.nif], ['Nº empresa instaladora', tec.numero],
    ['Dirección', [e.direccion, e.cp, e.localidad, e.provincia].filter(Boolean).join(', ')], ['Teléfono', e.telefono], ['Correo', e.email],
    ['Instalador / técnico', tec.nombre], ['NIF técnico', tec.nif], ['Nº colegiado', tec.colegiado],
  ]);
  seccion('2. TITULAR DE LA INSTALACIÓN');
  campos([['Nombre o razón social', cl.nombre], ['DNI / NIF / CIF', cl.nif], ['Teléfono', cl.telefono]]);
  seccion('3. EMPLAZAMIENTO');
  campos([
    ['Dirección', [calleNumero(su), su.piso && `Piso ${su.piso}`, su.puerta && `Puerta ${su.puerta}`].filter(Boolean).join(', ')], ['Código postal', su.cp], ['Población', [su.poblacion, su.provincia].filter(Boolean).join(' · ')],
    ['CUPS', su.cups], ['Referencia catastral', su.refCatastral], ['Coordenadas (ETRS89)', su.lat && su.lon ? `${String(su.lat).replace('.', ',')}  ${String(su.lon).replace('.', ',')}` : ''],
  ]);
  seccion('4. TOMA DE TIERRA');
  campos([
    ['Tipo de electrodo', c.electrodo], ['Nº de picas / longitud', [c.numPicas && `${c.numPicas} ud`, c.longitud && `${c.longitud} m`].filter(Boolean).join(' · ')], ['Sección conductor de tierra', c.seccion ? `${c.seccion} mm²` : ''],
    ['Terreno', c.terreno], ['Condiciones el día de la medida', c.clima], ['Edificio con pararrayos', c.pararrayos ? 'Sí' : 'No'],
  ]);
  seccion('5. MEDICIÓN');
  campos([['Fecha de la medición', fechaEs(c.fecha)], ['Método', c.metodo, 2],
    ['Sensibilidad del diferencial (Idn)', c.diferencial ? `${c.diferencial} mA` : ''], ['Local', c.humedo ? 'Húmedo o conductor (límite 24 V)' : 'Seco (límite 50 V)', 2]]);
  // Resultado destacado
  const alto = 62;
  page.drawRectangle({ x: M, y: y - alto, width: W, height: alto, borderColor: ev.completo ? (ev.apto ? VERDE : ROJO) : LINEA, borderWidth: 1.4 });
  t('RESISTENCIA DE TIERRA MEDIDA', M + 10, y - 14, { size: 7, font: B, color: ACERO });
  t(ev.completo ? `${fmt(ev.R)} ohm` : '— ohm', M + 10, y - 40, { size: 24, font: B });
  const xr = M + 190;
  if (ev.completo) {
    t(`Tensión de contacto Uc = R × Idn = ${fmt(ev.R)} ohm × ${fmt(ev.I / 1000, 3)} A = ${fmt(ev.uc)} V  ${ev.okUc ? '<=' : '>'} ${ev.limiteUc} V  (ITC-BT-18)`, xr, y - 16, { size: 7.5, color: ev.okUc ? NEGRO : ROJO, maxW: W - 200 });
    t(c.refViviendas ? `Referencia ITC-BT-26 (viviendas${c.pararrayos ? ', con pararrayos' : ''}): R <= ${ev.limiteR} ohm: ${ev.okR ? 'cumple' : 'NO cumple'}` : 'Referencia ITC-BT-26 no aplicada', xr, y - 28, { size: 7.5, color: ev.okR ? NEGRO : ROJO, maxW: W - 200 });
    const res = ev.apto ? 'RESULTADO: APTO' : 'RESULTADO: NO APTO';
    t(res, xr, y - 48, { size: 13, font: B, color: ev.apto ? VERDE : ROJO });
  } else t('Falta el valor medido.', xr, y - 30, { size: 9, color: ROJO });
  y -= alto + 8;
  const espacio = async (n) => { if (y - n < M) await nueva(); };

  // Fotografías de la medición: justo después del resultado
  if (fotos.length) {
    const cols = 3, gap = 8, cw = (W - gap * (cols - 1)) / cols, ch = 150;
    const filas = Math.ceil(fotos.length / cols);
    await espacio(20 + ch + 16);
    seccion('FOTOGRAFÍAS DE LA MEDICIÓN');
    for (let f = 0; f < filas; f++) {
      await espacio(ch + 16);
      for (let k = 0; k < cols; k++) {
        const i = f * cols + k;
        if (i >= fotos.length) break;
        const x = M + k * (cw + gap), top = y;
        page.drawRectangle({ x, y: top - ch, width: cw, height: ch, borderColor: LINEA, borderWidth: 0.6 });
        await imgCaja(fotos[i], x + 3, top - 3, cw - 6, ch - 6);
        t(fotos[i].nombre || `Foto ${i + 1}`, x, top - ch - 9, { size: 6.5, color: ACERO, maxW: cw });
      }
      y -= ch + 16;
    }
    y -= 4;
  }

  await espacio(20 + 2 * 24);
  seccion('6. EQUIPO DE MEDIDA');
  campos([
    ['Equipo', [medidor?.tipo, medidor?.marca, medidor?.modelo].filter(Boolean).join(' ')], ['Nº de serie', medidor?.serie], ['Certificado de calibración', medidor?.certificado],
    ['Fecha de calibración', fechaEs(medidor?.calibracion)], ['Calibración válida hasta', fechaEs(medidor?.validoHasta)],
  ]);
  if (c.observaciones) {
    await espacio(20 + 60);
    seccion('7. OBSERVACIONES');
    envolver(c.observaciones, 8.5, W).slice(0, 5).forEach((l) => { t(l, M, y, { size: 8.5 }); y -= 11; });
    y -= 4;
  }
  // Declaración, firma y sello (en la misma página: si no caben, a la siguiente)
  await espacio(40 + 70 + 24);
  y -= 4;
  envolver(`El instalador abajo firmante certifica que ha realizado la medición de la resistencia de la toma de tierra de la instalación indicada, con el equipo de medida reseñado, obteniendo los valores que constan en este certificado.`, 7.5, W)
    .forEach((l) => { t(l, M, y, { size: 7.5, color: ACERO }); y -= 10; });
  y -= 4;
  const hFirma = Math.max(70, Math.min(110, y - M - 14));
  const wb = (W - 10) / 2;
  for (const [i, [tit, im]] of [['FIRMA DEL INSTALADOR', firma], ['SELLO DE LA EMPRESA', sello]].entries()) {
    const x = M + i * (wb + 10);
    page.drawRectangle({ x, y: y - hFirma, width: wb, height: hFirma, borderColor: LINEA, borderWidth: 0.8 });
    t(tit, x + 6, y - 10, { size: 6.5, font: B, color: ACERO });
    if (im) await imgCaja(im, x + 6, y - 14, wb - 12, hFirma - 18); else t('Sin configurar en Empresa', x + 6, y - hFirma / 2, { size: 7, color: ACERO });
  }
  y -= hFirma + 10;
  t(`En ${e.localidad || su.poblacion || ''}, a ${fechaEs(c.fecha) || new Date().toLocaleDateString('es-ES')}  ·  ${tec.nombre || ''}`, M, Math.max(y, M - 6), { size: 8 });

  // ---- Plano de situación (última página)
  if (plano) {
    await nueva();
    seccion('PLANO DE SITUACIÓN');
    const hh = await img(plano, M, y, W, 330);
    y -= hh + 4;
    t(`Coordenadas ETRS89: ${su.lat || ''}, ${su.lon || ''}${su.refCatastral ? '  ·  Ref. catastral ' + su.refCatastral : ''}  ·  Cartografía © IGN`, M, y - 6, { size: 7, color: ACERO, maxW: W });
  }
  return pdf.save();
}
