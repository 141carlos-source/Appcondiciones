// Prueba en Chromium móvil: empresa (importada de la V1.35), ficha PDF, WhatsApp, firma y correos.
// Uso: node tests/navegador-documentos.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

globalThis.self ??= globalThis;
const _r = createRequire(import.meta.url)('../vendor/pdf-lib.min.js');
const PDFLib = _r?.PDFDocument ? _r : globalThis.PDFLib;
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const pWeb = await libre();
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
const ok = (t) => console.log('✓ ' + t);
let browser;

try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${pWeb}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  const base = `http://localhost:${pWeb}/index.html`;

  // Datos de la V1.35 en el mismo navegador (misma web)
  await page.goto(base + '#/inicio');
  await page.waitForFunction(() => window.soltec?.storage);
  await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 300; cv.height = 90;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 90); g.fillStyle = '#c4161c'; g.fillRect(10, 10, 20, 70); g.fillStyle = '#1e2226'; g.font = 'bold 40px Arial'; g.fillText('SOLTEC', 45, 62);
    localStorage.setItem('APP_AVISOS_WEB_DATOS_V116_PERSISTENTE', JSON.stringify({ empresa: { nombre: 'M. A. SOLTEC SL', nombreComercial: 'M. A. SOLTEC', nif: 'B99506651', telefono: '34607335058', email: '141carlos@gmail.com', web: 'WWW.SOLTECINSTALACIONES.COM', direccion: 'GERANIO 66', cp: '50171', localidad: 'LA PUEBLA DE ALFINDEN', logoData: cv.toDataURL('image/png') }, tecnico: { nombre: 'Carlos' } }));
    localStorage.setItem('APP_AVISOS_CONFIG_V127', JSON.stringify({ emails: { nuevosSuministros: 'nuevos@distribuidora.es', comercializadora: 'altas@comercializadora.es' } }));
  });

  await page.goto(base + '#/ajustes');
  await page.click('text=Empresa');
  await page.click('#importar-v1');
  await page.waitForSelector('#img-logo');
  assert.equal(await page.inputValue('#e-empresa-nombre'), 'M. A. SOLTEC SL');
  assert.equal(await page.inputValue('#e-empresa-provincia'), '');
  assert.equal(await page.inputValue('#e-correos-nuevosSuministros'), 'nuevos@distribuidora.es');
  await page.click('#guardar-empresa');
  await page.waitForSelector('h1:has-text("Ajustes")');
  const v1Intacta = await page.evaluate(() => JSON.parse(localStorage.getItem('APP_AVISOS_WEB_DATOS_V116_PERSISTENTE')).empresa.nombre);
  assert.equal(v1Intacta, 'M. A. SOLTEC SL');
  ok('Empresa copiada de la V1.35 con logo y correos, sin tocar la V1.35');

  // Aviso de prueba
  const id = await page.evaluate(async () => (await window.soltec.storage.save('aviso', {
    numero: '2026-0001', tramite: 'datos',
    cliente: { nombre: 'María Pérez Núñez', nif: '12345678Z', telefono: '600123456', email: 'maria@ejemplo.es' },
    suministro: { direccion: 'Calle Ramón y Cajal 12', piso: '3', puerta: 'B', cp: '44001', poblacion: 'Teruel', provincia: 'Teruel' },
    electrico: { potenciaKw: '5,75', tension: '230' }, docs: {},
  }, { event: { kind: 'creado' } })).id);

  // Ficha PDF
  await page.goto(base + '#/aviso/' + id);
  await page.click('summary:has-text("Solicitudes y comunicaciones")');
  await page.click('#btn-ficha-pdf');
  await page.waitForSelector('text=Ficha preparada.');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.aviso.ok >> text=Descargar')]);
  assert.equal(dl.suggestedFilename(), 'FICHA_CLIENTE_CALLE_RAMON_Y_CAJAL_12_PISO_3_PUERTA_B.pdf');
  const doc = await PDFLib.PDFDocument.load(readFileSync(await dl.path()));
  const vals = doc.getForm().getFields().map((f) => f.getText?.());
  assert.ok(vals.includes('María Pérez Núñez') && vals.includes('12345678Z'));
  ok('Ficha PDF rellenable generada en el móvil con los datos del aviso y el logo');

  // WhatsApp
  await page.click('#btn-whatsapp');
  const texto = await page.inputValue('#texto-whatsapp');
  assert.match(texto, /le escribimos de M\. A\. SOLTEC/);
  assert.match(texto, /• IBAN/);
  let urlWa = '';
  await ctx.route('https://wa.me/**', (r) => { urlWa = r.request().url(); r.fulfill({ status: 200, body: 'WhatsApp' }); });
  const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('text=Abrir WhatsApp')]);
  await pop.waitForLoadState();
  assert.match(urlWa, /^https:\/\/wa\.me\/34600123456\?text=Hola%20Mar%C3%ADa/);
  await pop.close();
  await page.click('text=Sí, marcar como enviado');
  await page.waitForSelector('text=Anotado como enviado en el historial.');
  ok('Resumen de WhatsApp editable; abrir WhatsApp y «enviado» quedan separados en el historial');

  // Correo de solicitud con revisión previa de datos
  await page.click('text=Correo: solicitar contrato de electricidad');
  await page.waitForSelector('text=Continuar con el borrador');
  assert.match(await page.textContent('.aviso.info'), /IBAN/);
  await page.click('text=Continuar con el borrador');
  await page.waitForSelector('text=Adjunta el PDF antes de enviarlo');
  ok('Correo de contrato: avisa de los datos que faltan y recuerda adjuntar el PDF');

  // Firma con el dedo
  await page.goto(base + '#/firma/' + id);
  const caja = await (await page.waitForSelector('#lienzo-firma')).boundingBox();
  await page.mouse.move(caja.x + 30, caja.y + 120);
  await page.mouse.down();
  for (let i = 0; i < 25; i++) await page.mouse.move(caja.x + 30 + i * 10, caja.y + 120 - Math.sin(i / 3) * 40);
  await page.mouse.up();
  await page.click('#generar-firmada');
  await page.waitForSelector('text=Ficha firmada:');
  await page.click('#guardar-firmada');
  await page.waitForSelector('text=Guardada en el aviso');
  await page.screenshot({ path: join(raiz, 'tests/captura-firma.png') });
  const info = await page.evaluate(async (aid) => {
    const r = await window.soltec.storage.get(aid);
    const h = (await window.soltec.storage.history(aid)).map((e) => e.data.kind);
    return { archivos: r.data.archivos.length, firmado: r.data.docs.firmado, h };
  }, id);
  assert.equal(info.archivos, 1);
  assert.notEqual(info.firmado, 'recibido', 'firmar no marca la firma como recibida');
  for (const k of ['formulario', 'doc_preparada', 'doc_enviada', 'firma_pdf']) assert.ok(info.h.includes(k), k);
  await page.goto(base + '#/aviso/' + id);
  await page.click('summary:has-text("Documentación")');
  await page.waitForSelector('text=FICHA_CLIENTE_CALLE_RAMON_Y_CAJAL_12_PISO_3_PUERTA_B_FIRMADA.pdf');
  ok('Firma con el dedo: ficha firmada, copia guardada en el aviso y todo anotado en el historial');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
