// Prueba en Chromium: ventanas comunes de SOLTEC (assets/soltec-dialogo.js) en la app, CuadroLab y la autorización.
// Sin ventanas nativas del navegador: mismo aspecto, Intro = aceptar, Esc = cancelar.
// Uso: node tests/navegador-ventanas.mjs
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const errores = [], nativas = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('dialog', (d) => { nativas.push(d.message()); d.dismiss(); });
  const base = `http://localhost:${pWeb}`;

  // --- el componente, directamente en la app
  await page.goto(base + '/index.html#/inicio');
  await page.waitForSelector('#buscador-unico');
  const r1 = page.evaluate(() => SoltecDialogo.confirmar('¿Seguro?', { si: 'Sí, borrar', peligro: true }));
  await page.waitForSelector('.sd-fondo');
  assert.equal(await page.textContent('.sd-fondo #dk'), 'Sí, borrar');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'dk', 'el foco va al botón');
  const caja = await page.locator('.sd-caja').boundingBox();
  assert.ok(caja.width <= 390 - 32 + 1, 'cabe en el móvil');
  const btn = await page.locator('.sd-fondo #dk').boundingBox();
  assert.ok(btn.height >= 44 && btn.width > 300, 'botones grandes, uno por fila en el móvil');
  await page.keyboard.press('Escape');
  assert.equal(await r1, false);
  const r2 = page.evaluate(() => SoltecDialogo.confirmar('¿Seguro?'));
  await page.waitForSelector('.sd-fondo');
  await page.keyboard.press('Enter');
  assert.equal(await r2, true);
  const r3 = page.evaluate(() => SoltecDialogo.preguntar('Nombre', { valor: 'abc', mayusculas: true }));
  await page.waitForSelector('.sd-fondo #dg');
  await page.keyboard.type('def'); // el texto inicial está seleccionado: se sustituye
  await page.keyboard.press('Enter');
  assert.equal(await r3, 'DEF');
  const r4 = page.evaluate(() => SoltecDialogo.preguntar('Elige', { opciones: [['a', 'Uno'], ['b', 'Dos']], valor: 'b' }));
  await page.waitForSelector('.sd-fondo select#dg');
  await page.click('.sd-fondo #dk');
  assert.equal(await r4, 'b');
  const r5 = page.evaluate(() => { const p = SoltecDialogo.confirmar('primera'); SoltecDialogo.aviso('segunda'); return p; });
  assert.equal(await r5, false, 'una ventana nueva cierra la anterior como «Cancelar»');
  assert.equal(await page.locator('.sd-fondo').count(), 1);
  await page.click('.sd-fondo #dk');
  await page.waitForSelector('.sd-fondo', { state: 'detached' });
  ok('Ventana común: foco en el botón, Esc cancela, Intro acepta, pregunta con texto o lista, cabe en el móvil');

  // --- CuadroLab
  await page.goto(base + '/assets/cuadrolab.html');
  await page.waitForSelector('[data-pal="PIA:0"]');
  await page.selectOption('[data-pal="PIA:0"]', '16');
  await page.click('[onclick="nw()"]');
  await page.waitForSelector('.sd-fondo');
  assert.match(await page.textContent('.sd-fondo .sd-texto'), /PROYECTO NUEVO/);
  assert.equal(await page.textContent('.sd-fondo #dk'), 'ACEPTAR');
  await page.click('.sd-fondo #dc');
  assert.equal(await page.locator('.dv').count(), 1, 'cancelar no borra nada');
  await page.evaluate(() => { S.dv = S.dv.filter((d) => d.t != 'PIA'); rd(); });
  await page.selectOption('[data-pal="PIA:0"]', '10');
  await page.selectOption('[data-pal="PIA:0"]', '16');
  await page.evaluate(() => { add('REL', 2); });
  await page.waitForSelector('.sd-fondo select#dg');
  assert.match(await page.textContent('.sd-fondo .sd-texto'), /DE QUÉ MAGNETOTÉRMICO CUELGA/);
  const ops = await page.$$eval('.sd-fondo select#dg option', (o) => o.map((x) => x.value));
  await page.selectOption('.sd-fondo select#dg', ops[1]);
  await page.click('.sd-fondo #dk');
  assert.equal(await page.evaluate(() => S.dv.find((d) => d.t == 'REL').dep), ops[1]);
  await page.evaluate(() => { S.w = 2; S.r = 1; S.dv = []; rd(); add('ID', 2); add('ID', 2); });
  await page.waitForSelector('.sd-fondo');
  assert.equal(await page.textContent('.sd-fondo .sd-texto'), 'NO HAY ESPACIO LIBRE');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.sd-fondo', { state: 'detached' });
  ok('CuadroLab: «Proyecto nuevo», «¿De qué magnetotérmico cuelga?» y «No hay espacio» salen en la ventana común');

  // --- Autorización
  await page.goto(base + '/assets/autorizacion.html');
  await page.waitForSelector('[data-a="clear"]', { state: 'attached' });
  await page.selectOption('#modo', 'asi');
  const campo = page.locator('#fld_sol_nombre');
  await campo.fill('PRUEBA');
  await page.evaluate(() => document.querySelector('[data-a="clear"]').click());
  await page.waitForSelector('.sd-fondo');
  assert.match(await page.textContent('.sd-fondo .sd-texto'), /autorización nueva/);
  assert.equal(await page.textContent('.sd-fondo #dk'), 'Empezar de nuevo');
  await page.click('.sd-fondo #dc');
  assert.equal(await campo.inputValue(), 'PRUEBA', 'cancelar conserva los datos');
  await page.evaluate(() => document.querySelector('[data-a="clear"]').click());
  await page.click('.sd-fondo #dk');
  await page.waitForFunction(() => !document.querySelector('.sd-fondo'));
  assert.equal(await page.evaluate(() => SoltecAutorizacion.getData().sol_nombre || ''), '');
  ok('Autorización: «Nueva autorización» pregunta en la ventana común y solo vacía si se acepta');

  assert.deepEqual(nativas, [], 'ninguna ventana nativa del navegador');
  assert.deepEqual(errores, []);
  ok('Sin ventanas nativas ni errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
