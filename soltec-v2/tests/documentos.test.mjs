import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { generarFicha, nombreFicha, resumenWhatsApp, enlaceWhatsApp, telefonoWhatsApp, correo, enlaceCorreo, textoPdf } from '../core/documentos.js';
import { desdeV1, faltaParaFormulario, normalizarEmpresa } from '../core/empresa.js';
import { nuevoAviso } from '../core/model.js';

globalThis.self ??= globalThis; // pdf-lib (versión navegador) espera «self»
const _req = createRequire(import.meta.url)('../vendor/pdf-lib.min.js');
const PDFLib = _req?.PDFDocument ? _req : globalThis.PDFLib;
const edist = { bytes: readFileSync(new URL('../assets/logo_e-distribucion.jpg', import.meta.url)), mime: 'image/jpeg' };
const empresa = normalizarEmpresa({ empresa: { nombre: 'M. A. SOLTEC SL', nombreComercial: 'M. A. SOLTEC', nif: 'B99506651', telefono: '607 335 058', email: 'info@soltec.es' }, correos: { nuevosSuministros: 'nuevos@dist.es', comercializadora: 'altas@com.es' } });
const aviso = nuevoAviso({ numero: '2026-0007', cliente: { nombre: 'María Pérez Núñez', contacto: '', nif: '12345678Z', telefono: '600 123 456', email: 'm@x.es', iban: '' },
  suministro: { direccion: 'Calle Ramón y Cajal 12', piso: '3', puerta: 'B', cp: '44001', poblacion: 'Teruel', provincia: 'Teruel', refCatastral: '', lat: '', lon: '', cups: '' },
  electrico: { potenciaKw: '5,75', tension: '230', uso: 'vivienda' } });

test('ficha PDF rellenable con los datos del aviso', async () => {
  const bytes = await generarFicha(PDFLib, { aviso, empresa, edist });
  const doc = await PDFLib.PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1);
  const campos = doc.getForm().getFields().map((f) => [f.getName(), f.getText?.()]);
  assert.ok(campos.some(([, v]) => v === 'María Pérez Núñez'), 'acentos y ñ conservados');
  assert.ok(campos.some(([, v]) => v === '12345678Z'));
  assert.ok(campos.some(([, v]) => v === 'Calle Ramón y Cajal 12'));
  assert.ok(campos.length >= 16, 'campos rellenables');
  writeFileSync(new URL('./ficha-ejemplo.pdf', import.meta.url), bytes);
});

test('ficha firmada: incluye la firma y fija los datos', async () => {
  // PNG 1x1 transparente
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
  const bytes = await generarFicha(PDFLib, { aviso, empresa, edist, firma: { png, nombre: 'María Pérez', fecha: '10/10/2026' } });
  const doc = await PDFLib.PDFDocument.load(bytes);
  assert.equal(doc.getForm().getFields().length, 0, 'formulario aplanado');
  assert.equal(nombreFicha(aviso, true), 'FICHA_CLIENTE_CALLE_RAMON_Y_CAJAL_12_PISO_3_PUERTA_B_FIRMADA.pdf');
});

test('caracteres que el PDF no admite no rompen el documento', async () => {
  assert.equal(textoPdf('Obra 🔌 «Norte» – ok — €'), 'Obra  «Norte» – ok — €');
  const raro = { ...aviso, cliente: { ...aviso.cliente, nombre: 'Ĉliente ✓ 😀' } };
  await generarFicha(PDFLib, { aviso: raro, empresa });
});

test('resumen y enlace de WhatsApp', () => {
  const t = resumenWhatsApp({ aviso, empresa, seguimiento: { fecha: '2026-10-12', hora: '10:00' } });
  assert.match(t, /Hola María, le escribimos de M\. A\. SOLTEC/);
  assert.doesNotMatch(t, /• IBAN/);
  assert.match(t, /• CUPS/);
  assert.match(t, /Le enviamos la ficha en PDF/);
  assert.match(t, /Próximo contacto: 2026-10-12 a las 10:00/);
  assert.equal(telefonoWhatsApp('+34 600 123 456'), '34600123456');
  assert.equal(telefonoWhatsApp('978 123 456'), null, 'un fijo no tiene WhatsApp');
  assert.match(enlaceWhatsApp('600123456', 'hola y adiós'), /^https:\/\/wa\.me\/34600123456\?text=hola%20y%20adi%C3%B3s$/);
});

test('correos de solicitud', () => {
  const c = correo('condiciones', { aviso, empresa });
  assert.equal(c.para, 'nuevos@dist.es');
  assert.match(c.asunto, /Calle Ramón y Cajal 12, Piso 3, Puerta B/);
  assert.match(c.cuerpo, /Potencia solicitada: 5,75 kW/);
  assert.doesNotMatch(c.cuerpo, /Referencia catastral:/, 'no incluye líneas vacías');
  assert.equal(correo('contrato', { aviso, empresa }).para, 'altas@com.es');
  assert.equal(correo('datos', { aviso, empresa }).para, 'm@x.es');
  assert.match(enlaceCorreo(c), /^mailto:nuevos@dist\.es\?subject=/);
});

test('empresa: importar de la V1.35 (localStorage y archivo) y requisitos del formulario', () => {
  const main = JSON.stringify({ empresa: { nombre: 'M. A. SOLTEC SL', nif: 'B99506651', logoData: 'data:image/png;base64,iVBORw0KGgo=' }, tecnico: { nombre: 'Carlos' } });
  const cfg = JSON.stringify({ emails: { nuevosSuministros: 'n@d.es' }, firmaData: 'no-es-imagen' });
  const r = desdeV1({ main, cfg });
  assert.equal(r.datos.empresa.nombre, 'M. A. SOLTEC SL');
  assert.equal(r.datos.tecnico.nombre, 'Carlos');
  assert.equal(r.datos.correos.nuevosSuministros, 'n@d.es');
  assert.ok(r.imagenes.logo);
  assert.equal(r.imagenes.firma, undefined, 'solo imágenes válidas');
  const b = desdeV1({ base: { schema: 'SOLTEC_EMPRESA_BASE_V1', empresa: { nombre: 'X' }, identidadVisual: {} } });
  assert.equal(b.datos.empresa.nombre, 'X');
  assert.equal(desdeV1({ main: 'roto', cfg: '' }), null);
  assert.deepEqual(faltaParaFormulario(normalizarEmpresa({})), ['nombre de la empresa', 'logo']);
});
