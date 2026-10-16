// Prueba en Chromium móvil: autorización de representatividad dentro de la ficha del aviso.
// Se rellena con los datos del aviso y de Ajustes › Empresa (logo incluido), se guarda en el aviso y se recupera al reabrirlo.
// Uso: node tests/navegador-autorizacion.mjs
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  const base = `http://localhost:${pWeb}/index.html`;

  // Empresa con logo (copiada de la V1.35, como en la otra prueba)
  await page.goto(base);
  await page.waitForFunction(() => window.soltec?.storage);
  await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 300; cv.height = 90;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 90); g.fillStyle = '#c4161c'; g.fillRect(10, 10, 20, 70); g.fillStyle = '#1e2226'; g.font = 'bold 40px Arial'; g.fillText('SOLTEC', 45, 62);
    localStorage.setItem('APP_AVISOS_WEB_DATOS_V116_PERSISTENTE', JSON.stringify({ empresa: { nombre: 'M. A. SOLTEC SL', nif: 'B99506651', telefono: '976000000', email: 'info@soltec.es', direccion: 'GERANIO 66', cp: '50171', localidad: 'LA PUEBLA DE ALFINDEN', logoData: cv.toDataURL('image/png') } }));
  });
  await page.goto(base + '#/ajustes');
  await page.click('text=Empresa');
  await page.click('#importar-v1');
  await page.waitForSelector('#img-logo');
  await page.click('#guardar-empresa');
  await page.waitForSelector('h1:has-text("Ajustes")');

  const id = await page.evaluate(async () => (await window.soltec.storage.save('aviso', {
    numero: '2026-0042', tramite: 'datos',
    cliente: { nombre: 'Luis Pérez', nif: '12345678Z', telefono: '600123456', email: 'luis@ejemplo.es' },
    suministro: { direccion: 'Calle Mayor', numero: '12', piso: '', puerta: '', cp: '50001', poblacion: 'Zaragoza', provincia: 'Zaragoza', refCatastral: '', cups: '' },
    electrico: { potenciaKw: '9.2' },
  })).id);

  await page.goto(base + '#/aviso/' + id);
  await page.click('summary:has-text("Autorización de representatividad")');
  assert.match(await page.textContent('#autorizacion-resumen'), /Sin preparar/);
  ok('La ficha tiene la sección «Autorización de representatividad»');

  await page.click('#abrir-autorizacion');
  const f = page.frameLocator('#iframe-autorizacion');
  await f.locator('#modo').waitFor();
  const frame = page.frame({ url: /autorizacion\.html/ });
  await frame.waitForFunction(() => window.SoltecAutorizacion && window.SoltecAutorizacion.getData().sol_nombre);
  const d0 = await frame.evaluate(() => window.SoltecAutorizacion.getData());
  assert.equal(d0.sol_nombre, 'Luis Pérez');
  assert.equal(d0.sum_dir, 'Calle Mayor 12');
  assert.equal(d0.sum_potencia, '9,2');
  assert.equal(d0.aut_nombre, 'M. A. SOLTEC SL');
  assert.equal(d0.aut_nif, 'B99506651');
  ok('Se abre a pantalla completa con los datos del aviso y el representante de Ajustes › Empresa');

  assert.equal(await frame.evaluate(() => SA.LOGOS.src), 'v2');
  const html = await frame.evaluate(() => SA.makeDoc(window.SoltecAutorizacion.getData(), false));
  assert.ok(html.includes('alt="SOLTEC"') && html.includes('data:image/png') && html.includes('alt="e-distribución"'));
  ok('El impreso lleva el logo de Ajustes › Empresa y el de e-distribución');
  if (process.env.CAPTURAS) {
    await page.screenshot({ path: join(process.env.CAPTURAS, 'aut-movil.png') });
    await frame.evaluate(() => { const pa = document.getElementById('printArea'); pa.innerHTML = '<div class="doc">' + SA.makeDoc(SoltecAutorizacion.getData(), false) + '</div>'; });
  }

  // Cambiar el modo y escribir: el dato cambiado no lo pisan las sugerencias al reabrir
  await frame.selectOption('#modo', 'asi');
  await frame.fill('#fld_sol_nombre', 'Luis Pérez García');
  await frame.click('.seg[data-k="sol_opcion"] button[data-v="A"]');
  await frame.evaluate(() => SoltecAutorizacion.goTo(4));
  const cv = frame.locator('.pad canvas').first();
  await cv.scrollIntoViewIfNeeded();
  const bb = await cv.boundingBox();
  await page.mouse.move(bb.x + 20, bb.y + 80); await page.mouse.down();
  for (let i = 0; i < 25; i++) await page.mouse.move(bb.x + 20 + i * 10, bb.y + 80 - (i % 2) * 30);
  await page.mouse.up();
  await page.waitForTimeout(200);
  await page.click('#volver-autorizacion');
  await page.waitForFunction(() => /firma/.test(document.querySelector('#autorizacion-resumen')?.textContent || ''));
  await page.waitForTimeout(500);
  const guardado = await page.evaluate(async (id) => (await window.soltec.storage.get(id)).data.autorizacion, id);
  assert.equal(guardado.datos.sol_nombre, 'Luis Pérez García');
  assert.equal(guardado.datos.sol_opcion, 'A');
  assert.match(guardado.datos.firma_sol, /^data:image\/png;base64,/);
  ok('Al volver, la autorización (con la firma) se guarda sola dentro del aviso');
  const hist = await page.evaluate(async (id) => (await window.soltec.storage.list('evento')).filter((e) => e.ref === id).map((e) => e.data.text).join(' | '), id);
  assert.match(hist, /Autorización de representatividad actualizada/);
  ok('Queda en el historial');

  await page.goto(base + '#/avisos');
  await page.goto(base + '#/aviso/' + id);
  await page.click('summary:has-text("Autorización de representatividad")');
  assert.match(await page.textContent('#autorizacion-resumen'), /Luis Pérez García · factura al solicitante · 1 firma/);
  await page.click('#abrir-autorizacion');
  await page.frameLocator('#iframe-autorizacion').locator('#modo').waitFor();
  const frame2 = page.frame({ url: /autorizacion\.html/ });
  await frame2.waitForFunction(() => window.SoltecAutorizacion && window.SoltecAutorizacion.getData().sol_nombre);
  assert.equal(await frame2.evaluate(() => SoltecAutorizacion.getData().sol_nombre), 'Luis Pérez García');
  assert.equal(await frame2.evaluate(() => localStorage.getItem('soltec.autorizacion.borrador')), null);
  ok('Al reabrir el aviso se recupera tal cual; no guarda datos fuera del aviso');
  await page.click('#volver-autorizacion');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} finally {
  if (browser) await browser.close();
  web.kill();
}
