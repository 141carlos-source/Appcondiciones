// Prueba en Chromium: envío automático del formulario con el servicio de Google (simulado): enlace corto en
// WhatsApp, correo que sale solo con el botón y el logo, y el cliente abre el enlace corto con sus datos.
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
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 1200 } });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const base = `http://localhost:${pWeb}/`;
  // Servicio de Google simulado (como SOLTEC_Formularios.gs): guarda cifrado, envía correos, da el logo
  const DEP = 'AKfycbz' + 'Q'.repeat(65);
  const CLAVE = 'clave-de-prueba-1234567890';
  const guardado = new Map(), correos = [];
  let logo = '';
  const servicio = async (route) => {
    const req = route.request(), u = new URL(req.url());
    const json = (j) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(j) });
    if (req.method() === 'POST') {
      const b = JSON.parse(req.postData());
      if (b.clave !== CLAVE) return json({ ok: false, error: 'clave' });
      if (b.accion === 'prueba') return json({ ok: true, cuenta: '141carlos@gmail.com', correosHoy: 99 });
      if (b.accion === 'logo') { logo = b.logo; return json({ ok: true }); }
      if (b.accion === 'guardar') { const id = 'Kq7Zp' + (guardado.size + 1) + 'Lm'; guardado.set(id, b.datos); return json({ ok: true, id }); }
      if (b.accion === 'correo') { correos.push(b); return json({ ok: true }); }
    }
    if (u.searchParams.get('logo')) return json({ ok: true, logo });
    const d = guardado.get(u.searchParams.get('id'));
    return json(d ? { ok: true, datos: d } : { ok: false, error: 'caducado' });
  };
  await ctx.route('https://script.google.com/**', servicio);
  let urlWa = '';
  await ctx.route('https://wa.me/**', (r) => { urlWa = r.request().url(); r.fulfill({ status: 200, body: 'WhatsApp' }); });

  await page.goto(base + 'index.html#/inicio');
  await page.waitForFunction(() => window.soltec?.storage);
  const id = await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 300; cv.height = 100;
    const cx = cv.getContext('2d'); cx.fillStyle = '#0b4ea2'; cx.fillRect(0, 0, 300, 100);
    const logo = await window.soltec.storage.putFile(new File([await new Promise((r) => cv.toBlob(r, 'image/png'))], 'logo.png', { type: 'image/png' }));
    await window.soltec.storage.save('config', { empresa: { nombre: 'M. A. SOLTEC SL', nombreComercial: 'M. A. SOLTEC', nif: 'B99506651', telefono: '607335058', email: 'info@soltec.es' }, logo }, { id: 'empresa' });
    return (await window.soltec.storage.save('aviso', { numero: '2026-0077', cliente: { nombre: 'ANA GIL', telefono: '600123456', email: 'ana@correo.es' }, suministro: { direccion: 'CALLE MAYOR', numero: '3', cp: '50001', poblacion: 'ZARAGOZA', provincia: 'ZARAGOZA' }, electrico: {}, docs: {} })).id;
  });

  // Empresa › Envío automático: clave, URL y «Probar»
  await page.goto(base + 'index.html#/empresa');
  await page.waitForSelector('#bloque-envio');
  assert.ok((await page.inputValue('#envio-clave')).length >= 20, 'la app da una clave');
  await page.evaluate((c) => { document.getElementById('envio-clave').value = c; }, CLAVE);
  await page.evaluate((c) => window.__clave = c, CLAVE);
  // La clave que se pega en Google es la de la app: aquí se pone la del servicio simulado
  await page.evaluate(async (c) => { const r = await window.soltec.storage.get('empresa'); await window.soltec.storage.save('config', { ...r.data, envio: { url: '', clave: c } }, { id: 'empresa' }); }, CLAVE);
  await page.goto(base + 'index.html#/inicio');
  await page.goto(base + 'index.html#/empresa');
  await page.waitForSelector('#envio-url');
  assert.equal(await page.inputValue('#envio-clave'), CLAVE);
  await page.fill('#envio-url', `https://script.google.com/macros/s/${DEP}/exec`);
  await page.click('#probar-envio');
  await page.waitForSelector('#envio-resultado .aviso.ok');
  assert.match(await page.textContent('#envio-resultado'), /141carlos@gmail\.com/);
  assert.match(logo, /^data:image\/(png|jpeg);base64,/, 'el logo se manda al servicio');
  await page.click('#guardar-empresa');
  await page.waitForFunction(() => location.hash === '#/ajustes');
  ok('Empresa › Envío automático: clave de la app, URL del servicio, «Probar» (cuenta y logo)');

  // Pedir datos al cliente: dos botones; el correo sale solo
  await page.goto(base + 'index.html#/aviso/' + id);
  await page.click('summary:has-text("Solicitudes y comunicaciones")');
  await page.click('#btn-enlace-cliente');
  await page.waitForSelector('#panel-enlace-cliente');
  assert.deepEqual(await page.$$eval('#panel-enlace-cliente .acciones.dos button', (b) => b.map((x) => x.textContent)), ['Enviar correo', 'Enviar por WhatsApp']);
  assert.ok(!(await page.$('#sin-envio-auto')));
  await page.click('#enlace-correo');
  await page.waitForSelector('#correo-enviado');
  assert.equal(correos.length, 1);
  assert.equal(correos[0].para, 'ana@correo.es');
  assert.match(correos[0].html, /ABRIR FORMULARIO AQUÍ/);
  assert.match(correos[0].html, /cid:logo/);
  const corto = /href="([^"]+cliente\.html#g\.[^"]+)"/.exec(correos[0].html)[1];
  assert.ok(corto.length < 200, `enlace de ${corto.length} caracteres`);
  assert.ok(![...guardado.values()][0].includes('ANA'), 'en Google solo hay datos cifrados');
  const evs = await page.evaluate(async (aid) => (await window.soltec.storage.listByRef(aid, 'evento')).map((e) => e.data.text).join(' | '), id);
  assert.match(evs, /Formulario de datos enviado por correo a ana@correo\.es/);
  ok('«Enviar correo»: sale solo desde Gmail con el botón y el logo, con enlace corto; queda en el historial');

  const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('#enlace-whatsapp')]);
  await pop.waitForLoadState().catch(() => {});
  await page.waitForFunction(() => true);
  for (let i = 0; i < 30 && !urlWa; i++) await page.waitForTimeout(100);
  const texto = new URL(urlWa).searchParams.get('text');
  assert.match(texto, /cliente\.html#g\./);
  assert.ok(texto.length < 400, `mensaje de ${texto.length} caracteres`);
  await pop.close().catch(() => {});
  ok('WhatsApp con enlace corto');

  // El cliente abre el enlace corto
  const cli = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  await cli.context().route('https://script.google.com/**', servicio);
  cli.on('pageerror', (e) => errores.push('cliente: ' + e.message));
  await cli.goto(corto.replace(/^https:\/\/[^#]+\/cliente\.html/, base + 'cliente.html'));
  await cli.waitForSelector('#c-cliente-nombre');
  assert.equal(await cli.inputValue('#c-cliente-nombre'), 'ANA GIL');
  assert.ok(await cli.$eval('#empresa-logo', (i) => i.complete && i.naturalWidth > 0), 'logo desde el servicio');
  ok('El cliente abre el enlace corto: sus datos y el logo de la empresa');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
