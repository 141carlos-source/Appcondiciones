// Prueba en Chromium: dos dispositivos (móvil y PC) abiertos a la vez contra el servidor real.
// Lo creado en uno aparece en el otro sin pulsar nada (latido), aviso de aviso abierto en
// los dos, y aviso de cambios que llevan tiempo sin subir.
// Uso: node tests/navegador-sync.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const esperar = async (url) => { for (let i = 0; i < 60; i++) { try { await fetch(url); return; } catch { await new Promise((r) => setTimeout(r, 100)); } } throw new Error('No arranca ' + url); };
const ok = (t) => console.log('✓ ' + t);
/** Repite fn en la página hasta que devuelva algo cierto (waitForFunction no espera promesas). */
const hasta = async (page, fn, arg, ms = 40000) => {
  const fin = Date.now() + ms;
  for (;;) {
    if (await page.evaluate(fn, arg)) return;
    if (Date.now() > fin) throw new Error('Tiempo agotado esperando: ' + fn.toString().slice(0, 80));
    await page.waitForTimeout(500);
  }
};

const pWeb = await libre(), pSync = await libre();
const dir = mkdtempSync(join(tmpdir(), 'soltecv2-sync-'));
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
const srv = spawn('python3', [join(raiz, 'servidor-pc/server.py')], { env: { ...process.env, SOLTEC_V2_DIR: dir, SOLTEC_V2_PORT: String(pSync) }, stdio: 'ignore' });
let browser;

try {
  await esperar(`http://127.0.0.1:${pWeb}/index.html`);
  await esperar(`http://127.0.0.1:${pSync}/`);
  const clave = JSON.parse(readFileSync(join(dir, 'soltec-v2-config.json'), 'utf8')).key;
  browser = await chromium.launch();
  const errores = [];

  const abrir = async (nombre) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (e) => errores.push(nombre + ': ' + e.message));
    page.on('dialog', (d) => d.accept());
    await page.goto(`http://localhost:${pWeb}/index.html#/ajustes`);
    await page.waitForSelector('#sync-url');
    await page.fill('#sync-url', `http://127.0.0.1:${pSync}`);
    await page.fill('#sync-clave', clave);
    await page.fill('#sync-nombre', nombre);
    await page.click('text=Guardar y sincronizar');
    await page.waitForSelector('.estado:has-text("Sincronizado")');
    return page;
  };
  const movil = await abrir('MÓVIL');
  const pc = await abrir('PC CASA');
  await pc.goto(`http://localhost:${pWeb}/index.html#/avisos`);

  // 1. Se crea en el móvil → aparece en el PC solo (latido cada 25 s), sin pulsar nada
  const t0 = Date.now();
  const id = await movil.evaluate(async () => (await window.soltec.storage.save('aviso', { numero: '2026-0101', cliente: { nombre: 'Luis Pardo' }, suministro: {}, docs: {} }, { event: { kind: 'creado' } })).id);
  await hasta(pc, async (aid) => !!(await window.soltec.storage.get(aid)), id);
  await pc.waitForSelector('main :text("Luis Pardo")', { timeout: 5000 });
  const seg = Math.round((Date.now() - t0) / 1000);
  assert.ok(seg <= 35, `tardó ${seg} s`);
  ok(`Creado en el móvil, aparece en la lista del PC sin pulsar nada (${seg} s)`);

  // 2. Cambio en el PC → llega al móvil
  await pc.evaluate(async (aid) => window.soltec.storage.patch(aid, { observaciones: 'Cambiado en el PC' }), id);
  await hasta(movil, async (aid) => (await window.soltec.storage.get(aid))?.data.observaciones === 'Cambiado en el PC', id);
  ok('Cambiado en el PC, llega al móvil solo');

  // 3. Mismo aviso abierto en los dos → aviso en pantalla
  await movil.goto(`http://localhost:${pWeb}/index.html#/aviso/${id}`);
  await movil.waitForSelector('h1:has-text("2026-0101")');
  await movil.waitForTimeout(1500); // su latido anuncia qué tiene abierto
  await pc.goto(`http://localhost:${pWeb}/index.html#/aviso/${id}`);
  await hasta(pc, () => document.getElementById('aviso-otro-dispositivo')?.textContent.includes('«MÓVIL»'));
  await hasta(movil, () => document.getElementById('aviso-otro-dispositivo')?.textContent.includes('«PC CASA»'));
  await pc.goto(`http://localhost:${pWeb}/index.html#/agenda`);
  await hasta(pc, () => document.querySelector('h1')?.textContent === 'Agenda', undefined, 10000);
  assert.equal(await pc.$('#aviso-otro-dispositivo'), null);
  ok('Mismo aviso abierto en los dos: los dos lo avisan; al salir desaparece');

  // 4. Cambios sin subir desde hace más de 1 h → aviso con «Sincronizar ahora»
  srv.kill();
  await movil.evaluate(async () => {
    await window.soltec.storage.setMeta('ultimoContactoPC', new Date(Date.now() - 3 * 3600 * 1000).toISOString());
    await window.soltec.storage.save('aviso', { numero: '2026-0102', cliente: { nombre: 'Sin subir' }, suministro: {}, docs: {} });
  });
  await hasta(movil, () => document.getElementById('aviso-sin-subir')?.textContent.includes('Llevas 3 h sin conectar con el PC'), undefined, 20000);
  assert.match(await movil.textContent('#aviso-sin-subir'), /solo está en este dispositivo/);
  ok('Más de 1 h sin conectar y con cambios: aviso «solo está en este dispositivo»');

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
