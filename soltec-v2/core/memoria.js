// SOLTEC V2 · Memoria técnica CNMC Circular 1/2024 (Endesa / e-distribución).
// Datos en aviso.memoria; el PDF se genera con pdf-lib. Funciones puras.

import { direccionCompleta, calleNumero, nombreMemoria } from './model.js';
import { nombreEmpresa } from './empresa.js';
import { textoPdf } from './documentos.js';

export const TIPOS_SOLICITUD = ['NUEVO SUMINISTRO', 'AMPLIACIÓN DE POTENCIA / CAMBIO DE TENSIÓN', 'PROVISIONAL OBRAS', 'SUMINISTRO EVENTUAL O DE TEMPORADA', 'COMPLEMENTARIO O DE SEGURIDAD'];
export const USOS_FINCA = ['VIVIENDA', 'LOCAL', 'NAVE', 'CAMPA', 'EDIFICIO DE VIVIENDAS', 'OTROS'];
export const TENSIONES = ['230 V', '3X230 V', '3X230/400 V'];
export const ALMACENAMIENTO = ['BATERÍAS', 'VOLANTE DE INERCIA', 'SUPERCONDENSADORES', 'OTROS'];

const filas = (n, base) => Array.from({ length: n }, (_, i) => ({ ...base(i) }));
export function memoriaVacia() {
  return {
    tipoSolicitud: '', usoFinca: '', cupsGas: '',
    viviendas: filas(3, (i) => ({ aplica: false, nombre: `VIVIENDA ${i + 1}`, escalera: '', piso: '', puerta: '', potencia: '', tension: '', grado: '' })),
    locales: filas(2, (i) => ({ aplica: false, nombre: `LOCAL ${i + 1}`, aclarador: '', potencia: '', tension: '', superficie: '' })),
    servicios: ['ESCALERAS', 'ASCENSORES', 'OTROS'].map((nombre) => ({ aplica: false, nombre, aclarador: '', potencia: '', tension: '' })),
    garajes: ['GARAJE', 'PUNTOS RECARGA VE'].map((nombre) => ({ aplica: false, nombre, tipo: '', potencia: '', tension: '', superficie: '' })),
    acumulacion: { aplica: false, tipo: '', potencia: '', capacidad: '' },
    autoconsumo: { aplica: false, consumo: '', generacion: '' },
  };
}

/** Completa una memoria guardada por otra versión con lo que le falte. */
export function normalizarMemoria(m = {}) {
  const b = memoriaVacia();
  const out = { ...b, ...m };
  for (const k of ['viviendas', 'locales', 'servicios', 'garajes']) out[k] = b[k].map((f, i) => ({ ...f, ...((m[k] || [])[i] || {}) }));
  out.acumulacion = { ...b.acumulacion, ...(m.acumulacion || {}) };
  out.autoconsumo = { ...b.autoconsumo, ...(m.autoconsumo || {}) };
  return out;
}

const num = (v) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
export const kw = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

/** Potencias por apartado y total A+B+C+D (solo filas que aplican). */
export function totales(m) {
  const suma = (a) => (a || []).filter((f) => f.aplica).reduce((s, f) => s + num(f.potencia), 0);
  const t = { A: suma(m.viviendas), B: suma(m.locales), C: suma(m.servicios), D: suma(m.garajes) };
  t.total = t.A + t.B + t.C + t.D;
  return t;
}

export const tensionTexto = (v) => (String(v || '').includes('400') ? '3X230/400V' : String(v || '') === '230' ? '230 V' : String(v || ''));

// ---------------------------------------------------------------- PDF
const ROJO = [0.835, 0.122, 0.169], AZUL = [0.09, 0.231, 0.408], ACERO = [0.4, 0.44, 0.52], LINEA = [0.84, 0.866, 0.906], FONDO = [0.953, 0.965, 0.98];

/**
 * @param {object} PDFLib
 * @param {{aviso, empresa, logo?, edist?, firma?, sello?, plano?:{bytes,mime,nombre}, fotos?:{bytes,mime,nombre,cgp}[], fecha?:string}} o
 */
export async function generarMemoria(PDFLib, { aviso, empresa, logo, edist, firma, sello, plano, fotos = [], fecha }) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const c = (a) => rgb(...a);
  const m = normalizarMemoria(aviso.memoria);
  const pdf = await PDFDocument.create();
  pdf.setTitle(textoPdf(nombreMemoria(aviso).replace(/\.pdf$/, '')));
  pdf.setAuthor(textoPdf(nombreEmpresa(empresa)));
  pdf.setCreator('SOLTEC V2');
  const F = await pdf.embedFont(StandardFonts.Helvetica);
  const B = await pdf.embedFont(StandardFonts.HelveticaBold);
  const PW = 595.28, PH = 841.89, M = 26, W = PW - 2 * M;
  const imgs = new Map();
  const emb = async (img) => {
    if (!img) return null;
    if (!imgs.has(img)) imgs.set(img, /png/.test(img.mime) ? await pdf.embedPng(img.bytes) : await pdf.embedJpg(img.bytes));
    return imgs.get(img);
  };
  const paginas = [];
  let page, y;

  const t = (s, x, yy, { size = 9, font = F, color = [0.12, 0.16, 0.22], maxW } = {}) => {
    let str = textoPdf(s);
    if (maxW) while (str && font.widthOfTextAtSize(str, size) > maxW) str = str.slice(0, -1);
    page.drawText(str, { x, y: yy, size, font, color: c(color) });
  };
  const envolver = (s, size, maxW, font = F) => {
    const palabras = textoPdf(s).split(' ');
    const lineas = [];
    let l = '';
    for (const p of palabras) {
      const prueba = l ? l + ' ' + p : p;
      if (font.widthOfTextAtSize(prueba, size) > maxW && l) { lineas.push(l); l = p; } else l = prueba;
    }
    if (l) lineas.push(l);
    return lineas;
  };
  const dibujarImg = async (img, x, top, maxW, maxH, centrar = false) => {
    const e = await emb(img);
    if (!e) return 0;
    const k = Math.min(maxW / e.width, maxH / e.height);
    const w = e.width * k, hh = e.height * k;
    page.drawImage(e, { x: centrar ? x + (maxW - w) / 2 : x, y: top - hh, width: w, height: hh });
    return hh;
  };

  const nuevaPagina = async (titulo = 'CNMC CIRCULAR 1/2024 ENDESA', sub = 'SOLICITUD DE SUMINISTRO · e-distribución') => {
    page = pdf.addPage([PW, PH]);
    paginas.push(page);
    y = PH - M;
    await dibujarImg(logo, M, y, 96, 36);
    await dibujarImg(edist, M + W - 120, y - 6, 120, 22);
    const tw = B.widthOfTextAtSize(titulo, 13);
    t(titulo, PW / 2 - tw / 2, y - 16, { size: 13, font: B, color: AZUL });
    const sw = F.widthOfTextAtSize(textoPdf(sub), 7.5);
    t(sub, PW / 2 - sw / 2, y - 27, { size: 7.5, color: ACERO });
    y -= 42;
    page.drawRectangle({ x: M, y, width: W, height: 2, color: c(ROJO) });
    y -= 10;
  };
  const seccion = (titulo) => {
    y -= 4;
    page.drawRectangle({ x: M, y: y - 14, width: W, height: 16, color: c(FONDO) });
    page.drawRectangle({ x: M, y: y - 14, width: 3, height: 16, color: c(ROJO) });
    t(titulo, M + 8, y - 9, { size: 9, font: B, color: AZUL });
    y -= 22;
  };
  // Rejilla de campos etiqueta/valor en dos columnas
  const campos = (lista, cols = 2) => {
    const cw = (W - (cols - 1) * 10) / cols;
    for (let i = 0; i < lista.length; i += cols) {
      let alto = 0;
      lista.slice(i, i + cols).forEach(([k, v], j) => {
        const x = M + j * (cw + 10);
        t(String(k).toUpperCase(), x, y, { size: 6.5, font: B, color: ACERO, maxW: cw });
        const lineas = envolver(v || '—', 9, cw);
        lineas.slice(0, 3).forEach((l, n) => t(l, x, y - 11 - n * 11, { size: 9, maxW: cw }));
        alto = Math.max(alto, 11 + Math.min(lineas.length, 3) * 11);
      });
      y -= alto + 5;
    }
  };
  const tabla = (cab, filasT, anchos, size = 7) => {
    const total = anchos.reduce((a, b) => a + b, 0);
    const ws = anchos.map((a) => (W * a) / total);
    const fila = (celdas, cabecera) => {
      const lineas = celdas.map((v, i) => envolver(v || '—', size, ws[i] - 6, cabecera ? B : F));
      const alto = Math.max(...lineas.map((l) => l.length)) * (size + 2) + 6;
      let x = M;
      celdas.forEach((_, i) => {
        page.drawRectangle({ x, y: y - alto, width: ws[i], height: alto, borderColor: c(LINEA), borderWidth: 0.6, color: cabecera ? c(FONDO) : undefined });
        lineas[i].forEach((l, n) => t(l, x + 3, y - 4 - size - n * (size + 2), { size, font: cabecera ? B : F, color: cabecera ? AZUL : [0.12, 0.16, 0.22] }));
        x += ws[i];
      });
      y -= alto;
    };
    fila(cab, true);
    filasT.forEach((f) => fila(f));
    y -= 6;
  };

  const a = aviso, su = a.suministro || {}, cl = a.cliente || {}, e = empresa?.empresa || {}, so = empresa?.solicitante || {}, te = empresa?.tecnico || {};
  const coords = su.lat && su.lon ? `${su.lat}, ${su.lon}` : '—';
  const dir = [calleNumero(su), su.cp, su.poblacion, su.provincia].filter(Boolean).join(' · ');
  const tot = totales(m);
  const potencia = tot.total ? `${kw(tot.total)} kW` : a.electrico?.potenciaKw ? `${a.electrico.potenciaKw} kW` : '';

  // Página 1: solicitud, solicitante, ubicación, observaciones
  await nuevaPagina();
  seccion('1. CARACTERÍSTICAS DE LA SOLICITUD');
  campos([['Concepto', a.concepto], ['Tipo de solicitud', m.tipoSolicitud]]);
  seccion('2. SOLICITANTE');
  campos([['Razón social / Nombre', so.nombre || e.nombre], ['CIF / NIF', so.nif || e.nif],
    ['Dirección', [so.direccion || e.direccion, so.cp || e.cp, so.localidad || e.localidad, so.provincia || e.provincia].filter(Boolean).join(' · ')], ['Teléfono', so.telefono || e.telefono],
    ['Correo electrónico', so.email || e.email]]);
  seccion('3. UBICACIÓN DEL SUMINISTRO');
  campos([['Dirección postal', calleNumero(su)], ['Piso', su.piso], ['Puerta', su.puerta], ['Código postal y población', [su.cp, su.poblacion, su.provincia].filter(Boolean).join(' · ')],
    ['Ref. catastral', su.refCatastral], ['CUPS electricidad', su.cups], ['CUPS gas', m.cupsGas], ['Coordenadas WGS84', coords]]);
  seccion('USO Y POTENCIA');
  campos([['Uso de la finca', m.usoFinca], ['Nivel de tensión', tensionTexto(a.electrico?.tension)], ['Potencia total solicitada', potencia]]);
  seccion('5. OBSERVACIONES');
  for (const l of envolver(a.observaciones || '—', 9, W).slice(0, 14)) { t(l, M, y, { size: 9 }); y -= 12; }

  // Página 2: datos técnicos
  await nuevaPagina();
  seccion('4. DATOS TÉCNICOS DE LA PETICIÓN');
  t('Rellenar las tablas que apliquen al tipo de solicitud. Si se requieren más filas, adjuntar anexo.', M, y, { size: 7, color: ACERO }); y -= 12;
  campos([['Potencia A · Viviendas', kw(tot.A) + ' kW'], ['Potencia B · Locales', kw(tot.B) + ' kW'], ['Potencia C · Servicios comunes', kw(tot.C) + ' kW'], ['Potencia D · Garajes', kw(tot.D) + ' kW']], 4);
  const val = (f, k) => (f.aplica ? f[k] : '');
  const tens = (f) => (f.aplica ? tensionTexto(f.tension) : '');
  t('A. VIVIENDAS', M, y, { size: 8, font: B, color: AZUL }); y -= 6;
  tabla(['CONCEPTO APLICABLE', 'ESCALERA', 'PISO', 'PUERTA', 'POTENCIA (kW)', 'TENSIÓN (V)', 'GRADO ELECTRIF.'], m.viviendas.map((f) => [f.aplica ? f.nombre : '', val(f, 'escalera'), val(f, 'piso'), val(f, 'puerta'), val(f, 'potencia'), tens(f), val(f, 'grado')]), [2, 1, 1, 1, 1.2, 1.3, 1.5]);
  t('B. LOCALES COMERCIALES', M, y, { size: 8, font: B, color: AZUL }); y -= 6;
  tabla(['CONCEPTO APLICABLE', 'ACLARADOR DE LOCALES', 'POTENCIA (kW)', 'TENSIÓN (V)', 'SUPERFICIE (m²)'], m.locales.map((f) => [f.aplica ? f.nombre : '', val(f, 'aclarador'), val(f, 'potencia'), tens(f), val(f, 'superficie')]), [2, 2.5, 1.2, 1.3, 1.2]);
  t('C. SERVICIOS COMUNES', M, y, { size: 8, font: B, color: AZUL }); y -= 6;
  tabla(['CONCEPTO APLICABLE', 'ACLARADOR DE SERVICIOS', 'POTENCIA (kW)', 'TENSIÓN (V)'], m.servicios.map((f) => [f.aplica ? f.nombre : '', val(f, 'aclarador'), val(f, 'potencia'), tens(f)]), [2, 3, 1.2, 1.3]);
  t('D. GARAJES Y VEHÍCULOS ELÉCTRICOS (VE)', M, y, { size: 8, font: B, color: AZUL }); y -= 6;
  tabla(['CONCEPTO APLICABLE', 'TIPO GARAJE / Nº PLAZAS', 'POTENCIA (kW)', 'TENSIÓN (V)', 'SUPERFICIE (m²)'], m.garajes.map((f) => [f.aplica ? f.nombre : '', val(f, 'tipo'), val(f, 'potencia'), tens(f), val(f, 'superficie')]), [2, 2.5, 1.2, 1.3, 1.2]);
  t('E. ELEMENTOS DE ACUMULACIÓN DE ENERGÍA ELÉCTRICA', M, y, { size: 8, font: B, color: AZUL }); y -= 14;
  const ac = m.acumulacion, au = m.autoconsumo;
  campos([['Aplica', ac.aplica ? 'SÍ' : 'NO'], ['Tecnología', ac.aplica ? ac.tipo : ''], ['Potencia', ac.aplica && ac.potencia ? ac.potencia + ' kW' : ''], ['Capacidad', ac.aplica && ac.capacidad ? ac.capacidad + ' kWh' : '']], 4);
  t('F. GENERACIÓN ASOCIADA / AUTOCONSUMO', M, y, { size: 8, font: B, color: AZUL }); y -= 14;
  campos([['Aplica', au.aplica ? 'SÍ' : 'NO'], ['Capacidad por consumo', au.aplica && au.consumo ? au.consumo + ' kW' : ''], ['Capacidad para generación', au.aplica && au.generacion ? au.generacion + ' kW' : '']], 3);
  t('Si aplica, es obligatorio adjuntar Esquema Unifilar Simplificado.', M, y, { size: 7, color: ACERO }); y -= 14;
  page.drawRectangle({ x: M, y: y - 20, width: W, height: 22, borderColor: c(ROJO), borderWidth: 1.5, color: rgb(1, 0.969, 0.965) });
  t(`POTENCIA TOTAL SOLICITADA A+B+C+D: ${kw(tot.total)} kW`, M + 8, y - 13, { size: 10, font: B });
  y -= 30;

  // Página 3: plano y foto CGP
  await nuevaPagina();
  const cgp = fotos.find((f) => f.cgp);
  const otras = fotos.filter((f) => f !== cgp);
  const hueco = (texto, alto) => { page.drawRectangle({ x: M, y: y - alto, width: W, height: alto, borderColor: c(LINEA), borderWidth: 0.8 }); const tw = F.widthOfTextAtSize(textoPdf(texto), 9); t(texto, PW / 2 - tw / 2, y - alto / 2, { size: 9, color: ACERO }); y -= alto + 8; };
  seccion('6. PLANO DE SITUACIÓN');
  if (plano) { const hh = await dibujarImg(plano, M, y, W, 330, true); y -= hh + 4; t(`PLANO DE SITUACIÓN · ${plano.nombre || ''} · ${coords}`, M, y, { size: 7, color: ACERO, maxW: W }); y -= 12; } else hueco(`PLANO DE SITUACIÓN NO ADJUNTO · COORDENADAS: ${coords}`, 120);
  seccion('7. FOTOGRAFÍA PROPUESTA DE UBICACIÓN DE LA CGP');
  if (cgp) { const hh = await dibujarImg(cgp, M, y, W, Math.max(120, y - M - 30), true); y -= hh + 4; t(`FOTOGRAFÍA CGP · ${cgp.nombre || ''}`, M, y, { size: 7, color: ACERO, maxW: W }); y -= 12; } else hueco('NO HAY FOTOGRAFÍA CGP SELECCIONADA', 100);

  // Páginas de anexo fotográfico (4 por página)
  await nuevaPagina();
  seccion('8. ANEXO FOTOGRÁFICO');
  if (!otras.length) hueco('NO HAY OTRAS FOTOGRAFÍAS ADJUNTAS', 100);
  for (let i = 0; i < otras.length; i++) {
    if (i && i % 4 === 0) { await nuevaPagina(); seccion('8. ANEXO FOTOGRÁFICO (continuación)'); }
    const col = i % 2, filaTop = y - Math.floor((i % 4) / 2) * 330;
    const x = M + col * (W / 2 + 5), w = W / 2 - 5;
    page.drawRectangle({ x, y: filaTop - 300, width: w, height: 300, borderColor: c(LINEA), borderWidth: 0.6 });
    await dibujarImg(otras[i], x + 4, filaTop - 4, w - 8, 280, true);
    t(`${i + 1}. ${otras[i].nombre || 'FOTOGRAFÍA'}`, x + 4, filaTop - 296, { size: 7, color: ACERO, maxW: w - 8 });
  }

  // Firma y sello + auditoría
  await nuevaPagina('FIRMA Y SELLO', 'CNMC CIRCULAR 1/2024 ENDESA');
  const top = y;
  campos([['Empresa', e.nombre || e.nombreComercial], ['CIF / NIF', e.nif], ['Técnico', te.nombre], ['Nº instalador / habilitación', te.numero], ['Fecha', fecha || new Date().toLocaleDateString('es-ES')]], 1);
  const xs = M + W / 2 + 10, ws = W / 2 - 10;
  page.drawRectangle({ x: xs, y: top - 150, width: ws, height: 150, borderColor: c(LINEA), borderWidth: 0.8 });
  t('FIRMA', xs + 8, top - 12, { size: 7, font: B, color: ACERO });
  t('SELLO', xs + ws / 2 + 8, top - 12, { size: 7, font: B, color: ACERO });
  if (firma) await dibujarImg(firma, xs + 6, top - 20, ws / 2 - 12, 120, true); else t('SIN FIRMA CONFIGURADA', xs + 8, top - 80, { size: 7, color: ACERO });
  if (sello) await dibujarImg(sello, xs + ws / 2 + 6, top - 20, ws / 2 - 12, 120, true); else t('SIN SELLO CONFIGURADO', xs + ws / 2 + 8, top - 80, { size: 7, color: ACERO });
  y = Math.min(y, top - 160);
  seccion('AUDITORÍA DE GENERACIÓN');
  campos([['Dirección', direccionCompleta(su) + (dir ? ' · ' + [su.cp, su.poblacion].filter(Boolean).join(' ') : '')], ['CUPS', su.cups], ['Referencia catastral', su.refCatastral], ['Coordenadas', coords],
    ['Plano incorporado', plano ? 'SÍ' : 'NO'], ['Fotografías incorporadas', String(fotos.length)], ['Foto CGP seleccionada', cgp ? 'SÍ' : 'NO'], ['Aviso', a.numero]]);

  // Pies de página
  paginas.forEach((p, i) => {
    page = p;
    p.drawRectangle({ x: M, y: 22, width: W, height: 1.2, color: c(ROJO) });
    t(`${nombreEmpresa(empresa)} · CNMC CIRCULAR 1/2024 ENDESA · Página ${i + 1} de ${paginas.length}`, M, 12, { size: 7, color: ACERO });
  });
  return pdf.save();
}
