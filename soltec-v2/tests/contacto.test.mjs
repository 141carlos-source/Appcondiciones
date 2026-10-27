// Llamar, WhatsApp y correo desde la ficha (ui.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hrefTelefono, hrefWhatsApp, hrefCorreo } from '../ui.js';

test('enlace para llamar: españoles con +34, extranjeros con su prefijo', () => {
  assert.equal(hrefTelefono('+34 600 123 123'), 'tel:+34600123123');
  assert.equal(hrefTelefono('600123123'), 'tel:+34600123123');
  assert.equal(hrefTelefono('976 11 12 22'), 'tel:+34976111222');
  assert.equal(hrefTelefono('0034 976111222'), 'tel:+34976111222');
  assert.equal(hrefTelefono('+33 6 12 34 56 78'), 'tel:+33612345678');
  assert.equal(hrefTelefono('0049301234567'), 'tel:+49301234567');
  assert.equal(hrefTelefono('123'), null);
  assert.equal(hrefTelefono(''), null);
});

test('WhatsApp solo para móviles españoles', () => {
  assert.equal(hrefWhatsApp('+34 600 123 123'), 'https://wa.me/34600123123');
  assert.equal(hrefWhatsApp('711222333'), 'https://wa.me/34711222333');
  assert.equal(hrefWhatsApp('976111222'), null, 'un fijo no tiene WhatsApp');
  assert.equal(hrefWhatsApp('+33612345678'), null);
});

test('enlace de correo con asunto', () => {
  assert.equal(hrefCorreo(' ana@correo.es '), 'mailto:ana@correo.es');
  assert.equal(hrefCorreo('ana@correo.es', 'Aviso 2026-0001 CALLE MAYOR 1'), 'mailto:ana@correo.es?subject=Aviso%202026-0001%20CALLE%20MAYOR%201');
  assert.equal(hrefCorreo('ana@correo'), null);
  assert.equal(hrefCorreo('ana correo.es'), null);
});
