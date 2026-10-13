// SOLTEC V2 · Plano de situación en PDF tamaño A5 apaisado, para adjuntar a la memoria / solicitud.
// Recibe la imagen del mapa ya preparada (con el punto marcado) y la coloca a escala.

import { A5, MAPA_A5, barraEscala } from './geo.js';
import { calleNumero, nombreArchivo } from './model.js';
import { nombreEmpresa } from './empresa.js';
import { textoPdf } from './documentos.js';

export const nombrePlanoA5 = (aviso) => {
  const s = aviso.suministro || {};
  return nombreArchivo('PLANO_SITUACION_A5', calleNumero(s) || aviso.numero, s.piso && `PISO ${s.piso}`, s.puerta && `PUERTA ${s.puerta}`) + '.pdf';
};

/**
 * @param PDFLib  módulo pdf-lib
 * @param {{aviso, empresa, logo?:{bytes,mime}, mapa:{bytes,mime}, escala?:number, fecha?:string}} o
 */
export async function generarPlanoA5(PDFLib, { aviso, empresa, logo, mapa, escala = 2000, fecha }) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const pdf = await PDFDocument.create();
  pdf.setTitle(textoPdf(`Plano de situación · Aviso ${aviso.numero || ''}`));
  pdf.setAuthor(textoPdf(nombreEmpresa(empresa)));
  pdf.setCreator('SOLTEC V2');
  const page = pdf.addPage([A5.ancho, A5.alto]);
  const F = await pdf.embedFont(StandardFonts.Helvetica);
  const B = await pdf.embedFont(StandardFonts.HelveticaBold);
  const NEGRO = rgb(0.12, 0.13, 0.15), ACERO = rgb(0.35, 0.38, 0.41), ROJO = rgb(0.77, 0.09, 0.11);
  const t = (s, x, y, { size = 8, font = F, color = NEGRO, maxW } = {}) => {
    let txt = textoPdf(s);
    if (maxW) while (txt.length > 3 && font.widthOfTextAtSize(txt, size) > maxW) txt = txt.slice(0, -2) + '…';
    page.drawText(txt, { x, y, size, font, color });
  };
  const emb = async (img) => {
    if (!img?.bytes) return null;
    try { return /png/.test(img.mime) ? await pdf.embedPng(img.bytes) : await pdf.embedJpg(img.bytes); } catch { return null; }
  };
  const M = A5.margen;
  const s = aviso.suministro || {};

  // Cabecera
  let y = A5.alto - M;
  page.drawRectangle({ x: M, y: y - 42, width: 4, height: 42, color: ROJO });
  t('PLANO DE SITUACIÓN', M + 10, y - 14, { size: 14, font: B });
  t(`AVISO ${aviso.numero || ''}${aviso.cliente?.nombre ? ' · ' + aviso.cliente.nombre : ''}`.toUpperCase(), M + 10, y - 27, { size: 8, color: ACERO, maxW: 330 });
  const dir = [calleNumero(s), s.piso && `PISO ${s.piso}`, s.puerta && `PUERTA ${s.puerta}`].filter(Boolean).join(', ');
  t([dir, [s.cp, s.poblacion].filter(Boolean).join(' '), s.provincia && `(${s.provincia})`].filter(Boolean).join(' · ').toUpperCase(), M + 10, y - 39, { size: 8.5, font: B, maxW: 400 });
  const lg = await emb(logo);
  if (lg) {
    const k = Math.min(120 / lg.width, 34 / lg.height);
    page.drawImage(lg, { x: A5.ancho - M - lg.width * k, y: y - 4 - lg.height * k, width: lg.width * k, height: lg.height * k });
  } else {
    const n = textoPdf(nombreEmpresa(empresa) || '');
    t(n, A5.ancho - M - B.widthOfTextAtSize(n, 9), y - 14, { size: 9, font: B });
  }

  // Mapa a escala
  const top = A5.alto - M - A5.cabecera;
  const x0 = M, y0 = top - MAPA_A5.alto;
  const im = await emb(mapa);
  if (im) page.drawImage(im, { x: x0, y: y0, width: MAPA_A5.ancho, height: MAPA_A5.alto });
  else t('MAPA NO DISPONIBLE', x0 + MAPA_A5.ancho / 2 - 50, y0 + MAPA_A5.alto / 2, { size: 11, color: ACERO });
  page.drawRectangle({ x: x0, y: y0, width: MAPA_A5.ancho, height: MAPA_A5.alto, borderColor: NEGRO, borderWidth: 0.8 });

  // Barra de escala (abajo a la izquierda, sobre fondo blanco)
  const b = barraEscala(escala);
  const bx = x0 + 10, by = y0 + 12;
  page.drawRectangle({ x: bx - 6, y: by - 6, width: b.pt + 60, height: 24, color: rgb(1, 1, 1), opacity: 0.9 });
  page.drawRectangle({ x: bx, y: by, width: b.pt / 2, height: 4, color: NEGRO });
  page.drawRectangle({ x: bx + b.pt / 2, y: by, width: b.pt / 2, height: 4, color: rgb(1, 1, 1), borderColor: NEGRO, borderWidth: 0.6 });
  t('0', bx - 2, by + 7, { size: 6.5 });
  t(`${b.metros} m`, bx + b.pt - 6, by + 7, { size: 6.5 });
  t(`1:${escala.toLocaleString('es-ES')}`, bx + b.pt + 12, by + 1, { size: 8, font: B });

  // Pie
  const lat = s.lat ? String(s.lat).replace('.', ',') : '', lon = s.lon ? String(s.lon).replace('.', ',') : '';
  let yp = y0 - 12;
  t(`COORDENADAS (ETRS89): LAT ${lat}  ·  LON ${lon}${s.refCatastral ? `   ·   REF. CATASTRAL: ${s.refCatastral}` : ''}`, M, yp, { size: 7.5, font: B, maxW: MAPA_A5.ancho });
  yp -= 10;
  t(`Escala 1:${escala.toLocaleString('es-ES')} impreso en A5 sin ajustar. El punto rojo marca el suministro. Cartografía: © Instituto Geográfico Nacional (IGN Base).`, M, yp, { size: 6.5, color: ACERO, maxW: MAPA_A5.ancho - 90 });
  const f = textoPdf(fecha || new Date().toLocaleDateString('es-ES'));
  t(f, A5.ancho - M - F.widthOfTextAtSize(f, 6.5), yp, { size: 6.5, color: ACERO });
  return pdf.save();
}
