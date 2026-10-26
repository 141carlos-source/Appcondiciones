// Prueba en Chromium móvil del importador de la V1.35 (con datos inventados).
// Uso: node tests/navegador-importar.mjs [ruta/a/soltec-central.json opcional para probar un archivo real]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, connect } from 'node:net';
import assert from 'node:assert/strict';
import { centralDePrueba, IDS } from './fixture-v1.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const pWeb = await libre();
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
const ok = (t) => console.log('✓ ' + t);
const real = process.argv[2];
let browser;

try {
  const escucha = () => new Promise((r) => { const c = connect(pWeb, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); });
  for (let i = 0; i < 50 && !(await escucha()); i++) await new Promise((r) => setTimeout(r, 100));
  browser = await chromium.launch();
  const base = `http://localhost:${pWeb}/index.html`;
  const nueva = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.setDefaultTimeout(real ? 120000 : 15000);
    const errores = [];
    page.on('pageerror', (e) => errores.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    return { ctx, page, errores };
  };

  // 1) Desde el archivo del PC central
  {
    const { ctx, page, errores } = await nueva();
    const archivo = real || join(mkdtempSync(join(tmpdir(), 'v1-')), 'soltec-central.json');
    if (!real) writeFileSync(archivo, JSON.stringify(centralDePrueba()));
    await page.goto(base + '#/ajustes');
    await page.click('#enlace-importar');
    await page.setInputFiles('#archivo-central', archivo);
    await page.waitForSelector('#confirmar-importar');
    const resumen = await page.textContent('.resumen-import');
    if (!real) assert.match(resumen, /3 avisos activos \(2 con condiciones/);
    await page.click('#confirmar-importar');
    await page.waitForSelector('#resultado-importar');
    console.log('   ' + (await page.textContent('#resultado-importar')).replace(/Ver Inicio.*/, '').trim());
    await page.screenshot({ path: join(raiz, 'tests/captura-importar.png') });
    ok(real ? 'Archivo real importado desde la pantalla' : 'Importación desde soltec-central.json');
    if (!real) {
      await page.goto(base + '#/expedientes');
      await page.waitForSelector('.tarjeta.exp');
      assert.equal(await page.$$eval('.tarjeta.exp', (t) => t.length), 2);
      await page.goto(base + '#/inicio');
      await page.fill('#buscador-unico', String(IDS.A));
      await page.waitForSelector('#buscador-unico + .lista .tarjeta');
      await page.click('#buscador-unico + .lista .tarjeta');
      await page.waitForSelector(`text=V1.35 nº ${IDS.A}`);
      await page.click('summary:has-text("Condiciones y trámite")');
      await page.waitForSelector('text=COND_V2.pdf');
      ok('Los expedientes aparecen, se encuentran por el número de la V1.35 y conservan sus PDF');
      await page.goto(base + '#/ajustes');
      await page.click('summary:has-text("Empresa")').catch(() => {});
      const empresa = await page.evaluate(async () => (await window.soltec.storage.get('empresa'))?.data);
      assert.equal(empresa.empresa.nombre, 'EMPRESA DE PRUEBA SL');
      assert.ok(empresa.logo && empresa.sello);
      ok('Datos de empresa, logo y sello rellenados');
      // Segunda vez: nada nuevo
      await page.goto(base + '#/importar');
      await page.setInputFiles('#archivo-central', archivo);
      await page.waitForSelector('text=ya se importaron antes');
      await page.click('#confirmar-importar');
      await page.waitForSelector('#resultado-importar');
      assert.match(await page.textContent('#resultado-importar'), /0 avisos, 0 a la papelera, 0 citas, 0 partes/);
      ok('Importar dos veces no duplica nada');
    }
    assert.deepEqual(errores, []);
    await ctx.close();
  }

  // 2) Desde la V1.35 de este navegador (localStorage + IndexedDB con Blobs reales)
  if (!real) {
    const { ctx, page, errores } = await nueva();
    await page.goto(base + '#/inicio');
    await page.waitForFunction(() => window.soltec?.storage);
    const central = centralDePrueba();
    await page.evaluate(async ({ ls, stores }) => {
      for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v);
      const aBlob = (x) => {
        if (x && x.__soltecBlob) { const [c, b] = x.data.split(','); const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Blob([u], { type: x.mime }); }
        if (Array.isArray(x)) return x.map(aBlob);
        if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, aBlob(v)]));
        return x;
      };
      const db = await new Promise((ok) => { const r = indexedDB.open('APP_AVISOS_PERSISTENCIA', 3); r.onupgradeneeded = () => { r.result.createObjectStore('estado'); r.result.createObjectStore('planos'); }; r.onsuccess = () => ok(r.result); });
      for (const st of ['estado', 'planos']) {
        const tx = db.transaction(st, 'readwrite');
        for (const it of stores[st]) tx.objectStore(st).put(aBlob(it.value), it.key);
        await new Promise((ok) => { tx.oncomplete = ok; });
      }
      db.close();
    }, { ls: central.snapshot.localStorage, stores: central.snapshot.indexedDB.stores });
    await page.reload();
    await page.waitForSelector('text=Hay datos de la V1.35 en este navegador');
    ok('Inicio avisa de que hay datos de la V1.35 en el navegador');
    await page.click('text=Hay datos de la V1.35 en este navegador');
    await page.click('#leer-local');
    await page.waitForSelector('#confirmar-importar');
    await page.click('#confirmar-importar');
    await page.waitForSelector('#resultado-importar');
    assert.match(await page.textContent('#resultado-importar'), /3 avisos, 1 a la papelera, 1 citas, 1 partes/);
    const pdfs = await page.evaluate(async (id) => (await window.soltec.storage.get('v1-' + id)).data.condiciones.pdfs.length, IDS.A);
    assert.equal(pdfs, 2);
    const v1Intacta = await page.evaluate(() => JSON.parse(localStorage.getItem('APP_AVISOS_WEB_DATOS_V116_PERSISTENTE')).avisos.length);
    assert.equal(v1Intacta, 3);
    ok('Importación desde este navegador (con PDF guardados como archivos) y la V1.35 intacta');
    assert.deepEqual(errores, []);
    await ctx.close();
  }
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
