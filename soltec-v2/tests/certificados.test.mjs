import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { evaluarTierra, normalizarCertTierra, generarCertTierra, nombreCertTierra, estadoCalibracion, nombreMedidor } from '../core/certificados.js';
import { normalizarAviso } from '../core/model.js';
import { normalizarEmpresa } from '../core/empresa.js';

globalThis.self ??= globalThis;
const _r = createRequire(import.meta.url)('../vendor/pdf-lib.min.js');
const PDFLib = _r?.PDFDocument ? _r : globalThis.PDFLib;
const jpg = { bytes: readFileSync(new URL('../assets/logo_e-distribucion.jpg', import.meta.url)), mime: 'image/jpeg' };

test('evaluación de la toma de tierra (ITC-BT-18 y referencia ITC-BT-26)', () => {
  const ok = evaluarTierra(normalizarCertTierra({ medida: '25,4', diferencial: '30' }));
  assert.equal(ok.apto, true);
  assert.ok(Math.abs(ok.uc - 0.762) < 1e-9);
  assert.equal(ok.limiteR, 37);
  const alto = evaluarTierra(normalizarCertTierra({ medida: '60' }));
  assert.equal(alto.okUc, true, '60 Ω × 30 mA = 1,8 V');
  assert.equal(alto.okR, false, 'pero supera los 37 Ω de referencia');
  assert.equal(alto.apto, false);
  assert.equal(evaluarTierra(normalizarCertTierra({ medida: '60', refViviendas: false })).apto, true);
  assert.equal(evaluarTierra(normalizarCertTierra({ medida: '20', pararrayos: true })).okR, false, 'con pararrayos el límite es 15 Ω');
  const humedo = evaluarTierra(normalizarCertTierra({ medida: '100', diferencial: '300', humedo: true, refViviendas: false }));
  assert.equal(humedo.uc, 30);
  assert.equal(humedo.okUc, false, '30 V > 24 V en local húmedo');
  assert.equal(evaluarTierra(normalizarCertTierra({})).completo, false);
  assert.equal(normalizarCertTierra({ fotos: [1, 2, 3, 4, 5, 6, 7, 8] }).fotos.length, 6);
});

test('equipo de medida: calibración vigente o caducada', () => {
  const m = { tipo: 'Telurómetro', marca: 'FLUKE', modelo: '1625-2', serie: 'A123', validoHasta: '2027-03-01' };
  assert.equal(estadoCalibracion(m, '2026-10-14'), 'vigente');
  assert.equal(estadoCalibracion(m, '2027-03-02'), 'caducada');
  assert.equal(nombreMedidor(m), 'Telurómetro · FLUKE · 1625-2 · nº A123');
});

test('PDF del certificado con plano y 6 fotos', async () => {
  const aviso = normalizarAviso({ numero: '2026-0030', cliente: { nombre: 'ANA GIL', nif: '12345678Z' }, suministro: { direccion: 'CALLE MAYOR', numero: '10', cp: '50001', poblacion: 'ZARAGOZA', provincia: 'ZARAGOZA', lat: '41.6488', lon: '-0.8891', refCatastral: '9872023VH5797S0001WX' } });
  const empresa = normalizarEmpresa({ empresa: { nombre: 'M. A. SOLTEC SL', nif: 'B99506651', localidad: 'LA PUEBLA DE ALFINDEN' }, tecnico: { nombre: 'CARLOS', numero: 'IBTE-123' } });
  const cert = { fecha: '2026-10-14', medida: '12,3', seccion: '16', observaciones: 'Medida con terreno húmedo tras lluvia.' };
  const bytes = await generarCertTierra(PDFLib, { aviso, empresa, cert, medidor: { tipo: 'Telurómetro', marca: 'FLUKE', modelo: '1625-2', serie: 'A123', calibracion: '2026-03-01', validoHasta: '2027-03-01' }, logo: jpg, firma: jpg, sello: jpg, plano: jpg, fotos: Array.from({ length: 6 }, (_, i) => ({ ...jpg, nombre: 'Foto ' + (i + 1) })) });
  const doc = await PDFLib.PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 3, 'datos y medición + fotos, equipo y firma + plano');
  assert.equal(nombreCertTierra(aviso), 'CERTIFICADO_TOMA_TIERRA_CALLE_MAYOR_10.pdf');
  writeFileSync(new URL('./cert-tierra-ejemplo.pdf', import.meta.url), bytes);
});

import { partesCertificado, faltaTitular } from '../core/certificados.js';

test('solicitante = cliente del aviso; titular el mismo o el escrito en el certificado', () => {
  const aviso = normalizarAviso({ cliente: { nombre: 'ANA GIL', nif: '12345678Z', telefono: '+34 600 111 222' }, suministro: { direccion: 'CALLE MAYOR', numero: '10', cp: '50001', poblacion: 'ZARAGOZA' } });
  const mismo = partesCertificado(aviso, {});
  assert.equal(mismo.mismo, true);
  assert.equal(mismo.solicitante.nombre, 'ANA GIL');
  assert.deepEqual([mismo.titular.nombre, mismo.titular.nif, mismo.titular.direccion], ['ANA GIL', '12345678Z', 'CALLE MAYOR 10, 50001, ZARAGOZA']);
  const otro = partesCertificado(aviso, { titularDistinto: true, titular: { nombre: 'COMUNIDAD SOL', nif: 'H50000000', direccion: 'C/ SOL 2' } });
  assert.equal(otro.mismo, false);
  assert.equal(otro.solicitante.nombre, 'ANA GIL', 'el solicitante sigue siendo el cliente');
  assert.deepEqual([otro.titular.nombre, otro.titular.nif, otro.titular.direccion], ['COMUNIDAD SOL', 'H50000000', 'C/ SOL 2']);
  assert.equal(partesCertificado(aviso, { titularDistinto: true, titular: { nombre: '' } }).mismo, true, 'marcado pero sin nombre: el mismo');
  assert.deepEqual(faltaTitular({ titularDistinto: true, titular: { nombre: 'X' } }), ['DNI / NIF / CIF']);
  assert.deepEqual(faltaTitular({}), []);
  // Certificados antiguos (sin estos campos) siguen abriendo igual
  const viejo = normalizarCertTierra({ medida: '10' });
  assert.equal(viejo.titularDistinto, false);
  assert.deepEqual(viejo.titular, { nombre: '', nif: '', telefono: '', direccion: '' });
});

test('PDF con titular distinto: sigue cabiendo igual (3 páginas con plano y 6 fotos)', async () => {
  const aviso = normalizarAviso({ numero: '2026-0031', cliente: { nombre: 'ANA GIL', nif: '12345678Z' }, suministro: { direccion: 'CALLE MAYOR', numero: '10', cp: '50001', poblacion: 'ZARAGOZA' } });
  const cert = { fecha: '2026-10-25', medida: '12,3', observaciones: 'Prueba.', titularDistinto: true, titular: { nombre: 'COMUNIDAD SOL', nif: 'H50000000', telefono: '+34 976 000 000', direccion: 'C/ SOL 2, 50001, ZARAGOZA' } };
  const bytes = await generarCertTierra(PDFLib, { aviso, empresa: normalizarEmpresa({}), cert, medidor: null, logo: jpg, firma: jpg, sello: jpg, plano: jpg, fotos: Array.from({ length: 6 }, () => ({ ...jpg })) });
  assert.equal((await PDFLib.PDFDocument.load(bytes)).getPageCount(), 3);
  writeFileSync(new URL('./cert-tierra-titular.pdf', import.meta.url), bytes);
});
