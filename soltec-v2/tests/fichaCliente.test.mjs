import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { paqueteFicha, enlaceFormulario, leerEnlace, lineaDatos, leerDatos, datosDePdf, cambiosFicha, aplicarCambios, nombreCampoPdf } from '../core/fichaCliente.js';
import { generarFicha } from '../core/documentos.js';
import { normalizarAviso } from '../core/model.js';
import { normalizarEmpresa } from '../core/empresa.js';

globalThis.self ??= globalThis;
const _r = createRequire(import.meta.url)('../vendor/pdf-lib.min.js');
const PDFLib = _r?.PDFDocument ? _r : globalThis.PDFLib;
const empresa = normalizarEmpresa({ empresa: { nombre: 'M. A. SOLTEC SL', telefono: '600111222', email: 'info@soltec.es' } });
const aviso = normalizarAviso({ numero: '2026-0009', cliente: { nombre: 'ANA GIL', telefono: '600123456' }, suministro: { direccion: 'CALLE MAYOR', numero: '10', cp: '50001', poblacion: 'ZARAGOZA', provincia: 'ZARAGOZA' } });

test('el enlace lleva los datos de la ficha y nada más', () => {
  const p = paqueteFicha({ ...aviso, id: 'avi_1' }, empresa);
  assert.deepEqual(Object.keys(p.d).sort(), ['cliente.nombre', 'cliente.telefono', 'suministro.cp', 'suministro.direccion', 'suministro.numero', 'suministro.poblacion', 'suministro.provincia']);
  const url = enlaceFormulario(p);
  assert.match(url, /^https:\/\/141carlos-source\.github\.io\/Appcondiciones\/soltec-v2\/cliente\.html#[A-Za-z0-9_-]+$/);
  assert.ok(url.length < 1200, `enlace de ${url.length} caracteres`);
  const de = leerEnlace(new URL(url).hash);
  assert.equal(de.n, '2026-0009');
  assert.equal(de.e.t, '600111222');
  assert.equal(de.d['cliente.nombre'], 'ANA GIL');
  assert.equal(leerEnlace('#roto'), null);
});

test('los datos vuelven en el mensaje (texto pegado) y se comparan con el aviso', () => {
  const linea = lineaDatos({ v: 1, n: '2026-0009', d: { 'cliente.nombre': 'ANA GIL', 'cliente.nif': '12345678z', 'cliente.email': 'Ana@Correo.es', 'suministro.cups': 'ES0031408137891001FE0F' }, firma: { nombre: 'ANA GIL', fecha: '13/10/2026' } });
  const r = leerDatos(`Ficha de datos\nNombre: ANA GIL\n\n(Código para la app, no lo borre)\n${linea}`);
  assert.equal(r.firma.nombre, 'ANA GIL');
  const c = cambiosFicha(aviso, r.d);
  assert.deepEqual(c.map((x) => [x.ruta, x.ahora]), [['cliente.nif', '12345678Z'], ['cliente.email', 'Ana@Correo.es'], ['suministro.cups', 'ES0031408137891001FE0F']]);
  assert.ok(c.find((x) => x.ruta === 'cliente.nif').problema === null);
  const nuevo = aplicarCambios(aviso, c);
  assert.equal(nuevo.cliente.nif, '12345678Z');
  assert.equal(nuevo.cliente.nombre, 'ANA GIL');
  assert.equal(aviso.cliente.nif, '', 'el original no cambia');
});

test('PDF del formulario web: los datos se leen del propio PDF aunque esté firmado y aplanado', async () => {
  const linea = lineaDatos({ v: 1, n: '2026-0009', d: { 'cliente.nif': '12345678Z' }, firma: { nombre: 'ANA', fecha: '13/10/2026' } });
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));
  const bytes = await generarFicha(PDFLib, { aviso, empresa, firma: { png, nombre: 'ANA', fecha: '13/10/2026' }, datosCliente: linea });
  const r = await datosDePdf(PDFLib, bytes);
  assert.equal(r.origen, 'formulario');
  assert.equal(r.d['cliente.nif'], '12345678Z');
});

test('PDF rellenable completado por el cliente (Acrobat): se leen sus campos', async () => {
  const bytes = await generarFicha(PDFLib, { aviso, empresa });
  const doc = await PDFLib.PDFDocument.load(bytes);
  const form = doc.getForm();
  form.getTextField(nombreCampoPdf('cliente.nif')).setText('12345678Z');
  form.getTextField(nombreCampoPdf('cliente.iban')).setText('ES9121000418450200051332');
  form.getTextField('firma__nombre').setText('ANA GIL');
  form.getCheckBox('conformidad').check();
  const r = await datosDePdf(PDFLib, await doc.save());
  assert.equal(r.origen, 'pdf');
  assert.deepEqual(r.firma, { nombre: 'ANA GIL', fecha: '', dibujada: false, conforme: true });
  assert.equal(r.d['cliente.nif'], '12345678Z');
  assert.equal(r.d['cliente.nombre'], 'ANA GIL');
  const c = cambiosFicha(aviso, r.d);
  assert.deepEqual(c.map((x) => x.ruta), ['cliente.nif', 'cliente.iban']);
});

