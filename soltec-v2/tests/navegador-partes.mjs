// Prueba en Chromium móvil de los partes de trabajo.
// Uso: node tests/navegador-partes.mjs
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
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
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  const base = `http://localhost:${pWeb}/index.html`;

  await page.goto(base + '#/inicio');
  await page.waitForFunction(() => window.soltec?.storage);
  const id = await page.evaluate(async () => {
    const s = window.soltec.storage;
    await s.save('config', { empresa: { nombre: 'M. A. SOLTEC SL' }, tecnico: { nombre: 'Carlos' } }, { id: 'empresa' });
    return (await s.save('aviso', { numero: '2026-0001', cliente: { nombre: 'Ana Gil', telefono: '600123456' }, suministro: { direccion: 'Calle Sol 3', piso: '1', puerta: 'A', poblacion: 'Teruel' }, docs: {} })).id;
  });

  await page.goto(base + '#/aviso/' + id);
  await page.click('summary:has-text("Partes de trabajo")');
  await page.click('text=+ Nuevo parte de este aviso');
  await page.waitForSelector('h1:has-text("Nuevo parte")');
  assert.equal(await page.inputValue('#p-cliente'), 'Ana Gil');
  assert.equal(await page.inputValue('#p-tecnico'), 'Carlos');
  ok('Parte nuevo desde el aviso con cliente, dirección y técnico rellenados');

  await page.fill('#p-trabajos', 'Sustitución de diferencial 40A 30mA.\nComprobación de disparo.');
  await page.check('#p-c-desplazamiento');
  await page.fill('#p-horas', '1,5');
  await page.selectOption('#p-resultado', 'Resuelto');
  await page.click('#p-anadir-material');
  await page.fill('.material input[aria-label="Descripción"]', 'Diferencial 2P 40A 30mA');
  await page.fill('.material input[aria-label="Cantidad"]', '1');
  await page.click('#p-guardar');
  await page.waitForSelector('h1:has-text("Parte P-")');
  const numero = (await page.textContent('h1')).replace('Parte ', '');
  assert.match(numero, /^P-\d{4}-0001$/);
  ok(`Parte creado con número ${numero}`);

  await page.click('#p-cerrar');
  await page.waitForSelector('.toast:has-text("la firma del cliente")');
  ok('No deja cerrar sin la firma del cliente');

  await page.$eval('details:has(#lienzo-parte)', (d) => { d.open = true; });
  const caja = await (await page.waitForSelector('#lienzo-parte')).boundingBox();
  await page.mouse.move(caja.x + 30, caja.y + 100); await page.mouse.down();
  for (let i = 0; i < 20; i++) await page.mouse.move(caja.x + 30 + i * 12, caja.y + 100 - Math.sin(i / 2) * 30);
  await page.mouse.up();
  await page.fill('#p-firmante-nif', '12345678z');
  await page.click('#p-guardar-firma');
  await page.waitForSelector('#img-firma-parte');
  await page.click('#p-cerrar');
  await page.waitForSelector('text=Parte cerrado');
  assert.equal(await page.$eval('#p-trabajos', (e) => e.disabled), true);
  ok('Firmado y cerrado: el parte queda bloqueado');

  await page.click('#p-pdf');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#p-descargar')]);
  assert.match(dl.suggestedFilename(), /^PARTE_P_\d{4}_0001_CALLE_SOL_3_PISO_1_PUERTA_A\.pdf$/);
  const txt = execFileSync('pdftotext', ['-layout', await dl.path(), '-']).toString();
  for (const t of ['PARTE DE TRABAJO', 'Ana Gil', 'Diferencial 2P 40A 30mA', 'Resuelto', 'Desplazamiento', '1,5 h', '12345678Z']) assert.ok(txt.includes(t), t);
  ok('PDF del parte con trabajos, material, resultado y firma');
  await page.screenshot({ path: join(raiz, 'tests/captura-parte.png') });

  const h = await page.evaluate(async (aid) => (await window.soltec.storage.history(aid)).map((e) => e.data.kind), id);
  assert.ok(h.includes('parte_creado') && h.includes('parte_cerrado'), h.join(','));
  await page.goto(base + '#/inicio');
  await page.click('#acceso-partes');
  await page.click('a.chip:has-text("Cerrados")');
  await page.waitForSelector(`.tarjeta:has-text("${numero}")`);
  ok('Queda en el historial del aviso y en «Partes › Cerrados» (acceso desde Inicio)');

  await page.click(`.tarjeta:has-text("${numero}")`);
  await page.click('#p-reabrir');
  await page.waitForSelector('#p-cerrar');
  ok('Se puede reabrir, y queda anotado');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
