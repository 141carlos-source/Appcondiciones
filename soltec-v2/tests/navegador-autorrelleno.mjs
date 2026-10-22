// Prueba en Chromium móvil: autorrelleno de la ficha del aviso con clientes, suministros y valores ya usados.
// Uso: node tests/navegador-autorrelleno.mjs
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

  // Un aviso ya trabajado
  await page.goto(base + '#/aviso/nuevo');
  await page.waitForSelector('#f-cliente-nombre');
  await page.evaluate(async () => {
    await window.soltec.storage.save('aviso', {
      ...(await import('./core/model.js')).nuevoAviso({ numero: '2025-0007', concepto: 'Nuevo suministro',
        cliente: { nombre: 'TALLERES EBRO SL', contacto: 'PILAR', nif: 'B12345674', telefono: '976111222', email: 'admin@ebro.es', iban: 'ES9121000418450200051332' },
        suministro: { direccion: 'CALLE MAYOR', numero: '1', piso: '', puerta: '', cp: '50171', poblacion: 'LA PUEBLA DE ALFINDÉN', provincia: 'ZARAGOZA', refCatastral: '', lat: '', lon: '', cups: 'ES0031405000000001AA' },
        electrico: { tension: '400', iga: '63', potenciaCalculada: '43,65', potenciaKw: '43,65', uso: 'nave' } }),
    });
  });
  await page.reload();
  await page.waitForSelector('#f-cliente-nombre');

  // Cliente: escribir parte del nombre y elegir
  await page.click('#f-cliente-nombre');
  await page.keyboard.type('tall');
  await page.waitForSelector('[data-campo="cliente.nombre"] .sugerencia');
  assert.match(await page.textContent('[data-campo="cliente.nombre"] .sugerencias'), /TALLERES EBRO SL.*B12345674.*1 aviso/);
  if (process.env.CAPTURAS) await page.screenshot({ path: join(process.env.CAPTURAS, 'autorrelleno-cliente.png') });
  await page.tap('[data-campo="cliente.nombre"] .sugerencia');
  assert.equal(await val('#f-cliente-nombre'), 'TALLERES EBRO SL');
  assert.equal(await val('#f-cliente-nif'), 'B12345674');
  assert.equal(await val('#f-cliente-telefono'), '976111222');
  assert.equal(await val('#f-cliente-email'), 'admin@ebro.es');
  assert.equal(await val('#f-cliente-contacto'), 'PILAR');
  assert.equal(await val('#f-cliente-iban'), 'ES9121000418450200051332');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'f-cliente-nombre', 'el teclado no se cierra');
  ok('Cliente: escribes «tall», eliges y se rellenan NIF, teléfono, correo, contacto e IBAN');

  // Suministro del cliente con un toque
  await page.waitForSelector('#sum-cliente button');
  assert.match(await page.textContent('#sum-cliente'), /CALLE MAYOR 1 · LA PUEBLA DE ALFINDÉN/);
  await page.tap('#sum-cliente button');
  assert.equal(await val('#f-suministro-direccion'), 'CALLE MAYOR');
  assert.equal(await val('#f-suministro-numero'), '1');
  assert.equal(await val('#f-suministro-cp'), '50171');
  assert.equal(await val('#f-suministro-cups'), 'ES0031405000000001AA');
  assert.equal(await val('#f-electrico-iga'), '63');
  assert.equal(await val('#f-electrico-tension'), '400');
  assert.equal(await page.locator('#sum-cliente button').count(), 0);
  ok('Suministro del cliente con un toque: dirección, CP, CUPS y datos eléctricos (IGA, tensión)');

  // Otro aviso: buscar por teléfono; población → CP y provincia
  await page.evaluate(() => { window.soltec.guardia = null; }); // se descarta el aviso de prueba sin preguntar
  await page.goto(base + '#/avisos');
  await page.goto(base + '#/aviso/nuevo');
  await page.waitForSelector('#f-cliente-telefono');
  await page.click('#f-cliente-telefono');
  await page.keyboard.type('976 11');
  await page.tap('[data-campo="cliente.telefono"] .sugerencia');
  assert.equal(await val('#f-cliente-nombre'), 'TALLERES EBRO SL');
  await page.click('#f-suministro-poblacion');
  await page.keyboard.type('pueb');
  await page.waitForSelector('[data-campo="suministro.poblacion"] .sugerencia');
  await page.tap('[data-campo="suministro.poblacion"] .sugerencia');
  assert.equal(await val('#f-suministro-poblacion'), 'LA PUEBLA DE ALFINDÉN');
  assert.equal(await val('#f-suministro-cp'), '50171');
  assert.equal(await val('#f-suministro-provincia'), 'ZARAGOZA');
  ok('Por teléfono también; y la población rellena el CP y la provincia de otras veces');

  // Calle de otro cliente (por la dirección) y concepto ya usado
  await page.evaluate(() => { window.soltec.guardia = null; }); // se descarta el aviso de prueba sin preguntar
  await page.goto(base + '#/avisos');
  await page.goto(base + '#/aviso/nuevo');
  await page.waitForSelector('#f-suministro-direccion');
  await page.click('#f-suministro-direccion');
  await page.keyboard.type('mayor');
  await page.waitForSelector('[data-campo="suministro.direccion"] .sugerencia');
  assert.match(await page.textContent('[data-campo="suministro.direccion"] .sugerencias'), /TALLERES EBRO SL/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-campo="suministro.direccion"] .sugerencias:not([hidden])').count(), 0, 'Esc cierra la lista');
  assert.equal(await val('#f-suministro-numero'), '', 'sin elegir no cambia nada');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.type(' ');
  await page.keyboard.press('Backspace');
  await page.waitForSelector('[data-campo="suministro.direccion"] .sugerencia');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  assert.equal(await val('#f-suministro-numero'), '1');
  ok('Por la calle: propone el suministro (con su cliente); Esc cierra, flechas + Intro eligen');

  await page.click('summary:has-text("Obra, fecha y observaciones")');
  await page.click('#f-concepto');
  await page.keyboard.type('nue');
  await page.tap('[data-campo="concepto"] .sugerencia');
  assert.equal(await val('#f-concepto'), 'Nuevo suministro');
  ok('Concepto (y demás campos) con lo ya escrito otras veces');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
