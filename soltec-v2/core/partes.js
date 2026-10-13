// SOLTEC V2 · Partes de trabajo (registro «parte», ref = aviso opcional). Funciones puras y PDF.
// Sin funciones de facturación ni cobro: el parte documenta el trabajo realizado.

import { direccionCompleta, calleNumero, nombreArchivo, hoyLocal } from './model.js';
import { nombreEmpresa } from './empresa.js';
import { textoPdf } from './documentos.js';

export const RESULTADOS = ['Resuelto', 'Pendiente', 'Nueva visita', 'Requiere presupuesto'];
export const CONCEPTOS = [['desplazamiento', 'Desplazamiento'], ['disponibilidad', 'Disponibilidad'], ['urgencia', 'Urgencia']];

export function nuevoParte(aviso = null, empresa = null) {
  const cl = aviso?.cliente || {}, su = aviso?.suministro || {};
  return {
    numero: '', fecha: hoyLocal(), avisoNumero: aviso?.numero || '',
    tecnico: empresa?.tecnico?.nombre || '',
    cliente: { nombre: cl.nombre || '', nif: cl.nif || '', contacto: cl.contacto || '', telefono: cl.telefono || '', email: cl.email || '',
      direccion: su.direccion || '', numero: su.numero || '', piso: su.piso || '', puerta: su.puerta || '', cp: su.cp || '', localidad: su.poblacion || '', provincia: su.provincia || '' },
    trabajos: '', conceptos: { desplazamiento: false, disponibilidad: false, urgencia: false }, horas: '',
    materiales: [], // {ref, desc, cantidad}
    observaciones: '', resultado: '',
    fotos: [], firma: null, // firma: {hash, name, mime, size, nombre, nif, fecha}
    cerrado: false, cerradoAt: null,
  };
}

export function normalizarParte(d = {}) {
  const b = nuevoParte();
  return { ...b, ...d, cliente: { ...b.cliente, ...(d.cliente || {}) }, conceptos: { ...b.conceptos, ...(d.conceptos || {}) },
    materiales: Array.isArray(d.materiales) ? d.materiales : [], fotos: Array.isArray(d.fotos) ? d.fotos : [] };
}

/** P-2026-0001, P-2026-0002… */
export function siguienteNumeroParte(partes, fecha = new Date()) {
  const anio = String(fecha.getFullYear());
  let max = 0;
  for (const p of partes) {
    const m = /^P-(\d{4})-(\d+)$/.exec(p.data?.numero || '');
    if (m && m[1] === anio) max = Math.max(max, +m[2]);
  }
  return `P-${anio}-${String(max + 1).padStart(4, '0')}`;
}

/** Horas «1,5», «3.25», «2h 30» → número; null si no se entiende. */
export function horasNumero(v) {
  const s = String(v ?? '').trim().toLowerCase().replace(',', '.');
  if (!s) return 0;
  const hm = /^(\d+)\s*h\s*(\d{1,2})?\s*(m|min)?$/.exec(s);
  if (hm) return +hm[1] + (hm[2] ? +hm[2] / 60 : 0);
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Lo que falta para cerrar el parte. */
export function faltaParaCerrar(p) {
  const f = [];
  if (!String(p.trabajos || '').trim()) f.push('los trabajos realizados');
  if (!p.resultado) f.push('el resultado');
  if (horasNumero(p.horas) === null) f.push('unas horas válidas (ej.: 1,5)');
  if (!p.firma) f.push('la firma del cliente');
  return f;
}

export const nombrePartePdf = (p) => nombreArchivo('PARTE', p.numero, calleNumero(p.cliente || {}), p.cliente?.piso && `PISO ${p.cliente.piso}`, p.cliente?.puerta && `PUERTA ${p.cliente.puerta}`) + '.pdf';

// ---------------------------------------------------------------- PDF
const ROJO = [0.769, 0.086, 0.11], GRAFITO = [0.118, 0.133, 0.149], ACERO = [0.353, 0.38, 0.412], LINEA = [0.83, 0.843, 0.859], HUESO = [0.957, 0.949, 0.933];

/** @param {{parte, empresa, logo?, firmaCliente?:{bytes}, firmaTecnico?:{bytes,mime}, fotos?:{bytes,mime,nombre}[]}} o */
export async function generarPartePdf(PDFLib, { parte, empresa, logo, firmaCliente, firmaTecnico, fotos = [] }) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const c = (a) => rgb(...a);
  const p = normalizarParte(parte);
  const pdf = await PDFDocument.create();
  pdf.setTitle(textoPdf(`Parte de trabajo ${p.numero}`));
  pdf.setAuthor(textoPdf(nombreEmpresa(empresa)));
  pdf.setCreator('SOLTEC V2');
  const F = await pdf.embedFont(StandardFonts.Helvetica), B = await pdf.embedFont(StandardFonts.HelveticaBold);
  const PW = 595.28, PH = 841.89, M = 36, W = PW - 2 * M;
  let page, y;
  const emb = async (img) => (img ? (/png/.test(img.mime || 'image/png') ? pdf.embedPng(img.bytes) : pdf.embedJpg(img.bytes)) : null);
  const t = (s, x, yy, { size = 9, font = F, color = GRAFITO, maxW } = {}) => {
    let str = textoPdf(s);
    if (maxW) while (str && font.widthOfTextAtSize(str, size) > maxW) str = str.slice(0, -1);
    page.drawText(str, { x, y: yy, size, font, color: c(color) });
  };
  const envolver = (s, size, maxW) => {
    const out = [];
    for (const parrafo of String(s ?? '').replace(/\r/g, '').split('\n').map(textoPdf)) {
      let l = '';
      for (const w of parrafo.split(' ')) {
        const pr = l ? l + ' ' + w : w;
        if (F.widthOfTextAtSize(pr, size) > maxW && l) { out.push(l); l = w; } else l = pr;
      }
      out.push(l);
    }
    return out;
  };
  const imagen = async (img, x, top, mw, mh, centrar = false) => {
    const e = await emb(img);
    if (!e) return 0;
    const k = Math.min(mw / e.width, mh / e.height);
    page.drawImage(e, { x: centrar ? x + (mw - e.width * k) / 2 : x, y: top - e.height * k, width: e.width * k, height: e.height * k });
    return e.height * k;
  };
  const nueva = async () => {
    page = pdf.addPage([PW, PH]);
    page.drawRectangle({ x: 0, y: PH - 6, width: PW, height: 6, color: c(ROJO) });
    y = PH - M;
    const hl = await imagen(logo, M, y, 150, 46);
    t('PARTE DE TRABAJO', M + W - 190, y - 14, { size: 15, font: B });
    t(`${p.numero}  ·  ${p.fecha.split('-').reverse().join('/')}`, M + W - 190, y - 28, { size: 9, color: ACERO });
    if (p.avisoNumero) t(`Aviso ${p.avisoNumero}`, M + W - 190, y - 40, { size: 9, color: ACERO });
    y -= Math.max(hl, 44) + 8;
    const e = empresa?.empresa || {};
    t([e.nombre || nombreEmpresa(empresa), e.nif && `CIF ${e.nif}`, e.telefono, e.email].filter(Boolean).join('  ·  '), M, y, { size: 7.5, color: ACERO, maxW: W });
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.5, color: c(LINEA) });
    y -= 16;
  };
  const seccion = (s) => { y -= 4; t(s, M, y, { size: 8.5, font: B, color: ROJO }); y -= 5; page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.8, color: c(ROJO) }); y -= 13; };
  const par = (lista) => {
    const cw = (W - 12) / 2;
    for (let i = 0; i < lista.length; i += 2) {
      lista.slice(i, i + 2).forEach(([k, v], j) => { t(k.toUpperCase(), M + j * (cw + 12), y, { size: 6.5, font: B, color: ACERO }); t(v || '—', M + j * (cw + 12), y - 11, { size: 9.5, maxW: cw }); });
      y -= 25;
    }
  };
  const texto = async (s) => {
    for (const l of envolver(s || '—', 9.5, W)) {
      if (y < M + 40) await nueva();
      t(l, M, y, { size: 9.5 }); y -= 13;
    }
    y -= 4;
  };

  await nueva();
  const cl = p.cliente;
  seccion('CLIENTE');
  par([['Cliente', cl.nombre], ['NIF / CIF', cl.nif], ['Contacto', cl.contacto], ['Teléfono', cl.telefono],
    ['Dirección', direccionCompleta(cl)], ['Localidad', [cl.cp, cl.localidad, cl.provincia].filter(Boolean).join(' · ')], ['Correo', cl.email], ['Técnico', p.tecnico]]);
  seccion('TRABAJOS REALIZADOS');
  await texto(p.trabajos);
  seccion('CONCEPTOS Y MANO DE OBRA');
  const conceptos = CONCEPTOS.filter(([k]) => p.conceptos[k]).map(([, l]) => l).join(', ') || 'Ninguno';
  const hn = horasNumero(p.horas);
  par([['Conceptos', conceptos], ['Mano de obra', hn ? `${String(hn).replace('.', ',')} h` : '—']]);
  if (p.materiales.length) {
    seccion('MATERIAL EMPLEADO');
    const ws = [90, W - 90 - 60, 60];
    const fila = (cels, cab) => {
      if (y < M + 40) return false;
      let x = M;
      cels.forEach((v, i) => {
        page.drawRectangle({ x, y: y - 16, width: ws[i], height: 18, borderColor: c(LINEA), borderWidth: 0.5, color: cab ? c(HUESO) : undefined });
        t(v, x + 4, y - 11, { size: 8, font: cab ? B : F, maxW: ws[i] - 8 });
        x += ws[i];
      });
      y -= 18;
      return true;
    };
    fila(['REFERENCIA', 'DESCRIPCIÓN', 'CANTIDAD'], true);
    for (const m of p.materiales) if (!fila([m.ref || '', m.desc || '', String(m.cantidad || '')])) { await nueva(); fila(['REFERENCIA', 'DESCRIPCIÓN', 'CANTIDAD'], true); fila([m.ref || '', m.desc || '', String(m.cantidad || '')]); }
    y -= 8;
  }
  seccion('OBSERVACIONES');
  await texto(p.observaciones);
  seccion('RESULTADO');
  t(p.resultado || '—', M, y, { size: 11, font: B }); y -= 20;

  // Firmas
  if (y < M + 150) await nueva();
  seccion('CONFORMIDAD');
  const top = y, bw = (W - 12) / 2, bh = 100;
  for (const [i, titulo] of [[0, 'FIRMA DEL CLIENTE'], [1, 'FIRMA DEL TÉCNICO']]) {
    const x = M + i * (bw + 12);
    page.drawRectangle({ x, y: top - bh, width: bw, height: bh, borderColor: c(LINEA), borderWidth: 0.6 });
    t(titulo, x + 6, top - 10, { size: 6.5, font: B, color: ACERO });
  }
  if (firmaCliente) await imagen({ ...firmaCliente, mime: 'image/png' }, M + 6, top - 14, bw - 12, bh - 34, true);
  if (firmaTecnico) await imagen(firmaTecnico, M + bw + 18, top - 14, bw - 12, bh - 34, true);
  t(p.firma ? `${p.firma.nombre}${p.firma.nif ? ' · ' + p.firma.nif : ''} · ${p.firma.fecha}` : '', M + 6, top - bh + 8, { size: 7.5, maxW: bw - 12 });
  t(p.tecnico, M + bw + 18, top - bh + 8, { size: 7.5, maxW: bw - 12 });
  y = top - bh - 14;

  // Fotos (4 por página)
  for (let i = 0; i < fotos.length; i++) {
    if (i % 4 === 0) { await nueva(); seccion('FOTOGRAFÍAS'); }
    const col = i % 2, filaTop = y - Math.floor((i % 4) / 2) * 340;
    const x = M + col * (W / 2 + 6), w = W / 2 - 6;
    await imagen(fotos[i], x, filaTop, w, 310, true);
    t(`${i + 1}. ${fotos[i].nombre || ''}`, x, filaTop - 322, { size: 7.5, color: ACERO, maxW: w });
  }
  return pdf.save();
}
