// Prueba en Chromium: enviar la autorización por correo (Sí/No, correo del cliente por defecto y editable, PDF).
// Uso: node tests/navegador-autorizacion-correo.mjs   (CAPTURA=1 guarda el PDF)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, connect } from 'node:net';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
globalThis.self ??= globalThis;
const _r = createRequire(import.meta.url)('../vendor/pdf-lib.min.js');
const PDFLib = _r?.PDFDocument ? _r : globalThis.PDFLib;

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const ok = (t) => console.log('✓ ' + t);
const pWeb = await libre();
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
let browser;
try {
  const escucha = () => new Promise((r) => { const c = connect(pWeb, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); });
  for (let i = 0; i < 50 && !(await escucha()); i++) await new Promise((r) => setTimeout(r, 100));
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.route(/^mailto:/, (r) => r.abort());
  const base = `http://localhost:${pWeb}/index.html`;
  await page.goto(base);
  await page.waitForFunction(() => window.soltec?.storage);
  const id = await page.evaluate(async () => (await window.soltec.storage.save('aviso', { numero: '2026-0088', cliente: { nombre: 'Luis Pérez', nif: '12345678Z', email: 'luis@ejemplo.es' }, suministro: { direccion: 'Calle Mayor', numero: '1', poblacion: 'Zaragoza', provincia: 'Zaragoza' } })).id);
  await page.goto(base + '#/aviso/' + id);
  await page.click('summary:has-text("Autorización de representatividad")');
  await page.click('#abrir-autorizacion');
  const frame = await (async () => { for (;;) { const fr = page.frame({ url: /autorizacion\.html/ }); if (fr) return fr; await page.waitForTimeout(100); } })();
  await frame.waitForFunction(() => window.SoltecAutorizacion && window.SoltecAutorizacion.getData().sol_nombre);

  await frame.click('#bCorreo');
  await frame.waitForSelector('#mCorreo');
  assert.equal(await frame.inputValue('#envPara'), 'luis@ejemplo.es');
  assert.equal(await frame.getAttribute('#envSeg [data-v="si"]', 'aria-pressed'), 'true');
  ok('«✉ Correo»: enviar por correo Sí, con el correo del cliente del aviso por defecto');

  await frame.click('#envSeg [data-v="no"]');
  assert.ok(await frame.isHidden('#envPara'));
  assert.equal((await frame.evaluate(() => window.SoltecAutorizacion.getData())).env_correo, 'no');
  await frame.click('#envSeg [data-v="si"]');
  await frame.fill('#envPara', 'otro@ejemplo.es');
  ok('Se puede elegir No, y cambiar el correo');

  const [desc] = await Promise.all([page.waitForEvent('download'), frame.click('#bEnviar')]);
  assert.match(desc.suggestedFilename(), /^AUTORIZACION_REPRESENTATIVIDAD_LUIS_PEREZ\.pdf$/);
  const pdf = readFileSync(await desc.path());
  assert.ok(pdf.subarray(0, 5).toString() === '%PDF-');
  assert.equal((await PDFLib.PDFDocument.load(pdf)).getPageCount(), 2, 'las 2 páginas del modelo');
  assert.ok(pdf.length > 60000, 'con la imagen del documento');
  if (process.env.CAPTURA) writeFileSync('/tmp/claude-0/cab/autorizacion.pdf', pdf);
  await frame.waitForFunction(() => /otro@ejemplo\.es/.test(document.getElementById('envInfo').textContent));
  const dd = await frame.evaluate(() => window.SoltecAutorizacion.getData());
  assert.equal(dd.env_para, 'otro@ejemplo.es');
  assert.ok(dd.env_fecha);
  ok('En el PC: descarga el PDF de 2 páginas y abre el correo para el destinatario; queda anotado el envío');

  await frame.click('#mCorreo [data-a="x"]');
  await page.click('#volver-autorizacion');
  await page.waitForFunction(() => /enviada por correo a otro@ejemplo\.es/.test(document.getElementById('autorizacion-resumen')?.textContent || ''));
  ok('La ficha del aviso muestra a quién y cuándo se envió');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
