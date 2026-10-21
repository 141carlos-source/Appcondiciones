import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { generarMemoria, totales, normalizarMemoria, memoriaVacia, tensionTexto, kw } from '../core/memoria.js';
import { nuevoAviso, nombreMemoria } from '../core/model.js';
import { normalizarEmpresa } from '../core/empresa.js';

globalThis.self ??= globalThis;
const _r = createRequire(import.meta.url)('../vendor/pdf-lib.min.js');
const PDFLib = _r?.PDFDocument ? _r : globalThis.PDFLib;
const jpg = { bytes: readFileSync(new URL('../assets/logo_e-distribucion.jpg', import.meta.url)), mime: 'image/jpeg' };

test('potencias A+B+C+D: solo cuentan las filas que aplican', () => {
  const m = memoriaVacia();
  m.viviendas[0] = { ...m.viviendas[0], aplica: true, potencia: '9,2' };
  m.viviendas[1] = { ...m.viviendas[1], aplica: false, potencia: '50' };
  m.locales[0] = { ...m.locales[0], aplica: true, potencia: '15' };
  m.garajes[1] = { ...m.garajes[1], aplica: true, potencia: '7.4' };
  const t = totales(m);
  assert.deepEqual([t.A, t.B, t.C, t.D], [9.2, 15, 0, 7.4]);
  assert.equal(kw(t.total), '31,6');
  assert.equal(tensionTexto('400'), '3X230/400V');
  assert.equal(tensionTexto('3X230/400 V'), '3X230/400V');
});

test('memoria antigua o incompleta se completa sin perder datos', () => {
  const m = normalizarMemoria({ tipoSolicitud: 'NUEVO SUMINISTRO', viviendas: [{ aplica: true, potencia: '5' }] });
  assert.equal(m.viviendas.length, 3);
  assert.equal(m.viviendas[0].nombre, 'VIVIENDA 1');
  assert.equal(m.viviendas[0].potencia, '5');
  assert.equal(m.garajes[1].nombre, 'PUNTOS RECARGA VE');
});

test('PDF de la memoria CNMC con sus apartados y nombre con dirección, piso y puerta', async () => {
  const aviso = nuevoAviso({ numero: '2026-0009', concepto: 'Nuevo suministro vivienda unifamiliar', observaciones: 'Acometida subterránea desde la CGP existente en fachada.',
    suministro: { direccion: 'Calle Ramón y Cajal 12', piso: '3', puerta: 'B', cp: '44001', poblacion: 'Teruel', provincia: 'Teruel', refCatastral: '9872023VH5797S0001WX', lat: '40.3456', lon: '-1.1065', cups: '' },
    electrico: { potenciaKw: '9,2', tension: '230' } });
  aviso.memoria = memoriaVacia();
  aviso.memoria.tipoSolicitud = 'NUEVO SUMINISTRO';
  aviso.memoria.usoFinca = 'VIVIENDA';
  aviso.memoria.viviendas[0] = { ...aviso.memoria.viviendas[0], aplica: true, potencia: '9,2', tension: '230 V', grado: 'ELEVADA' };
  const empresa = normalizarEmpresa({ empresa: { nombre: 'M. A. SOLTEC SL', nif: 'B99506651' }, tecnico: { nombre: 'Carlos', numero: 'IBTE-123' } });
  const fotos = [{ ...jpg, nombre: 'cgp.jpg', cgp: true }, ...Array.from({ length: 5 }, (_, i) => ({ ...jpg, nombre: `foto${i + 1}.jpg` }))];
  const bytes = await generarMemoria(PDFLib, { aviso, empresa, logo: jpg, edist: jpg, plano: { ...jpg, nombre: 'plano.jpg' }, fotos, fecha: '10/10/2026' });
  const doc = await PDFLib.PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 6, '2 de datos + plano/CGP + 2 de anexo + firma');
  assert.equal(nombreMemoria(aviso), 'CNMC_CIRCULAR_1_2024_ENDESA_CALLE_RAMON_Y_CAJAL_12_PISO_3_PUERTA_B.pdf');
  writeFileSync(new URL('./memoria-ejemplo.pdf', import.meta.url), bytes);
});

test('apartado G. Naves: suma en el total y uso de la finca desde «Datos eléctricos»', async () => {
  const { normalizarMemoria, totales, usoFincaDeUso } = await import('../core/memoria.js');
  const m = normalizarMemoria({ viviendas: [{ aplica: true, potencia: '5,75' }] });
  assert.equal(m.naves.length, 2);
  assert.equal(m.naves[0].nombre, 'NAVE 1');
  m.naves[0].aplica = true; m.naves[0].potencia = '43,65';
  const t = totales(m);
  assert.equal(Math.round(t.G * 100), 4365);
  assert.equal(Math.round(t.total * 100), 4940);
  assert.equal(usoFincaDeUso('nave'), 'NAVE');
  assert.equal(usoFincaDeUso('vivienda'), 'VIVIENDA');
  assert.equal(usoFincaDeUso('local'), 'LOCAL');
});
