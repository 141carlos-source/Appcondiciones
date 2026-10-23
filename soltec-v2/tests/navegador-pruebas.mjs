// Prueba en Chromium móvil: «Probar en este dispositivo» (prueba en real guiada con informe).
// Uso: node tests/navegador-pruebas.mjs
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 820 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  const base = `http://localhost:${pWeb}/index.html`;

  await page.goto(base + '#/ajustes');
  await page.click('#ir-pruebas');
  await page.waitForSelector('#pruebas-auto .prueba-auto');
  assert.match(await page.textContent('#pruebas-auto'), /Instalada como app.*Conexión con el PC CASA: Este dispositivo aún no está conectado/s);
  assert.ok(await page.locator('[data-paso="teclado"]').count(), 'en la tablet sale el paso del teclado');
  assert.equal(await page.locator('[data-paso="instalador"]').count(), 0, 'y no el del instalador de Windows');
  if (process.env.CAPTURAS) await page.screenshot({ path: join(process.env.CAPTURAS, 'pruebas.png'), fullPage: true });
  ok('Ajustes › «Probar en este dispositivo»: comprobaciones automáticas y pasos para tablet');

  // Marcar: funciona / falla con nota (se guarda en el dispositivo)
  await page.click('[data-paso="ventanas"] [data-marca="ok"]');
  await page.click('[data-paso="telefono"] [data-marca="falla"]');
  await page.fill('[data-paso="telefono"] .prueba-nota', 'sale sin espacios');
  await page.waitForFunction(async () => (await window.soltec.storage.getMeta('pruebasReales'))?.telefono?.nota === 'sale sin espacios');
  assert.match(await page.textContent('#pruebas-resumen'), /1 funcionan · 1 fallan/);
  ok('«Funciona» / «Falla» con nota, y el resumen arriba');

  // Botón de acción: ventana de prueba
  await page.click('[data-accion="ventanas"]');
  await page.waitForSelector('.sd-fondo');
  await page.click('.sd-fondo #dc');
  // Ir a otra pantalla y volver con el botón flotante
  await page.click('[data-accion="telefono"]');
  await page.waitForSelector('#f-cliente-telefono');
  await page.waitForSelector('#volver-pruebas');
  await page.click('#volver-pruebas');
  await page.waitForSelector('[data-paso="telefono"].falla');
  ok('Los botones llevan a cada sitio y «✓ Volver a las pruebas» devuelve a la lista con lo marcado');

  // CuadroLab de prueba (suelto)
  await page.click('[data-accion="frontal"]');
  const f = page.frameLocator('#iframe-cuadrolab-prueba');
  await f.locator('[data-pal="PIA:0"]').waitFor({ timeout: 20000 });
  await f.locator('[data-pal="PIA:0"]').selectOption('16');
  assert.ok(await f.locator('svg[data-estilo="esquema"]').count());
  await page.click('#cerrar-cuadrolab-prueba');
  ok('CuadroLab de prueba (suelto, sin tocar avisos) con el dibujo nuevo');

  // Informe
  await page.evaluate(() => { window.__copiado = ''; navigator.clipboard.writeText = async (t) => { window.__copiado = t; }; });
  await page.click('#pruebas-copiar');
  await page.waitForFunction(() => window.__copiado);
  const t = await page.evaluate(() => window.__copiado);
  assert.match(t, /INFORME DE PRUEBA EN REAL/);
  assert.match(t, /Versión: V2-\d/);
  assert.match(t, /✅ Ventanas de SOLTEC/);
  assert.match(t, /❌ Teléfono con \+34 — sale sin espacios/);
  ok('«Copiar informe» deja el texto listo para pegar en el chat');

  // Terminar: deja de salir el botón flotante
  await page.click('a:has-text("Terminar")');
  await page.waitForSelector('#ir-pruebas');
  assert.equal(await page.locator('#volver-pruebas').count(), 0);
  ok('«Terminar» quita el botón de volver');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
