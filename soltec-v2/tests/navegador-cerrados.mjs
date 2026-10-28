// Prueba en Chromium: cerrar avisos y expedientes (pestaña «Cerrados»), buscar en todos y reabrir.
// Uso: node tests/navegador-cerrados.mjs
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
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 1200 } })).newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const base = `http://localhost:${pWeb}/`;
  await page.goto(base + 'index.html#/inicio');
  await page.waitForFunction(() => window.soltec?.storage);
  const ids = await page.evaluate(async () => {
    const s = window.soltec.storage;
    const av = (numero, nombre, extra = {}) => s.save('aviso', { numero, cliente: { nombre }, suministro: { direccion: 'CALLE MAYOR', numero: numero.slice(-2), cp: '50001', poblacion: 'ZARAGOZA' }, electrico: {}, docs: {}, ...extra }).then((r) => r.id);
    return { a: await av('2026-0001', 'ANA GIL'), b: await av('2026-0002', 'LUIS PEREZ'), e: await av('2026-0003', 'TALLERES EBRO SL', { condiciones: { ref: 'SOL-1', pdfs: [] } }) };
  });
  const numeros = () => page.$$eval('#lista-avisos .tarjeta', (x) => x.map((e) => e.querySelector('.mono').textContent));
  const aceptar = () => page.click('.sd-fondo #dk');

  await page.goto(base + 'index.html#/aviso/' + ids.a);
  await page.click('#btn-cerrar-aviso');
  await aceptar();
  await page.waitForFunction(() => location.hash.startsWith('#/avisos'));
  await page.waitForSelector('#lista-avisos');
  assert.deepEqual(await numeros(), ['2026-0002']);
  assert.match(await page.textContent('#chips-ver'), /Cerrados \(1\)/);
  ok('«Cerrar aviso» lo quita de Activos');

  await page.click('#chips-ver [data-ver="cerrados"]');
  await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Avisos cerrados');
  assert.deepEqual(await numeros(), ['2026-0001']);
  ok('Pestañas Activos · Cerrados · Papelera: el cerrado está en «Cerrados»');

  await page.click('#chips-ver [data-ver="activos"]');
  await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Avisos');
  await page.fill('#buscar-avisos', 'ana gil');
  assert.deepEqual(await numeros(), ['2026-0001']);
  assert.match(await page.textContent('#lista-avisos'), /Cerrado/);
  await page.fill('#buscar-avisos', 'talleres');
  assert.deepEqual(await numeros(), ['2026-0003'], 'también encuentra expedientes');
  assert.match(await page.textContent('#lista-avisos'), /Expediente/);
  ok('El buscador busca en todos: abiertos, cerrados y expedientes');

  await page.fill('#buscar-avisos', 'ana gil');
  await page.click('#lista-avisos .tarjeta');
  await page.waitForSelector('#aviso-cerrado');
  await page.click('#btn-reabrir');
  await page.waitForSelector('#btn-cerrar-aviso');
  assert.ok(!(await page.$('#aviso-cerrado')));
  const d = await page.evaluate(async (id) => (await window.soltec.storage.get(id)).data, ids.a);
  assert.equal(d.estado, 'Abierto');
  const evs = await page.evaluate(async (id) => (await window.soltec.storage.listByRef(id, 'evento')).map((e) => e.data.kind), ids.a);
  assert.ok(evs.includes('aviso_cerrado') && evs.includes('aviso_reabierto'), evs.join());
  ok('Un aviso cerrado se abre, se ve que está cerrado y se puede reabrir (queda en el historial)');

  // Expedientes: igual
  await page.goto(base + 'index.html#/aviso/' + ids.e);
  await page.click('#btn-cerrar-aviso');
  await aceptar();
  await page.waitForFunction(() => location.hash.startsWith('#/expedientes'));
  await page.waitForSelector('#lista-avisos');
  assert.match(await page.textContent('#lista-avisos'), /No hay expedientes abiertos/);
  await page.click('#chips-ver [data-ver="cerrados"]');
  await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Expedientes cerrados');
  assert.deepEqual(await numeros(), ['2026-0003']);
  ok('Expedientes: también se cierran y pasan a «Cerrados»');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
