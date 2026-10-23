// Prueba en Chromium móvil: recordatorios automáticos en Inicio, en la ficha del aviso y plazos en Ajustes.
// Uso: node tests/navegador-recordatorios.mjs
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
  const page = await (await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true })).newPage();
  page.setDefaultTimeout(10000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  const base = `http://localhost:${pWeb}/index.html`;

  // Aviso con condiciones pedidas hace 20 días y autorización enviada hace 10 días sin firmar
  await page.goto(base + '#/aviso/nuevo');
  await page.waitForSelector('#f-cliente-nombre');
  await page.fill('#f-cliente-nombre', 'Talleres Ebro');
  await page.fill('#f-suministro-direccion', 'Calle Mayor 1');
  await page.click('#guardar');
  await page.waitForSelector('h1:has-text("Aviso 2026-0001")');
  const id = await page.evaluate(async () => {
    const s = window.soltec.storage, r = (await s.list('aviso'))[0];
    const dia = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
    await s.save('evento', { at: dia(20).toISOString(), kind: 'solicitud_presentada', text: 'Solicitud presentada' }, { ref: r.id });
    const f = dia(10);
    await s.save('aviso', { ...r.data, tramite: 'presentado', autorizacion: { v: 1, actualizado: f.toISOString(), datos: { env_correo: 'si', env_para: 'cliente@correo.es', env_fecha: f.toLocaleDateString('es-ES') + ' 10:00', firma_sol: '' } } }, { id: r.id });
    return r.id;
  });

  await page.goto(base + '#/inicio');
  await page.waitForSelector('#recordatorios');
  const textos = await page.$$eval('#recordatorios .recordatorio-texto', (e) => e.map((x) => x.textContent));
  assert.deepEqual(textos, ['Condiciones solicitadas hace 20 días sin respuesta', 'Autorización enviada hace 10 días sin firmar']);
  assert.match(await page.textContent('.hoy-resumen'), /2 recordatorios sin respuesta/);
  assert.match(await page.textContent('#recordatorios'), /Talleres Ebro/i);
  if (process.env.CAPTURAS) { await page.locator('#recordatorios').scrollIntoViewIfNeeded(); await page.screenshot({ path: join(process.env.CAPTURAS, 'recordatorios.png') }); }
  ok('Inicio: «Condiciones solicitadas hace 20 días sin respuesta» y «Autorización enviada hace 10 días sin firmar»');

  await page.click('#recordatorios .recordatorio[data-tipo="condiciones"] [data-accion="reclamado"]');
  await page.waitForFunction(() => document.querySelectorAll('#recordatorios .recordatorio').length === 1);
  const hist = await page.evaluate(async (i) => (await window.soltec.storage.history(i)).map((e) => [e.data.kind, e.data.tipo || '']), id);
  assert.ok(hist.some(([k, t]) => k === 'reclamado' && t === 'condiciones'));
  ok('«Reclamado hoy» lo anota en el historial y vuelve a contar desde hoy');

  await page.click('#recordatorios a:has-text("Abrir")');
  await page.waitForSelector('#recordatorios-aviso .recordatorio');
  assert.match(await page.textContent('#recordatorios-aviso'), /Autorización enviada hace 10 días sin firmar/);
  await page.click('#recordatorios-aviso [data-accion="resuelto"]');
  await page.waitForSelector('.sd-fondo');
  await page.click('.sd-fondo #dk');
  await page.waitForFunction(() => !document.querySelector('#recordatorios-aviso .recordatorio'));
  ok('En la ficha del aviso sale el recordatorio; «Ya está» lo quita (con confirmación)');

  await page.goto(base + '#/inicio');
  await page.waitForSelector('#buscador-unico');
  await page.waitForSelector('#recordatorios[data-listo]', { state: 'attached' });
  assert.equal(await page.locator('#recordatorios:not([hidden])').count(), 0);
  ok('Sin recordatorios pendientes, Inicio no muestra el bloque');

  // Plazos en Ajustes: documentación enviada hace 5 días no avisa con 10 días, sí con 3
  await page.evaluate(async (i) => { const d = new Date(); d.setDate(d.getDate() - 5); await window.soltec.storage.save('evento', { at: d.toISOString(), kind: 'doc_enviada', text: 'Ficha: enviado' }, { ref: i }); }, id);
  await page.goto(base + '#/ajustes');
  await page.click('summary:has-text("Recordatorios automáticos")');
  assert.equal(await page.inputValue('#plazo-condiciones'), '15');
  assert.equal(await page.inputValue('#plazo-documentacion'), '10');
  await page.goto(base + '#/inicio');
  await page.waitForSelector('#buscador-unico');
  await page.waitForSelector('#recordatorios[data-listo]', { state: 'attached' });
  assert.equal(await page.locator('#recordatorios:not([hidden])').count(), 0, 'con 10 días aún no avisa');
  await page.goto(base + '#/ajustes');
  await page.click('summary:has-text("Recordatorios automáticos")');
  await page.fill('#plazo-documentacion', '3');
  await page.click('#plazos-guardar');
  await page.waitForFunction(async () => (await window.soltec.storage.get('empresa'))?.data?.recordatorios?.documentacion === 3);
  await page.goto(base + '#/inicio');
  await page.waitForSelector('#recordatorios');
  assert.match(await page.textContent('#recordatorios'), /Documentación enviada al cliente hace 5 días sin respuesta/);
  ok('Los días de cada recordatorio se cambian en Ajustes y se guardan con la empresa');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
