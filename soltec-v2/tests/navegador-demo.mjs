// Prueba en Chromium: modo demostración con temas (?demo=1&tema=N) y la página para comparar aspectos.
// La demo usa su propia base de datos: no toca los datos reales ni sincroniza.
// Uso: node tests/navegador-demo.mjs
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const base = `http://localhost:${pWeb}`;

  // La app real con un aviso
  await page.goto(base + '/index.html#/inicio');
  await page.waitForSelector('#buscador-unico');
  await page.evaluate(async () => window.soltec.storage.save('aviso', (await import('./core/model.js')).nuevoAviso({ numero: '2026-0001', cliente: { nombre: 'REAL' } })));

  // Demo con el tema 1
  await page.goto(base + '/index.html?demo=1&tema=1#/inicio');
  await page.waitForSelector('#barra-demo');
  assert.equal(await page.getAttribute('html', 'data-tema'), '1');
  assert.equal(await page.getAttribute('html', 'data-demo'), '1');
  assert.ok(await page.locator('link#css-tema[href$="tema-1.css"]').count());
  assert.match(await page.textContent('.estado'), /Demo · sin sincronizar/);
  const nav = await page.evaluate(() => getComputedStyle(document.querySelector('nav.inferior')).backgroundColor);
  assert.equal(nav, 'rgb(31, 43, 92)', 'el tema cambia el aspecto (barra azul marino)');
  const demo = await page.evaluate(async () => (await window.soltec.storage.list('aviso')).map((r) => r.data.cliente.nombre));
  assert.equal(demo.length, 6); assert.ok(!demo.includes('REAL'), 'los datos reales no aparecen en la demo');
  assert.equal(await page.locator('#alerta-sync').count(), 0, 'en la demo no sale «sin sincronizar»');
  ok('Demo con tema 1: aspecto aplicado, datos de ejemplo y sin sincronizar');

  // Cambiar de tema desde la barra y navegar
  await page.click('#barra-demo a:has-text("3")');
  await page.waitForFunction(() => document.documentElement.dataset.tema === '3');
  await page.click('nav.inferior a[data-ruta="avisos"]');
  await page.waitForSelector('.tarjeta');
  assert.equal(await page.locator('.tarjeta').count() >= 4, true);
  await page.goto(base + '/index.html?demo=1&tema=4#/aviso/demo_av1');
  await page.waitForSelector('#f-cliente-nombre', { state: 'attached' });
  ok('Se cambia de tema con un toque y se navega por la app de ejemplo (avisos, ficha)');

  // La app real sigue igual
  await page.goto(base + '/index.html#/avisos');
  await page.waitForSelector('.tarjeta');
  const real = await page.evaluate(async () => (await window.soltec.storage.list('aviso')).map((r) => r.data.cliente.nombre));
  assert.deepEqual(real, ['REAL']);
  assert.equal(await page.getAttribute('html', 'data-tema'), '0');
  assert.equal(await page.locator('#barra-demo').count(), 0);
  ok('La app real no cambia: sus datos, su aspecto y sin barra de demo');

  // Página para comparar
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(base + '/temas.html');
  await page.waitForSelector('.tema iframe');
  assert.equal(await page.locator('.tema').count(), 5);
  const f = page.frameLocator('.tema[data-n="2"] iframe');
  await f.locator('#barra-demo').waitFor();
  await page.click('.pantallas button:has-text("Avisos")');
  await f.locator('.tarjeta').first().waitFor();
  ok('«Comparar aspectos»: los 5 lado a lado y la misma pantalla en todos');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
