// Prueba de la instalación del PC: el servidor sirve la app en /app/ y la app sincroniza
// con ese mismo servidor (como al abrirla con el icono del escritorio).
// Uso: node tests/navegador-instalado.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, cpSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const esperar = async (url) => { for (let i = 0; i < 60; i++) { try { await fetch(url); return; } catch { await new Promise((r) => setTimeout(r, 100)); } } throw new Error('No arranca ' + url); };
const ok = (t) => console.log('✓ ' + t);

// Misma estructura que %LOCALAPPDATA%\SOLTEC_V2: app\ y servidor\
const inst = mkdtempSync(join(tmpdir(), 'soltecv2-inst-'));
const datos = mkdtempSync(join(tmpdir(), 'soltecv2-datos-'));
mkdirSync(join(inst, 'app'));
cpSync(raiz, join(inst, 'app'), { recursive: true, filter: (p) => !/node_modules|[\\/]tests|servidor-pc|instalador|\.git/.test(p.slice(raiz.length)) });
cpSync(join(raiz, 'servidor-pc'), join(inst, 'servidor'), { recursive: true });
const port = await libre();
const srv = spawn('python3', [join(inst, 'servidor/server.py')], { env: { ...process.env, SOLTEC_V2_DIR: datos, SOLTEC_V2_PORT: String(port) }, stdio: 'ignore' });
let browser;
try {
  await esperar(`http://127.0.0.1:${port}/`);
  const clave = JSON.parse(readFileSync(join(datos, 'soltec-v2-config.json'), 'utf8')).key;
  const r = await fetch(`http://127.0.0.1:${port}/app/core/db.js`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /javascript/);
  assert.notEqual((await fetch(`http://127.0.0.1:${port}/app/%2e%2e/servidor/server.py`)).status, 200);
  assert.notEqual((await fetch(`http://127.0.0.1:${port}/app/../servidor/server.py`)).status, 200);
  ok('El servidor sirve la app en /app/ (módulos JS con su tipo) y nada fuera de ella');

  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto(`http://localhost:${port}/app/#/ajustes`);
  await page.waitForSelector('#sync-url');
  assert.equal(await page.inputValue('#sync-url'), 'http://127.0.0.1:8766');
  await page.fill('#sync-url', `http://127.0.0.1:${port}`);
  await page.fill('#sync-clave', clave);
  await page.fill('#sync-nombre', 'PC CASA');
  await page.click('text=Guardar y sincronizar');
  await page.waitForSelector('.estado:has-text("Sincronizado")');
  await page.evaluate(() => window.soltec.storage.save('aviso', { numero: '2026-0201', cliente: { nombre: 'Desde el icono' }, suministro: {}, docs: {} }));
  for (let i = 0; i < 40; i++) {
    const st = await (await fetch(`http://127.0.0.1:${port}/api/v2/status`, { headers: { 'X-Soltec-Key': clave } })).json();
    if (st.records >= 1) break;
    if (i === 39) throw new Error('no llegó al servidor');
    await page.waitForTimeout(250);
  }
  ok('La app abierta desde el servidor sincroniza con él (aviso subido solo)');
  const sw = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  assert.match(sw, /\/app\/$/);
  ok('Funciona sin internet: service worker activo en /app/');
  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  srv.kill();
}
