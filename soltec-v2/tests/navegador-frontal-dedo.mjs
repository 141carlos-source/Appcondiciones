// Prueba en Chromium con pantalla táctil: mover aparatos del frontal de CuadroLab con el dedo, varias veces seguidas.
// (En la tablet solo dejaba mover un aparato una vez: el arrastre nativo de Android se quedaba colgado al redibujar.)
// Uso: node tests/navegador-frontal-dedo.mjs
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
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${pWeb}/index.html`); break; } catch { await espera(100); } }
  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 712, height: 1138 }, hasTouch: true, isMobile: true })).newPage();
  page.setDefaultTimeout(10000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.goto(`http://localhost:${pWeb}/assets/cuadrolab.html`);
  await page.waitForSelector('[data-pal="PIA:0"]');
  const cdp = await page.context().newCDPSession(page);
  const toque = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });

  // Arrastra con el dedo desde el centro del aparato id hasta el centro de la columna c de la fila r
  async function arrastrar(id, r, c, { pausa = 450 } = {}) {
    // Las dos filas a la vista, por encima del panel fijo de abajo (en la tablet ocupa la parte baja de la pantalla)
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const de = await page.locator(`.dv[data-id="${id}"]`).boundingBox();
    const fila = await page.locator(`.row[data-r="${r}"]`).boundingBox();
    const m = await page.evaluate((id) => S.dv.find((d) => d.id == id).m, id);
    const x0 = de.x + de.width / 2, y0 = de.y + de.height / 2;
    const x1 = fila.x + (c + m / 2) * (fila.width / await page.evaluate(() => S.w)), y1 = fila.y + fila.height / 2;
    await toque('touchStart', x0, y0);
    await espera(pausa);
    for (let k = 1; k <= 8; k++) await toque('touchMove', x0 + (x1 - x0) * k / 8, y0 + (y1 - y0) * k / 8);
    await toque('touchEnd');
    await espera(100);
  }
  const pos = (id) => page.evaluate((id) => { const d = S.dv.find((d) => d.id == id); return [d.row, d.col]; }, id);

  await page.evaluate(() => {
    window.alert = () => {}; S.dv = []; S.n = 0; S.w = 12; S.r = 2;
    for (const [t, m, r, c] of [['ID', 2, 0, 0], ['PIA', 1, 0, 2], ['PIA', 1, 0, 3]]) S.dv.push(CuadroFrontal.nuevoAparato(S, t, m, r, c));
    rd();
  });
  const pia = await page.evaluate(() => S.dv[1].id);

  await arrastrar(pia, 0, 6);
  assert.deepEqual(await pos(pia), [0, 6]);
  ok('Primer arrastre con el dedo: el magnetotérmico pasa a la columna 7');
  await arrastrar(pia, 1, 4);
  assert.deepEqual(await pos(pia), [1, 4]);
  ok('Segundo arrastre del mismo aparato: baja a la segunda fila');
  await arrastrar(pia, 0, 9);
  assert.deepEqual(await pos(pia), [0, 9]);
  const otro = await page.evaluate(() => S.dv[2].id);
  await arrastrar(otro, 1, 0);
  assert.deepEqual(await pos(otro), [1, 0]);
  ok('Tercer arrastre y otro aparato después: todos se mueven');

  await arrastrar(pia, 0, 0);
  assert.deepEqual(await pos(pia), [0, 9]);
  ok('Encima del diferencial no lo suelta (no hay hueco)');

  await arrastrar(pia, 1, 8, { pausa: 0 });
  assert.deepEqual(await pos(pia), [0, 9]);
  ok('Deslizar sin mantener pulsado no mueve nada (es desplazar la pantalla)');

  assert.equal(await page.locator('body > .dv').count(), 0);
  assert.deepEqual(errores, []);
  ok('Sin restos del arrastre ni errores en la consola');
} catch (e) {
  console.error('✗ ' + (e.stack || e.message));
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
