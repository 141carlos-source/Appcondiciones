// Prueba en Chromium móvil: potencia a contratar en el aviso; el formulario web del cliente muestra
// la empresa (logo, NIF, dirección), los datos eléctricos y la información de protección de datos.
// Uso: node tests/navegador-ficha-empresa.mjs
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
  const ctxApp = await browser.newContext({ viewport: { width: 1000, height: 1200 }, acceptDownloads: true });
  await ctxApp.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await ctxApp.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const base = `http://localhost:${pWeb}/`;
  const CAP = process.env.CAPTURAS;
  await page.goto(base + 'index.html#/inicio');
  await page.waitForFunction(() => window.soltec?.storage);
  const id = await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 600; cv.height = 200;
    const cx = cv.getContext('2d'); cx.fillStyle = '#c4161c'; cx.fillRect(0, 0, 600, 200); cx.fillStyle = '#fff'; cx.font = 'bold 90px sans-serif'; cx.fillText('SOLTEC', 40, 135);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const logo = await window.soltec.storage.putFile(new File([blob], 'logo.png', { type: 'image/png' }));
    await window.soltec.storage.save('config', { empresa: { nombre: 'M. A. SOLTEC SL', nombreComercial: 'M. A. SOLTEC', nif: 'B99506651', telefono: '607335058', email: 'info@soltec.es', web: 'www.soltec.es', direccion: 'CALLE EJEMPLO 1', cp: '50171', localidad: 'LA PUEBLA DE ALFINDÉN', provincia: 'ZARAGOZA' }, logo }, { id: 'empresa' });
    return (await window.soltec.storage.save('aviso', { numero: '2026-0031', cliente: { nombre: 'ANA GIL', telefono: '600123456', nif: '12345678Z', email: 'ana@correo.es' }, suministro: { direccion: 'CALLE MAYOR', numero: '10', cp: '50001', poblacion: 'ZARAGOZA', provincia: 'ZARAGOZA' }, electrico: { tension: '230', iga: '40', uso: 'vivienda', potenciaKw: '9,2' }, docs: {} })).id;
  });

  // --- en la app: potencia a contratar
  await page.goto(base + 'index.html#/aviso/' + id);
  await page.click('summary:has-text("Datos eléctricos")');
  assert.equal(await page.inputValue('#f-electrico-potenciaCalculada'), '9,2');
  assert.deepEqual(await page.$$eval('#potencias-normalizadas .chip', (b) => b.map((x) => x.textContent)), ['1,15', '2,3', '3,45', '4,6', '5,75', '6,9', '8,05', '9,2']);
  await page.click('#potencias-normalizadas .chip[data-kw="5,75"]');
  assert.equal(await page.inputValue('#f-electrico-potenciaContratar'), '5,75');
  assert.equal(await page.inputValue('#f-electrico-potenciaKw'), '9,2', 'la CNMC no cambia');
  await page.fill('#f-electrico-potenciaContratar', '10,35');
  assert.match(await page.textContent('#msg-potencia'), /más de lo que admite el IGA/);
  await page.fill('#f-electrico-potenciaContratar', '7');
  assert.equal(await page.textContent('#msg-potencia'), '', 'otro valor (no normalizado) vale');
  await page.selectOption('#f-electrico-tension', '400');
  assert.equal(await page.inputValue('#f-electrico-potenciaCalculada'), '27,71');
  assert.equal((await page.$$eval('#potencias-normalizadas .chip', (b) => b.map((x) => x.textContent))).at(-1), '27,713');
  await page.selectOption('#f-electrico-tension', '230');
  await page.click('#potencias-normalizadas .chip[data-kw="5,75"]');
  await page.click('#btn-guardar, button:has-text("Guardar")');
  let a;
  for (let i = 0; i < 30; i++) { a = await page.evaluate(async (aid) => (await window.soltec.storage.get(aid)).data, id); if (a.electrico.potenciaContratar) break; await page.waitForTimeout(200); }
  assert.equal(a.electrico.potenciaContratar, '5,75');
  ok('Potencia a contratar: botones con las normalizadas hasta la del IGA, otro valor permitido, aviso si pasa del IGA; distinta de la CNMC');

  // --- enlace del formulario
  await page.goto(base + 'index.html#/aviso/' + id);
  await page.click('summary:has-text("Solicitudes y comunicaciones")');
  await page.click('#btn-enlace-cliente');
  await page.waitForSelector('#enlace-cliente', { state: 'attached' });
  const enlace = await page.inputValue('#enlace-cliente');
  assert.ok(enlace.length < 20000, `enlace de ${enlace.length} caracteres`);
  assert.ok(!(await page.isVisible('#enlace-cliente')), 'el enlace largo no se ve');
  const previa = await page.frameLocator('#vista-correo-cliente').locator('body').innerText();
  assert.match(previa, /ABRIR FORMULARIO AQUÍ/);
  assert.equal(await page.inputValue('#para-cliente'), 'ana@correo.es');
  if (CAP) await page.locator('#comunicaciones').screenshot({ path: CAP + '/comunicaciones.png' });
  await page.click('#enlace-correo');
  await page.waitForSelector('#pasos-correo .aviso');
  const html = await page.evaluate(async () => { const [it] = await navigator.clipboard.read(); return (await it.getType('text/html')).text(); });
  assert.match(html, /ABRIR FORMULARIO AQU/);
  assert.ok(html.includes('href="' + enlace.replace(/&/g, '&amp;') + '"'), 'el botón lleva el enlace');
  assert.match(html, /NIF B99506651/);
  assert.match(await page.textContent('#pasos-correo'), /pega/);
  const [eml] = await Promise.all([page.waitForEvent('download'), page.click('#enlace-eml')]);
  const textoEml = (await import('node:fs')).readFileSync(await eml.path(), 'utf8');
  assert.match(textoEml, /X-Unsent: 1/);
  assert.match(textoEml, /To: ana@correo\.es/);
  ok('Correo al cliente con botón «ABRIR FORMULARIO AQUÍ» (copiado para pegar y en borrador para Outlook); el enlace no se ve');

  const cli = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  cli.on('pageerror', (e) => errores.push('cliente: ' + e.message));
  await cli.goto(base + 'cliente.html' + new URL(enlace).hash);
  await cli.waitForSelector('#empresa-cab');
  assert.ok(await cli.$eval('#empresa-logo', (i) => i.complete && i.naturalWidth > 0), 'se ve el logo');
  const cab = await cli.textContent('#empresa-cab');
  for (const x of ['M. A. SOLTEC', 'M. A. SOLTEC SL', 'NIF B99506651', 'CALLE EJEMPLO 1, 50171 LA PUEBLA DE ALFINDÉN, ZARAGOZA', '607335058', 'info@soltec.es', 'www.soltec.es']) assert.ok(cab.includes(x), 'falta ' + x);
  ok('Formulario web: logo, nombre, razón social, NIF, dirección y contacto de la empresa');

  const elec = await cli.textContent('.card:has(h2:has-text("DATOS ELÉCTRICOS"))');
  for (const x of ['230 V (monofásico)', 'Vivienda', '40 A', '9,2']) assert.ok(elec.includes(x), 'falta ' + x);
  assert.equal(await cli.inputValue('#c-electrico-potenciaContratar'), '5,75');
  await cli.click('#c-potencias .chip[data-kw="4,6"]');
  assert.equal(await cli.inputValue('#c-electrico-potenciaContratar'), '4,6');
  ok('Formulario web: tensión, uso, IGA y potencia máxima; el cliente elige la potencia a contratar');

  const rgpd = await cli.textContent('#rgpd');
  for (const x of ['Responsable', 'M. A. SOLTEC SL · NIF B99506651', 'Finalidad', 'Legitimación', 'Destinatarios', 'Conservación', 'Derechos', 'www.aepd.es']) assert.ok(rgpd.includes(x), 'falta ' + x);
  assert.match(await cli.textContent('label.check-linea'), /protección de datos/);
  if (CAP) { await cli.screenshot({ path: CAP + '/cliente-cab.png' }); await cli.screenshot({ path: CAP + '/cliente-todo.png', fullPage: true }); }
  ok('Formulario web: información de protección de datos (RGPD) y casilla que la menciona');

  const caja = await cli.$('#firma-cliente');
  await caja.scrollIntoViewIfNeeded();
  const b = await caja.boundingBox();
  await cli.mouse.move(b.x + 20, b.y + 30); await cli.mouse.down();
  for (let i = 1; i <= 12; i++) await cli.mouse.move(b.x + 20 + i * 15, b.y + 30 + (i % 2) * 20);
  await cli.mouse.up();
  await cli.check('#c-acepto');
  await cli.click('#btn-preparar');
  await cli.waitForSelector('#capa-reenviar #btn-reenviar');
  assert.equal(await cli.textContent('#btn-reenviar'), 'REENVIAR AQUÍ');
  assert.match(await cli.textContent('#capa-reenviar'), /Ficha firmada[\s\S]*M\. A\. SOLTEC/);
  if (CAP) await cli.screenshot({ path: CAP + '/cliente-reenviar.png' });
  ok('Al terminar sale la ventana «REENVIAR AQUÍ»');
  const texto = new URL(await cli.getAttribute('#btn-wa', 'href')).searchParams.get('text');
  assert.match(texto, /Potencia a contratar: 4,6/);

  await page.click('#btn-leer-devuelta');
  await page.fill('#texto-devuelto', texto);
  await page.click('#leer-texto');
  await page.waitForSelector('#cambios-ficha');
  assert.match(await page.textContent('#cambios-ficha'), /Potencia a contratar/);
  ok('La potencia que elige el cliente vuelve a la app');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
