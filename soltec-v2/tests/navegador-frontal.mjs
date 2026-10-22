// Prueba en Chromium: frontal de CuadroLab (assets/cuadro-frontal.js) — colocar, mover, duplicar y dimensionar.
// Uso: node tests/navegador-frontal.mjs
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
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
  page.setDefaultTimeout(10000);
  const errores = [], dialogos = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('dialog', (d) => { dialogos.push(d.message()); d.accept(); });
  await page.goto(`http://localhost:${pWeb}/assets/cuadrolab.html`);
  await page.waitForSelector('[data-pal="PIA:0"]');
  assert.equal(await page.evaluate(() => typeof CuadroFrontal.nuevoAparato), 'function');
  ok('CuadroLab carga el módulo del frontal');

  await page.evaluate(() => { window.__avisos = []; window.alert = (m) => __avisos.push(m); S.dv = []; S.n = 0; S.w = 6; S.r = 1; rd(); });
  await page.selectOption('[data-pal="ID:0"]', '25|30');
  await page.selectOption('[data-pal="PIA:0"]', '20');
  const dv = await page.evaluate(() => S.dv.map((d) => [d.t, d.col, d.in, d.nom, d.se]));
  assert.deepEqual(dv, [['ID', 0, 25, 'DIFERENCIAL 1', undefined], ['PIA', 2, 20, '', 4]]);
  ok('Desde la paleta: diferencial «DIFERENCIAL 1» y magnetotérmico de 20 A con 4 mm², uno detrás de otro');

  await page.evaluate(() => { sel = S.dv[1].id; mv(1, 0); });
  assert.equal(await page.evaluate(() => S.dv[1].col), 3);
  await page.evaluate(() => mv(-2, 0));
  assert.equal(await page.evaluate(() => S.dv[1].col), 3, 'no se monta encima del diferencial');
  ok('Mover: se corre si hay sitio y no se monta encima de otro');

  await page.evaluate(() => { dup(); dup(); });
  assert.deepEqual(await page.evaluate(() => S.dv.map((d) => d.col)), [0, 3, 4, 5]);
  await page.evaluate(() => dup());
  assert.equal(await page.evaluate(() => S.dv.at(-1).col), 2, 'da la vuelta y usa el hueco libre');
  await page.evaluate(() => dup());
  assert.equal(await page.evaluate(() => __avisos.at(-1)), 'NO HAY ESPACIO LIBRE');
  ok('Duplicar pone la copia en el siguiente hueco (dando la vuelta) y avisa cuando no queda');

  await page.evaluate(() => dim('w', 4));
  assert.equal(await page.evaluate(() => __avisos.at(-1)), 'HAY APARATOS FUERA DEL NUEVO TAMAÑO');
  assert.equal(await page.evaluate(() => S.w), 6);
  await page.evaluate(() => dim('r', 2));
  assert.equal(await page.evaluate(() => S.r), 2);
  ok('Envolvente: no deja encoger si se quedan aparatos fuera; ampliar sí');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
