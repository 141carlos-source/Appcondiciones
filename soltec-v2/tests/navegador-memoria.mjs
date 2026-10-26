// Prueba en Chromium móvil: localización (CartoCiudad), referencia catastral, plano IGN, fotos y memoria CNMC.
// Los servicios públicos se simulan con respuestas reales capturadas (aquí no hay acceso a internet).
// Uso: node tests/navegador-memoria.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, connect } from 'node:net';
import assert from 'node:assert/strict';

globalThis.self ??= globalThis;
const _r = createRequire(import.meta.url)('../vendor/pdf-lib.min.js');
const PDFLib = _r?.PDFDocument ? _r : globalThis.PDFLib;
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const pWeb = await libre();
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
const ok = (t) => console.log('✓ ' + t);
let browser;
const png = readFileSync(join(raiz, 'icon-512.png'));

try {
  const escucha = () => new Promise((r) => { const c = connect(pWeb, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); });
  for (let i = 0; i < 50 && !(await escucha()); i++) await new Promise((r) => setTimeout(r, 100));
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });

  // --- Servicios públicos simulados
  const jsonp = (route, data) => { const cb = new URL(route.request().url()).searchParams.get('callback'); route.fulfill({ contentType: 'application/javascript', body: `${cb}(${JSON.stringify(data)})` }); };
  // CartoCiudad: la petición normal no deja leerla desde una web (sin CORS) → la app usa JSONP.
  let cartoCaido = false;
  const gloria = [{ id: '130770000123', type: 'portal', tip_via: 'CALLE', address: 'GLORIA', portalNumber: 51, postalCode: '13730', muni: 'SANTA CRUZ DE MUDELA', province: 'CIUDAD REAL', lat: 38.6448, lng: -3.4655 }];
  await ctx.route('https://www.cartociudad.es/**', (route) => {
    const u = route.request().url();
    if (cartoCaido) return route.abort();
    if (u.includes('candidatesJsonp')) return jsonp(route, gloria);
    if (u.includes('/candidates?')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(gloria) }); // sin CORS
    return jsonp(route, {});
  });
  await ctx.route('https://nominatim.openstreetmap.org/**', (route) => route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/json',
    body: JSON.stringify([{ lat: '41.6562', lon: '-0.8773', address: { road: 'Calle de Alfonso I', house_number: '17', postcode: '50003', city: 'Zaragoza', province: 'Zaragoza' } }]) }));
  await ctx.route('https://ovc.catastro.meh.es/**', (route) => {
    const u = route.request().url();
    const h = { 'Access-Control-Allow-Origin': '*' };
    if (u.includes('Consulta_RCCOOR_Distancia')) return route.fulfill({ headers: h, contentType: 'application/json', body: JSON.stringify({ Consulta_RCCOOR_DistanciaResult: { control: { cucoor: 1 }, coordenadas_distancias: { coordd: [{ lpcd: [{ pc: { pc1: '9872023', pc2: 'VH5797S' }, ldt: 'CL GLORIA 51 SANTA CRUZ DE MUDELA (CIUDAD REAL)', dis: '4.2' }] }] } } }) });
    // Respuesta real de Consulta_DNPRC para 9872023VH5797S
    return route.fulfill({ headers: h, contentType: 'application/json', body: JSON.stringify({ consulta_dnprcResult: { control: { cudnp: 1, cucons: 3 }, bico: { bi: { idbi: { cn: 'UR', rc: { pc1: '9872023', pc2: 'VH5797S', car: '0001', cc1: 'W', cc2: 'X' } }, dt: { locs: { lous: { lourb: { loint: { es: 'T', pt: 'OD', pu: 'OS' } } } } }, ldt: 'CL GLORIA 51 13730 SANTA CRUZ DE MUDELA (CIUDAD REAL)', debi: { luso: 'Residencial' } } } } }) });
  });
  await ctx.route('https://www.ign.es/**', (route) => route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'image/png', body: png }));

  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  // Los fallos de red simulados (CartoCiudad sin CORS o caído) no cuentan como errores de la app
  page.on('console', (m) => { if (m.type() === 'error' && !/cartociudad|CORS|Failed to load resource/i.test(m.text())) errores.push(m.text()); });
  const dialogos = [];
  page.on('dialog', (d) => { dialogos.push(d.message()); d.accept(); });
  const base = `http://localhost:${pWeb}/index.html`;

  await page.goto(base + '#/inicio');
  await page.waitForFunction(() => window.soltec?.storage);
  const id = await page.evaluate(async () => (await window.soltec.storage.save('aviso', {
    numero: '2026-0001', concepto: 'Nuevo suministro vivienda', cliente: { nombre: 'Luis Gómez' },
    suministro: { direccion: 'CALLE GLORIA', numero: '51', poblacion: 'SANTA CRUZ DE MUDELA' }, electrico: {}, docs: {},
  })).id);
  await page.goto(base + '#/aviso/' + id);
  await page.click('summary:has-text("Cliente y suministro")');

  // CartoCiudad
  await page.click('#btn-buscar-direccion');
  await page.click('text=CALLE GLORIA 51, 13730');
  await page.waitForSelector('text=Dirección aplicada con coordenadas');
  assert.equal(await page.inputValue('#f-suministro-direccion'), 'CALLE GLORIA');
  assert.equal(await page.inputValue('#f-suministro-numero'), '51');
  assert.equal(await page.inputValue('#f-suministro-cp'), '13730');
  assert.equal(await page.inputValue('#f-suministro-provincia'), 'CIUDAD REAL');
  assert.equal(await page.inputValue('#f-suministro-lat'), '38.6448');
  ok('CartoCiudad (sin CORS → JSONP): calle y número por separado, CP, provincia y coordenadas');

  // CartoCiudad caído → OpenStreetMap
  cartoCaido = true;
  await page.click('#btn-buscar-direccion');
  await page.waitForSelector('text=resultados de OpenStreetMap');
  assert.match(await page.textContent('#estado-ubicacion'), /CartoCiudad no responde/);
  await page.click('text=CALLE DE ALFONSO I 17, 50003');
  await page.waitForSelector('text=Dirección aplicada con coordenadas 41.6562');
  assert.equal(await page.inputValue('#f-suministro-numero'), '17');
  ok('CartoCiudad caído: se busca en OpenStreetMap');
  // se vuelve a la dirección de la prueba para el Catastro
  cartoCaido = false;
  await page.click('#btn-buscar-direccion');
  await page.click('text=CALLE GLORIA 51, 13730');
  await page.waitForSelector('text=Dirección aplicada con coordenadas 38.6448');

  // Catastro
  await page.click('#btn-catastro');
  await page.waitForSelector('text=Referencia aplicada: 9872023VH5797S0001WX');
  assert.equal(await page.inputValue('#f-suministro-refCatastral'), '9872023VH5797S0001WX');
  assert.equal(await page.$eval('.campo[data-campo="suministro.refCatastral"]', (e) => e.classList.contains('pend')), false, 'referencia válida');
  ok('Catastro: referencia catastral de 20 caracteres obtenida y validada');

  // Plano y fotos
  await page.click('summary:has-text("Plano de situación y fotografías")');
  // Al encontrar la dirección el plano se genera solo, en A5 a escala 1:2000
  await page.waitForSelector('#vista-plano img');
  await page.waitForSelector('#estado-plano:has-text("Plano de situación listo")');
  const pedido = new URL(await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes('ign.es')).pop()));
  assert.equal(pedido.searchParams.get('WIDTH'), '1800');
  assert.equal(pedido.searchParams.get('HEIGHT'), '952');
  const [desc] = await Promise.all([page.waitForEvent('download'), page.click('#btn-plano-a5')]);
  assert.match(desc.suggestedFilename(), /^PLANO_SITUACION_A5_CALLE_GLORIA_51.*\.pdf$/);
  globalThis.self ??= globalThis;
  const _pl = (await import('node:module')).createRequire(import.meta.url)('../vendor/pdf-lib.min.js');
  const PL = _pl?.PDFDocument ? _pl : globalThis.PDFLib;
  const docA5 = await PL.PDFDocument.load(await (await import('node:fs/promises')).readFile(await desc.path()));
  const tam = docA5.getPage(0).getSize();
  assert.ok(Math.abs(tam.width - 595.28) < 0.1 && Math.abs(tam.height - 419.53) < 0.1, JSON.stringify(tam));
  ok('Al encontrar la dirección se genera el plano de situación y se descarga en PDF A5 (1:2000)');
  await page.click('#btn-plano');
  await page.waitForSelector('#estado-plano:has-text("Plano de situación listo")');
  await page.setInputFiles('#fotos-galeria', [{ name: 'cgp.png', mimeType: 'image/png', buffer: png }, { name: 'fachada.png', mimeType: 'image/png', buffer: readFileSync(join(raiz, 'icon-192.png')) }]);
  await page.waitForFunction(() => document.querySelectorAll('.foto').length === 2);
  await page.check('.foto >> nth=0 >> input[type=radio]');
  await page.fill('.foto >> nth=1 >> input[type=text]', 'Fachada principal');
  ok('Plano IGN con marcador y fotos con la de la CGP marcada');

  // Memoria
  await page.click('summary:has-text("Memoria técnica CNMC")');
  await page.selectOption('#m-tipo', 'NUEVO SUMINISTRO');
  await page.selectOption('#m-uso', 'VIVIENDA');
  await page.click('summary:has-text("A. Viviendas")');
  await page.check('#m-viv-0-aplica');
  await page.fill('#m-viv-0-potencia', '9,2');
  await page.selectOption('#m-viv-0-tension', '230 V');
  await page.waitForSelector('text=Total A+B+C+D+G: 9,2 kW');
  assert.equal(await page.inputValue('#f-electrico-potenciaKw'), '9,2');
  ok('Memoria: total A+B+C+D calculado y usado como potencia del aviso');
  await page.click('#guardar');
  await page.waitForSelector('.toast:has-text("Guardado")');
  await page.$eval('details:has(#generar-memoria)', (d) => { d.open = true; });
  await page.click('#generar-memoria');
  await page.waitForSelector('text=Memoria generada:');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#descargar-memoria')]);
  assert.equal(dl.suggestedFilename(), 'CNMC_CIRCULAR_1_2024_ENDESA_CALLE_GLORIA_51.pdf');
  const doc = await PDFLib.PDFDocument.load(readFileSync(await dl.path()));
  assert.equal(doc.getPageCount(), 5);
  ok('Memoria CNMC en PDF (5 páginas: datos, técnicos, plano y CGP, anexo, firma y sello)');
  await page.screenshot({ path: join(raiz, 'tests/captura-memoria.png'), fullPage: false });

  // Guardar la copia en el aviso y seguir editando: sin avisos falsos y sin perder la copia
  await page.click('text=Guardar copia en el aviso');
  await page.waitForSelector('text=Guardada en el aviso');
  await page.$eval('details:has(#f-observaciones)', (d) => { d.open = true; });
  await page.fill('#f-observaciones', 'Acometida subterránea');
  await page.click('#guardar');
  await page.waitForTimeout(500);
  assert.ok(!dialogos.some((m) => /otro dispositivo/.test(m)), 'sin aviso falso de edición simultánea');
  const archivos = await page.evaluate(async (aid) => (await window.soltec.storage.get(aid)).data.archivos.map((a) => a.tipo), id);
  assert.deepEqual(archivos, ['plano_a5', 'memoria']);
  ok('La copia de la memoria se guarda en el aviso y se conserva al seguir editando');

  // Sin servicios: se puede seguir a mano
  await ctx.unroute('https://ovc.catastro.meh.es/**');
  await ctx.route('https://ovc.catastro.meh.es/**', (r) => r.abort());
  await page.$eval('details:has(#btn-catastro)', (d) => { d.open = true; });
  await page.click('#btn-catastro');
  await page.waitForSelector('text=Abrir la Sede del Catastro');
  ok('Si el Catastro no responde, la app lo dice y ofrece la Sede del Catastro');

  assert.deepEqual(errores.filter((e) => !/net::ERR_FAILED|Failed to fetch/.test(e)), []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
