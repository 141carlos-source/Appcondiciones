// Prueba en Chromium: con un correo o el formulario abiertos en «Solicitudes y comunicaciones», al cambiar un dato
// del cliente (p. ej. el correo) y guardar, lo abierto se rehace con el dato nuevo.
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
  const id = await page.evaluate(async () => {
    await window.soltec.storage.save('config', { empresa: { nombre: 'M. A. SOLTEC SL', email: 'info@soltec.es', telefono: '607335058' } }, { id: 'empresa' });
    return (await window.soltec.storage.save('aviso', { numero: '2026-0090', cliente: { nombre: 'ANA GIL', telefono: '600123456', email: 'viejo@correo.es' }, suministro: { direccion: 'CALLE MAYOR', numero: '1', cp: '50001', poblacion: 'ZARAGOZA', provincia: 'ZARAGOZA' }, electrico: {}, docs: {} })).id;
  });
  await page.goto(base + 'index.html#/aviso/' + id);
  await page.click('summary:has-text("Solicitudes y comunicaciones")');
  await page.click('#btn-enlace-cliente');
  await page.waitForSelector('#para-cliente');
  assert.equal(await page.inputValue('#para-cliente'), 'viejo@correo.es');

  // Se cambia el correo del cliente y se guarda
  await page.click('summary:has-text("Cliente y suministro")');
  await page.fill('#f-cliente-email', 'nuevo@correo.es');
  await page.click('#guardar');
  await page.waitForFunction(() => document.querySelector('#para-cliente')?.value === 'nuevo@correo.es', null, { timeout: 10000 });
  ok('Formulario abierto: al guardar, el «Para» pasa al correo nuevo del cliente');

  // Igual con un correo de solicitud abierto (el texto lleva los datos del cliente)
  await page.click('#btn-correo-contrato');
  await page.waitForSelector('#vista-correo');
  await page.fill('#f-cliente-nombre', 'ANA GIL PEREZ');
  await page.click('#guardar');
  await page.waitForFunction(() => document.querySelector('#correo-cuerpo')?.value.includes('ANA GIL PEREZ'), null, { timeout: 10000 });
  ok('Correo de solicitud abierto: al guardar, el texto se rehace con los datos nuevos');

  // Otro trabajo para el mismo cliente: copia solo los datos del cliente, no la dirección
  await page.evaluate(() => { window.soltec.guardia = () => false; });
  await page.goto(base + 'index.html#/aviso/duplicar?de=' + id);
  await page.waitForSelector('h1:has-text("Nuevo aviso (mismo cliente)")');
  assert.equal(await page.inputValue('#f-cliente-nombre'), 'ANA GIL PEREZ');
  assert.ok((await page.inputValue('#f-cliente-telefono')).includes('600'));
  assert.equal(await page.inputValue('#f-cliente-email'), 'nuevo@correo.es');
  for (const c of ['direccion', 'numero', 'cp', 'poblacion', 'provincia']) assert.equal(await page.inputValue('#f-suministro-' + c), '', 'sin ' + c);
  ok('«Nuevo aviso para este cliente»: copia empresa, CIF, teléfono y correo; no la dirección ni el código postal');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
