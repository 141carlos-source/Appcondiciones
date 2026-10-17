// Prueba en Chromium móvil: CuadroLab incrustado en la ficha del aviso (sección «Cuadros eléctricos»).
// El cuadro se diseña dentro de la app, se guarda dentro del aviso y se recupera al reabrirlo.
// Uso: node tests/navegador-cuadros.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const pWeb = await libre();
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
const ok = (t) => console.log('✓ ' + t);
let browser;

try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${pWeb}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  const dialogos = [];
  page.on('dialog', (d) => { dialogos.push(d.message()); d.accept(); });
  const base = `http://localhost:${pWeb}/index.html`;
  const abrirSeccion = (t) => page.click(`summary:has-text("${t}")`);

  // --- aviso nuevo con un cuadro
  await page.goto(base + '#/aviso/nuevo');
  await page.waitForSelector('#f-cliente-nombre');
  await page.fill('#f-cliente-nombre', 'Clínica de Teruel');
  await page.fill('#f-suministro-direccion', 'Calle Mayor 1');
  await abrirSeccion('Cuadros eléctricos');
  assert.match(await page.textContent('#cuadro-resumen'), /Sin cuadro diseñado/);
  ok('La ficha tiene la sección «Cuadros eléctricos» y empieza sin cuadro');

  await page.click('#abrir-cuadro');
  const f = page.frameLocator('#iframe-cuadro');
  await f.locator('[data-pal="ID:0"]').waitFor({ timeout: 20000 });
  assert.match(await f.locator('#hd').textContent(), /SOLTEC/);
  ok('CuadroLab se abre dentro de la app, a pantalla completa');
  assert.ok(await f.getByText('ACEPTAR Y VOLVER').isVisible());
  assert.equal(await f.getByText('GUARDAR COMO').count(), 0);

  await f.locator('[data-pal="ID:0"]').selectOption('1');
  await f.locator('[data-pal="PIA:0"]').selectOption('16');
  await f.locator('[data-pal="PIA:1"]').selectOption('16');
  assert.equal(await f.locator('.dv').count(), 3);
  ok('Se colocan aparatos en el frontal');

  await f.getByText('ACEPTAR Y VOLVER').click();
  await page.waitForSelector('.capa-cuadro', { state: 'detached' });
  ok('Aceptar y volver cierra el diseñador');

  // Al volver con cambios el aviso se guarda solo, sin pulsar «Guardar»
  await page.waitForSelector('h1:has-text("Aviso 2026-0001")');
  const guardado = await page.evaluate(async () => (await window.soltec.storage.list('aviso')).find((r) => r.data.numero === '2026-0001'));
  assert.ok(guardado?.data.cuadro?.proyecto, 'el cuadro está guardado en el aviso');
  await abrirSeccion('Cuadros eléctricos');
  assert.match(await page.textContent('#cuadro-resumen'), /1 cuadro · 2 circuitos/);
  ok('Al volver del cuadro el aviso se guarda solo, con su cuadro (sin pulsar «Guardar»)');

  // Aviso ya existente: añadir un circuito y volver → guardado sin preguntar nada
  await page.click('#abrir-cuadro');
  const e1 = page.frameLocator('#iframe-cuadro');
  await e1.locator('.dv').first().waitFor({ timeout: 20000 });
  await e1.locator('[data-pal="PIA:0"]').selectOption('16');
  await e1.getByText('ACEPTAR Y VOLVER').click();
  await page.waitForSelector('.capa-cuadro', { state: 'detached' });
  await page.waitForFunction(async () => {
    const r = (await window.soltec.storage.list('aviso')).find((x) => x.data.numero === '2026-0001');
    return (r?.data.cuadro?.proyecto?.cs?.[0]?.dv || r?.data.cuadro?.proyecto?.dv || []).filter((d) => d.t === 'PIA').length === 3;
  }, undefined, { polling: 300, timeout: 10000 }).catch(() => {});
  const n3 = await page.evaluate(async () => {
    const r = (await window.soltec.storage.list('aviso')).find((x) => x.data.numero === '2026-0001');
    const p = r.data.cuadro.proyecto; return (p.cs?.find((q) => q.dv?.length)?.dv || p.dv || []).filter((d) => d.t === 'PIA').length;
  });
  assert.equal(n3, 3);
  assert.match(await page.textContent('#cuadro-resumen'), /3 circuitos/);
  ok('En un aviso ya guardado, el cambio del cuadro se guarda solo al volver');

  assert.match(await page.textContent('#version-app'), /V2 · \d+\.\d+\.\d+/);
  ok('La versión se ve arriba a la derecha');

  // --- reabrir desde cero: el cuadro viene de la base de datos del aviso
  await page.reload();
  await page.waitForSelector('#f-cliente-nombre', { state: 'attached' }); // la sección de cliente está plegada
  await abrirSeccion('Cuadros eléctricos');
  assert.match(await page.textContent('#cuadro-resumen'), /1 cuadro · 3 circuitos/);
  await page.click('#abrir-cuadro');
  const g = page.frameLocator('#iframe-cuadro');
  await g.locator('.dv').first().waitFor({ timeout: 20000 });
  assert.equal(await g.locator('.dv').count(), 4);
  assert.match(await g.locator('#hd').textContent(), /CLÍNICA DE TERUEL · CALLE MAYOR/); // nombre y dirección que se pasaron del aviso
  ok('Al reabrir el aviso, el cuadro se recupera tal como se dejó, con el nombre y la dirección del aviso');

  // Con el service worker activo (la app instalada) y sin conexión, el diseñador sigue abriéndose
  await page.evaluate(() => navigator.serviceWorker.ready);
  await g.getByText('ACEPTAR Y VOLVER').click();
  await page.waitForSelector('.capa-cuadro', { state: 'detached' });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('#f-cliente-nombre', { state: 'attached' });
  await abrirSeccion('Cuadros eléctricos');
  await page.click('#abrir-cuadro');
  const off = page.frameLocator('#iframe-cuadro');
  await off.locator('.dv').first().waitFor({ timeout: 20000 });
  assert.equal(await off.locator('.dv').count(), 4);
  ok('Sin conexión y con la app instalada, el diseñador se abre igual (queda en el caché del service worker)');
  await ctx.setOffline(false);
  const g2 = page.frameLocator('#iframe-cuadro');

  // CuadroLab incrustado no guarda el proyecto por su cuenta
  const fr = page.frames().find((x) => x.url().includes('cuadrolab.html'));
  assert.ok(fr);
  assert.equal(await fr.evaluate(() => localStorage.getItem('cl_s')), null);
  ok('CuadroLab no guarda el proyecto en localStorage: solo vive dentro del aviso');

  // Cambio sin guardar: avisa al salir; si se vuelve sin tocar nada no se marca como cambiado
  await g2.getByText('ACEPTAR Y VOLVER').click();
  await page.waitForSelector('.capa-cuadro', { state: 'detached' });
  assert.equal(await page.evaluate(() => !!document.querySelector('.capa-cuadro')), false);
  const antes = dialogos.length;
  await page.goto(base + '#/avisos'); // si el aviso estuviera «modificado», la app preguntaría si salir sin guardar
  await page.waitForFunction(() => location.hash === '#/avisos' && !document.querySelector('#f-cliente-nombre'));
  assert.equal(dialogos.length, antes);
  ok('Abrir y cerrar el diseñador sin tocar nada no marca el aviso como modificado');

  // Los avisos sin cuadro no se ven afectados
  await page.goto(base + '#/aviso/nuevo');
  await page.waitForSelector('#f-cliente-nombre');
  await page.fill('#f-cliente-nombre', 'Sin cuadro');
  await page.click('#guardar');
  await page.waitForSelector('h1:has-text("Aviso 2026-0002")');
  ok('Un aviso sin cuadro se guarda como siempre');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
