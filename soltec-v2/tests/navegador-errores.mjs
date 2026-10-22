// Prueba en Chromium: los errores de la app y de los formularios incrustados quedan en Ajustes › Registro de errores.
// Uso: node tests/navegador-errores.mjs
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
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 1100 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  const base = `http://localhost:${pWeb}/index.html`;
  await page.goto(base + '#/inicio');
  await page.waitForFunction(() => window.soltec?.anotarError);
  await page.evaluate(() => { setTimeout(() => { throw new Error('Fallo de prueba en la app'); }); Promise.reject(new Error('Promesa rechazada de prueba')); });
  await page.waitForTimeout(400);

  // Error dentro de CuadroLab (iframe)
  await page.goto(base + '#/aviso/nuevo');
  await page.waitForSelector('#f-cliente-nombre');
  await page.click('summary:has-text("Cuadros eléctricos")');
  await page.click('#abrir-cuadro');
  const f = page.frameLocator('#iframe-cuadro');
  await f.locator('[data-pal="ID:0"]').waitFor({ timeout: 20000 });
  const fr = page.frame({ url: /cuadrolab/ });
  await fr.evaluate(() => setTimeout(() => { throw new Error('Fallo de prueba en CuadroLab'); }));
  await page.waitForTimeout(400);
  await page.click('#volver-cuadro');

  await page.goto(base + '#/ajustes');
  await page.click('summary:has-text("Registro de errores")');
  const txt = await page.textContent('#bloque-errores');
  assert.match(txt, /Fallo de prueba en la app/);
  assert.match(txt, /Promesa rechazada de prueba/);
  assert.match(txt, /Fallo de prueba en CuadroLab/);
  assert.match(txt, /cuadrolab/);
  assert.match(await page.textContent('summary:has-text("Registro de errores")'), /\(3\)/);
  ok('Los errores de la app, de promesas y de CuadroLab quedan en Ajustes › Registro de errores');

  await page.evaluate(() => { navigator.clipboard.writeText = async (t) => { window.__copiado = t; }; });
  await page.click('#errores-copiar');
  await page.waitForFunction(() => window.__copiado);
  const copiado = await page.evaluate(() => window.__copiado);
  assert.match(copiado, /SOLTEC V2 · registro de errores/);
  assert.match(copiado, /Versión: V2-/);
  ok('«Copiar» deja el informe listo para pegarlo en el chat');

  await page.click('#errores-borrar');
  await page.click('.sd-fondo #dk');
  await page.click('summary:has-text("Registro de errores")');
  assert.match(await page.textContent('#bloque-errores'), /Sin errores registrados/);
  ok('«Borrar» vacía el registro');
} catch (e) {
  console.error('✗', e.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  web.kill();
}
