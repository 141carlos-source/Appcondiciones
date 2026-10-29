// Prueba en Chromium: «Salir» y, al terminar, «Cerrar la aplicación» (si el navegador no deja cerrarla,
// pantalla de «SOLTEC cerrada» con cómo cerrarla).
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
  await page.goto(base + 'index.html#/avisos');
  await page.click('nav.inferior a[data-ruta=salir]');
  await page.waitForSelector('#cerrar-app');
  assert.match(await page.textContent('main'), /Todo listo: ya puedes cerrar la aplicación/);
  await page.click('#cerrar-app');
  await Promise.race([page.waitForEvent('close'), page.waitForSelector('#app-cerrada')]);
  if (!page.isClosed()) {
    assert.match(await page.textContent('#app-cerrada'), /SOLTEC cerrada[\s\S]*Todo está guardado/);
    assert.match(await page.textContent('#app-cerrada'), /X de la ventana/);
    ok('«Cerrar la aplicación»: si el navegador no deja, pantalla «SOLTEC cerrada» con cómo cerrarla');
  } else ok('«Cerrar la aplicación» cierra la ventana');

  // Ventana abierta por la propia app (como la app instalada con una sola página): se cierra
  const p2 = await page.context().newPage();
  await p2.goto(base + 'index.html#/salir');
  await p2.waitForSelector('#cerrar-app');
  await Promise.all([p2.waitForEvent('close', { timeout: 5000 }).catch(() => null), p2.click('#cerrar-app')]);
  ok(p2.isClosed() ? 'Con una sola página abierta, la app se cierra sola' : 'Sin permiso para cerrarse: queda la pantalla «SOLTEC cerrada»');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
