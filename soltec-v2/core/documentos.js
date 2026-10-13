// SOLTEC V2 · Documentos y comunicaciones: ficha PDF del cliente, WhatsApp y correos.
// Funciones puras: reciben pdf-lib (PDFLib) y los datos; no tocan la base de datos.

import { direccionCompleta, calleNumero, nombreArchivo, datosPendientes } from './model.js';
import { nombreCampoPdf } from './fichaCliente.js';
import { nombreEmpresa } from './empresa.js';

// ---------------------------------------------------------------- utilidades
/** Las fuentes estándar del PDF (WinAnsi) no admiten todos los caracteres: se limpian. */
// Se conservan también los signos tipográficos que WinAnsi sí tiene: – — ‘ ’ “ ” • … €
export const textoPdf = (s) => String(s ?? '').normalize('NFC').replace(/\t/g, ' ').replace(/[^\x20-\x7E\xA0-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC\n]/g, '').replace(/\n/g, ' ');

export const nombreFicha = (aviso, firmada = false) => {
  const s = aviso.suministro || {};
  return nombreArchivo('FICHA_CLIENTE', calleNumero(s) || aviso.numero, s.piso && `PISO ${s.piso}`, s.puerta && `PUERTA ${s.puerta}`, firmada && 'FIRMADA') + '.pdf';
};

const ROJO = [0.769, 0.086, 0.11], GRAFITO = [0.118, 0.133, 0.149], ACERO = [0.353, 0.38, 0.412], LINEA = [0.83, 0.843, 0.859], HUESO = [0.957, 0.949, 0.933];

/**
 * Genera la ficha de datos del cliente.
 * @param {object} PDFLib  la librería pdf-lib
 * @param {{aviso, empresa, logo?:{bytes,mime}, edist?:{bytes,mime}, firma?:{png:Uint8Array, nombre:string, fecha:string}}} o
 * @returns {Promise<Uint8Array>}
 */
export async function generarFicha(PDFLib, { aviso, empresa, logo, edist, firma, datosCliente, aplanar }) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const c = (a) => rgb(...a);
  const pdf = await PDFDocument.create();
  pdf.setTitle(textoPdf(`Ficha de datos del cliente · Aviso ${aviso.numero || ''}`));
  pdf.setAuthor(textoPdf(nombreEmpresa(empresa)));
  pdf.setCreator('SOLTEC V2');
  // Datos del cliente codificados (formulario web): la app los lee al recibir el PDF de vuelta
  if (datosCliente) { pdf.setSubject(datosCliente); pdf.setKeywords([datosCliente]); }
  const page = pdf.addPage([595.28, 841.89]);
  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const form = pdf.getForm();
  const M = 36, W = 595.28 - 2 * M;
  let y = 841.89 - M;

  const texto = (t, x, yy, { size = 8, font = fuente, color = GRAFITO, maxW } = {}) => {
    let s = textoPdf(t);
    if (maxW) while (s && font.widthOfTextAtSize(s, size) > maxW) s = s.slice(0, -1);
    page.drawText(s, { x, y: yy, size, font, color: c(color) });
  };
  const imagen = async (img, x, top, maxW, maxH, alinear = 'left') => {
    if (!img) return 0;
    const emb = /png/.test(img.mime) ? await pdf.embedPng(img.bytes) : await pdf.embedJpg(img.bytes);
    const k = Math.min(maxW / emb.width, maxH / emb.height);
    const w = emb.width * k, hh = emb.height * k;
    page.drawImage(emb, { x: alinear === 'right' ? x + maxW - w : x, y: top - hh, width: w, height: hh });
    return hh;
  };

  // Cabecera: barra roja, logos y datos de la empresa
  page.drawRectangle({ x: 0, y: 841.89 - 6, width: 595.28, height: 6, color: c(ROJO) });
  const hLogo = await imagen(logo, M, y, 170, 52);
  const hEd = await imagen(edist, M + W - 140, y - 4, 140, 22, 'right');
  y -= Math.max(hLogo, hEd, 30) + 8;
  const e = empresa?.empresa || {};
  texto([e.nombre || nombreEmpresa(empresa), e.nif && `CIF ${e.nif}`, e.telefono, e.email, e.web].filter(Boolean).join('  ·  '), M, y, { size: 7.5, color: ACERO, maxW: W });
  y -= 10;
  if (e.direccion) { texto([e.direccion, e.cp, e.localidad, e.provincia].filter(Boolean).join(', '), M, y, { size: 7.5, color: ACERO, maxW: W }); y -= 10; }
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.5, color: c(LINEA) });
  y -= 22;

  texto('FICHA DE DATOS DEL CLIENTE', M, y, { size: 15, font: negrita });
  texto(`Aviso ${aviso.numero || '-'}${aviso.condiciones?.ref ? '  ·  Ref. condiciones ' + aviso.condiciones.ref : ''}`, M + W - 230, y + 2, { size: 8, color: ACERO, maxW: 230 });
  y -= 16;

  // Instrucciones
  const instr = [
    'Revise los datos. Complete los campos vacíos que necesitamos para el boletín y/o el contrato de electricidad.',
    'Rellénelo en el móvil o el ordenador (con Adobe Acrobat Reader, gratuito), guárdelo y devuélvanoslo por WhatsApp o correo.',
  ];
  page.drawRectangle({ x: M, y: y - 26, width: W, height: 30, color: c(HUESO) });
  instr.forEach((t, i) => texto(t, M + 8, y - 8 - i * 11, { size: 8, maxW: W - 16 }));
  y -= 40;

  // Secciones con campos rellenables
  let n = 0;
  const seccion = (titulo) => { y -= 6; texto(titulo, M, y, { size: 8, font: negrita, color: ROJO }); y -= 6; page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.8, color: c(ROJO) }); y -= 4; };
  const fila = (campos, size) => {
    const alto = size === 9 ? 18 : 16, gap = 8;
    const total = campos.reduce((a, f) => a + f[2], 0);
    let x = M;
    for (const [etiqueta, valor, peso, ruta] of campos) {
      const w = (W - gap * (campos.length - 1)) * (peso / total);
      texto(etiqueta, x, y - 9, { size: 6.5, color: ACERO, maxW: w });
      // Los campos de datos se llaman como su ruta (cliente__nombre…) para poder leerlos al volver
      const tf = form.createTextField(ruta ? nombreCampoPdf(ruta) : `f${++n}_${nombreArchivo(etiqueta).slice(0, 30)}`);
      tf.setText(textoPdf(valor));
      tf.addToPage(page, { x, y: y - 11 - alto, width: w, height: alto, font: fuente, borderColor: c(LINEA), backgroundColor: valor ? rgb(1, 1, 1) : rgb(0.984, 0.918, 0.918), borderWidth: 0.6 });
      tf.setFontSize(size);
      x += w + gap;
    }
    y -= 11 + alto + 6;
  };

  const cl = aviso.cliente || {}, su = aviso.suministro || {}, el = aviso.electrico || {};
  seccion('DATOS DEL CLIENTE');
  fila([['Nombre y apellidos o razón social', cl.nombre, 3, 'cliente.nombre'], ['DNI / NIF / CIF', cl.nif, 1.2, 'cliente.nif']], 9);
  fila([['Persona de contacto', cl.contacto, 2, 'cliente.contacto'], ['Teléfono', cl.telefono, 1.2, 'cliente.telefono'], ['Correo electrónico', cl.email, 2, 'cliente.email']], 9);
  fila([['IBAN (para el contrato)', cl.iban, 1, 'cliente.iban']], 9);
  y -= 4;
  seccion('DATOS DEL SUMINISTRO');
  fila([['Calle / vía', su.direccion, 3.4, 'suministro.direccion'], ['Número', su.numero, 0.7, 'suministro.numero'], ['Piso', su.piso, 0.7, 'suministro.piso'], ['Puerta', su.puerta, 0.7, 'suministro.puerta']], 8);
  fila([['Código postal', su.cp, 1, 'suministro.cp'], ['Población', su.poblacion, 2, 'suministro.poblacion'], ['Provincia', su.provincia, 1.6, 'suministro.provincia']], 8);
  fila([['CUPS', su.cups, 2, 'suministro.cups'], ['Referencia catastral', su.refCatastral, 2, 'suministro.refCatastral']], 8);
  y -= 4;
  seccion('DATOS ELÉCTRICOS');
  const tension = { 230: '230 V (monofásico)', 400: '400 V (trifásico)' }[el.tension] || el.tension || '';
  const usos = { vivienda: 'Vivienda', local: 'Local comercial', comunes: 'Servicios comunes', garaje: 'Garaje / recarga', otro: 'Otro' };
  fila([['Potencia (kW)', el.potenciaKw, 1], ['Tensión', tension, 1.4], ['Uso', usos[el.uso] || el.uso, 1.6]], 8);
  y -= 8;

  // Firma
  seccion('CONFORMIDAD Y FIRMA DEL CLIENTE');
  texto('El cliente declara que los datos son correctos y autoriza su uso para tramitar la solicitud con la distribuidora y la comercializadora.', M, y - 8, { size: 7, color: ACERO, maxW: W });
  y -= 18;
  const firmaH = 80;
  page.drawRectangle({ x: M, y: y - firmaH, width: W * 0.6, height: firmaH, borderColor: c(LINEA), borderWidth: 0.6 });
  texto('Firma', M + 4, y - 9, { size: 6.5, color: ACERO });
  if (firma?.png) {
    const emb = await pdf.embedPng(firma.png);
    const k = Math.min((W * 0.6 - 16) / emb.width, (firmaH - 16) / emb.height);
    page.drawImage(emb, { x: M + 8, y: y - firmaH + 6, width: emb.width * k, height: emb.height * k });
  }
  const xd = M + W * 0.6 + 8, wd = W * 0.4 - 8;
  y -= 2;
  const yFirma = y;
  const campoFirma = (etq, val, dy) => {
    texto(etq, xd, yFirma - dy, { size: 6.5, color: ACERO });
    const tf = form.createTextField(`firma_${nombreArchivo(etq)}`);
    tf.setText(textoPdf(val));
    tf.addToPage(page, { x: xd, y: yFirma - dy - 20, width: wd, height: 18, font: fuente, borderColor: c(LINEA), borderWidth: 0.6 });
    tf.setFontSize(9);
  };
  campoFirma('Nombre de quien firma', firma?.nombre || '', 7);
  campoFirma('Fecha', firma?.fecha || '', 40);
  y -= firmaH + 14;

  texto(`Documento preparado por ${nombreEmpresa(empresa)}${firma ? ' · Firmado en el dispositivo el ' + firma.fecha : ''}.`, M, Math.max(y, M), { size: 6.5, color: ACERO, maxW: W });

  form.updateFieldAppearances(fuente);
  if (firma?.png || aplanar) form.flatten(); // firmado: los datos quedan fijados junto a la firma
  return pdf.save();
}

// ---------------------------------------------------------------- WhatsApp
export function telefonoWhatsApp(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.startsWith('0034')) d = d.slice(4);
  if (d.length === 11 && d.startsWith('34')) d = d.slice(2);
  return /^[67]\d{8}$/.test(d) ? '34' + d : null;
}

export function resumenWhatsApp({ aviso, empresa, seguimiento }) {
  const faltan = datosPendientes(aviso, 'ficha').concat(datosPendientes(aviso, 'contrato'), datosPendientes(aviso, 'boletin'));
  const unicos = [...new Map(faltan.map((f) => [f.campo, f.etiqueta])).values()];
  const cl = aviso.cliente || {};
  const l = [];
  l.push(`Hola${cl.contacto || cl.nombre ? ' ' + (cl.contacto || cl.nombre).split(' ')[0] : ''}, le escribimos de ${nombreEmpresa(empresa)}.`);
  l.push('');
  l.push(`Aviso ${aviso.numero}${direccionCompleta(aviso.suministro) ? ' · ' + direccionCompleta(aviso.suministro) : ''}`);
  if (aviso.condiciones?.ref) l.push(`Ref. condiciones: ${aviso.condiciones.ref}`);
  if (unicos.length) {
    l.push('');
    l.push('Para continuar necesitamos estos datos:');
    for (const u of unicos) l.push(`• ${u}`);
  }
  if (seguimiento) l.push('', `Próximo contacto: ${seguimiento.fecha}${seguimiento.hora ? ' a las ' + seguimiento.hora : ''}`);
  l.push('');
  l.push('Le enviamos la ficha en PDF: revísela, complete lo que falte para el boletín y/o el contrato, guárdela y devuélvanosla firmada.');
  l.push('');
  l.push(`Gracias. ${nombreEmpresa(empresa)}${empresa?.empresa?.telefono ? ' · ' + empresa.empresa.telefono : ''}`);
  return l.join('\n');
}

export const enlaceWhatsApp = (tel, texto) => {
  const t = telefonoWhatsApp(tel);
  return `https://wa.me/${t || ''}?text=${encodeURIComponent(texto)}`;
};

// ---------------------------------------------------------------- correos
export const TIPOS_CORREO = {
  condiciones: { label: 'Solicitar condiciones de suministro', destino: 'boletin', para: (e) => e.correos.nuevosSuministros },
  contrato: { label: 'Solicitar contrato de electricidad', destino: 'contrato', para: (e) => e.correos.comercializadora },
  datos: { label: 'Pedir datos al cliente', destino: null, para: (_e, a) => a.cliente?.email },
};

export function correo(tipo, { aviso, empresa, seguimiento }) {
  const a = aviso, cl = a.cliente || {}, su = a.suministro || {}, el = a.electrico || {}, so = empresa?.solicitante || {};
  const dir = [direccionCompleta(su), su.cp, su.poblacion, su.provincia].filter(Boolean).join(', ');
  const linea = (k, v) => (v ? `${k}: ${v}` : null);
  let asunto, cuerpo;
  if (tipo === 'condiciones') {
    asunto = `Solicitud de condiciones de suministro · ${dir || a.numero}`;
    cuerpo = ['Buenos días:', '', 'Solicitamos condiciones técnico-económicas para el siguiente suministro:', '',
      linea('Dirección', dir), linea('Referencia catastral', su.refCatastral), linea('Coordenadas', su.lat && su.lon ? `${su.lat}, ${su.lon}` : ''),
      linea('Potencia solicitada', el.potenciaKw && `${el.potenciaKw} kW`), linea('Tensión', el.tension && `${el.tension} V`), linea('CUPS', su.cups), '',
      linea('Titular', cl.nombre), linea('NIF titular', cl.nif), '',
      'Solicitante:', linea('Nombre', so.nombre || empresa?.empresa?.nombre), linea('NIF', so.nif || empresa?.empresa?.nif), linea('Teléfono', so.telefono || empresa?.empresa?.telefono), linea('Correo', so.email || empresa?.empresa?.email), '',
      'Adjuntamos la documentación.', '', 'Un saludo,', nombreEmpresa(empresa)];
  } else if (tipo === 'contrato') {
    asunto = `Solicitud de contrato · ${su.cups || dir} · ${cl.nombre || ''}`.trim();
    cuerpo = ['Buenos días:', '', 'Solicitamos el alta del contrato de electricidad con estos datos:', '',
      linea('Titular', cl.nombre), linea('NIF', cl.nif), linea('Teléfono', cl.telefono), linea('Correo', cl.email), linea('IBAN', cl.iban), '',
      linea('Dirección de suministro', dir), linea('CUPS', su.cups), linea('Potencia', el.potenciaKw && `${el.potenciaKw} kW`), linea('Ref. condiciones', a.condiciones?.ref), '',
      'Adjuntamos la documentación.', '', 'Un saludo,', nombreEmpresa(empresa)];
  } else {
    asunto = `Datos pendientes · Aviso ${a.numero} · ${nombreEmpresa(empresa)}`;
    cuerpo = resumenWhatsApp({ aviso, empresa, seguimiento }).split('\n');
  }
  return { para: TIPOS_CORREO[tipo].para(normalizarCorreos(empresa), a) || '', asunto, cuerpo: cuerpo.filter((x) => x !== null).join('\n') };
}

const normalizarCorreos = (e) => ({ ...e, correos: { nuevosSuministros: '', solicitarCups: '', comercializadora: '', inspeccion: '', ...(e?.correos || {}) } });

export const enlaceCorreo = ({ para, asunto, cuerpo }) => `mailto:${encodeURIComponent(para).replace(/%40/g, '@')}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
