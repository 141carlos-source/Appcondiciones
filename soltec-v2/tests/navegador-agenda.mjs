// Prueba en Chromium móvil de la Agenda y los seguimientos de avisos.
// Uso: node tests/navegador-agenda.mjs
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
const hoy = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${pWeb}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  const base = `http://localhost:${pWeb}/index.html`;

  await page.goto(base + '#/inicio');
  await page.waitForFunction(() => window.soltec?.storage);
  const id = await page.evaluate(async () => {
    const r = await window.soltec.storage.save('aviso', { numero: '2026-0001', cliente: { nombre: 'Ana Gil' }, suministro: { direccion: 'Calle Sol 3' }, docs: {} }, { event: { kind: 'creado' } });
    return r.id;
  });

  // Seguimiento desde el aviso
  await page.goto(base + '#/aviso/' + id);
  await page.click('summary:has-text("Seguimiento")');
  await page.click('text=+ Programar seguimiento');
  await page.waitForSelector('h1:has-text("Nuevo seguimiento")');
  assert.match(await page.textContent('main'), /Aviso 2026-0001 · Ana Gil/);
  await page.fill('#c-titulo', 'Llamar para pedir el IBAN');
  await page.fill('#c-fecha', hoy());
  await page.fill('#c-hora', '09:00');
  await page.fill('#c-responsable', 'Carlos');
  await page.click('#guardar-cita');
  await page.waitForSelector('h1:has-text("Aviso 2026-0001")');
  await page.click('summary:has-text("Seguimiento")');
  await page.waitForSelector('text=Llamar para pedir el IBAN');
  await page.click('summary:has-text("Historial")');
  await page.waitForSelector('text=Seguimiento programado');
  ok('Seguimiento programado desde el aviso, con anotación en su historial');

  // Inicio: bandeja «Seguimientos para hoy»
  await page.goto(base + '#/inicio');
  await page.click('button.chip:has-text("Seguimientos para hoy")');
  await page.waitForSelector('text=Hoy: Llamar para pedir el IBAN · ' + hoy() + ' 09:00 · Carlos');
  ok('«Qué toca hoy» muestra el seguimiento de hoy con hora y responsable');

  // Agenda: cita suelta de ayer → Vencidas
  await page.click('nav.inferior a[data-ruta=agenda]');
  await page.click('text=+ Nueva cita');
  const ayer = new Date(Date.now() - 86400000); const ayerIso = new Date(ayer.getTime() - ayer.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  await page.fill('#c-titulo', 'Revisar cuadro en obra');
  await page.fill('#c-fecha', ayerIso);
  await page.click('#guardar-cita');
  await page.waitForSelector('h2:has-text("Vencidas")');
  const grupos = await page.$$eval('main h2', (hs) => hs.map((x) => x.textContent));
  assert.deepEqual(grupos, ['Vencidas', 'Hoy']);
  ok('Agenda agrupada: Vencidas y Hoy');
  await page.screenshot({ path: join(raiz, 'tests/captura-agenda.png') });

  // Marcar como hecha → historial del aviso
  await page.click('.cita:has-text("Llamar para pedir el IBAN") .check');
  await page.waitForFunction(() => !document.querySelector('main').textContent.includes('Llamar para pedir el IBAN'));
  await page.click('a.chip:has-text("Hechas")');
  await page.waitForSelector('text=Llamar para pedir el IBAN');
  const kinds = await page.evaluate(async (aid) => (await window.soltec.storage.history(aid)).map((e) => e.data.kind), id);
  assert.ok(kinds.includes('seguimiento_hecho'), kinds.join(','));
  ok('Marcar como hecha la pasa a «Hechas» y lo anota en el aviso');

  // Alarma con la app abierta
  const t = new Date(Date.now() - 60000);
  await page.evaluate(async ({ fecha, hora }) => {
    await window.soltec.storage.save('cita', { titulo: 'Recoger material', fecha, hora, alarma: true, hecho: false });
    await window.soltec.revisarAlarmas();
  }, { fecha: hoy(), hora: t.toTimeString().slice(0, 5) });
  await page.waitForSelector('.toast:has-text("Recoger material")');
  await page.evaluate(() => document.querySelector('.toast')?.remove());
  await page.evaluate(() => window.soltec.revisarAlarmas());
  await page.waitForTimeout(300);
  assert.equal(await page.$('.toast'), null, 'no se repite');
  ok('La alarma avisa una sola vez con la app abierta');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
