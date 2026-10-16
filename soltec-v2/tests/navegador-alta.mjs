// Prueba en Chromium con el servidor real: en el PC CASA se prepara la instalación (enlace, QR e
// instalador .bat) y un dispositivo nuevo se conecta abriendo el enlace y poniendo solo su nombre.
// Uso: node tests/navegador-alta.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { leerAlta } from '../core/alta.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const esperar = async (url) => { for (let i = 0; i < 60; i++) { try { await fetch(url); return; } catch { await new Promise((r) => setTimeout(r, 100)); } } throw new Error('No arranca ' + url); };
const ok = (t) => console.log('✓ ' + t);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

const pWeb = await libre(), pSync = await libre();
const dir = mkdtempSync(join(tmpdir(), 'soltecv2-alta-'));
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
const srv = spawn('python3', [join(raiz, 'servidor-pc/server.py')], { env: { ...process.env, SOLTEC_V2_DIR: dir, SOLTEC_V2_PORT: String(pSync) }, stdio: 'ignore' });
let browser;
try {
  await esperar(`http://127.0.0.1:${pWeb}/index.html`);
  await esperar(`http://127.0.0.1:${pSync}/`);
  const clave = JSON.parse(readFileSync(join(dir, 'soltec-v2-config.json'), 'utf8')).key;
  browser = await chromium.launch();
  const errores = [];
  const nueva = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 800, height: 1200 }, acceptDownloads: true, ...opts });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (e) => errores.push(e.message));
    page.on('dialog', (d) => d.accept());
    return page;
  };

  // --- PC CASA: configurado y con un aviso
  const pc = await nueva();
  await pc.goto(`http://localhost:${pWeb}/index.html#/ajustes`);
  await pc.fill('#sync-url', `http://127.0.0.1:${pSync}`);
  await pc.fill('#sync-clave', clave);
  await pc.fill('#sync-nombre', 'PC CASA');
  await pc.click('text=Guardar y sincronizar');
  await pc.waitForSelector('.estado:has-text("Sincronizado")');
  await pc.evaluate(async () => { await window.soltec.storage.save('aviso', { numero: '2026-0500', cliente: { nombre: 'Ana Gil' }, suministro: {}, docs: {} }); });
  await pc.click('text=Guardar y sincronizar');
  await pc.waitForFunction(async () => (await window.soltec.storage.pendingCounts()).records === 0, undefined, { polling: 300 });

  // Preparar instalación en Ajustes: con 127.0.0.1 no deja; con la de Tailscale sí
  await pc.goto(`http://localhost:${pWeb}/index.html#/inicio`);
  await pc.goto(`http://localhost:${pWeb}/index.html#/ajustes`);
  await pc.click('summary:has-text("Instalar en otro dispositivo")');
  await pc.fill('#alta-url', `http://127.0.0.1:${pSync}`);
  await pc.click('#alta-generar');
  assert.match(await pc.textContent('#otro-dispositivo'), /solo sirve en el propio PC/);
  await pc.fill('#alta-url', 'https://pc-casa.ejemplo.ts.net:8443');
  await pc.click('#alta-generar');
  await pc.waitForSelector('#alta-qr svg');
  const enlace = await pc.inputValue('#alta-enlace');
  assert.ok(enlace.startsWith('https://141carlos-source.github.io/Appcondiciones/soltec-v2/#/alta/'));
  assert.deepEqual(leerAlta(enlace), { url: 'https://pc-casa.ejemplo.ts.net:8443', clave, pc: 'PC CASA' });
  ok('PC CASA: Ajustes › Instalar en otro dispositivo prepara enlace y QR con la dirección y la clave');
  const [desc] = await Promise.all([pc.waitForEvent('download'), pc.click('#alta-bat')]);
  assert.equal(desc.suggestedFilename(), 'INSTALAR_SOLTEC_V2_EN_OTRO_PC.bat');
  const bat = readFileSync(await desc.path(), 'utf8');
  assert.ok(bat.includes(enlace) && bat.includes('SOLTEC V2.lnk'));
  ok('Instalador .bat para otro PC: crea el icono del escritorio y abre el enlace de alta');
  if (process.env.CAPTURA) await pc.locator('#detalles-otro-dispositivo').screenshot({ path: '/tmp/claude-0/cab/alta-pc.png' });

  // --- Tablet nueva: abre el enlace (aquí con la dirección del servidor de prueba) y solo pone el nombre
  const codigo = b64({ v: 1, u: `http://127.0.0.1:${pSync}`, k: clave, pc: 'PC CASA' });
  const tab = await nueva({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36', isMobile: true, hasTouch: true });
  await tab.goto(`http://localhost:${pWeb}/index.html#/alta/${codigo}`);
  await tab.waitForSelector('#alta-nombre');
  assert.equal(await tab.inputValue('#alta-nombre'), 'TABLET');
  assert.equal(await tab.evaluate(() => location.hash), '#/alta', 'la clave no se queda en la barra');
  if (process.env.CAPTURA) await tab.screenshot({ path: '/tmp/claude-0/cab/alta-tablet.png' });
  await tab.fill('#alta-nombre', 'tablet salón');
  await tab.click('#alta-conectar');
  await tab.waitForSelector('#alta-ok', { timeout: 30000 });
  const cfg = await tab.evaluate(() => window.soltec.sync.config());
  assert.deepEqual(cfg, { url: `http://127.0.0.1:${pSync}`, clave, nombre: 'TABLET SALÓN' });
  assert.ok(await tab.evaluate(async () => (await window.soltec.storage.list('aviso')).some((r) => r.data.numero === '2026-0500')));
  ok('Tablet: abre el enlace, pregunta solo el nombre (propone TABLET), se conecta y baja los avisos del PC');
  if (process.env.CAPTURA) await tab.screenshot({ path: '/tmp/claude-0/cab/alta-listo.png' });

  // Enlace dañado
  const malo = await nueva();
  await malo.goto(`http://localhost:${pWeb}/index.html#/alta/xxx`);
  await malo.waitForSelector('text=no es válido');
  ok('Un enlace dañado avisa y no toca nada');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
  srv.kill();
}
