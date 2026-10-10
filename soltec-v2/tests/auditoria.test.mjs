// Pruebas de las correcciones de la auditoría.
import 'fake-indexeddb/auto';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { Storage } from '../core/storage.js';
import { SyncManager } from '../core/sync.js';
import { nuevoAviso, normalizarAviso, numerosRepetidos, hoyLocal } from '../core/model.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const procesos = [];
after(() => procesos.forEach((p) => p.kill()));
const libre = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

async function servidor(port = null) {
  const dir = mkdtempSync(join(tmpdir(), 'soltec-aud-'));
  port ??= await libre();
  const p = spawn('python3', [join(raiz, 'servidor-pc/server.py')], { env: { ...process.env, SOLTEC_V2_DIR: dir, SOLTEC_V2_PORT: String(port) }, stdio: 'ignore' });
  procesos.push(p);
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) { try { await fetch(url + '/'); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  return { url, port, proc: p, clave: JSON.parse(readFileSync(join(dir, 'soltec-v2-config.json'), 'utf8')).key };
}
let n = 0;
async function dispositivo(srv) {
  const s = await Storage.open({ name: 'aud_' + n++ });
  const sync = new SyncManager(s);
  await sync.guardarConfig({ url: srv.url, clave: srv.clave });
  return { s, sync };
}

test('fecha de hoy en hora local, no en UTC', () => {
  // 10 oct 2026 a las 00:30 en España = 9 oct 22:30 UTC
  const d = new Date(2026, 9, 10, 0, 30);
  assert.equal(hoyLocal(d), '2026-10-10');
});

test('un aviso antiguo o incompleto se abre sin fallos y sin perder datos', () => {
  const viejo = { numero: '2025-0007', cliente: { nombre: 'Luis' }, condiciones: { ref: 'X1' } };
  const a = normalizarAviso(viejo);
  assert.equal(a.cliente.nombre, 'Luis');
  assert.equal(a.cliente.nif, '');
  assert.deepEqual(a.condiciones.pdfs, []);
  assert.equal(a.condiciones.ref, 'X1');
  assert.equal(a.docs.contrato, 'revisar');
  assert.equal(a.fecha, '');
  assert.equal(viejo.docs, undefined, 'no modifica el original');
});

test('detecta números de aviso repetidos', () => {
  const regs = [
    { id: 'a', createdAt: '2026-10-10T10:00:00Z', data: { numero: '2026-0003' } },
    { id: 'b', createdAt: '2026-10-10T09:00:00Z', data: { numero: '2026-0003' } },
    { id: 'c', createdAt: '2026-10-10T09:00:00Z', data: { numero: '2026-0004' } },
  ];
  const r = numerosRepetidos(regs);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].registros.map((x) => x.id), ['b', 'a'], 'el más antiguo primero');
});

test('el PC pierde sus datos: el móvil lo detecta y se los vuelve a subir', async () => {
  const srv = await servidor();
  const movil = await dispositivo(srv);
  const f = await movil.s.putFile({ name: 'c.pdf', mime: 'application/pdf', bytes: new TextEncoder().encode('%PDF reset') });
  await movil.s.save('aviso', nuevoAviso({ numero: 'R1', condiciones: { ref: '', pdfs: [f] } }));
  await movil.s.save('aviso', nuevoAviso({ numero: 'R2' }));
  await movil.sync.sincronizar();
  await movil.sync.sincronizar(); // el cursor avanza

  // Se arranca un servidor vacío en el mismo puerto (como si se hubiera borrado su carpeta)
  srv.proc.kill();
  await new Promise((r) => setTimeout(r, 300));
  const nuevo = await servidor(srv.port);
  await movil.sync.guardarConfig({ url: srv.url, clave: nuevo.clave });
  const inf = await movil.sync.sincronizar();
  assert.equal(inf.servidorReiniciado, true);
  assert.equal(inf.conflictos, 0);
  const st = await (await fetch(srv.url + '/api/v2/status', { headers: { 'X-Soltec-Key': nuevo.clave } })).json();
  assert.equal(st.records, 2);
  assert.equal(st.blobs, 1);
  assert.deepEqual(await movil.s.pendingCounts(), { records: 0, files: 0 });
});

test('cambiar a otro servidor que ya tiene los datos no crea conflictos falsos', async () => {
  const srvA = await servidor();
  const srvB = await servidor();
  const movil = await dispositivo(srvA);
  const tablet = await dispositivo(srvB);
  // Mismo aviso en los dos servidores: el móvil lo sube a A; la tablet lo copia a B
  const a = await movil.s.save('aviso', nuevoAviso({ numero: 'M1', observaciones: 'v1' }));
  await movil.sync.sincronizar();
  await tablet.s._applyRemote({ ...(await movil.s.get(a.id)), serverRev: 0 });
  await tablet.s._requeueAll();
  await tablet.sync.sincronizar();
  // B recibe un cambio más nuevo desde la tablet
  await tablet.s.patch(a.id, { observaciones: 'v2 desde B' });
  await tablet.sync.sincronizar();

  // El móvil pasa al servidor B: su v1 no debe chocar con la v2 de B
  await movil.sync.guardarConfig({ url: srvB.url, clave: srvB.clave });
  const inf = await movil.sync.sincronizar();
  assert.equal(inf.conflictos, 0);
  assert.equal((await movil.s.get(a.id)).data.observaciones, 'v2 desde B');
});

test('el service worker guarda todos los archivos que la app necesita sin conexión', () => {
  const sw = readFileSync(join(raiz, 'sw.js'), 'utf8');
  const shell = new Set([...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean));
  const visto = new Set();
  const faltan = [];
  const recorrer = (rel) => {
    if (visto.has(rel)) return;
    visto.add(rel);
    if (!shell.has(rel)) faltan.push(rel);
    const src = readFileSync(join(raiz, rel), 'utf8');
    const base = dirname(join(raiz, rel));
    for (const m of src.matchAll(/(?:import\s[^'"]*from\s*|import\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)) recorrer(resolve(base, m[1]).slice(raiz.length + 1));
    for (const m of src.matchAll(/['"]\.\/(assets\/[^'"]+)['"]/g)) if (!shell.has(m[1])) faltan.push(m[1]);
  };
  recorrer('app.js');
  for (const f of ['index.html', 'app.css', 'manifest.webmanifest']) if (!shell.has(f)) faltan.push(f);
  assert.deepEqual([...new Set(faltan)], []);
  for (const f of shell) assert.ok(existsSync(join(raiz, f)), `${f} no existe`);
});
