// Prueba en Chromium: regla del P.I.A. de cabecera. Si los magnetotérmicos de un diferencial suman más que
// el diferencial, hay que poner un P.I.A. de cabecera ≤ diferencial, salvo que el protector de
// sobretensiones (del que cuelgan los diferenciales) ya sea ≤ diferencial.
// Uso: node tests/navegador-cuadros-cabecera.mjs   (CAPTURA=1 guarda capturas)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, connect } from 'node:net';
import assert from 'node:assert/strict';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const ok = (t) => console.log('✓ ' + t);
const pWeb = await libre();
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
let browser;
try {
  const escucha = () => new Promise((r) => { const c = connect(pWeb, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); });
  for (let i = 0; i < 50 && !(await escucha()); i++) await new Promise((r) => setTimeout(r, 100));
  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  page.setDefaultTimeout(15000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(`http://localhost:${pWeb}/index.html#/aviso/nuevo`);
  await page.waitForSelector('#f-cliente-nombre');
  await page.click('summary:has-text("Cuadros eléctricos")');
  await page.click('#abrir-cuadro');
  const f = page.frameLocator('#iframe-cuadro');
  await f.locator('[data-pal="ID:0"]').waitFor({ timeout: 20000 });
  const sel = (etq) => f.locator(`#ed label:has-text("${etq}") select`);
  const avisos = () => f.locator('body').innerText();
  const nuevo = async () => { await f.locator('button', { hasText: /^NUEVO$/ }).click(); if (await f.locator('#dk').count()) await f.locator('#dk').click(); };
  const montar = async (sob) => {
    await nuevo();
    if (sob) await f.locator('[data-pal="SOB:0"]').selectOption(String(sob));
    await f.locator('[data-pal="ID:0"]').selectOption('40|30');
    const id = await f.locator('.dv.on').getAttribute('data-id');
    for (let i = 0; i < 3; i++) { await f.locator('[data-pal="PIA:1"]').selectOption('16'); await sel('DEPENDE DE').selectOption(id); }
    await f.locator(`.dv[data-id="${id}"]`).click();
    return id;
  };

  // A) Sin protector: 3 × 16 A = 48 A > 40 A → hay que poner P.I.A. de cabecera
  await montar(0);
  assert.match(await avisos(), /SUMAN 48A\. PON UN P\.I\.A\. DE CABECERA DE 40A O MENOS/);
  assert.ok(await f.locator('#aviso-cab').isVisible());
  if (process.env.CAPTURA) await f.locator('#ed').screenshot({ path: '/tmp/claude-0/cab/aviso-cab.png' });
  await f.locator('#nuevo-cab').click();
  assert.doesNotMatch(await avisos(), /SUMAN 48A\. PON/);
  ok('Sin protector: 48 A tras un diferencial de 40 A → pide P.I.A. de cabecera; al ponerlo, desaparece el aviso');
  assert.match(await avisos(), /FALTA EL PROTECTOR DE SOBRETENSIONES/);
  ok('Sin protector de sobretensiones: Comprobaciones lo avisa');

  // B) Protector de sobretensiones de 40 A: ya protege al diferencial → no hace falta cabecera
  await montar(40);
  assert.doesNotMatch(await avisos(), /PON UN P\.I\.A\. DE CABECERA/);
  assert.match(await f.locator('#ok-cab').innerText(), /PROTECTOR DE SOBRETENSIONES DE 40A/);
  ok('Protector de sobretensiones de 40 A: puede sumar más de 40 A tras el diferencial sin cabecera');
  assert.doesNotMatch(await avisos(), /FALTA EL PROTECTOR/);
  // Nombre automático: DIFERENCIAL 1, DIFERENCIAL 2… en la ficha y en el unifilar
  assert.equal(await f.locator('#ed label:has-text("NOMBRE") input').first().inputValue(), 'DIFERENCIAL 1');
  await f.locator('[data-pal="ID:1"]').selectOption('25|300');
  assert.equal(await f.locator('#ed label:has-text("NOMBRE") input').first().inputValue(), 'DIFERENCIAL 2');
  const id2 = await f.locator('.dv.on').getAttribute('data-id');
  await f.locator('[data-pal="PIA:3"]').selectOption('20'); await sel('DEPENDE DE').selectOption(id2);
  assert.match(await avisos(), /ID 2 DIFERENCIAL 2/);
  assert.doesNotMatch(await avisos(), /DIFERENCIAL 2 \(25A\/300MA\): LOS/, '20 A tras 25 A: sin aviso');
  ok('Al poner un diferencial se llama solo DIFERENCIAL 1, DIFERENCIAL 2…');
  assert.match(await avisos(), /PROTECTOR DE SOBRETENSIONES ES MONOFÁSICO Y HAY APARATOS TRIFÁSICOS: DIFERENCIAL 2/);
  ok('Comprobaciones: aparatos trifásicos bajo un protector monofásico');
  await f.locator('nav button', { hasText: 'UNIFILAR' }).click();
  const uni = await f.locator('#t1').innerText();
  assert.match(uni, /PROT\. SOBRETENSIONES/);
  assert.match(uni, /MONOFÁSICO 40A/);
  assert.match(uni, /DIFERENCIAL 1/);
  assert.match(uni, /DIFERENCIAL 2/);
  if (process.env.CAPTURA) await f.locator('#t1 .a4').screenshot({ path: '/tmp/claude-0/cab/uni-sob.png' });
  await f.locator('nav button').first().click();
  ok('Unifilar: los diferenciales cuelgan del protector de sobretensiones, en cabeza del cuadro');

  // C) Protector de 63 A: no protege a un diferencial de 40 A → hay que poner cabecera
  await montar(63);
  assert.match(await avisos(), /SUMAN 48A\. PON UN P\.I\.A\. DE CABECERA DE 40A O MENOS/);
  ok('Protector de 63 A con diferencial de 40 A y 48 A detrás → pide P.I.A. de cabecera');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
