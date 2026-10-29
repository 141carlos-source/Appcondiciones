// Prueba en Chromium: boletín y condiciones en el aviso (¿los lleva?, guardar los PDF) y el correo de
// contrato con el boletín y las condiciones adjuntos.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const ok = (t) => console.log('✓ ' + t);
const pWeb = await libre();
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${pWeb}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 1200 } })).newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const base = `http://localhost:${pWeb}/`;
  await page.goto(base + 'index.html#/inicio');
  await page.waitForFunction(() => window.soltec?.storage);
  const id = await page.evaluate(async () => (await window.soltec.storage.save('aviso', { numero: '2026-0050', cliente: { nombre: 'ANA GIL', nif: '12345678Z' }, suministro: { direccion: 'CALLE MAYOR', numero: '1', cp: '50001', poblacion: 'ZARAGOZA', provincia: 'ZARAGOZA', cups: 'ES0031408137891001FE0F' }, electrico: {}, docs: {} })).id);
  const pdf = await page.evaluate(async () => { const { cargarPdfLib } = await import('./modulos/comunicaciones.js'); const P = await cargarPdfLib(); const d = await P.PDFDocument.create(); d.addPage(); return Array.from(await d.save()); });
  const buffer = Buffer.from(pdf);
  await page.goto(base + 'index.html#/aviso/' + id);
  await page.waitForSelector('#f-cliente-nombre', { state: 'attached' });
  const orden = await page.$$eval('main details > summary', (s) => s.map((x) => x.textContent));
  assert.deepEqual(orden.slice(0, 3), ['Cliente y suministro', 'Plano de situación y fotografías', 'Solicitudes y comunicaciones']);
  ok('Orden: cliente y suministro, plano y fotografías, solicitudes y comunicaciones');

  await page.click('summary:has-text("Cliente y suministro")');
  await page.selectOption('#lleva-condiciones', 'no');
  assert.equal(await page.inputValue('#doc-condiciones'), 'na');
  await page.selectOption('#lleva-condiciones', 'si');
  assert.equal(await page.inputValue('#doc-condiciones'), 'pendiente');
  // Sin boletín: CUPS y catastro fuera de pendientes; memoria, autorización y condiciones bloqueadas
  await page.fill('#f-suministro-cups', '');
  await page.selectOption('#lleva-boletin', 'no');
  const pendientes = async () => page.$$eval('.campo.pend[data-campo]', (c) => c.map((x) => x.dataset.campo));
  assert.ok(!(await pendientes()).includes('suministro.cups') && !(await pendientes()).includes('suministro.refCatastral'));
  for (const k of ['memoria', 'autorizacion', 'condiciones']) {
    const d = page.locator(`details[data-apartado="${k}"]`);
    assert.match(await d.getAttribute('class'), /inhabil/);
    await d.locator(':scope > summary').click();
    assert.equal(await d.evaluate((x) => x.open), false, k + ' no se abre');
  }
  assert.match(await page.textContent('details[data-apartado="memoria"] > summary'), /No aplica \(no lleva boletín\)/);
  await page.selectOption('#lleva-boletin', 'si');
  assert.ok((await pendientes()).includes('suministro.cups'), 'con boletín vuelve a pedir el CUPS');
  assert.doesNotMatch(await page.getAttribute('details[data-apartado="memoria"]', 'class'), /inhabil/);
  await page.fill('#f-suministro-cups', 'ES0031408137891001FE0F');
  ok('Sin boletín: CUPS y referencia catastral no salen en pendientes; memoria, autorización y condiciones bloqueadas');
  ok('Cliente: «Boletín ¿lo lleva?» y «Condiciones ¿las lleva?» (No = el documento no aplica)');

  await page.click('summary:has-text("Documentación")');
  await page.setInputFiles('#subir-boletin', { name: 'BOLETIN_CIE.pdf', mimeType: 'application/pdf', buffer });
  await page.waitForSelector('#lista-boletin:has-text("BOLETIN_CIE.pdf")');
  assert.equal(await page.inputValue('#doc-boletin'), 'recibido');
  const pdf2 = Buffer.concat([buffer, Buffer.from('\n% condiciones')]);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#btn-subir-condiciones')]);
  await chooser.setFiles({ name: 'CONDICIONES.pdf', mimeType: 'application/pdf', buffer: pdf2 });
  await page.waitForFunction(() => document.querySelector('#doc-condiciones').value === 'recibido');
  await page.click('#guardar');
  let a;
  for (let i = 0; i < 30; i++) { a = await page.evaluate(async (aid) => (await window.soltec.storage.get(aid)).data, id); if (a.archivos?.some((x) => x.tipo === 'boletin') && a.condiciones?.pdfs?.length) break; await page.waitForTimeout(200); }
  assert.equal(a.lleva.boletin, 'si');
  assert.equal(a.lleva.condiciones, 'si');
  assert.equal(a.docs.boletin, 'recibido');
  assert.equal(a.docs.condiciones, 'recibido');
  assert.ok(a.archivos.some((x) => x.tipo === 'boletin' && x.name === 'BOLETIN_CIE.pdf'));
  assert.equal(a.condiciones.pdfs.length, 1);
  ok('En el aviso se guardan el boletín y las condiciones (PDF) y quedan «Recibido»');

  await page.goto(base + 'index.html#/aviso/' + id);
  await page.click('summary:has-text("Solicitudes y comunicaciones")');
  await page.click('#btn-correo-contrato');
  await page.waitForSelector('#correo-adjuntos');
  const marcados = await page.$$eval('#correo-adjuntos li', (li) => li.filter((l) => l.querySelector('input').checked).map((l) => l.textContent));
  assert.ok(marcados.some((t) => t.includes('BOLETIN_CIE.pdf')), 'boletín adjunto');
  assert.ok(marcados.some((t) => t.includes('CONDICIONES.pdf')), 'condiciones adjuntas');
  ok('Correo de contrato: el boletín y las condiciones van adjuntos');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
