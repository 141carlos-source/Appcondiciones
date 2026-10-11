// Prueba en Chromium real, tamaño móvil: carcasa, navegación, sincronización con el
// servidor Python, salida segura y funcionamiento sin conexión.
// Uso: node tests/navegador.mjs   (necesita python3 y Playwright con Chromium)
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

const pWeb = await libre(), pSync = await libre();
const dir = mkdtempSync(join(tmpdir(), 'soltecv2-nav-'));
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
const srv = spawn('python3', [join(raiz, 'servidor-pc/server.py')], { env: { ...process.env, SOLTEC_V2_DIR: dir, SOLTEC_V2_PORT: String(pSync) }, stdio: 'ignore' });
const salida = [];
let browser;
const ok = (t) => { salida.push('✓ ' + t); console.log('✓ ' + t); };

try {
  await esperar(`http://127.0.0.1:${pWeb}/index.html`);
  await esperar(`http://127.0.0.1:${pSync}/`);
  const clave = JSON.parse(readFileSync(join(dir, 'soltec-v2-config.json'), 'utf8')).key;

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

  const url = `http://localhost:${pWeb}/index.html`;
  await page.goto(url);
  await page.waitForSelector('nav.inferior');
  await page.waitForFunction(() => window.soltec?.storage);

  // Navegación: 6 botones en UNA fila y «Salir» visible a 360 px
  const cajas = await page.$$eval('nav.inferior > a', (as) => as.map((a) => { const r = a.getBoundingClientRect(); return { t: a.textContent.trim(), top: Math.round(r.top), right: r.right }; }));
  assert.equal(cajas.length, 6);
  assert.equal(new Set(cajas.map((c) => c.top)).size, 1, 'todos en la misma fila');
  assert.equal(cajas.at(-1).t, 'Salir');
  assert.ok(cajas.at(-1).right <= 360, 'Salir dentro de la pantalla');
  const cortados = await page.$$eval('nav.inferior > a > span:last-child', (ss) => ss.filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.textContent));
  assert.deepEqual(cortados, [], 'etiquetas cortadas');
  ok('Navegación inferior en una fila, sin etiquetas cortadas y con «Salir» visible a 360 px');
  await page.screenshot({ path: join(raiz, 'tests/captura-inicio.png') });

  // Ajustes: desplegables cerrados salvo la sincronización sin configurar
  await page.click('nav.inferior a[data-ruta=ajustes]');
  await page.waitForSelector('#sync-url');
  const abiertos = await page.$$eval('details.card', (ds) => ds.map((d) => [d.querySelector('summary').textContent, d.open]));
  assert.deepEqual(abiertos.filter(([, o]) => o).map(([s]) => s), ['Sincronización con el PC']);
  ok('Desplegables cerrados al abrir (solo se abre la sincronización porque falta configurarla)');

  // Configurar y probar contra el servidor real
  assert.equal(await page.inputValue('#sync-url'), 'http://127.0.0.1:8766');
  ok('En el propio PC la dirección del servidor viene rellenada');
  await page.fill('#sync-url', `http://127.0.0.1:${pSync}`);
  await page.fill('#sync-clave', 'mala');
  await page.click('text=Probar conexión');
  await page.waitForSelector('.aviso.err');
  assert.match(await page.textContent('.aviso.err'), /clave/);
  await page.fill('#sync-clave', clave);
  await page.fill('#sync-nombre', 'MÓVIL');
  await page.click('text=Probar conexión');
  await page.waitForSelector('.aviso.ok');
  ok('Probar conexión: clave mala avisada, clave buena conecta con el PC');

  // Crear datos y sincronizar desde la app
  await page.evaluate(async () => {
    const s = window.soltec.storage;
    const f = await s.putFile({ name: 'c.pdf', mime: 'application/pdf', bytes: new TextEncoder().encode('%PDF prueba') });
    await s.save('aviso', { numero: '2026-0001', cliente: { nombre: 'Prueba' }, condiciones: { ref: '0001', pdfs: [f] } }, { event: { kind: 'creado' } });
  });
  // La subida automática llega a los 2 s: se comprueba que la cabecera lo mostró antes de subir
  await page.waitForFunction(() => /sin subir|Sincronizando|Sincronizado hace un momento/.test(document.querySelector('.estado')?.textContent || ''));
  ok('Al guardar, la cabecera muestra los cambios sin subir (y se suben solos a los 2 s)');
  await page.click('text=Guardar y sincronizar');
  await page.waitForFunction(() => document.querySelector('.estado')?.textContent.startsWith('Sincronizado'));
  const st = await (await fetch(`http://127.0.0.1:${pSync}/api/v2/status`, { headers: { 'X-Soltec-Key': clave } })).json();
  assert.equal(st.records, 2);
  assert.equal(st.blobs, 1);
  ok('Sincronización desde el navegador: 2 registros y 1 PDF en el PC');

  // Inicio refleja el expediente
  await page.click('nav.inferior a[data-ruta=inicio]');
  await page.waitForSelector('.cifras');
  const cifras = await page.$$eval('.cifra b', (bs) => bs.map((b) => b.textContent));
  assert.deepEqual(cifras, ['0', '1', '0']);
  ok('Inicio cuenta el aviso con referencia como expediente');
  await page.screenshot({ path: join(raiz, 'tests/captura-inicio-sync.png') });

  // Salida segura con un cambio pendiente
  await page.evaluate(async () => { const s = window.soltec.storage; const [a] = await s.list('aviso'); await s.patch(a.id, { estado: 'En curso' }); });
  await page.click('nav.inferior a[data-ruta=salir]');
  await page.waitForSelector('text=Ya puedes cerrar la aplicación.');
  const pasos = await page.$$eval('.lista-chk li', (ls) => ls.map((l) => l.textContent));
  assert.ok(pasos.some((p) => /Cambios subidos al PC/.test(p)), pasos.join(' | '));
  ok('Salida segura: sube lo pendiente y confirma que se puede cerrar');
  await page.screenshot({ path: join(raiz, 'tests/captura-salir.png') });

  // Copia de seguridad descargable
  await page.click('nav.inferior a[data-ruta=ajustes]');
  await page.click('summary:has-text("Copias de seguridad")');
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('text=Descargar copia')]);
  assert.match(descarga.suggestedFilename(), /^SOLTEC_V2_COPIA_\d{4}-\d{2}-\d{2}_\d{4}\.json$/);
  const copia = JSON.parse(readFileSync(await descarga.path(), 'utf8'));
  assert.equal(copia.archivos.length, 1);
  ok('Copia de seguridad descargada con su PDF: ' + descarga.suggestedFilename());

  // Sin conexión: la app abre desde el service worker y los datos siguen ahí
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.ready).active);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.evaluate(() => { location.hash = '#/inicio'; });
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('.cifras');
  assert.equal(await page.$eval('.cifra:nth-child(2) b', (b) => b.textContent), '1');
  ok('Sin conexión: la app abre y conserva los datos');
  await ctx.setOffline(false);

  assert.deepEqual(errores.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to fetch|net::|status of 401/.test(e)), []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
  srv.kill();
}
