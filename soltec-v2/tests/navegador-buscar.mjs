// Prueba en Chromium: el buscador de Inicio busca en todo (avisos, observaciones, archivos, partes y citas).
// Uso: node tests/navegador-buscar.mjs
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
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 }, isMobile: true, hasTouch: true })).newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto(`http://localhost:${pWeb}/index.html`);
  await page.waitForFunction(() => window.soltec?.storage);
  await page.evaluate(async () => {
    const s = window.soltec.storage;
    await s.save('aviso', { numero: '2026-0101', cliente: { nombre: 'ANA GIL' }, observaciones: 'LLAMAR ANTES: EL PERRO MUERDE' });
    await s.save('parte', { numero: 'P-0007', cliente: { nombre: 'BAR PEPE' }, trabajos: 'CAMBIO DE DIFERENCIAL EN COCINA', materiales: [], fotos: [] });
    await s.save('cita', { titulo: 'REVISAR CGP', fecha: '2026-11-03', notas: 'TRAER ESCALERA', hecho: false });
  });
  await page.goto(`http://localhost:${pWeb}/index.html#/inicio`);
  await page.waitForSelector('#buscador-unico');
  const buscar = async (q) => { await page.fill('#buscador-unico', q); return page.locator('#resultados-busqueda .tarjeta').allInnerTexts(); };
  let r = await buscar('perro');
  assert.equal(r.length, 1); assert.match(r[0], /ANA GIL/); assert.match(r[0], /En observaciones/);
  r = await buscar('diferencial cocina');
  assert.match(r[0], /Parte/); assert.match(r[0], /BAR PEPE/);
  r = await buscar('escalera');
  assert.match(r[0], /Cita/); assert.match(r[0], /REVISAR CGP/);
  await page.locator('#resultados-busqueda .tarjeta').first().click();
  await page.waitForFunction(() => location.hash.startsWith('#/cita/'));
  ok('El buscador de Inicio encuentra en observaciones, partes de trabajo y citas, y dice dónde');
  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
