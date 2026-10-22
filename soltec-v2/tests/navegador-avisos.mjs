// Prueba en Chromium móvil del circuito de avisos y expedientes.
// Uso: node tests/navegador-avisos.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const pWeb = await libre();
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
const ok = (t) => console.log('✓ ' + t);
const foto = (p, n) => p.screenshot({ path: join(raiz, `tests/captura-${n}.png`), fullPage: false });
let browser;

try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${pWeb}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  let respuesta = 'aceptar';
  page.on('dialog', (d) => (respuesta === 'aceptar' ? d.accept() : d.dismiss()));
  const base = `http://localhost:${pWeb}/index.html`;

  await page.goto(base + '#/avisos');
  await page.waitForSelector('text=Todavía no hay avisos.');
  await page.click('text=+ Nuevo aviso');
  await page.waitForSelector('#f-cliente-nombre');
  assert.ok(await page.$eval('.campo[data-campo="cliente.nombre"]', (e) => e.classList.contains('pend')));
  ok('Nuevo aviso: los datos que faltan salen en rojo claro');

  await page.fill('#f-cliente-nombre', 'María Pérez Gómez');
  await page.fill('#f-cliente-nif', '12345678z');
  assert.equal(await page.inputValue('#f-cliente-nif'), '12345678Z');
  await page.fill('#f-cliente-telefono', '600 123 456');
  await page.fill('#f-suministro-cp', '44001');
  assert.equal(await page.inputValue('#f-suministro-provincia'), 'TERUEL');
  ok('El código postal rellena la provincia');
  assert.equal(await page.inputValue('#f-cliente-nombre'), 'MARÍA PÉREZ GÓMEZ');
  await page.fill('#f-cliente-email', 'Maria@Ejemplo.es');
  assert.equal(await page.inputValue('#f-cliente-email'), 'Maria@Ejemplo.es');
  await page.click('#f-cliente-contacto');
  await page.keyboard.type('ana');
  // En táctil se ve en mayúsculas al escribir y se guarda así al salir del campo
  assert.equal(await page.$eval('#f-cliente-contacto', (e) => getComputedStyle(e).textTransform), 'uppercase');
  await page.locator('#f-cliente-contacto').blur();
  assert.equal(await page.inputValue('#f-cliente-contacto'), 'ANA');
  await page.fill('#f-cliente-contacto', '');
  ok('Todo se escribe en MAYÚSCULAS salvo el correo');
  await page.fill('#f-suministro-poblacion', 'Teruel');
  await page.fill('#f-cliente-email', 'maria@ejemplo.es');
  await page.fill('#f-suministro-direccion', 'Calle Mayor 1');
  await page.fill('#f-suministro-piso', '2');
  await page.fill('#f-suministro-puerta', 'B');
  assert.equal(await page.$eval('.campo[data-campo="cliente.nombre"]', (e) => e.classList.contains('pend')), false);
  ok('Al rellenar un dato, el rojo desaparece; DNI, CUPS e IBAN en mayúsculas');
  await foto(page, 'ficha-nueva');
  await page.click('#guardar');
  await page.waitForSelector('h1:has-text("Aviso 2026-0001")');
  const id1 = page.url().split('/').pop();
  ok('Aviso guardado con número 2026-0001 aunque esté incompleto');

  // Duplicado por dirección
  await page.goto(base + '#/aviso/nuevo');
  await page.waitForSelector('#f-suministro-direccion');
  await page.fill('#f-cliente-nombre', 'Otro cliente');
  await page.fill('#f-suministro-direccion', 'C/ Mayor, 1');
  await page.fill('#f-suministro-piso', '2');
  await page.fill('#f-suministro-puerta', 'b');
  await page.fill('#f-suministro-cp', '44001');
  await page.waitForSelector('text=Posible duplicado:');
  ok('Aviso de posible duplicado por la misma dirección, piso y puerta');
  await page.click('#guardar'); // el diálogo de confirmación se acepta
  await page.waitForSelector('h1:has-text("Aviso 2026-0002")');
  const id2 = page.url().split('/').pop();
  ok('Se puede crear igualmente tras confirmar que es otra actuación');

  // Condiciones, trámite, documentación y PDF → pasa a Expedientes
  await page.goto(base + '#/aviso/' + id1);
  await page.waitForSelector('#f-condiciones-ref', { state: 'attached' });
  await page.click('summary:has-text("Condiciones y trámite")');
  await page.fill('#f-condiciones-ref', '0000412345');
  await page.selectOption('#f-tramite', 'presentado');
  const pdf = join(tmpdir(), 'CONDICIONES_PRUEBA.pdf');
  writeFileSync(pdf, '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
  await page.setInputFiles('input[type=file][accept^="application/pdf"]', pdf);
  await page.waitForSelector('text=CONDICIONES_PRUEBA.pdf');
  await page.click('summary:has-text("Documentación")');
  await page.selectOption('#doc-contrato', 'pendiente');
  await page.click('#guardar');
  await page.waitForSelector('text=Guardado');
  await page.click('summary:has-text("Historial")');
  const hist = await page.$$eval('details:has(summary:has-text("Historial")) li b', (bs) => bs.map((b) => b.textContent));
  for (const k of ['Aviso creado', 'Cambio de estado del trámite', 'Cambio en documentación', 'PDF de condiciones añadido']) assert.ok(hist.includes(k), `${k} en ${hist}`);
  ok('El historial registra creación, trámite, documentación y PDF');
  await page.selectOption('#mov-tipo', 'cliente_informado');
  await page.fill('#mov-texto', 'Llamado por teléfono');
  await page.click('text=Añadir al historial');
  await page.waitForSelector('text=Llamado por teléfono');
  ok('Movimiento manual añadido al historial');

  await page.goto(base + '#/avisos');
  await page.waitForSelector('.lista .tarjeta');
  const enAvisos = await page.$$eval('.lista .tarjeta .mono', (s) => s.map((x) => x.textContent));
  assert.deepEqual(enAvisos, ['2026-0002']);
  await page.goto(base + '#/expedientes');
  await page.waitForSelector('.tarjeta.exp');
  assert.match(await page.textContent('.tarjeta.exp'), /0000412345/);
  assert.ok(await page.$eval('.logo-edist', (i) => i.complete && i.naturalWidth > 0));
  ok('Con referencia pasa de Avisos a Expedientes (con logo de e-distribución)');
  await foto(page, 'expedientes');

  // Inicio: buscador único y «Qué toca hoy»
  await page.goto(base + '#/inicio');
  await page.fill('#buscador-unico', 'MAYOR');
  await page.waitForSelector('.lista .tarjeta >> nth=1');
  assert.equal(await page.$$eval('#buscador-unico + .lista .tarjeta', (t) => t.length), 2);
  await page.fill('#buscador-unico', '600123456');
  await page.waitForFunction(() => document.querySelectorAll('#buscador-unico + .lista .tarjeta').length === 1);
  ok('Buscador único: por dirección sin acentos ni mayúsculas, y por teléfono');
  await page.fill('#buscador-unico', '');
  const bandejaTxt = await page.textContent('main');
  assert.match(bandejaTxt, /Documentación pendiente: Contrato/);
  await foto(page, 'inicio-bandeja');
  await page.click('text=Completar datos >> nth=0');
  await page.waitForFunction(() => document.activeElement?.closest('.campo.pend'));
  ok('«Qué toca hoy» lista los pendientes y «Completar datos» lleva al campo');

  // Papelera y recuperación
  await page.goto(base + '#/aviso/' + id2);
  await page.click('text=Enviar a la papelera');
  await page.waitForSelector('h1:has-text("Avisos")');
  assert.match(await page.textContent('main'), /Todavía no hay avisos/);
  await page.goto(base + '#/avisos?ver=papelera');
  await page.waitForSelector('.tarjeta');
  await page.click('.tarjeta');
  await page.click('text=Recuperar');
  await page.waitForSelector('text=Enviar a la papelera');
  await page.goto(base + '#/avisos');
  await page.waitForSelector('.lista .tarjeta');
  ok('Papelera: el aviso se oculta y se recupera sin perder datos');

  // Salir con cambios sin guardar: pregunta, y si cancelas sigues en la ficha con tus cambios
  await page.goto(base + '#/aviso/' + id1);
  await page.waitForSelector('#f-cliente-contacto', { state: 'attached' });
  await page.click('summary:has-text("Cliente y suministro")');
  await page.fill('#f-cliente-contacto', 'Juan (hijo)');
  respuesta = 'cancelar';
  await page.click('nav.inferior a[data-ruta=inicio]');
  await page.waitForTimeout(300);
  assert.match(page.url(), /#\/aviso\//);
  assert.equal(await page.inputValue('#f-cliente-contacto'), 'JUAN (HIJO)');
  respuesta = 'aceptar';
  await page.click('nav.inferior a[data-ruta=inicio]');
  await page.waitForSelector('#buscador-unico');
  ok('Salir de una ficha con cambios sin guardar pide confirmación');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
