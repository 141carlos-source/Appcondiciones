// Prueba en Chromium con el servidor real: copia diaria del PC en una carpeta de nube (Google Drive / OneDrive).
// Uso: node tests/navegador-nube.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const esperar = async (url) => { for (let i = 0; i < 60; i++) { try { await fetch(url); return; } catch { await new Promise((r) => setTimeout(r, 100)); } } throw new Error('No arranca ' + url); };
const ok = (t) => console.log('✓ ' + t);
const pWeb = await libre(), pSync = await libre();
const dir = mkdtempSync(join(tmpdir(), 'soltecv2-nube-'));
const nube = join(dir, 'Google Drive'); mkdirSync(nube);
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
const srv = spawn('python3', [join(raiz, 'servidor-pc/server.py')], { env: { ...process.env, SOLTEC_V2_DIR: dir, SOLTEC_V2_PORT: String(pSync) }, stdio: 'ignore' });
let browser;
try {
  await esperar(`http://127.0.0.1:${pWeb}/index.html`);
  await esperar(`http://127.0.0.1:${pSync}/`);
  const clave = JSON.parse(readFileSync(join(dir, 'soltec-v2-config.json'), 'utf8')).key;
  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 900, height: 1200 } })).newPage();
  page.setDefaultTimeout(20000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(`http://localhost:${pWeb}/index.html#/ajustes`);
  await page.fill('#sync-url', `http://127.0.0.1:${pSync}`);
  await page.fill('#sync-clave', clave);
  await page.fill('#sync-nombre', 'PC CASA');
  await page.click('text=Guardar y sincronizar');
  await page.waitForSelector('.estado:has-text("Sincronizado")');
  await page.evaluate(async () => { await window.soltec.storage.save('aviso', { numero: '2026-0001', cliente: { nombre: 'Ana' } }); });
  await page.click('text=Guardar y sincronizar');
  await page.waitForFunction(async () => (await window.soltec.storage.pendingCounts()).records === 0, undefined, { polling: 300 });

  await page.goto(`http://localhost:${pWeb}/index.html#/inicio`);
  await page.goto(`http://localhost:${pWeb}/index.html#/ajustes`);
  await page.click('summary:has-text("Copia diaria fuera de casa")');
  await page.waitForSelector('#nube-estado:has-text("Desactivada")');
  await page.fill('#nube-otra', nube);
  await page.click('#nube-activar');
  await page.waitForSelector('#nube-estado:has-text("✓ Activada")');
  const dest = join(nube, 'SOLTEC_V2_COPIAS');
  assert.ok(readdirSync(dest).some((f) => /^soltec-v2_\d{4}-\d\d-\d\d\.sqlite3$/.test(f)));
  assert.ok(existsSync(join(dest, 'LEEME.txt')));
  assert.ok(!readdirSync(dest).some((f) => /config/.test(f)), 'la clave no se copia');
  assert.match(await page.textContent('#bloque-nube'), /Última copia en la nube/);
  ok('Ajustes › Copia diaria fuera de casa: se elige la carpeta, se activa y el PC hace la copia (sin la clave)');

  await page.click('#bloque-nube >> text=Desactivar');
  await page.waitForSelector('#nube-estado:has-text("Desactivada")');
  ok('Se puede desactivar');
  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill(); srv.kill();
}
