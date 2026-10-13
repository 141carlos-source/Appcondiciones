import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { generarPlanoA5, nombrePlanoA5 } from '../core/plano.js';
import { encuadreA5, barraEscala, A5, MAPA_A5 } from '../core/geo.js';
import { normalizarEmpresa } from '../core/empresa.js';
import { normalizarAviso } from '../core/model.js';

globalThis.self ??= globalThis;
const _r = createRequire(import.meta.url)('../vendor/pdf-lib.min.js');
const PDFLib = _r?.PDFDocument ? _r : globalThis.PDFLib;
const png = { bytes: readFileSync(new URL('../icon-512.png', import.meta.url)), mime: 'image/png' };

test('encuadre del plano A5 a escala 1:2000', () => {
  const e = encuadreA5(41.6488, -0.8891);
  // El mapa mide ~194 × 105 mm en la hoja: a 1:2000 son ~389 × 210 m reales
  assert.ok(Math.abs(e.anchoM - MAPA_A5.ancho * 25.4 / 72 * 2) < 0.5);
  assert.ok(Math.abs(e.px / e.py - MAPA_A5.ancho / MAPA_A5.alto) < 0.01);
  const bbox = decodeURIComponent(new URL(e.url).searchParams.get('BBOX')).split(',').map(Number);
  const anchoMerc = bbox[2] - bbox[0];
  // En Web Mercator el ancho es mayor (1/cos lat): ~1,337 a 41,6º
  assert.ok(Math.abs(anchoMerc / e.anchoM - 1 / Math.cos(41.6488 * Math.PI / 180)) < 0.001);
  assert.deepEqual(barraEscala(2000), { metros: 100, pt: 100 / (2000 * 25.4 / 72 / 1000) });
});

test('PDF del plano de situación en A5 apaisado', async () => {
  const aviso = normalizarAviso({ numero: '2026-0007', cliente: { nombre: 'ANA GIL' }, suministro: { direccion: 'CALLE MAYOR', numero: '10', piso: '2', puerta: 'B', cp: '50001', poblacion: 'ZARAGOZA', provincia: 'ZARAGOZA', lat: '41.6488', lon: '-0.8891', refCatastral: '9872023VH5797S0001WX' } });
  const empresa = normalizarEmpresa({ empresa: { nombre: 'M. A. SOLTEC SL' } });
  const bytes = await generarPlanoA5(PDFLib, { aviso, empresa, mapa: png, fecha: '13/10/2026' });
  const doc = await PDFLib.PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1);
  const { width, height } = doc.getPage(0).getSize();
  assert.ok(Math.abs(width - A5.ancho) < 0.1 && Math.abs(height - A5.alto) < 0.1, `${width}x${height}`);
  assert.equal(nombrePlanoA5(aviso), 'PLANO_SITUACION_A5_CALLE_MAYOR_10_PISO_2_PUERTA_B.pdf');
  writeFileSync(new URL('./plano-a5-prueba.pdf', import.meta.url), bytes);
});
