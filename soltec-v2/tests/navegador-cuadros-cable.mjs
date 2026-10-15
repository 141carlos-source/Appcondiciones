// Prueba en Chromium: en CuadroLab, sección automática según la intensidad, tipo de cable
// (H07Z1-K por defecto o RZ1-K 0,6/1 kV) con CUMPLE / NO CUMPLE, y P.I.A. antes del diferencial.
// Uso: node tests/navegador-cuadros-cable.mjs
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
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(10000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(`http://localhost:${pWeb}/index.html#/aviso/nuevo`);
  await page.waitForSelector('#f-cliente-nombre');
  await page.fill('#f-cliente-nombre', 'PRUEBA CABLE');
  await page.click('summary:has-text("Cuadros eléctricos")');
  await page.click('#abrir-cuadro');
  const f = page.frameLocator('#iframe-cuadro');
  await f.locator('[data-new="ID:2"]').waitFor({ timeout: 20000 });
  await f.locator('[data-new="ID:2"]').click();
  await f.locator('[data-new="PIA:2"]').click(); // queda seleccionado
  const sel = (etq) => f.locator(`#ed label:has-text("${etq}") select`);
  assert.equal(await sel('TIPO DE CABLE').inputValue(), 'H07Z1-K');
  assert.equal(await sel('SECCIÓN CABLE').inputValue(), '2.5', '16 A → 2,5 mm² por defecto');
  await sel('INTENSIDAD (A)').selectOption('25');
  assert.equal(await sel('SECCIÓN CABLE').inputValue(), '4');
  await sel('INTENSIDAD (A)').selectOption('40');
  assert.equal(await sel('SECCIÓN CABLE').inputValue(), '10');
  assert.match(await f.locator('#cumple').textContent(), /^CUMPLE/);
  ok('Al elegir la intensidad se pone sola la sección (16 A → 2,5 · 25 A → 4 · 40 A → 10 mm² con H07Z1-K)');

  await sel('TIPO DE CABLE').selectOption('RZ1-K');
  assert.equal(await sel('SECCIÓN CABLE').inputValue(), '6', 'RZ1-K admite más intensidad: 40 A → 6 mm²');
  assert.match(await f.locator('#cumple').textContent(), /CUMPLE · IZ 49A RZ1-K 0,6\/1 KV/);
  await sel('SECCIÓN CABLE').selectOption('2.5');
  assert.match(await f.locator('#cumple').textContent(), /^NO CUMPLE/);
  ok('Tipo de cable H07Z1-K / RZ1-K 0,6/1 kV con CUMPLE / NO CUMPLE');
  await sel('SECCIÓN CABLE').selectOption('6');

  // PIA de cabecera antes del diferencial
  await f.locator('[data-new="PIA:2"]').click();
  const cabId = await f.locator('.dv.on').getAttribute('data-id');
  await f.locator('.dv.ID').click();
  await sel('P.I.A. ANTES DEL DIFERENCIAL').selectOption(cabId);
  await f.locator(`.dv[data-id="${cabId}"]`).click();
  assert.match(await f.locator('#ed').textContent(), /CABECERA DEL ID 1/);
  const svg = await f.locator('#t1').innerHTML();
  assert.ok(svg.includes('P.I.A. 2x16A C'), 'el unifilar dibuja el PIA de cabecera');
  ok('Se puede poner un P.I.A. que protege al diferencial y sale en el unifilar');

  // Botón para añadir directamente el P.I.A. de cabecera de un diferencial nuevo
  await f.locator('[data-new="ID:4"]').click();
  const idNuevo = await f.locator('.dv.on').getAttribute('data-id');
  if (process.env.CAPTURA) await f.locator('#ed').screenshot({ path: '/tmp/claude-0/editor-id.png' });
  const n0 = await f.locator('.dv').count();
  await f.locator('#nuevo-cab').click();
  assert.equal(await f.locator('.dv').count(), n0 + 1);
  assert.match(await f.locator('#ed').textContent(), /CABECERA DEL ID 2/);
  await f.locator(`.dv[data-id="${idNuevo}"]`).click();
  assert.ok(await f.locator('#sel-cab').inputValue());
  ok('«+ Añadir P.I.A. de cabecera» en el diferencial lo crea y lo deja puesto delante');

  // Caso real: IGA + ID con 3 circuitos colgando; la cabecera se mete entre el IGA y el ID
  // (los demás se corren), no se numera como circuito y no suma potencia.
  await f.locator('button', { hasText: /^NUEVO$/ }).click();
  if (await f.locator('#dk').count()) await f.locator('#dk').click();
  await f.locator('[data-new="IGA:2"]').click();
  await f.locator('[data-new="ID:2"]').click();
  const idR = await f.locator('.dv.on').getAttribute('data-id');
  const cir = [];
  for (let i = 0; i < 3; i++) { await f.locator('[data-new="PIA:2"]').click(); cir.push(await f.locator('.dv.on').getAttribute('data-id')); }
  for (const c of cir) { await f.locator(`.dv[data-id="${c}"]`).click(); await sel('DEPENDE DE').selectOption(idR); }
  await f.locator(`.dv[data-id="${idR}"]`).click();
  await f.locator('#nuevo-cab').click();
  const cabR = await f.locator('.dv.on').getAttribute('data-id');
  const pos = Object.fromEntries(await f.locator('.dv').evaluateAll((a) => a.map((d) => [d.dataset.id, parseInt(d.style.left, 10)])));
  assert.ok(pos[cabR] < pos[idR], 'la cabecera queda a la izquierda del diferencial');
  assert.ok(Object.values(pos).filter((x) => x > pos[cabR] && x < pos[idR]).length === 0, 'pegada al diferencial');
  const txt = await f.locator(`.dv[data-id="${cabR}"]`).innerText();
  assert.match(txt, /CAB\. ID 1/);
  assert.doesNotMatch(txt, /KW/);
  assert.ok(!/(^|\s)C\d{1,2}(\s|$)/.test(txt.replace(/C\d+\n400V/, '')), 'sin número de circuito');
  assert.match(await f.locator(`.dv[data-id="${cir[0]}"]`).innerText(), /\bC1\b/);
  await f.locator('nav button', { hasText: 'MEMORIA' }).click();
  const memo = await f.locator('#t5').innerText();
  assert.match(memo, /3 CIRCUITOS \+ 1 P\.I\.A\. DE CABECERA/);
  assert.match(memo, /POTENCIA TOTAL PREVISTA\s+11040 W/);
  await f.locator('nav button').first().click();
  ok('Cabecera real: va pegada delante del ID, no se numera como circuito y no suma potencia');
  if (process.env.CAPTURA) {
    await f.locator('nav button', { hasText: 'UNIFILAR' }).click();
    await f.locator('#t1 svg').first().screenshot({ path: '/tmp/claude-0/unifilar.png' });
    await f.locator('nav button').first().click();
    await f.locator('#ed').screenshot({ path: '/tmp/claude-0/editor.png' });
  }
  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
