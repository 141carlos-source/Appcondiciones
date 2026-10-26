// Prueba en Chromium móvil: aviso de «sin sincronizar» en Inicio (riesgo de perder trabajo) y velocidad de Inicio.
// Uso: node tests/navegador-sinsync.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, connect } from 'node:net';
import assert from 'node:assert/strict';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const pWeb = await libre();
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
const ok = (t) => console.log('✓ ' + t);
let browser;
try {
  const escucha = () => new Promise((r) => { const c = connect(pWeb, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); });
  for (let i = 0; i < 50 && !(await escucha()); i++) await new Promise((r) => setTimeout(r, 100));
  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 820 }, isMobile: true, hasTouch: true })).newPage();
  page.setDefaultTimeout(15000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_CONNECTION_REFUSED/.test(m.text())) errores.push(m.text()); });
  const base = `http://localhost:${pWeb}/index.html`;

  // Vacío: sin aviso
  await page.goto(base + '#/inicio');
  await page.waitForSelector('#buscador-unico');
  assert.equal(await page.locator('#alerta-sync').count(), 0, 'dispositivo vacío: nada que perder');

  // Con datos y sin conectar al PC
  await page.evaluate(async () => window.soltec.storage.save('aviso', (await import('./core/model.js')).nuevoAviso({ numero: '2026-0001', cliente: { nombre: 'PRUEBA' } })));
  await page.goto(base + '#/agenda'); await page.goto(base + '#/inicio');
  await page.waitForSelector('#alerta-sync');
  assert.match(await page.textContent('#alerta-sync'), /no está conectado al PC CASA.*Conectar con el PC/s);
  ok('Con datos y sin conectar al PC: banda roja «no está conectado al PC CASA» con «Conectar con el PC»');

  // Conectado, con cambios sin subir desde hace 2 días
  await page.evaluate(async () => {
    const s = window.soltec.storage;
    await s.setMeta('sync', { url: 'http://127.0.0.1:9', clave: 'x', nombre: 'TABLET' });
    await s.setMeta('ultimaSync', { fin: new Date(Date.now() - 50 * 3600000).toISOString(), subidos: 0, bajados: 0, archivosSubidos: 0, archivosBajados: 0 });
    const tx = s.db.transaction('outbox', 'readwrite'), o = tx.objectStore('outbox');
    const todos = await new Promise((r) => { const q = o.getAll(); q.onsuccess = () => r(q.result); });
    for (const x of todos) o.put({ ...x, queuedAt: new Date(Date.now() - 50 * 3600000).toISOString() });
    await new Promise((r) => { tx.oncomplete = r; });
  });
  await page.reload();
  await page.waitForSelector('#alerta-sync');
  assert.match(await page.textContent('#alerta-sync'), /\d+ cambios? sin subir al PC desde hace 2 días/);
  await page.click('#alerta-sync-ahora'); // el PC de prueba no responde: no se rompe nada
  await page.waitForSelector('#alerta-sync');
  ok('Con cambios sin subir desde hace 2 días: «N cambios sin subir al PC desde hace 2 días» y «Sincronizar ahora»');

  // Sincronizado hace poco y nada pendiente: sin banda
  await page.evaluate(async () => {
    const s = window.soltec.storage;
    await s.setMeta('ultimaSync', { fin: new Date().toISOString(), subidos: 0, bajados: 0, archivosSubidos: 0, archivosBajados: 0 });
    const tx = s.db.transaction('outbox', 'readwrite'); tx.objectStore('outbox').clear(); await new Promise((r) => { tx.oncomplete = r; });
  });
  await page.reload();
  await page.waitForSelector('#buscador-unico');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#alerta-sync').count(), 0);
  ok('Sincronizado y sin nada pendiente: no sale ninguna banda');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
