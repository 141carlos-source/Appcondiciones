// Prueba en Chromium táctil (tablet): al escribir no se toca el campo (no se cierra el teclado);
// se ve en mayúsculas y se guarda en mayúsculas al salir. Equipo de medida del certificado.
// Uso: node tests/navegador-teclado.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const ok = (t) => console.log('✓ ' + t);
const pWeb = await libre();
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${pWeb}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 800, height: 1100 }, isMobile: true, hasTouch: true })).newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(`http://localhost:${pWeb}/index.html`);
  await page.waitForFunction(() => window.soltec?.storage);
  const id = await page.evaluate(async () => (await window.soltec.storage.save('aviso', { numero: '2026-0001', cliente: { nombre: 'X' } })).id);
  await page.goto(`http://localhost:${pWeb}/index.html#/aviso/${id}`);
  await page.click('summary:has-text("Certificados")');
  await page.selectOption('#cert-tipo', 'tierra');
  await page.tap('#ct-nuevo-medidor');
  // Se vigila que nadie cambie el valor ni sustituya el campo mientras se escribe
  await page.evaluate(() => {
    const el = document.getElementById('md-marca'); window.__el = el; window.__tocado = 0;
    const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(el, 'value', { get() { return d.get.call(this); }, set(v) { if (document.activeElement === this) window.__tocado++; d.set.call(this, v); } });
  });
  await page.tap('#md-marca');
  await page.keyboard.type('fluke');
  assert.equal(await page.evaluate(() => window.__tocado), 0, 'no se toca el campo mientras se escribe');
  assert.equal(await page.evaluate(() => document.activeElement === window.__el), true, 'sigue con el foco');
  assert.equal(await page.$eval('#md-marca', (e) => getComputedStyle(e).textTransform), 'uppercase');
  await page.tap('#md-modelo');
  assert.equal(await page.inputValue('#md-marca'), 'FLUKE');
  await page.keyboard.type('1625-2');
  await page.tap('#md-serie');
  await page.keyboard.type('a123');
  await page.tap('#md-guardar');
  await page.waitForSelector('#ct-medidor');
  const med = await page.evaluate(async () => (await window.soltec.storage.get('empresa')).data.medidores[0]);
  assert.equal(med.marca, 'FLUKE');
  assert.equal(med.serie, 'A123');
  ok('Tablet: en «Equipo de medida» se escribe sin que se toque el campo (no se cierra el teclado) y se guarda en mayúsculas');
  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
