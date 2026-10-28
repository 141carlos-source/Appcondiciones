import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { avisoDeFicha, planRecepcion, deshacerRecepcion, textoEventoRecepcion } from '../core/recepcionFicha.js';
import { generarFicha } from '../core/documentos.js';
import { datosDePdf } from '../core/fichaCliente.js';
import { normalizarAviso } from '../core/model.js';
import { normalizarEmpresa } from '../core/empresa.js';

globalThis.self ??= globalThis;
const _r = createRequire(import.meta.url)('../vendor/pdf-lib.min.js');
const PDFLib = _r?.PDFDocument ? _r : globalThis.PDFLib;

const reg = (id, data, extra = {}) => ({ id, data: normalizarAviso(data), ...extra });
const avisos = [
  reg('a1', { numero: '2026-0001', cliente: { nombre: 'ANA GIL' }, suministro: { cups: 'ES0031408137891001FE0F' } }),
  reg('a2', { numero: '2026-0002', cliente: { nombre: 'LUIS PEREZ' } }),
  reg('a3', { numero: '2026-0003' }, { deleted: true }),
];

test('de qué aviso es la ficha: marca del aviso, número o CUPS', () => {
  assert.equal(avisoDeFicha(avisos, { id: 'a2', n: '2026-0001', d: {} }).registro.id, 'a2', 'manda la marca del aviso');
  assert.equal(avisoDeFicha(avisos, { id: 'otro-dispositivo', n: '2026-0001', d: {} }).por, 'numero');
  assert.equal(avisoDeFicha(avisos, { d: { 'suministro.cups': 'es0031408137891001fe0f' } }).registro.id, 'a1');
  assert.equal(avisoDeFicha(avisos, { n: '2026-0003', d: {} }), null, 'la papelera no cuenta');
  assert.equal(avisoDeFicha(avisos, { d: { 'cliente.nombre': 'X' } }), null);
});

test('se aplica solo lo correcto; lo mal escrito queda para revisar; PDF guardado y firma marcada', () => {
  const r = { origen: 'formulario', firma: { nombre: 'ANA GIL', fecha: '28/10/2026' }, d: { 'cliente.nif': '12345678z', 'cliente.email': 'Ana@Correo.es', 'cliente.iban': 'ES00 MAL', 'cliente.nombre': 'ANA GIL' } };
  const antes = avisos[0].data;
  const plan = planRecepcion(antes, r, { archivo: { hash: 'h1', name: 'F.pdf', size: 10 }, ahora: '2026-10-28T10:00:00Z' });
  assert.deepEqual(plan.aplicados.map((c) => c.ruta), ['cliente.nif', 'cliente.email']);
  assert.deepEqual(plan.revisar.map((c) => c.ruta), ['cliente.iban']);
  assert.equal(plan.nuevo.cliente.nif, '12345678Z');
  assert.equal(plan.nuevo.cliente.iban, '', 'el IBAN mal escrito no se aplica');
  assert.equal(plan.nuevo.docs.firmado, 'recibido');
  assert.equal(plan.nuevo.archivos[0].tipo, 'ficha_cliente');
  assert.match(textoEventoRecepcion(plan, r, true), /2 dato\(s\) aplicados \(DNI \/ NIF \/ CIF, Correo electrónico\) · 1 para revisar · firmada por ANA GIL · PDF guardado/);

  const vuelta = deshacerRecepcion(plan.nuevo, antes, { aplicados: plan.aplicados, archivoHash: 'h1' });
  assert.equal(vuelta.cliente.nif, '');
  assert.equal(vuelta.cliente.email, '');
  assert.equal(vuelta.archivos.length, 0);
  assert.equal(vuelta.docs.firmado, antes.docs.firmado);
});

test('el PDF rellenable de la app lleva la marca de su aviso (aunque se rellene a mano)', async () => {
  const aviso = { ...normalizarAviso({ numero: '2026-0007', cliente: { nombre: 'ANA GIL' } }), id: 'avi_77' };
  const bytes = await generarFicha(PDFLib, { aviso, empresa: normalizarEmpresa({ empresa: { nombre: 'SOLTEC' } }) });
  const doc = await PDFLib.PDFDocument.load(bytes);
  doc.getForm().getTextField('cliente__nif').setText('12345678Z');
  const r = await datosDePdf(PDFLib, await doc.save());
  assert.equal(r.id, 'avi_77');
  assert.equal(r.n, '2026-0007');
  assert.equal(r.d['cliente.nif'], '12345678Z');
});
