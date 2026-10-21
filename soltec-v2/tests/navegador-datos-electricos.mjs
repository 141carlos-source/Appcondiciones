// Prueba en Chromium: datos eléctricos (IGA desplegable, potencia calculada según tensión, potencia CNMC)
// y orden de las secciones de la ficha del aviso.
// Uso: node tests/navegador-datos-electricos.mjs
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
  page.on('dialog', (d) => d.accept());
  await page.goto(`http://localhost:${pWeb}/index.html#/aviso/nuevo`);
  await page.waitForSelector('#f-cliente-nombre');

  const orden = await page.$$eval('main details > summary', (s) => s.map((x) => x.textContent));
  const pos = (t) => orden.indexOf(t);
  assert.equal(orden[0], 'Plano de situación y fotografías');
  assert.ok(pos('Autorización de representatividad') < pos('Condiciones y trámite'));
  assert.equal(pos('Documentación'), pos('Condiciones y trámite') + 1);
  ok('Orden: plano y fotografías lo primero; condiciones y trámite tras la autorización; documentación después');

  await page.click('summary:has-text("Datos eléctricos")');
  assert.deepEqual((await page.$$eval('#f-electrico-iga option', (o) => o.map((x) => x.textContent))).slice(1), ['25 A', '40 A', '63 A', '80 A', '100 A', '125 A', '250 A']);
  const calc = () => page.inputValue('#f-electrico-potenciaCalculada');
  await page.selectOption('#f-electrico-tension', '230');
  await page.selectOption('#f-electrico-iga', '25');
  assert.equal(await calc(), '5,75');
  await page.selectOption('#f-electrico-iga', '63');
  assert.equal(await calc(), '14,49');
  await page.selectOption('#f-electrico-tension', '400');
  assert.equal(await calc(), '43,65');
  await page.selectOption('#f-electrico-iga', '250');
  assert.equal(await calc(), '173,21');
  assert.ok(await page.$eval('#f-electrico-potenciaCalculada', (e) => e.readOnly));
  ok('IGA desplegable (25-250 A) y potencia calculada sola: 230 V → I·230; 400 V → √3·400·I');

  assert.match(await page.textContent('label[for="f-electrico-potenciaKw"]'), /Potencia CNMC/);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'f-electrico-potenciaKw', 'pregunta la potencia CNMC');
  assert.equal(await page.getAttribute('#f-electrico-potenciaKw', 'placeholder'), '¿Qué potencia va en la CNMC?');
  ok('Pregunta la potencia CNMC (se pone el cursor ahí si está vacía)');

  // Uso: nave → también «Uso de la finca» de la memoria CNMC
  assert.ok((await page.$$eval('#f-electrico-uso option', (o) => o.map((x) => x.textContent))).includes('Nave'));
  await page.selectOption('#f-electrico-uso', 'nave');
  assert.equal(await page.inputValue('#m-uso'), 'NAVE');
  await page.selectOption('#f-electrico-uso', 'vivienda');
  assert.equal(await page.inputValue('#m-uso'), 'VIVIENDA');
  ok('Uso «Nave» y el uso pasa solo a «Uso de la finca» de la memoria');

  // Memoria: apartado G. Naves que suma en el total
  await page.click('summary:has-text("Memoria técnica CNMC")');
  await page.click('summary:has-text("G. Naves")');
  assert.ok(await page.locator('text=NAVE 1').first().isVisible());
  assert.match(await page.locator('#bloque-memoria, details:has(summary:has-text("Memoria técnica CNMC"))').first().innerText(), /A\+B\+C\+D\+G/);
  ok('Memoria CNMC con apartado G. Naves en el total');

  // Obra: nombre por defecto = dirección del suministro
  await page.fill('#f-suministro-direccion', 'CALLE MAYOR');
  await page.fill('#f-suministro-numero', '12');
  await page.click('summary:has-text("Obra, fecha y observaciones")');
  assert.equal(await page.inputValue('#f-obra'), 'CALLE MAYOR 12');
  await page.fill('#f-suministro-piso', '2');
  assert.equal(await page.inputValue('#f-obra'), 'CALLE MAYOR 12, Piso 2');
  await page.fill('#f-obra', 'REFORMA LOCAL');
  await page.fill('#f-suministro-numero', '14');
  assert.equal(await page.inputValue('#f-obra'), 'REFORMA LOCAL', 'si se escribe otro nombre, se respeta');
  assert.ok(await page.inputValue('#f-fecha'));
  ok('Obra: el nombre es la dirección del suministro (se respeta si se escribe otro) y la fecha viene puesta');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
