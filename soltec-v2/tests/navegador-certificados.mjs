// Prueba en Chromium móvil: pestaña Certificados del aviso (toma de tierra).
// Uso: node tests/navegador-certificados.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
globalThis.self ??= globalThis;
const _pl = createRequire(import.meta.url)('../vendor/pdf-lib.min.js');
const PDFLib = _pl?.PDFDocument ? _pl : globalThis.PDFLib;
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const pWeb = await libre();
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
const ok = (t) => console.log('✓ ' + t);
let browser;

try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${pWeb}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('dialog', (d) => d.accept());
  const base = `http://localhost:${pWeb}/index.html`;
  await page.goto(base + '#/inicio');
  await page.waitForFunction(() => window.soltec?.storage);
  const [id, id2] = await page.evaluate(async () => {
    const s = window.soltec.storage;
    await s.save('config', { empresa: { nombre: 'M. A. SOLTEC SL', nif: 'B99506651', localidad: 'LA PUEBLA DE ALFINDEN' }, tecnico: { nombre: 'CARLOS', numero: 'IBTE-1' } }, { id: 'empresa' });
    const base = { cliente: { nombre: 'ANA GIL', nif: '12345678Z' }, suministro: { direccion: 'CALLE MAYOR', numero: '10', cp: '50001', poblacion: 'ZARAGOZA', provincia: 'ZARAGOZA', lat: '41.6488', lon: '-0.8891' }, electrico: {}, docs: {} };
    return [(await s.save('aviso', { numero: '2026-0040', ...base })).id, (await s.save('aviso', { numero: '2026-0041', ...base })).id];
  });

  await page.goto(base + '#/aviso/' + id);
  await page.click('summary:has-text("Certificados")');
  await page.selectOption('#cert-tipo', 'tierra');
  await page.waitForSelector('#ct-medida');
  await page.fill('#ct-medida', '12,5');
  await page.waitForSelector('#cert-resultado:has-text("APTO · 12,5 Ω")');
  await page.fill('#ct-medida', '45');
  await page.waitForSelector('#cert-resultado:has-text("NO APTO")');
  assert.match(await page.textContent('#cert-resultado'), /no cumple/);
  await page.fill('#ct-medida', '12,5');
  ok('Resultado en directo: APTO / NO APTO con tensión de contacto y referencia ITC-BT-26');

  // Equipo de medida: se da de alta una vez
  await page.click('#ct-nuevo-medidor');
  await page.fill('#md-marca', 'FLUKE');
  await page.fill('#md-modelo', '1625-2');
  await page.fill('#md-serie', 'a123');
  await page.fill('#md-validoHasta', '2027-03-01');
  await page.click('#md-guardar');
  await page.waitForSelector('#ct-medidor');
  const emp = await page.evaluate(async () => (await window.soltec.storage.get('empresa')).data);
  assert.equal(emp.medidores.length, 1);
  assert.equal(emp.medidores[0].serie, 'A123');
  assert.equal(emp.medidorPorDefecto, emp.medidores[0].id);
  ok('El equipo de medida queda guardado en la empresa');

  // Fotos: máximo 6
  // 7 imágenes distintas (las iguales se guardan una sola vez)
  const imgs = await page.evaluate(() => Array.from({ length: 7 }, (_, i) => {
    const cv = document.createElement('canvas'); cv.width = 120; cv.height = 90;
    const g = cv.getContext('2d'); g.fillStyle = `hsl(${i * 50},70%,50%)`; g.fillRect(0, 0, 120, 90); g.fillStyle = '#fff'; g.fillText('Foto ' + i, 10, 50);
    return cv.toDataURL('image/png').split(',')[1];
  }));
  await page.setInputFiles('#cert-fotos', imgs.map((b, i) => ({ name: `f${i}.png`, mimeType: 'image/png', buffer: Buffer.from(b, 'base64') })));
  await page.waitForSelector('#bloque-certificados >> text=6 de 6 fotografías');
  ok('Fotografías del certificado: como máximo 6');

  await page.click('#cert-generar');
  await page.waitForSelector('#cert-salida >> text=Certificado preparado');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#cert-salida >> text=Descargar')]);
  assert.equal(dl.suggestedFilename(), 'CERTIFICADO_TOMA_TIERRA_CALLE_MAYOR_10.pdf');
  const doc = await PDFLib.PDFDocument.load(readFileSync(await dl.path()));
  assert.equal(doc.getPageCount(), 2);
  await page.click('#cert-guardar');
  let a;
  for (let i = 0; i < 30; i++) { a = await page.evaluate(async (aid) => (await window.soltec.storage.get(aid)).data, id); if (a.archivos?.some((x) => x.tipo === 'cert_tierra')) break; await page.waitForTimeout(200); }
  assert.ok(a.archivos.some((x) => x.tipo === 'cert_tierra'));
  assert.equal(a.certificados.tierra.medida, '12,5');
  assert.equal(a.certificados.tierra.fotos.length, 6);
  ok('Certificado PDF (datos + plano/fotos) generado y guardado en el aviso con sus datos');

  // En otro aviso el equipo ya está elegido
  await page.goto(base + '#/aviso/' + id2);
  await page.click('summary:has-text("Certificados")');
  await page.selectOption('#cert-tipo', 'tierra');
  await page.waitForSelector('#ct-medidor');
  assert.equal(await page.$eval('#ct-medidor', (s) => s.selectedOptions[0].textContent), 'Telurómetro · FLUKE · 1625-2 · nº A123');
  ok('En el siguiente aviso el equipo de medida ya aparece elegido');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
