// Prueba en Chromium: la ficha que devuelve el cliente rellena el aviso sola (Inicio, Compartir › SOLTEC,
// arrastrar el PDF), se puede deshacer y, si no se sabe de qué aviso es, se elige.
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
  const ids = await page.evaluate(async () => {
    const s = window.soltec.storage;
    await s.save('config', { empresa: { nombre: 'M. A. SOLTEC SL', telefono: '607335058', email: 'info@soltec.es' } }, { id: 'empresa' });
    const av = (numero, nombre) => s.save('aviso', { numero, cliente: { nombre, telefono: '600123456' }, suministro: { direccion: 'CALLE MAYOR', numero: numero.slice(-1), cp: '50001', poblacion: 'ZARAGOZA', provincia: 'ZARAGOZA' }, electrico: {}, docs: {} }).then((r) => r.id);
    return { a: await av('2026-0001', 'ANA GIL'), b: await av('2026-0002', 'LUIS PEREZ') };
  });
  // PDF rellenable de la app para el aviso A, rellenado «a mano» por el cliente
  const fichaRellena = async (id, valores) => page.evaluate(async ({ id, valores }) => {
    const { cargarPdfLib } = await import('./modulos/comunicaciones.js');
    const { generarFicha } = await import('./core/documentos.js');
    const PDFLib = await cargarPdfLib();
    const aviso = { ...(await window.soltec.storage.get(id)).data, id };
    const doc = await PDFLib.PDFDocument.load(await generarFicha(PDFLib, { aviso, empresa: { empresa: { nombre: 'SOLTEC' } } }));
    for (const [k, v] of Object.entries(valores)) doc.getForm().getTextField(k).setText(v);
    return Array.from(await doc.save());
  }, { id, valores });
  const datos = (id) => page.evaluate(async (id) => (await window.soltec.storage.get(id)).data, id);
  const pdfA = Buffer.from(await fichaRellena(ids.a, { cliente__nif: '12345678Z', cliente__email: 'ana@correo.es', cliente__iban: 'ES00 MAL' }));

  // 1. Desde Inicio, sin abrir el aviso
  await page.click('#acceso-recibir');
  await page.waitForSelector('#panel-recibir');
  await page.setInputFiles('#ficha-devuelta', { name: 'FICHA_CLIENTE.pdf', mimeType: 'application/pdf', buffer: pdfA });
  await page.waitForSelector('#cambios-ficha');
  const t = await page.textContent('#cambios-ficha');
  assert.match(t, /Aviso 2026-0001 actualizado/);
  assert.match(t, /2 dato\(s\) del cliente aplicados/);
  assert.match(await page.textContent('#revisar-ficha'), /IBAN.*ES00 MAL/);
  let a = await datos(ids.a);
  assert.equal(a.cliente.nif, '12345678Z');
  assert.equal(a.cliente.email, 'ana@correo.es');
  assert.equal(a.cliente.iban, '', 'lo mal escrito no se aplica');
  assert.ok(a.archivos.some((x) => x.tipo === 'ficha_cliente'), 'PDF guardado en el aviso');
  const evs = await page.evaluate(async (id) => (await window.soltec.storage.listByRef(id, 'evento')).map((e) => e.data.text).join(' | '), ids.a);
  assert.match(evs, /Ficha del cliente recibida: 2 dato\(s\) aplicados/);
  ok('Desde Inicio: la ficha encuentra su aviso sola, aplica lo correcto, deja para revisar lo mal escrito y guarda el PDF');

  await page.click('#deshacer-ficha');
  await page.waitForSelector('#cambios-ficha:has-text("Recepción deshecha")');
  a = await datos(ids.a);
  assert.equal(a.cliente.nif, '');
  assert.ok(!a.archivos.some((x) => x.tipo === 'ficha_cliente'));
  ok('Deshacer deja el aviso como estaba');

  // 2. Compartir › SOLTEC V2 (share target): hace falta el service worker
  await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 15000 }).catch(async () => { await page.reload(); await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 15000 }); });
  await page.evaluate(async (bytes) => {
    const fd = new FormData();
    fd.append('ficha', new File([new Uint8Array(bytes)], 'FICHA_FIRMADA.pdf', { type: 'application/pdf' }));
    fd.append('text', 'Le envío la ficha');
    await fetch('./recibir-ficha', { method: 'POST', body: fd });
  }, Array.from(pdfA));
  await page.goto(base + 'index.html#/inicio');
  await page.goto(base + 'index.html#/recibir');
  await page.waitForSelector('#cambios-ficha:has-text("2026-0001")');
  assert.equal((await datos(ids.a)).cliente.nif, '12345678Z');
  ok('«Compartir › SOLTEC V2» desde WhatsApp o el correo: la app se abre y rellena el aviso');

  // 3. Arrastrar el PDF a la app (PC), estando en otro aviso
  const pdfB = Buffer.from(await fichaRellena(ids.b, { cliente__nif: '87654321X' }));
  const soltar = async (bytes, nombre) => page.evaluate(async ({ bytes, nombre }) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(bytes)], nombre, { type: 'application/pdf' }));
    document.querySelector('main').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, { bytes: Array.from(bytes), nombre });
  await page.goto(base + 'index.html#/aviso/' + ids.a);
  await page.waitForSelector('#f-cliente-nombre', { state: 'attached' });
  const otroPdf = await page.evaluate(async () => { const { cargarPdfLib } = await import('./modulos/comunicaciones.js'); const P = await cargarPdfLib(); const d = await P.PDFDocument.create(); d.addPage(); return Array.from(await d.save()); });
  await soltar(otroPdf, 'CONDICIONES.pdf');
  await page.waitForSelector('.toast:has-text("no es una ficha")');
  assert.match(page.url(), /#\/aviso\//, 'un PDF que no es ficha no hace nada');
  await soltar(pdfB, 'FICHA_B.pdf');
  await page.waitForSelector('#cambios-ficha:has-text("2026-0002")');
  assert.equal((await datos(ids.b)).cliente.nif, '87654321X');
  ok('Arrastrar el PDF a la app: va a su aviso (aunque estés en otro); otro PDF no hace nada');

  // 4. No se sabe de qué aviso es: se elige
  const linea = await page.evaluate(async () => (await import('./core/fichaCliente.js')).lineaDatos({ v: 1, id: 'de-otro-movil', d: { 'cliente.nombre': 'LUIS PEREZ', 'cliente.email': 'luis@correo.es' } }));
  await page.goto(base + 'index.html#/recibir');
  await page.fill('#texto-devuelto', 'Hola\n' + linea);
  await page.click('#leer-texto');
  await page.waitForSelector('#ficha-sin-aviso');
  await page.waitForSelector(`[data-elegir="${ids.b}"]`);
  await page.click(`[data-elegir="${ids.b}"]`);
  await page.waitForSelector('#cambios-ficha:has-text("2026-0002")');
  assert.equal((await datos(ids.b)).cliente.email, 'luis@correo.es');
  ok('Si no se sabe de qué aviso es, se busca y se elige, y se rellena');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
