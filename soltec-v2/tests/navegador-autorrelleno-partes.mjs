// Prueba en Chromium móvil: teléfono con +34, autorrelleno en partes de trabajo y en la autorización.
// Uso: node tests/navegador-autorrelleno-partes.mjs
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
  const page = await (await browser.newContext({ viewport: { width: 390, height: 820 }, isMobile: true, hasTouch: true })).newPage();
  page.setDefaultTimeout(10000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  const base = `http://localhost:${pWeb}/index.html`;
  const val = (sel) => page.inputValue(sel);

  await page.goto(base + '#/inicio');
  await page.waitForSelector('#buscador-unico');
  await page.evaluate(async () => {
    const s = window.soltec.storage, { nuevoAviso } = await import('./core/model.js'), { normalizarParte } = await import('./core/partes.js');
    await s.save('aviso', nuevoAviso({ numero: '2026-0101', cliente: { nombre: 'COMUNIDAD SOL', nif: 'H50000000', telefono: '976 333 444', contacto: 'PEDRO', email: '', iban: '' },
      suministro: { direccion: 'CALLE SOL', numero: '2', piso: '', puerta: '', cp: '50171', poblacion: 'LA PUEBLA DE ALFINDÉN', provincia: 'ZARAGOZA', refCatastral: '', lat: '', lon: '', cups: '' },
      autorizacion: { v: 1, actualizado: new Date().toISOString(), datos: { sol_nombre: 'COMUNIDAD SOL', sol_nif: 'H50000000', sol_via: 'C/ SOL 2', sol_municipio: 'LA PUEBLA DE ALFINDÉN', sol_opcion: 'B', ent_nombre: 'PEDRO GIL', ent_cargo: 'PRESIDENTE', ent_nif: '12345678Z', ent_tel: '600111222' } } }));
    await s.save('parte', normalizarParte({ numero: 'P-2026-0001', fecha: '2026-10-01', tecnico: 'JAVIER', cliente: { nombre: 'BAR EL CRUCE', telefono: '+34 976 555 666', direccion: 'AVENIDA ZARAGOZA', numero: '10', cp: '50171', localidad: 'LA PUEBLA DE ALFINDÉN' },
      materiales: [{ ref: 'NZ-2201', desc: 'INTERRUPTOR ZENIT BLANCO', cantidad: '2' }] }));
  });

  // Ficha del aviso: teléfono con +34 al salir del campo
  await page.goto(base + '#/aviso/nuevo');
  await page.waitForSelector('#f-cliente-telefono');
  await page.fill('#f-cliente-telefono', '600123123');
  await page.click('#f-cliente-email');
  assert.equal(await val('#f-cliente-telefono'), '+34 600 123 123');
  ok('Ficha del aviso: 600123123 → «+34 600 123 123» al salir del campo');
  await page.evaluate(() => { window.soltec.guardia = null; });

  // Parte nuevo: cliente de un parte anterior por el nombre, con su dirección
  await page.goto(base + '#/parte/nuevo');
  await page.waitForSelector('#p-cliente');
  await page.click('#p-cliente');
  await page.keyboard.type('cruce');
  await page.waitForSelector('#p-cliente ~ .sugerencias .sugerencia');
  await page.tap('#p-cliente ~ .sugerencias .sugerencia');
  assert.equal(await val('#p-cliente'), 'BAR EL CRUCE');
  assert.equal(await val('#p-telefono'), '+34 976 555 666');
  assert.equal(await val('#p-direccion'), 'AVENIDA ZARAGOZA');
  assert.equal(await val('#p-numero'), '10');
  assert.equal(await val('#p-localidad'), 'LA PUEBLA DE ALFINDÉN');
  ok('Parte: el cliente de otro parte se rellena con su teléfono y dirección');

  // Cliente de un aviso por el teléfono; +34 en el parte
  await page.fill('#p-cliente', ''); await page.fill('#p-telefono', ''); await page.fill('#p-direccion', ''); await page.fill('#p-numero', ''); await page.fill('#p-localidad', ''); await page.fill('#p-cp', '');
  await page.click('#p-telefono');
  await page.keyboard.type('976 33');
  await page.tap('#p-telefono ~ .sugerencias .sugerencia');
  assert.equal(await val('#p-cliente'), 'COMUNIDAD SOL');
  assert.equal(await val('#p-nif'), 'H50000000');
  assert.equal(await val('#p-telefono'), '+34 976 333 444');
  assert.equal(await val('#p-direccion'), 'CALLE SOL');
  ok('Parte: el cliente de un aviso por el teléfono (con +34)');

  // Técnico y materiales
  await page.click('#p-tecnico');
  await page.fill('#p-tecnico', '');
  await page.keyboard.type('jav');
  await page.tap('#p-tecnico ~ .sugerencias .sugerencia');
  assert.equal(await val('#p-tecnico'), 'JAVIER');
  await page.click('button:has-text("Añadir material")');
  await page.click('#p-mat-desc-0');
  await page.keyboard.type('zenit');
  await page.waitForSelector('.material .sugerencia');
  await page.tap('.material .sugerencia');
  assert.equal(await val('#p-mat-ref-0'), 'NZ-2201');
  assert.equal(await val('#p-mat-desc-0'), 'INTERRUPTOR ZENIT BLANCO');
  ok('Parte: técnico y materiales (escribes «zenit» y se ponen referencia y descripción)');
  await page.evaluate(() => { window.soltec.guardia = null; });

  // Autorización de otro aviso: el solicitante (y quien firma por la comunidad) de una autorización anterior
  const id2 = await page.evaluate(async () => (await window.soltec.storage.save('aviso', (await import('./core/model.js')).nuevoAviso({ numero: '2026-0102' }))).id);
  await page.goto(base + '#/aviso/' + id2);
  await page.click('summary:has-text("Autorización de representatividad")');
  await page.click('#abrir-autorizacion');
  const f = page.frameLocator('#iframe-autorizacion');
  await f.locator('#modo').waitFor();
  const frame = page.frame({ url: /autorizacion\.html/ });
  await frame.waitForFunction(() => window.SoltecAutorizacion);
  await page.waitForTimeout(600); // datos de la app (au-cargar)
  await frame.selectOption('#modo', 'frm');
  await frame.click('#fld_sol_nombre');
  await page.keyboard.type('comun');
  await frame.waitForSelector('.sug-auto .sug-op');
  assert.match(await frame.textContent('.sug-auto'), /COMUNIDAD SOL.*H50000000/);
  if (process.env.CAPTURAS) await page.screenshot({ path: join(process.env.CAPTURAS, 'autorrelleno-autorizacion.png') });
  await frame.tap('.sug-auto .sug-op');
  const dd = await frame.evaluate(() => window.SoltecAutorizacion.getData());
  assert.equal(dd.sol_nombre, 'COMUNIDAD SOL');
  assert.equal(dd.sol_nif, 'H50000000');
  assert.equal(dd.sol_via, 'C/ SOL 2');
  assert.equal(dd.ent_nombre, 'PEDRO GIL');
  assert.equal(dd.ent_tel, '+34 600 111 222');
  assert.equal(await frame.inputValue('#fld_sol_nif'), 'H50000000');
  await page.waitForFunction(async (i) => true, id2);
  ok('Autorización: el solicitante de una autorización anterior, con su domicilio y quien firma por la comunidad (+34)');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
