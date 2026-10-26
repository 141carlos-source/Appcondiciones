// Prueba en Chromium: unifilar en varias hojas cuando no cabe legible en una, papel A4/A3 y PDF.
// Uso: node tests/navegador-unifilar-hojas.mjs   (CAPTURA=1 guarda el PDF en /tmp/claude-0/cab/)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, connect } from 'node:net';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const ok = (t) => console.log('✓ ' + t);
const pWeb = await libre();
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
let browser;
try {
  // Esperar a que el servidor escuche con una conexión TCP simple: fetch() de Node a veces se rompe
  // por dentro («assert(!this.paused)») si el servidor de Python aún está arrancando.
  const escucha = () => new Promise((r) => { const c = connect(pWeb, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); });
  for (let i = 0; i < 50 && !(await escucha()); i++) await new Promise((r) => setTimeout(r, 100));
  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(`http://localhost:${pWeb}/assets/cuadrolab.html`);
  await page.waitForFunction(() => typeof S !== 'undefined' && typeof put === 'function');
  // 3 diferenciales con 10 circuitos cada uno + uno con 20 (30 + 20 circuitos)
  await page.evaluate(() => {
    S.w = 24; S.r = 12; S.dv = []; rd();
    put('SOB', 3, 0, 0); S.dv[0].in = 40;
    const nombres = ['ALUMBRADO', 'TOMAS DE CORRIENTE', 'COCINA', 'LAVADORA', 'TERMO', 'CLIMATIZACIÓN', 'PERSIANA', 'BAÑOS', 'GARAJE', 'JARDÍN'];
    let fila = 1;
    for (const n of [10, 10, 10, 20]) {
      put('ID', 2, fila, 0); const id = S.dv[S.dv.length - 1].id;
      for (let j = 0; j < n; j++) { const c = 2 + (j % 11) * 2, r = fila + Math.floor(j / 11); put('PIA', 2, r, c); const p = S.dv[S.dv.length - 1]; p.dep = id; p.nom = nombres[j % 10]; }
      fila += 2;
    }
    rd();
  });
  await page.click('nav button:has-text("UNIFILAR")');
  const hojas = () => page.locator('#t1 .hoja-uni').count();
  assert.equal(await hojas(), 5, '10 | 10 | 10 | 14 | 6 circuitos');
  const txt = await page.locator('#t1').innerText();
  assert.match(txt, /CONTINÚA EN LA HOJA 2/);
  assert.match(txt, /VIENE DE LA HOJA 1/);
  assert.match(txt, /\(SIGUE DIFERENCIAL 4\)/);
  assert.match(txt, /HOJA 5 DE 5/);
  ok('No cabe legible en una A4: 5 hojas, con «continúa en / viene de» y el diferencial que sigue en la hoja siguiente');

  await page.selectOption('#uni-cph', '0');
  assert.equal(await hojas(), 1);
  ok('«Todos en una hoja» lo junta en una sola');
  await page.selectOption('#uni-cph', '14');
  await page.selectOption('#uni-papel', 'A3');
  assert.match(await page.locator('#pg-uni').textContent(), /size:A3 landscape/);
  ok('Papel A3 horizontal para imprimirlo más grande');

  // PDF real: una página por hoja
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  if (process.env.CAPTURA) writeFileSync('/tmp/claude-0/cab/unifilar-hojas.pdf', pdf);
  const paginas = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  assert.equal(paginas, 5, 'una página A3 por hoja');
  ok('Al imprimir sale una página por hoja');

  // Cuadro pequeño en A4: una sola página
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => { S.dv = S.dv.slice(0, 6); S.p.pp = 'A4'; rd(); });
  await page.click('nav button:has-text("UNIFILAR")');
  assert.equal(await hojas(), 1);
  await page.emulateMedia({ media: 'print' });
  const pdf1 = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  assert.equal((pdf1.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length, 1);
  ok('Cuadro pequeño: una sola hoja A4');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
