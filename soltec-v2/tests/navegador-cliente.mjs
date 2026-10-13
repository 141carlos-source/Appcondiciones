// Prueba en Chromium móvil: el cliente rellena y firma la ficha en el formulario web y la app
// lee el PDF devuelto (y también el texto del mensaje).
// Uso: node tests/navegador-cliente.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errores = [];
  page.on('pageerror', (e) => errores.push('app: ' + e.message));
  page.on('dialog', (d) => d.accept());
  const base = `http://localhost:${pWeb}/`;

  // Aviso con datos incompletos
  await page.goto(base + 'index.html#/inicio');
  await page.waitForFunction(() => window.soltec?.storage);
  const id = await page.evaluate(async () => {
    await window.soltec.storage.save('config', { empresa: { nombre: 'M. A. SOLTEC SL', nombreComercial: 'M. A. SOLTEC', nif: 'B99506651', telefono: '607335058', email: 'info@soltec.es' }, tecnico: { nombre: 'CARLOS' } }, { id: 'empresa' });
    return (await window.soltec.storage.save('aviso', { numero: '2026-0021', cliente: { nombre: 'ANA GIL', telefono: '600123456' }, suministro: { direccion: 'CALLE MAYOR', numero: '10', cp: '50001', poblacion: 'ZARAGOZA', provincia: 'ZARAGOZA' }, electrico: {}, docs: {} })).id;
  });
  await page.goto(base + 'index.html#/aviso/' + id);
  await page.click('summary:has-text("Solicitudes y comunicaciones")');
  await page.click('#btn-enlace-cliente');
  await page.waitForSelector('#enlace-cliente');
  const enlace = await page.inputValue('#enlace-cliente');
  assert.match(enlace, /^https:\/\/141carlos-source\.github\.io\/Appcondiciones\/soltec-v2\/cliente\.html#/);
  ok('La app prepara el enlace del formulario con los datos dentro');

  // El cliente abre el enlace (en su móvil, otro navegador)
  const ctxCliente = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  const cli = await ctxCliente.newPage();
  cli.setDefaultTimeout(15000);
  cli.on('pageerror', (e) => errores.push('cliente: ' + e.message));
  await cli.goto(base + 'cliente.html' + new URL(enlace).hash);
  await cli.waitForSelector('#c-cliente-nombre');
  assert.equal(await cli.inputValue('#c-cliente-nombre'), 'ANA GIL');
  assert.equal(await cli.inputValue('#c-suministro-numero'), '10');
  assert.ok(await cli.$eval('[data-campo="cliente.nif"]', (e) => e.classList.contains('pend')), 'el DNI que falta sale marcado');
  assert.match(await cli.textContent('main'), /M\. A\. SOLTEC/);
  ok('El cliente ve sus datos ya puestos y lo que falta en rojo');

  await cli.fill('#c-cliente-nif', '12345678z');
  assert.equal(await cli.inputValue('#c-cliente-nif'), '12345678Z');
  await cli.fill('#c-cliente-email', 'Ana@Correo.es');
  await cli.fill('#c-cliente-iban', 'es9121000418450200051332');
  await cli.click('#btn-preparar');
  await cli.waitForSelector('.aviso.err:has-text("Falta la firma")');
  const caja = await cli.$('#firma-cliente');
  await caja.scrollIntoViewIfNeeded();
  const b = await caja.boundingBox();
  await cli.mouse.move(b.x + 20, b.y + 30); await cli.mouse.down();
  for (let i = 1; i <= 12; i++) await cli.mouse.move(b.x + 20 + i * 15, b.y + 30 + (i % 2) * 20);
  await cli.mouse.up();
  await cli.check('#c-acepto');
  await cli.click('#btn-preparar');
  await cli.waitForSelector('#btn-descargar');
  const wa = new URL(await cli.getAttribute('#btn-wa', 'href'));
  assert.equal(wa.pathname, '/34607335058');
  const texto = wa.searchParams.get('text');
  assert.match(texto, /DNI \/ NIF \/ CIF: 12345678Z/);
  assert.match(texto, /SOLTEC-DATOS:[A-Za-z0-9_-]+$/);
  const [desc] = await Promise.all([cli.waitForEvent('download'), cli.click('#btn-descargar')]);
  const pdf = await readFile(await desc.path());
  ok('El cliente completa, firma y obtiene la ficha firmada para enviarla por WhatsApp o correo');

  // De vuelta en la app: leer el PDF devuelto
  await page.click('#btn-leer-devuelta');
  await page.setInputFiles('#ficha-devuelta', { name: desc.suggestedFilename(), mimeType: 'application/pdf', buffer: pdf });
  await page.waitForSelector('#cambios-ficha');
  const t = await page.textContent('#cambios-ficha');
  assert.match(t, /3 dato\(s\) del cliente/);
  assert.match(t, /Firmada por ANA GIL/);
  await page.click('#aplicar-ficha');
  await page.waitForFunction(async (aid) => true, id);
  let a;
  for (let i = 0; i < 30; i++) { a = await page.evaluate(async (aid) => (await window.soltec.storage.get(aid)).data, id); if (a.cliente.nif) break; await page.waitForTimeout(200); }
  assert.equal(a.cliente.nif, '12345678Z');
  assert.equal(a.cliente.email, 'Ana@Correo.es');
  assert.equal(a.cliente.iban, 'ES9121000418450200051332');
  assert.equal(a.docs.firmado, 'recibido');
  assert.ok(a.archivos.some((x) => x.tipo === 'ficha_cliente'));
  ok('La app lee el PDF devuelto: aplica los datos, guarda el PDF y marca la firma como recibida');

  // También vale pegar el texto del mensaje
  await page.evaluate(async (aid) => window.soltec.storage.patch(aid, { cliente: { nombre: 'ANA GIL', telefono: '600123456', nif: '', email: '', iban: '' } }), id);
  await page.goto(base + 'index.html#/aviso/' + id);
  await page.click('summary:has-text("Solicitudes y comunicaciones")');
  await page.click('#btn-leer-devuelta');
  await page.fill('#texto-devuelto', texto);
  await page.click('#leer-texto');
  await page.waitForSelector('#cambios-ficha:has-text("3 dato(s)")');
  ok('Pegando el mensaje de WhatsApp también se leen los datos');

  // Sin abrir nada: el cliente responde al propio mensaje de WhatsApp con sus datos
  await page.evaluate(async (aid) => window.soltec.storage.patch(aid, { cliente: { nombre: 'ANA GIL', telefono: '600123456', nif: '', email: '', iban: '' } }), id);
  await page.goto(base + 'index.html#/inicio');
  await page.goto(base + 'index.html#/aviso/' + id);
  await page.waitForSelector('#btn-whatsapp', { state: 'attached' });
  await page.evaluate(() => { document.querySelector('#btn-whatsapp').closest('details').open = true; });
  await page.click('#btn-whatsapp');
  const msg = await page.inputValue('#texto-whatsapp');
  assert.match(msg, /^DNI \/ NIF \/ CIF: +← falta$/m);
  assert.match(msg, /^CALLE: CALLE MAYOR$/m);
  const respuesta = msg.replace(/^DNI \/ NIF \/ CIF: +← falta$/m, 'DNI / NIF / CIF: 12345678Z')
    .replace(/^CORREO ELECTRÓNICO: +← falta$/m, 'Correo electrónico: ana@correo.es').replace(/^CONFORMIDAD \(escriba SÍ\): $/m, 'CONFORMIDAD (escriba SÍ): Sí');
  await page.click('#btn-leer-devuelta');
  await page.fill('#texto-devuelto', respuesta);
  await page.click('#leer-texto');
  await page.waitForSelector('#cambios-ficha:has-text("2 dato(s)")');
  assert.match(await page.textContent('#cambios-ficha'), /respondido «SÍ»/);
  await page.click('#aplicar-ficha');
  let a2;
  for (let i = 0; i < 30; i++) { a2 = await page.evaluate(async (aid) => (await window.soltec.storage.get(aid)).data, id); if (a2.cliente.nif) break; await page.waitForTimeout(200); }
  assert.equal(a2.cliente.nif, '12345678Z');
  assert.equal(a2.cliente.email, 'ana@correo.es');
  ok('Sin abrir nada: el cliente responde al mensaje con sus datos y la app los aplica');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
