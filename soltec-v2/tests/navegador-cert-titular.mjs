// Prueba en Chromium móvil: certificado de tierra con solicitante (cliente del aviso) y titular distinto,
// y rehacer los certificados ya hechos con el formato nuevo (Ajustes › Certificados ya hechos).
// Uso: node tests/navegador-cert-titular.mjs
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const pWeb = await libre();
const web = spawn('python3', ['-m', 'http.server', String(pWeb), '--bind', '127.0.0.1'], { cwd: raiz, stdio: 'ignore' });
const ok = (t) => console.log('✓ ' + t);
// Texto de un PDF (pdftotext si está; si no, se omite esa comprobación)
const textoPdf = (bytes) => { try { const d = mkdtempSync(join(tmpdir(), 'cert-')); writeFileSync(join(d, 'c.pdf'), bytes); return execFileSync('pdftotext', ['-layout', join(d, 'c.pdf'), '-'], { encoding: 'utf8' }); } catch { return null; } };
let browser;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${pWeb}/index.html`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  page.setDefaultTimeout(20000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  const base = `http://localhost:${pWeb}/index.html`;
  await page.goto(base + '#/inicio');
  await page.waitForFunction(() => window.soltec?.storage);
  const [id, idViejo] = await page.evaluate(async () => {
    const s = window.soltec.storage, { nuevoAviso } = await import('./core/model.js');
    await s.save('config', { empresa: { nombre: 'M. A. SOLTEC SL', nif: 'B99506651', localidad: 'LA PUEBLA DE ALFINDEN' }, tecnico: { nombre: 'CARLOS' } }, { id: 'empresa' });
    await s.save('aviso', nuevoAviso({ numero: '2026-0001', cliente: { nombre: 'COMUNIDAD SOL', nif: 'H50000000', telefono: '976000000', contacto: '', email: '', iban: '' }, suministro: { direccion: 'CALLE SOL', numero: '2', piso: '', puerta: '', cp: '50171', poblacion: 'LA PUEBLA DE ALFINDÉN', provincia: 'ZARAGOZA', refCatastral: '', lat: '', lon: '', cups: '' } }));
    const base = { cliente: { nombre: 'ANA GIL', nif: '12345678Z', telefono: '', contacto: '', email: '', iban: '' }, suministro: { direccion: 'CALLE MAYOR', numero: '10', piso: '', puerta: '', cp: '50001', poblacion: 'ZARAGOZA', provincia: 'ZARAGOZA', refCatastral: '', lat: '', lon: '', cups: '' } };
    const a = await s.save('aviso', nuevoAviso({ numero: '2026-0040', ...base }));
    // Un certificado ya hecho con el formato anterior (PDF guardado sin «formato»)
    const viejo = await s.putFile({ name: 'CERT_VIEJO.pdf', mime: 'application/pdf', bytes: new TextEncoder().encode('%PDF-1.4 viejo') });
    const b = await s.save('aviso', nuevoAviso({ numero: '2026-0041', ...base, certificados: { tierra: { fecha: '2026-10-01', medida: '20' } }, archivos: [{ tipo: 'cert_tierra', hash: viejo.hash, name: viejo.name, mime: 'application/pdf', size: viejo.size, addedAt: '2026-10-01T10:00:00.000Z' }] }));
    return [a.id, b.id];
  });

  // Certificado nuevo: solicitante = cliente; titular distinto con autorrelleno
  await page.goto(base + '#/aviso/' + id);
  await page.click('summary:has-text("Certificados")');
  await page.selectOption('#cert-tipo', 'tierra');
  await page.waitForSelector('#cert-titular');
  assert.match(await page.textContent('#cert-titular'), /Solicitante: ANA GIL · 12345678Z \(el cliente del aviso\)/);
  assert.match(await page.textContent('#cert-titular'), /Titular: el mismo que el solicitante/);
  await page.check('#ct-titularDistinto');
  await page.waitForSelector('#ct-titular-nombre');
  await page.click('#ct-titular-nombre');
  await page.keyboard.type('comun');
  await page.tap('[data-campo] .sugerencia, #cert-titular .sugerencia');
  assert.equal(await page.inputValue('#ct-titular-nombre'), 'COMUNIDAD SOL');
  assert.equal(await page.inputValue('#ct-titular-nif'), 'H50000000');
  assert.equal(await page.inputValue('#ct-titular-telefono'), '+34 976 000 000');
  assert.match(await page.inputValue('#ct-titular-direccion'), /CALLE SOL 2/);
  ok('Solicitante = cliente del aviso; «titular distinto» con sus datos (autorrelleno de clientes ya trabajados)');

  await page.fill('#ct-medida', '12,5');
  await page.click('#cert-generar');
  await page.waitForSelector('#cert-guardar');
  await page.click('#cert-guardar');
  await page.waitForSelector('#cert-guardar:has-text("Guardado en el aviso")');
  const pdf1 = await page.evaluate(async (i) => {
    const r = await window.soltec.storage.get(i), a = r.data.archivos.find((x) => x.tipo === 'cert_tierra');
    return { formato: a.formato, bytes: [...new Uint8Array(await (await window.soltec.storage.getFileBlob(a.hash)).arrayBuffer())], titular: r.data.certificados.tierra.titular };
  }, id);
  assert.equal(pdf1.formato, 2);
  assert.equal(pdf1.titular.nombre, 'COMUNIDAD SOL', 'el titular se guarda en el aviso');
  const t1 = textoPdf(Buffer.from(pdf1.bytes));
  if (t1) {
    assert.match(t1, /2\. SOLICITANTE[\s\S]*ANA GIL[\s\S]*3\. TITULAR DE LA INSTALACIÓN[\s\S]*COMUNIDAD SOL[\s\S]*H50000000/);
    assert.match(t1, /4\. EMPLAZAMIENTO/);
  }
  ok('PDF: «2. Solicitante» (el cliente) y «3. Titular de la instalación» con los datos del titular');

  // Ya hechos: Ajustes › Certificados ya hechos › Rehacer
  await page.evaluate(() => { window.soltec.guardia = null; });
  await page.goto(base + '#/ajustes');
  await page.click('summary:has-text("Certificados ya hechos")');
  await page.waitForSelector('#rehacer-certificados');
  assert.match(await page.textContent('#bloque-cert-antiguos'), /1 certificado de toma de tierra guardado con el formato anterior/);
  await page.click('#rehacer-certificados');
  await page.waitForSelector('#rehacer-resultado');
  assert.match(await page.textContent('#rehacer-resultado'), /Rehechos: 2026-0041/);
  assert.match(await page.textContent('#bloque-cert-antiguos'), /Todos los certificados de toma de tierra están con el formato actual/);
  const pdf2 = await page.evaluate(async (i) => {
    const s = window.soltec.storage, r = await s.get(i), a = r.data.archivos.filter((x) => x.tipo === 'cert_tierra');
    const h = await s.history(i);
    return { n: a.length, formato: a[0].formato, bytes: [...new Uint8Array(await (await s.getFileBlob(a[0].hash)).arrayBuffer())], ev: h.map((e) => e.data.text) };
  }, idViejo);
  assert.equal(pdf2.n, 1); assert.equal(pdf2.formato, 2);
  assert.ok(pdf2.ev.some((t) => /rehecho con solicitante y titular/.test(t)), 'queda anotado en el historial');
  const t2 = textoPdf(Buffer.from(pdf2.bytes));
  if (t2) assert.match(t2, /2\. SOLICITANTE[\s\S]*ANA GIL[\s\S]*3\. TITULAR DE LA INSTALACIÓN[\s\S]*El mismo que el solicitante/);
  ok('Los ya hechos se rehacen de una vez con el formato nuevo (titular = el mismo), con nota en el historial');

  assert.deepEqual(errores, []);
  ok('Sin errores en la consola');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
