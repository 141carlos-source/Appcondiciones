// Prueba en Chromium: sin contrato, el IBAN vacío no se marca como falta.
// Uso: node tests/navegador-iban.mjs
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
await new Promise((r) => setTimeout(r, 1000));
let browser;
try {
  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 1200 } })).newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(`http://localhost:${pWeb}/index.html#/aviso/nuevo`);
  await page.waitForSelector('#f-cliente-nombre');
  const iban = () => page.locator('.campo[data-campo="cliente.iban"]');
  assert.match(await iban().getAttribute('class'), /\bpend\b/);
  assert.ok(await page.locator('.enlaces-pend button', { hasText: 'IBAN' }).count());
  await page.click('#sin-contrato');
  assert.doesNotMatch(await iban().getAttribute('class'), /\bpend\b/);
  assert.equal(await page.locator('.enlaces-pend button', { hasText: 'IBAN' }).count(), 0);
  assert.equal(await page.inputValue('#doc-contrato'), 'na');
  ok('«No lleva contrato» quita el IBAN de las faltas y marca Contrato: No aplica');
  await page.click('summary:has-text("Documentación")');
  await page.selectOption('#doc-contrato', 'pendiente');
  assert.match(await iban().getAttribute('class'), /\bpend\b/);
  ok('Si vuelve a haber contrato, el IBAN vuelve a pedirse');
  await page.selectOption('#doc-contrato', 'na');
  await page.fill('#f-cliente-nombre', 'Sin contrato');
  await page.click('#guardar');
  await page.waitForFunction(() => /^Aviso \d/.test(document.querySelector('h1')?.textContent || ''));
  await page.click('nav.inferior a[data-ruta=inicio]');
  await page.waitForSelector('.hoy');
  assert.doesNotMatch(await page.textContent('main'), /Faltan:[^\n]*IBAN/);
  ok('En «Qué toca hoy» tampoco aparece el IBAN como falta');
  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
