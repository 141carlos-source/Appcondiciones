// Prueba en Chromium móvil: firma del técnico con el dedo (azul bolígrafo) y sello de caucho.
// Uso: node tests/navegador-firma-sello.mjs
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
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  page.setDefaultTimeout(15000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('dialog', (d) => d.accept());
  const base = `http://localhost:${pWeb}/index.html`;
  await page.goto(base + '#/inicio');
  await page.waitForFunction(() => window.soltec?.storage);
  await page.evaluate(async () => {
    const s = window.soltec.storage;
    const logo = await s.putFile({ name: 'logo.png', mime: 'image/png', bytes: new Uint8Array(await (await fetch('./icon-512.png')).arrayBuffer()) });
    window.__logo = logo;
  });
  await page.evaluate(() => window.soltec.storage.save('config', { logo: window.__logo, empresa: { nombre: 'M. A. SOLTEC SL', nif: 'B99506651', localidad: 'LA PUEBLA DE ALFINDEN', provincia: 'ZARAGOZA', direccion: 'GERANIO 66', cp: '50171', telefono: '607335058' }, tecnico: { nombre: 'CARLOS', numero: '50-1234' } }, { id: 'empresa' }));
  await page.goto(base + '#/empresa');
  await page.click('#firmar-dedo');
  const caja = await page.$('#lienzo-firma-tecnico');
  await caja.scrollIntoViewIfNeeded();
  const b = await caja.boundingBox();
  // Firma: varios trazos a distinta velocidad
  await page.mouse.move(b.x + 30, b.y + 120); await page.mouse.down();
  for (let i = 0; i <= 40; i++) await page.mouse.move(b.x + 30 + i * 6, b.y + 120 - Math.sin(i / 4) * 50 - i, { steps: i % 3 ? 1 : 3 });
  await page.mouse.up();
  await page.mouse.move(b.x + 120, b.y + 150); await page.mouse.down();
  for (let i = 0; i <= 30; i++) await page.mouse.move(b.x + 120 + i * 7, b.y + 150 + Math.cos(i / 3) * 15, { steps: 2 });
  await page.mouse.up();
  await caja.screenshot({ path: join(raiz, 'tests/captura-firma.png') });
  await page.click('#guardar-firma-tecnico');
  await page.waitForSelector('#img-firma');
  // Color de la tinta: azul bolígrafo
  const color = await page.evaluate(async () => {
    const img = document.getElementById('img-firma'); await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let r = 0, gg = 0, bb = 0, n = 0, transparentes = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 200) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; n++; } if (d[i + 3] === 0) transparentes++; }
    return { r: r / n, g: gg / n, b: bb / n, n, transparente: transparentes / (d.length / 4), w: cv.width, h: cv.height };
  });
  assert.ok(color.b > 120 && color.r < 60 && color.g < 90, JSON.stringify(color));
  assert.ok(color.transparente > 0.5, 'fondo transparente');
  ok(`Firma con el dedo en azul bolígrafo, recortada y con fondo transparente (${color.w}×${color.h})`);

  await page.click('#crear-sello');
  await page.waitForSelector('#muestra-sello canvas');
  await (await page.$('#muestra-sello')).screenshot({ path: join(raiz, 'tests/captura-sello.png') });
  await page.click('#guardar-sello');
  await page.waitForSelector('#img-sello');
  await page.click('#guardar-empresa');
  let emp;
  for (let i = 0; i < 30; i++) { emp = await page.evaluate(async () => (await window.soltec.storage.get('empresa')).data); if (emp.sello && emp.firma) break; await page.waitForTimeout(200); }
  assert.ok(emp.firma?.hash && emp.sello?.hash);
  ok('Sello de caucho generado con los datos de la empresa y guardado junto a la firma');
  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
