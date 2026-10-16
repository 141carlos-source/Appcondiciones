// Prueba en Chromium: icono de la app en la pantalla de inicio (tablet / móvil).
// Uso: node tests/navegador-instalar.mjs
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
  const errores = [];
  const tablet = async (ua) => {
    const ctx = await browser.newContext({ viewport: { width: 800, height: 1280 }, isMobile: true, hasTouch: true, ...(ua ? { userAgent: ua } : {}) });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errores.push(e.message));
    await page.goto(`http://localhost:${pWeb}/index.html#/inicio`);
    await page.waitForSelector('.hoy');
    return page;
  };

  // Android: el navegador ofrece instalar → botón que lo hace en un toque
  const and = await tablet();
  await and.waitForSelector('#bloque-instalar');
  assert.match(await and.textContent('#bloque-instalar'), /Instalar aplicación|Añadir a pantalla de inicio/);
  await and.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { window.__pedido = true; };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await and.waitForSelector('#instalar-app');
  await and.click('#instalar-app');
  assert.equal(await and.evaluate(() => window.__pedido), true);
  ok('Tablet Android: en Inicio sale «Añadir icono a la pantalla de inicio» y lanza la instalación');

  // «Ahora no» lo quita de Inicio y no vuelve; sigue en Ajustes › Acerca de
  await and.reload(); await and.waitForSelector('#bloque-instalar');
  await and.click('#bloque-instalar >> text=Ahora no');
  await and.reload(); await and.waitForSelector('.hoy');
  assert.equal(await and.$('#bloque-instalar'), null);
  await and.goto(`http://localhost:${pWeb}/index.html#/ajustes`);
  await and.waitForSelector('#bloque-instalar', { state: 'attached' });
  ok('«Ahora no» lo quita de Inicio; sigue disponible en Ajustes › Acerca de');

  // iPad: instrucciones de Safari
  const ipad = await tablet('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  await ipad.waitForSelector('#bloque-instalar');
  assert.match(await ipad.textContent('#bloque-instalar'), /Compartir.*Añadir a pantalla de inicio/);
  if (process.env.CAPTURA) await ipad.screenshot({ path: '/tmp/claude-0/cab/ipad.png' });
  ok('iPad: explica Compartir › «Añadir a pantalla de inicio»');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
