import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { potenciaDeIga, potenciasNormalizadas, problemaPotencia, numeroKw } from '../core/potencias.js';
import { paqueteFicha, enlaceFormulario, leerEnlace, empresaDePaquete, infoProteccionDatos, cambiosFicha, aplicarCambios, datosDePdf } from '../core/fichaCliente.js';
import { generarFicha } from '../core/documentos.js';
import { normalizarAviso } from '../core/model.js';
import { normalizarEmpresa } from '../core/empresa.js';

globalThis.self ??= globalThis;
const _r = createRequire(import.meta.url)('../vendor/pdf-lib.min.js');
const PDFLib = _r?.PDFDocument ? _r : globalThis.PDFLib;

test('potencia máxima según IGA y tensión', () => {
  assert.equal(potenciaDeIga(40, '230'), '9,2');
  assert.equal(potenciaDeIga(63, '400'), '43,65');
  assert.equal(potenciaDeIga('', '230'), '');
  assert.equal(numeroKw('5,75'), 5.75);
  assert.ok(Number.isNaN(numeroKw('mucho')));
});

test('potencias normalizadas para contratar: hasta la máxima del IGA', () => {
  assert.deepEqual(potenciasNormalizadas('230', '9,2').map((p) => p.kw), ['1,15', '2,3', '3,45', '4,6', '5,75', '6,9', '8,05', '9,2']);
  const tri = potenciasNormalizadas('400', '43,65').map((p) => p.kw);
  assert.deepEqual(tri.slice(0, 4), ['3,464', '5,196', '6,928', '10,392']);
  assert.equal(tri.at(-1), '43,648');
  assert.equal(potenciasNormalizadas('400').length, 12, 'sin IGA, todas');
  assert.deepEqual(potenciasNormalizadas(''), []);
});

test('la potencia a contratar puede ser distinta, pero no más que la del IGA', () => {
  assert.equal(problemaPotencia('', '9,2'), null);
  assert.equal(problemaPotencia('7', '9,2'), null, 'un valor no normalizado se admite');
  assert.match(problemaPotencia('10,35', '9,2'), /IGA/);
  assert.match(problemaPotencia('abc'), /números/);
});

const empresa = normalizarEmpresa({ empresa: { nombre: 'M. A. SOLTEC SL', nombreComercial: 'SOLTEC', nif: 'B50000000', telefono: '976000000', email: 'info@soltec.es', web: 'soltec.es', direccion: 'CALLE EJEMPLO 1', cp: '50171', localidad: 'LA PUEBLA DE ALFINDÉN', provincia: 'ZARAGOZA' } });
const aviso = normalizarAviso({ numero: '2026-0141', cliente: { nombre: 'ANA GIL' }, electrico: { tension: '400', iga: '63', uso: 'nave', potenciaKw: '40' } });

test('el enlace lleva la empresa (con logo pequeño) y los datos eléctricos', () => {
  const logo = 'data:image/png;base64,iVBORw0KGgo=';
  const p = leerEnlace(new URL(enlaceFormulario(paqueteFicha(aviso, empresa, { logo }))).hash);
  assert.deepEqual(p.el, { t: '400', u: 'nave', i: '63', pc: '43,65' });
  assert.equal(p.e.n, 'SOLTEC');
  assert.equal(p.e.rs, 'M. A. SOLTEC SL');
  assert.equal(p.e.f, 'B50000000');
  assert.equal(p.e.d, 'CALLE EJEMPLO 1, 50171 LA PUEBLA DE ALFINDÉN, ZARAGOZA');
  assert.equal(p.e.l, logo);
  assert.equal(paqueteFicha(aviso, empresa, { logo: 'javascript:alert(1)' }).e.l, undefined, 'solo imágenes PNG/JPG');
  const e = empresaDePaquete(p).empresa;
  assert.equal(e.nombre, 'M. A. SOLTEC SL');
  assert.equal(e.nif, 'B50000000');
});

test('información de protección de datos con el responsable, destinatarios, derechos y la AEPD', () => {
  const info = Object.fromEntries(infoProteccionDatos(empresa));
  assert.deepEqual(Object.keys(info), ['Responsable', 'Finalidad', 'Legitimación', 'Destinatarios', 'Conservación', 'Derechos']);
  assert.match(info.Responsable, /M\. A\. SOLTEC SL · NIF B50000000 · CALLE EJEMPLO 1/);
  assert.match(info.Destinatarios, /distribuidora/);
  assert.match(info.Derechos, /info@soltec\.es/);
  assert.match(info.Derechos, /www\.aepd\.es/);
});

test('la potencia a contratar vuelve a la app (formulario y PDF rellenable)', async () => {
  const c = cambiosFicha(aviso, { 'electrico.potenciaContratar': '34,641' });
  assert.deepEqual(c.map((x) => [x.ruta, x.ahora, x.problema]), [['electrico.potenciaContratar', '34,641', null]]);
  const nuevo = aplicarCambios(aviso, c);
  assert.equal(nuevo.electrico.potenciaContratar, '34,641');
  assert.equal(nuevo.electrico.iga, '63', 'no se pierde lo demás');

  const bytes = await generarFicha(PDFLib, { aviso: { ...aviso, electrico: { ...aviso.electrico, potenciaContratar: '20,785' } }, empresa });
  const doc = await PDFLib.PDFDocument.load(bytes);
  const f = doc.getForm();
  assert.equal(f.getTextField('electrico__potenciaContratar').getText(), '20,785');
  assert.ok(f.getFields().some((x) => x.isReadOnly() && x.getText?.() === '43,65'), 'potencia máxima según IGA, fija');
  assert.ok(f.getFields().some((x) => x.getText?.() === 'Nave'));
  const r = await datosDePdf(PDFLib, bytes);
  assert.equal(r.d['electrico.potenciaContratar'], '20,785');
});
