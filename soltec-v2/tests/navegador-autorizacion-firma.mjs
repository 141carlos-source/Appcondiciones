// Prueba en Chromium: en la autorización se elige el representante (SOLTEC o técnico) y se pone
// la firma y el sello de la empresa, en los tres modos (Réplica A4, Formulario y Asistente).
// Uso: node tests/navegador-autorizacion-firma.mjs   (CAPTURA=1 guarda capturas)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, connect } from 'node:net';
import assert from 'node:assert/strict';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const pWeb = await libre();
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
const ok = (t) => console.log('✓ ' + t);
let browser;
try {
  const escucha = () => new Promise((r) => { const c = connect(pWeb, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); });
  for (let i = 0; i < 50 && !(await escucha()); i++) await new Promise((r) => setTimeout(r, 100));
  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 1000 } })).newPage();
  page.setDefaultTimeout(10000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('dialog', (d) => d.accept());
  const base = `http://localhost:${pWeb}/index.html`;
  await page.goto(base);
  await page.waitForFunction(() => window.soltec?.storage);

  // Empresa con técnico, firma (azul) y sello (rojo)
  const id = await page.evaluate(async () => {
    const st = window.soltec.storage;
    const png = async (w, h, pintar) => { const c = document.createElement('canvas'); c.width = w; c.height = h; pintar(c.getContext('2d')); return new Promise((ok) => c.toBlob(ok, 'image/png')); };
    const firma = await st.putFile(new File([await png(300, 120, (g) => { g.strokeStyle = '#1b3a8c'; g.lineWidth = 6; g.beginPath(); g.moveTo(10, 90); g.bezierCurveTo(80, 0, 150, 120, 290, 30); g.stroke(); })], 'firma.png', { type: 'image/png' }));
    const sello = await st.putFile(new File([await png(200, 200, (g) => { g.strokeStyle = '#c4161c'; g.lineWidth = 10; g.beginPath(); g.arc(100, 100, 85, 0, 7); g.stroke(); })], 'sello.png', { type: 'image/png' }));
    await st.save('empresa', {
      empresa: { nombre: 'M. A. SOLTEC SL', nombreComercial: 'M. A. SOLTEC', nif: 'B99506651', direccion: 'GERANIO 66', localidad: 'LA PUEBLA DE ALFINDEN', telefono: '976000000', email: 'info@soltec.es' },
      tecnico: { nombre: 'CARLOS GARCÍA', nif: '12345678Z', telefono: '600111222', email: 'carlos@soltec.es' },
      firma, sello,
    }, { id: 'empresa' });
    return (await st.save('aviso', { numero: '2026-0077', cliente: { nombre: 'Luis Pérez', nif: '12345678Z' }, suministro: { direccion: 'Calle Mayor', numero: '1', poblacion: 'Zaragoza', provincia: 'Zaragoza' } })).id;
  });

  await page.goto(base + '#/aviso/' + id);
  await page.click('summary:has-text("Autorización de representatividad")');
  await page.click('#abrir-autorizacion');
  const frame = await (async () => { for (;;) { const fr = page.frame({ url: /autorizacion\.html/ }); if (fr) return fr; await page.waitForTimeout(100); } })();
  await frame.waitForFunction(() => window.SoltecAutorizacion && window.SoltecAutorizacion.getData().sol_nombre);
  const datos = () => frame.evaluate(() => window.SoltecAutorizacion.getData());

  // Al abrir: representante SOLTEC con la firma y el sello de la empresa ya puestos
  let d = await datos();
  assert.equal(d.aut_nombre, 'M. A. SOLTEC SL');
  assert.match(d.firma_rep, /^data:image\/png;base64,/);
  assert.equal(await frame.inputValue('#repSel'), 'sol');
  const dims = await frame.evaluate((u) => new Promise((ok) => { const im = new Image(); im.onload = () => ok([im.width, im.height]); im.src = u; }), d.firma_rep);
  assert.ok(dims[0] > dims[1] * 1.5, 'sello y firma juntos, uno al lado del otro: ' + dims);
  ok('Al abrir: representante SOLTEC con la firma y el sello de la empresa');

  // Elegir técnico desde el selector de arriba (vale en cualquier modo)
  await frame.selectOption('#repSel', 'tec');
  d = await datos();
  assert.equal(d.aut_nombre, 'CARLOS GARCÍA');
  assert.equal(d.aut_nif, '12345678Z');
  assert.equal(d.aut_via, 'GERANIO 66');
  assert.equal(d.aut_tel, '600111222');
  assert.match(d.firma_rep, /^data:image\/png/);
  ok('Representante: técnico (nombre, NIF y contacto del técnico; domicilio de la empresa) con firma y sello');
  await frame.selectOption('#repSel', 'sol');
  assert.equal((await datos()).aut_nombre, 'M. A. SOLTEC SL');
  ok('Representante: SOLTEC otra vez');

  // Los tres modos: botón «Firma y sello de empresa» en la firma del representante
  for (const [modo, abrirFirma] of [
    ['frm', async () => {}],
    ['asi', async () => { await frame.click('#steps button[data-i="4"]'); }],
    ['rep', async () => { await frame.click('.sigz[data-sig="firma_rep"]'); }],
  ]) {
    await frame.selectOption('#modo', modo);
    await abrirFirma();
    const pad = frame.locator('.pad', { hasText: 'Firma del representante' });
    await pad.locator('[data-del]').click();
    assert.equal((await datos()).firma_rep, '');
    await pad.locator('[data-ex]').click();
    assert.match((await datos()).firma_rep, /^data:image\/png/);
    if (process.env.CAPTURA) await frame.locator('body').screenshot({ path: `/tmp/claude-0/cab/aut-${modo}.png` });
    if (modo === 'rep') await frame.click('.modal [data-a="x"]');
    ok(`Modo ${modo}: «Firma y sello de empresa» en la firma del representante`);
  }
  // En el impreso sale la imagen en la casilla del representante
  const html = await frame.evaluate(() => SA.makeDoc(window.SoltecAutorizacion.getData(), false));
  assert.ok(html.includes((await datos()).firma_rep.slice(0, 60)));
  ok('El impreso lleva la firma y el sello en «Firma de la persona o de la Empresa representante»');

  // Menú «Más»
  await frame.click('#bMas');
  assert.ok(await frame.isVisible('#bTecnico'));
  assert.ok(await frame.isVisible('#bFirmaEmp'));
  ok('Menú «Más»: rellenar con el técnico y poner firma y sello');
  await frame.click('#bTecnico');
  assert.equal((await datos()).aut_nombre, 'CARLOS GARCÍA');

  // Al volver se guarda en el aviso
  await page.click('#volver-autorizacion');
  await page.waitForFunction(async (aid) => (await window.soltec.storage.get(aid))?.data.autorizacion?.datos?.aut_nombre === 'CARLOS GARCÍA', id, { polling: 300, timeout: 10000 });
  const g = await page.evaluate(async (aid) => (await window.soltec.storage.get(aid)).data.autorizacion.datos, id);
  assert.match(g.firma_rep, /^data:image\/png/);
  ok('Al volver, el aviso guarda el representante elegido con su firma y sello');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
