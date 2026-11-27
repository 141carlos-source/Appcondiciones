// Prueba en Chromium móvil: «Cuadro desde foto» desde la pestaña Cuadros y dentro del aviso.
// La lectura con Claude se simula (respuesta fija de la API); el resto es real: datos al aviso, PDF al aviso y reapertura.
// Uso: node tests/navegador-cuadrofoto.mjs
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
const LEIDO = { suministro: 'trifasico', tipoInstalacion: 'general', iga: { calibre: null, curva: 'C', polos: '4P' },
  sobretensiones: { transitorias: true, permanentes: false, texto: 'Transitorias · In 5 kA · Up 1,5 kV' },
  sinDiferencial: [{ nombre: 'CLINICA', calibre: 25, curva: 'C', polos: '3P+N' }],
  diferenciales: [{ calibre: 40, sensibilidad: 30, polos: '2P', tipo: null, circuitos: [{ nombre: 'ALUMBRADO 1', calibre: 10, curva: 'C', polos: '1P+N' }, { nombre: 'RX 1', calibre: 10, curva: 'C', polos: '1P+N' }] },
    { calibre: 40, sensibilidad: 30, polos: '2P', tipo: null, circuitos: [{ nombre: 'ESCANER', calibre: null, curva: 'C', polos: '1P+N' }] }],
  comprobar: ['Calibre del IGA: la foto está cortada arriba.', 'Calibre del PIA del escáner.'] };

try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${pWeb}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  let peticion = null;
  await ctx.route('https://api.anthropic.com/v1/messages', async (r) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (r.request().method() === 'OPTIONS') { await r.fulfill({ status: 204, headers: cors }); return; }
    peticion = { cab: r.request().headers(), cuerpo: JSON.parse(r.request().postData()) };
    await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ content: [{ type: 'text', text: '```json\n' + JSON.stringify(LEIDO) + '\n```' }] }) });
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errores.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  const base = `http://localhost:${pWeb}/index.html`;
  await page.goto(base);
  await page.waitForFunction(() => window.soltec?.storage);

  const id = await page.evaluate(async () => (await window.soltec.storage.save('aviso', { lleva: { condiciones: 'no', boletin: 'si' }, numero: '2026-0073',
    cliente: { nombre: 'Clínica Sagunto' }, suministro: { direccion: 'Av. Sagunto', numero: '73', poblacion: 'Teruel' } })).id);

  // Pestaña Cuadros: pregunta por el aviso y lo encuentra
  await page.click('nav.inferior a[data-ruta="cuadros"]');
  await page.waitForSelector('h1:has-text("Cuadros")');
  await page.fill('#cuadros-buscar', 'sagunto');
  await page.click('#cuadros-avisos a');
  ok('La pestaña Cuadros pregunta por el aviso y lo abre');

  // Se abre la herramienta con la dirección del aviso
  const f = page.frameLocator('#iframe-cuadrofoto');
  await f.locator('#bLeer').waitFor();
  assert.equal(await f.locator('#hobra').textContent(), 'Av. Sagunto 73, Teruel');
  ok('La herramienta coge la dirección y población del aviso');

  // Foto: imagen generada al vuelo
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#ddd'; g.fillRect(0, 0, 400, 300); g.fillStyle = '#1f62c4'; g.fillRect(50, 120, 300, 40); return c.toDataURL('image/png').split(',')[1]; });
  await f.locator('#fGaleria').setInputFiles({ name: 'cuadro.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await f.locator('#fotos img').waitFor();
  // Clave: se pide y se guarda solo en el dispositivo
  await f.locator('#bLeer').click();
  await f.locator('#clave').fill('sk-ant-prueba');
  await f.locator('#clave').dispatchEvent('change');
  await f.locator('#bLeer').click();
  await f.locator('#groups .grp').first().waitFor();
  assert.equal(peticion.cab['x-api-key'], 'sk-ant-prueba');
  assert.equal(peticion.cab['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(peticion.cuerpo.messages[0].content[0].type, 'image');
  assert.equal(await f.locator('#groups .grp').count(), 3);
  ok('Claude lee la foto: 1 grupo sin diferencial y 2 diferenciales');
  assert.equal(await page.evaluate(async () => window.soltec.storage.getMeta('claudeClave')), 'sk-ant-prueba');
  ok('La clave queda guardada solo en este dispositivo');

  // Unifilar y PDF al aviso
  await f.locator('nav button[data-v="uni"]').click();
  await f.locator('#sheetsUni svg').first().waitFor();
  const txtUni = await f.locator('#sheetsUni').textContent();
  assert.match(txtUni, /ALUMBRADO 1/); assert.match(txtUni, /M\. A\. SOLTEC|SOLTEC/);
  assert.doesNotMatch(txtUni, /la foto está cortada/);
  ok('Unifilar modelo Palomar 5 sin lo de «comprobar en obra»');
  await f.locator('#pdfUni').click();
  await page.waitForFunction(() => document.querySelector('#iframe-cuadrofoto') && true);
  await f.locator('nav button[data-v="chint"]').click();
  await f.locator('#sheetsChint svg').first().waitFor();
  assert.match(await f.locator('#sheetsChint').textContent(), /PEDIDO DE MATERIAL/);
  await f.locator('#pdfChint').click();
  await page.waitForTimeout(2500);
  await page.click('#volver-cuadrofoto');
  await page.waitForSelector('#cuadrofoto-resumen', { state: 'attached' });
  await page.waitForTimeout(800);
  const a = await page.evaluate(async (id) => (await window.soltec.storage.get(id)).data, id);
  assert.equal(a.cuadroFoto.datos.circ.length, 4);
  assert.equal(a.cuadroFoto.datos.comprobar.length, 2);
  const tipos = a.archivos.map((x) => x.tipo).sort();
  assert.deepEqual(tipos, ['cuadro-chint', 'foto-cuadro', 'unifilar']);
  assert.ok(a.archivos.find((x) => x.tipo === 'unifilar').name.startsWith('Unifilar Av. Sagunto 73 Teruel'));
  ok('Datos, foto, PDF del unifilar y PDF del cuadro CHINT guardados en el aviso');
  const pdf = await page.evaluate(async (h) => { const f = await window.soltec.storage.getFile(h); return [...new Uint8Array(f.bytes).slice(0, 5)].map((c) => String.fromCharCode(c)).join(''); }, a.archivos.find((x) => x.tipo === 'unifilar').hash);
  assert.equal(pdf, '%PDF-');
  ok('El PDF es un PDF de verdad');

  // Reabrir: vuelven los datos
  assert.doesNotMatch(page.url(), /cuadro=1/);
  await page.evaluate(() => { const d = document.querySelector('#bloque-cuadrofoto').closest('details'); d.open = true; });
  await page.click('#abrir-cuadrofoto');
  await f.locator('#groups .grp').first().waitFor();
  assert.match(await f.locator('#groups').textContent(), /RX 1/);
  await page.click('#volver-cuadrofoto');
  ok('Al reabrir, el cuadro vuelve tal cual');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} finally {
  await browser?.close();
  web.kill();
}
