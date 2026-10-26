// Prueba en Chromium: en CuadroLab, sección automática según la intensidad, tipo de cable
// (H07Z1-K por defecto o RZ1-K 0,6/1 kV) con CUMPLE / NO CUMPLE, y P.I.A. antes del diferencial.
// Uso: node tests/navegador-cuadros-cable.mjs
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
  await f.locator('[data-pal="ID:0"]').waitFor({ timeout: 20000 });
  await f.locator('[data-pal="ID:0"]').selectOption('40|30');
  await f.locator('[data-pal="PIA:1"]').selectOption('16'); // queda seleccionado
  const sel = (etq) => f.locator(`#ed label:has-text("${etq}") select`);
  assert.equal(await sel('TIPO DE CABLE').inputValue(), 'H07Z1-K');
  assert.equal(await sel('SECCIÓN CABLE').inputValue(), '2.5', '16 A → 2,5 mm² por defecto');
  await sel('INTENSIDAD (A)').selectOption('25');
  assert.equal(await sel('SECCIÓN CABLE').inputValue(), '6');
  await sel('INTENSIDAD (A)').selectOption('20');
  assert.equal(await sel('SECCIÓN CABLE').inputValue(), '4');
  await sel('INTENSIDAD (A)').selectOption('10');
  assert.equal(await sel('SECCIÓN CABLE').inputValue(), '1.5');
  await sel('INTENSIDAD (A)').selectOption('50');
  assert.equal(await sel('SECCIÓN CABLE').inputValue(), '16');
  await sel('INTENSIDAD (A)').selectOption('32');
  assert.equal(await sel('SECCIÓN CABLE').inputValue(), '10');
  await sel('INTENSIDAD (A)').selectOption('40');
  assert.equal(await sel('SECCIÓN CABLE').inputValue(), '10');
  assert.match(await f.locator('#cumple').textContent(), /^CUMPLE/);
  ok('Al elegir la intensidad se pone la sección de la tabla de SOLTEC (10→1,5 · 16→2,5 · 20→4 · 25→6 · 32/40→10 · 50→16 mm²)');

  await sel('TIPO DE CABLE').selectOption('RZ1-K');
  assert.equal(await sel('SECCIÓN CABLE').inputValue(), '10', 'la tabla manda también con RZ1-K');
  await sel('SECCIÓN CABLE').selectOption('6');
  assert.match(await f.locator('#cumple').textContent(), /CUMPLE · IZ 49A RZ1-K 0,6\/1 KV/);
  await sel('SECCIÓN CABLE').selectOption('2.5');
  assert.match(await f.locator('#cumple').textContent(), /^NO CUMPLE/);
  ok('Tipo de cable H07Z1-K / RZ1-K 0,6/1 kV con CUMPLE / NO CUMPLE');
  await sel('SECCIÓN CABLE').selectOption('6');

  // PIA de cabecera antes del diferencial
  await f.locator('[data-pal="PIA:1"]').selectOption('16');
  const cabId = await f.locator('.dv.on').getAttribute('data-id');
  await f.locator('.dv.ID').click();
  await sel('P.I.A. ANTES DEL DIFERENCIAL').selectOption(cabId);
  await f.locator(`.dv[data-id="${cabId}"]`).click();
  assert.match(await f.locator('#ed').textContent(), /CABECERA DEL ID 1/);
  const svg = await f.locator('#t1').innerHTML();
  assert.ok(svg.includes('P.I.A. 2x16A C'), 'el unifilar dibuja el PIA de cabecera');
  ok('Se puede poner un P.I.A. que protege al diferencial y sale en el unifilar');

  // Botón para añadir directamente el P.I.A. de cabecera de un diferencial nuevo
  await f.locator('[data-pal="ID:1"]').selectOption('40|30');
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
  await await f.locator('[data-pal="ID:0"]').selectOption('40|30');
  const idR = await f.locator('.dv.on').getAttribute('data-id');
  const cir = [];
  for (let i = 0; i < 3; i++) { await f.locator('[data-pal="PIA:1"]').selectOption('16'); cir.push(await f.locator('.dv.on').getAttribute('data-id')); }
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
  // Paleta nueva: sin IGA; protector mono 3/6 y tri 5/9; bornero y diferencial mono/tri; PIA 1-4 módulos con intensidad
  await f.locator('button', { hasText: /^NUEVO$/ }).click();
  if (await f.locator('#dk').count()) await f.locator('#dk').click();
  assert.equal(await f.locator('[data-new^="IGA:"]').count(), 0, 'el IGA ya no está en la paleta');
  const opciones = (pal) => f.locator(`[data-pal="${pal}"] option`).allTextContents();
  assert.deepEqual((await opciones('SOB:0')).slice(1), ['25 A', '32 A', '40 A', '63 A', '80 A']);
  assert.deepEqual((await opciones('SOB:1')).slice(1), ['25 A', '32 A', '40 A', '63 A', '80 A']);
  assert.deepEqual((await opciones('SOB:2')).slice(1), ['25 A', '32 A', '40 A', '63 A', '80 A', '100 A', '125 A', '160 A', '200 A']);
  assert.deepEqual((await opciones('SOB:3')).slice(1), ['25 A', '32 A', '40 A', '63 A', '80 A', '100 A', '125 A', '160 A', '200 A']);
  assert.deepEqual((await opciones('BOR:0')).slice(1), ['MONOFÁSICO', 'TRIFÁSICO']);
  assert.deepEqual((await opciones('ID:0')).slice(1), ['2x25A 30mA', '2x25A 300mA', '2x40A 30mA', '2x40A 300mA', '2x63A 30mA', '2x63A 300mA', '2x80A 30mA', '2x80A 300mA']);
  assert.deepEqual((await opciones('ID:1')).slice(1), ['4x25A 30mA', '4x25A 300mA', '4x40A 30mA', '4x40A 300mA', '4x63A 30mA', '4x63A 300mA', '4x80A 30mA', '4x80A 300mA']);
  const hasta80 = ['6 A', '10 A', '16 A', '20 A', '25 A', '32 A', '40 A', '50 A', '63 A', '80 A'];
  assert.deepEqual((await opciones('PIA:0')).slice(1), hasta80);
  for (const g of [1, 2, 3]) assert.deepEqual((await opciones('PIA:' + g)).slice(1), hasta80.concat(['100 A', '125 A']));
  const ultimo = async () => f.locator('.dv.on');
  await f.locator('[data-pal="SOB:3"]').selectOption('160');
  assert.match(await (await ultimo()).getAttribute('style'), new RegExp(`width:${9 * 34 - 2}px`));
  assert.equal(await sel('INTENSIDAD (A)').inputValue(), '160');
  await f.locator('[data-pal="BOR:0"]').selectOption('3');
  assert.match(await (await ultimo()).innerText(), /TRIFÁSICO/);
  await f.locator('[data-pal="ID:1"]').selectOption('63|300');
  assert.match(await f.locator('#ed').innerText(), /4 MÓD/);
  assert.equal(await sel('INTENSIDAD (A)').inputValue(), '63');
  assert.equal(await sel('SENSIBILIDAD (MA)').inputValue(), '300');
  await f.locator('[data-pal="PIA:2"]').selectOption('32');
  assert.equal(await sel('INTENSIDAD (A)').inputValue(), '32');
  assert.equal(await sel('SECCIÓN CABLE').inputValue(), '10');
  assert.match(await f.locator('#ed').innerText(), /3 MÓD/);
  assert.equal(await f.locator('[data-pal="PIA:2"]').inputValue(), '', 'el desplegable vuelve a su título');
  await f.locator('[data-pal="PIA:3"]').selectOption('125');
  assert.equal(await sel('SECCIÓN CABLE').inputValue(), '50');
  assert.match(await (await ultimo()).innerText(), /NXB-125/);
  // Todas las intensidades de la paleta, monofásicas y trifásicas, con su potencia: CUMPLE (sin falsos NO CUMPLE por redondeo)
  await page.frame({ url: /cuadrolab/ }).evaluate(() => { S.w = 24; S.r = 8; rd(); });
  const tabla = { 6: '1.5', 10: '1.5', 16: '2.5', 20: '4', 25: '6', 32: '10', 40: '10', 50: '16', 63: '16', 80: '25', 100: '35', 125: '50' };
  for (const [g, lista] of [[1, [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125]], [3, [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125]]]) {
    for (const i of lista) {
      await f.locator(`[data-pal="PIA:${g}"]`).selectOption(String(i));
      assert.equal(await sel('SECCIÓN CABLE').inputValue(), tabla[i], `${i} A`);
      assert.match(await f.locator('#cumple').textContent(), /^CUMPLE/, `${g === 3 ? 'trifásico' : 'monofásico'} ${i} A`);
    }
  }
  ok('Todas las intensidades (6-125 A), monofásicas y trifásicas: sección de la tabla y CUMPLE');
  ok('Paleta: sin IGA; protector mono 25-80 A y tri 25-200 A; diferencial 2x/4x 25-80 A 30/300 mA; bornero; PIA 1 mód. hasta 80 A y 2-4 mód. hasta 125 A, con sección');
  await f.locator('nav button', { hasText: 'UNIFILAR' }).click();
  assert.doesNotMatch(await f.locator('#t1').innerText(), /I\.G\.A\. PENDIENTE/);
  if (process.env.CAPTURA) await f.locator('#t1 .a4').screenshot({ path: '/tmp/claude-0/cab/uni-nuevo.png' });
  await f.locator('nav button').first().click();
  if (process.env.CAPTURA) await f.locator('#t0').screenshot({ path: '/tmp/claude-0/cab/paleta.png' });
  ok('Unifilar sin «I.G.A. PENDIENTE»');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
