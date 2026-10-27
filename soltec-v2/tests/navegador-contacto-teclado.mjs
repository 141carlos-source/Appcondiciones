// Prueba en Chromium móvil: el campo no cambia después de recibir el foco (teclado estable en Android),
// el diagnóstico anota si un campo pierde el foco solo, y los botones Llamar / WhatsApp / Enviar correo.
// Uso: node tests/navegador-contacto-teclado.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const pWeb = await libre();
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
const ok = (t) => console.log('✓ ' + t);
let browser;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${pWeb}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true })).newPage();
  page.setDefaultTimeout(15000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const base = `http://localhost:${pWeb}/index.html`;

  await page.goto(base + '#/aviso/nuevo');
  await page.waitForSelector('#f-cliente-nombre');
  // Los campos ya vienen preparados: tocar y escribir no cambia nada del campo con el teclado abierto
  assert.equal(await page.getAttribute('#f-cliente-nombre', 'autocapitalize'), 'characters', 'preparado al pintarse');
  await page.evaluate(() => {
    window.__cambios = [];
    const el = document.getElementById('f-suministro-poblacion');
    el.addEventListener('focus', () => {
      new MutationObserver((ms) => ms.forEach((m) => window.__cambios.push(m.attributeName))).observe(el, { attributes: true });
    });
  });
  await page.tap('#f-suministro-poblacion');
  await page.keyboard.type('zaragoza', { delay: 60 });
  assert.deepEqual(await page.evaluate(() => window.__cambios), [], 'ningún cambio en el campo tras recibir el foco');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'f-suministro-poblacion');
  assert.equal(await page.inputValue('#f-suministro-poblacion'), 'zaragoza', 'mientras se escribe no se toca el valor');
  ok('Tocar y escribir no cambia el campo con el teclado abierto (mayúsculas preparadas antes)');

  // Diagnóstico: si el campo pierde el foco sin tocar nada mientras se escribe, se anota
  await page.tap('#f-cliente-contacto');
  await page.keyboard.type('pepe', { delay: 60 });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.getElementById('f-cliente-contacto').blur());
  await page.waitForTimeout(1200);
  const err = await page.evaluate(async () => { const { leerErrores } = await import('./core/errores.js'); return leerErrores(window.soltec.storage); });
  const t = err.find((e) => /Teclado/.test(e.mensaje));
  assert.ok(t, 'se anota en el registro de errores: ' + JSON.stringify(err));
  assert.match(t.mensaje, /«f-cliente-contacto» perdió el foco solo/);
  assert.match(t.pila, /alto visible/);
  ok('Si un campo pierde el foco solo mientras se escribe, queda anotado (Ajustes › Registro de errores)');

  // Llamar / WhatsApp / correo
  assert.equal(await page.locator('[data-campo="cliente.telefono"] .acciones-contacto a').count(), 0, 'sin teléfono, sin botón');
  await page.fill('#f-cliente-telefono', '600123123');
  assert.equal(await page.getAttribute('[data-campo="cliente.telefono"] [data-accion="llamar"]', 'href'), 'tel:+34600123123');
  assert.equal(await page.getAttribute('[data-campo="cliente.telefono"] [data-accion="whatsapp"]', 'href'), 'https://wa.me/34600123123');
  await page.fill('#f-cliente-telefono', '976111222');
  assert.equal(await page.locator('[data-campo="cliente.telefono"] [data-accion="whatsapp"]').count(), 0, 'un fijo: solo llamar');
  await page.fill('#f-cliente-email', 'ana@correo.es');
  await page.fill('#f-suministro-direccion', 'CALLE MAYOR');
  await page.evaluate(() => { const a = document.querySelector('[data-campo="cliente.email"] [data-accion="correo"]'); a.addEventListener('click', (e) => e.preventDefault()); a.click(); });
  assert.match(await page.getAttribute('[data-campo="cliente.email"] [data-accion="correo"]', 'href'), /^mailto:ana@correo\.es\?subject=Aviso%20CALLE%20MAYOR/);
  ok('Con teléfono: «Llamar» (y «WhatsApp» si es móvil); con correo: «Enviar correo» con el aviso en el asunto');

  // Al rellenar desde un cliente ya trabajado también salen
  await page.evaluate(async () => {
    window.soltec.guardia = null;
    await window.soltec.storage.save('aviso', (await import('./core/model.js')).nuevoAviso({ numero: '2025-0009', cliente: { nombre: 'TALLERES EBRO', nif: 'B12345674', telefono: '+34 611 222 333', email: 'admin@ebro.es', contacto: '', iban: '' } }));
  });
  await page.goto(base + '#/avisos'); await page.goto(base + '#/aviso/nuevo');
  await page.waitForSelector('#f-cliente-nombre');
  await page.tap('#f-cliente-nombre');
  await page.keyboard.type('tall');
  await page.tap('[data-campo="cliente.nombre"] .sugerencia');
  assert.equal(await page.getAttribute('[data-campo="cliente.telefono"] [data-accion="llamar"]', 'href'), 'tel:+34611222333');
  assert.match(await page.getAttribute('[data-campo="cliente.email"] [data-accion="correo"]', 'href'), /^mailto:admin@ebro\.es/);
  ok('Al rellenar un cliente ya trabajado aparecen sus botones de llamar y correo');
  await page.evaluate(() => { window.soltec.guardia = null; });

  // En el parte de trabajo también
  await page.goto(base + '#/parte/nuevo');
  await page.waitForSelector('#p-telefono');
  await page.fill('#p-telefono', '+34 600 999 888');
  assert.equal(await page.getAttribute('#p-telefono ~ .acciones-contacto [data-accion="llamar"]', 'href'), 'tel:+34600999888');
  ok('En el parte de trabajo también: «Llamar» y «WhatsApp»');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
