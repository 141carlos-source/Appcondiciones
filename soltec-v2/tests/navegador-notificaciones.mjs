// Prueba en Chromium: notificaciones de los recordatorios (app abierta y service worker con la app cerrada).
// La hora de la página se fija a las 12:00 para que caiga dentro del horario de avisos (8:00–21:00).
// Uso: node tests/navegador-notificaciones.mjs
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
  browser = await chromium.launch({ channel: 'chromium' }); // Chromium completo: el «headless shell» deniega siempre las notificaciones
  const origen = `http://localhost:${pWeb}`;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  await ctx.grantPermissions(['notifications'], { origin: origen });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const mediodia = new Date(); mediodia.setHours(12, 0, 0, 0);
  await page.clock.setFixedTime(mediodia);
  // Se anotan las notificaciones que muestra la página
  await page.addInitScript(() => {
    window.__notifs = [];
    const orig = ServiceWorkerRegistration.prototype.showNotification;
    ServiceWorkerRegistration.prototype.showNotification = function (t, o) { window.__notifs.push({ t, o }); return orig.call(this, t, o).catch(() => {}); };
  });
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  const base = origen + '/index.html';

  await page.goto(base + '#/aviso/nuevo');
  await page.waitForSelector('#f-cliente-nombre');
  await page.fill('#f-cliente-nombre', 'Talleres Ebro');
  await page.click('#guardar');
  await page.waitForSelector('h1:has-text("Aviso 2026-0001")');
  const id = await page.evaluate(async () => {
    const s = window.soltec.storage, r = (await s.list('aviso'))[0];
    const d = new Date(); d.setDate(d.getDate() - 20);
    await s.save('evento', { at: d.toISOString(), kind: 'solicitud_presentada', text: 'Solicitud presentada' }, { ref: r.id });
    return r.id;
  });
  await page.evaluate(() => navigator.serviceWorker.ready);

  // App abierta
  const n1 = await page.evaluate(async () => { await window.soltec.storage.setMeta('recordatoriosAvisados', {}); return window.soltec.revisarRecordatorios(); });
  assert.equal(n1, 1, JSON.stringify(await page.evaluate(async () => [Notification.permission, await window.soltec.storage.getMeta('notifRecordatorios'), window.__notifs.length, new Date().toString()])));
  const no = await page.evaluate(() => window.__notifs.at(-1));
  assert.equal(no.t, 'SOLTEC · Recordatorio');
  assert.match(no.o.body, /Condiciones solicitadas hace 20 días sin respuesta/);
  assert.equal(no.o.data.url, '#/aviso/' + id);
  assert.equal(await page.evaluate(() => window.soltec.revisarRecordatorios()), 0);
  ok('Con la app abierta: notificación «Condiciones solicitadas hace 20 días sin respuesta» que abre el aviso, una vez al día');

  // Ajustes: estado, probar y desactivar
  await page.goto(base + '#/ajustes');
  await page.click('summary:has-text("Recordatorios automáticos")');
  await page.waitForSelector('#notif-estado');
  assert.match(await page.textContent('#notif-estado'), /Activadas en este dispositivo/);
  await page.click('#notif-probar');
  await page.waitForFunction(() => window.__notifs.some((n) => n.t === 'SOLTEC · Prueba'));
  await page.click('#notif-desactivar');
  await page.waitForSelector('#notif-activar');
  assert.match(await page.textContent('#notif-estado'), /Desactivadas/);
  await page.evaluate(() => window.soltec.storage.setMeta('recordatoriosAvisados', {}));
  assert.equal(await page.evaluate(() => window.soltec.revisarRecordatorios()), 0, 'desactivadas: no avisa');
  await page.click('#notif-activar');
  await page.waitForSelector('#notif-probar');
  if (process.env.CAPTURAS) { await page.locator('#detalles-recordatorios').scrollIntoViewIfNeeded(); await page.screenshot({ path: join(process.env.CAPTURAS, 'notif-ajustes.png'), fullPage: false }); }
  ok('Ajustes: estado de las notificaciones, «Probar», «Desactivar» y «Activar» en este dispositivo');

  // Service worker (app cerrada): lee la base de datos y notifica con las mismas reglas
  const hora = new Date().getHours(); // el service worker usa la hora real
  await page.evaluate(() => window.soltec.storage.setMeta('recordatoriosAvisados', {}));
  await page.evaluate(() => navigator.serviceWorker.controller.postMessage({ tipo: 'REVISAR_RECORDATORIOS' }));
  if (hora >= 8 && hora < 21) {
    await page.waitForFunction(async () => (await (await navigator.serviceWorker.ready).getNotifications()).some((n) => n.title === 'SOLTEC · Recordatorio' && n.data?.url?.startsWith('#/aviso/')), undefined, { polling: 300, timeout: 10000 });
    await page.waitForFunction(async () => Object.keys((await window.soltec.storage.getMeta('recordatoriosAvisados')) || {}).length === 1, undefined, { polling: 300 });
    ok('Con la app cerrada: el service worker lee los avisos y notifica (y lo apunta para no repetir)');
  } else {
    await page.waitForTimeout(1500);
    assert.deepEqual(Object.keys((await page.evaluate(() => window.soltec.storage.getMeta('recordatoriosAvisados'))) || {}), [], 'fuera de horario no avisa');
    ok('Con la app cerrada: fuera de horario (' + hora + ' h) el service worker no avisa');
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
