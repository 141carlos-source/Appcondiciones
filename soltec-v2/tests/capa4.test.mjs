// Prueba de extremo a extremo: dos dispositivos (móvil y PC) contra el servidor Python real.
import 'fake-indexeddb/auto';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { Storage } from '../core/storage.js';
import { SyncManager, huellasDe } from '../core/sync.js';
import { nuevoAviso, conPdfCondiciones } from '../core/model.js';

const here = dirname(fileURLToPath(import.meta.url));
let proc, url, clave, n = 0;

const puertoLibre = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'soltecv2-'));
  const port = await puertoLibre();
  proc = spawn('python3', [join(here, '../servidor-pc/server.py')], { env: { ...process.env, SOLTEC_V2_DIR: dir, SOLTEC_V2_PORT: String(port) }, stdio: 'ignore' });
  url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try { await fetch(url + '/'); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  clave = JSON.parse(readFileSync(join(dir, 'soltec-v2-config.json'), 'utf8')).key;
});
after(() => proc.kill());

async function dispositivo(nombre) {
  const s = await Storage.open({ name: `sync_${nombre}_${n++}` });
  const sync = new SyncManager(s);
  await sync.guardarConfig({ url, clave, nombre });
  return { s, sync };
}

test('clave incorrecta y PC apagado dan un mensaje claro', async () => {
  const { sync } = await dispositivo('x');
  await sync.guardarConfig({ url, clave: 'mala' });
  await assert.rejects(sync.probar(), /clave/);
  await sync.guardarConfig({ url: 'http://127.0.0.1:1', clave });
  await assert.rejects(sync.probar(), /No se puede conectar/);
  await assert.rejects(sync.guardarConfig({ url: 'carlos25.ts.net', clave }), /https/);
});

test('móvil crea un aviso con PDF → el PC lo recibe todo', async () => {
  const movil = await dispositivo('movil');
  const pc = await dispositivo('pc');
  assert.equal((await movil.sync.probar()).ok, true);

  const f = await movil.s.putFile({ name: 'cond.pdf', mime: 'application/pdf', bytes: new TextEncoder().encode('%PDF condiciones Ana') });
  const a = await movil.s.save('aviso', conPdfCondiciones(nuevoAviso({ numero: '2026-0001', cliente: { nombre: 'Ana' } }), f), { event: { kind: 'creado', text: 'Aviso creado' } });
  await movil.s.save('cita', { titulo: 'Llamar a Ana', fecha: '2026-10-12' }, { ref: a.id });

  const i1 = await movil.sync.sincronizar();
  assert.equal(i1.subidos, 3);
  assert.equal(i1.archivosSubidos, 1);
  assert.deepEqual(await movil.s.pendingCounts(), { records: 0, files: 0 });

  const i2 = await pc.sync.sincronizar();
  assert.ok(i2.bajados >= 3);
  assert.equal(i2.archivosBajados, 1);
  const enPc = await pc.s.get(a.id);
  assert.equal(enPc.data.cliente.nombre, 'Ana');
  assert.equal((await pc.s.history(a.id))[0].data.text, 'Aviso creado');
  assert.equal((await pc.s.listByRef(a.id, 'cita'))[0].data.titulo, 'Llamar a Ana');
  assert.equal(new TextDecoder().decode((await pc.s.getFile(f.hash)).bytes), '%PDF condiciones Ana');

  // Sincronizar otra vez no mueve nada
  const i3 = await pc.sync.sincronizar();
  assert.equal(i3.subidos + i3.bajados + i3.conflictos, 0);
});

test('cambios en avisos distintos desde los dos dispositivos se juntan sin conflicto', async () => {
  const movil = await dispositivo('movil');
  const pc = await dispositivo('pc');
  const a1 = await movil.s.save('aviso', nuevoAviso({ numero: 'A1' }));
  const a2 = await movil.s.save('aviso', nuevoAviso({ numero: 'A2' }));
  await movil.sync.sincronizar();
  await pc.sync.sincronizar();

  await movil.s.patch(a1.id, { estado: 'En curso' });
  await pc.s.patch(a2.id, { tramite: 'presentado' });
  await movil.sync.sincronizar();
  const ipc = await pc.sync.sincronizar();
  await movil.sync.sincronizar();

  assert.equal(ipc.conflictos, 0);
  for (const d of [movil, pc]) {
    assert.equal((await d.s.get(a1.id)).data.estado, 'En curso');
    assert.equal((await d.s.get(a2.id)).data.tramite, 'presentado');
  }
});

test('el mismo aviso cambiado en los dos: conflicto visible, nada se pierde, y se resuelve', async () => {
  const movil = await dispositivo('movil');
  const pc = await dispositivo('pc');
  const a = await movil.s.save('aviso', nuevoAviso({ numero: 'C1', observaciones: 'original' }));
  await movil.sync.sincronizar();
  await pc.sync.sincronizar();

  // Sin sincronizar entre medias
  await movil.s.patch(a.id, { observaciones: 'desde el móvil' });
  await pc.s.patch(a.id, { observaciones: 'desde el PC' });
  await movil.sync.sincronizar(); // llega primero
  const ipc = await pc.sync.sincronizar();

  assert.equal(ipc.conflictos, 1);
  assert.equal((await pc.s.get(a.id)).data.observaciones, 'desde el móvil');
  const c = (await pc.sync.conflictos())[a.id];
  assert.equal(c.local.data.observaciones, 'desde el PC');

  // Carlos elige la del PC
  await pc.sync.resolverConflicto(a.id, 'local');
  assert.deepEqual(await pc.sync.conflictos(), {});
  await pc.sync.sincronizar();
  await movil.sync.sincronizar();
  assert.equal((await movil.s.get(a.id)).data.observaciones, 'desde el PC');
  assert.ok((await movil.s.history(a.id)).some((e) => /Conflicto resuelto/.test(e.data.text)));
});

test('papelera y edición durante la subida', async () => {
  const movil = await dispositivo('movil');
  const pc = await dispositivo('pc');
  const a = await movil.s.save('aviso', nuevoAviso({ numero: 'P1' }));
  await movil.sync.sincronizar();
  await pc.sync.sincronizar();
  await pc.s.trash(a.id, 'duplicado');
  await pc.sync.sincronizar();
  await movil.sync.sincronizar();
  assert.equal((await movil.s.list('aviso')).some((r) => r.id === a.id), false);
  assert.equal((await movil.s.list('aviso', { onlyDeleted: true })).length, 1);

  // Si el registro cambia mientras se sube, sigue pendiente con la revisión nueva.
  const b = await movil.s.save('aviso', nuevoAviso({ numero: 'P2' }));
  await movil.s.patch(b.id, { estado: 'En curso' });
  await movil.s._ackPushed(b.id, 1, 7);
  const p = await movil.s._hasPending(b.id);
  assert.equal(p.baseServerRev, 7);
});

test('huellas de archivo en cualquier parte del registro', () => {
  const h = 'a'.repeat(64);
  assert.deepEqual([...huellasDe({ condiciones: { pdfs: [{ hash: h }] }, fotos: [{ hash: 'corto' }] })], [h]);
});

test('la dirección mal puesta se explica antes de conectar', async () => {
  const { problemaDireccion } = await import('../core/sync.js');
  const movil = { hostname: '141carlos-source.github.io', protocol: 'https:' };
  const pc = { hostname: 'localhost', protocol: 'http:' };
  assert.match(problemaDireccion('http://127.0.0.1:8766', movil), /solo sirve en el propio PC/);
  assert.equal(problemaDireccion('http://127.0.0.1:8766', pc), null);
  assert.match(problemaDireccion('https://carlos25.tail970b93.ts.net', movil), /Falta «:8443»/);
  assert.equal(problemaDireccion('https://carlos25.tail970b93.ts.net:8443', movil), null);
  assert.match(problemaDireccion('http://192.168.1.20:8766', movil), /https:\/\//);
  assert.match(problemaDireccion('no es una url', movil), /no es válida/);
});

test('latido: avisa de cambios nuevos en el PC y de quién tiene abierto el mismo aviso', async () => {
  const movil = await dispositivo('movil');
  const pc = await dispositivo('pc');
  await pc.sync.sincronizar();
  assert.equal((await pc.sync.latido()).hayCambios, false);

  const a = await movil.s.save('aviso', nuevoAviso({ numero: 'L1' }));
  await movil.sync.sincronizar();
  const l1 = await movil.sync.latido(a.id); // el móvil tiene el aviso abierto
  assert.equal(l1.hayCambios, false); // lo suyo ya está al día

  const l2 = await pc.sync.latido(null);
  assert.equal(l2.hayCambios, true); // el PC ve que hay algo nuevo sin bajar
  assert.ok(l2.otros.some((o) => o.abierto === a.id && o.nombre === 'movil'));
  await pc.sync.sincronizar();
  assert.equal((await pc.sync.latido(null)).hayCambios, false);
  assert.ok(await pc.s.getMeta('ultimoContactoPC'));
});

test('lo mismo importado en dos dispositivos no da conflicto; los iguales guardados se limpian solos', async () => {
  const { mismoContenido, problemaDireccion } = await import('../core/sync.js');
  const movil = await dispositivo('movil');
  const pc = await dispositivo('pc');
  // El mismo aviso (id fijo, como al importar de la V1.35) creado por separado en los dos
  await pc.s.save('aviso', nuevoAviso({ numero: 'V1-9' }), { id: 'v1-999' });
  await movil.s.save('aviso', nuevoAviso({ numero: 'V1-9' }), { id: 'v1-999' });
  await pc.sync.sincronizar();
  const i = await movil.sync.sincronizar();
  assert.equal(i.conflictos, 0);
  assert.deepEqual(await movil.sync.conflictos(), {});
  // Conflictos antiguos que en realidad son iguales desaparecen al mirarlos
  const r = await movil.s.get('v1-999');
  await movil.s.setMeta('conflictos', { 'v1-999': { local: { ...r, rev: 9, deviceId: 'otro' }, servidor: r } });
  assert.deepEqual(await movil.sync.conflictos(), {});
  assert.equal(mismoContenido({ type: 'aviso', data: { a: 1, b: 2 } }, { type: 'aviso', data: { b: 2, a: 1 } }), true);
  assert.equal(mismoContenido({ type: 'aviso', data: { a: 1 } }, { type: 'aviso', data: { a: 2 } }), false);
  const movilPag = { hostname: '141carlos-source.github.io', protocol: 'https:' };
  assert.match(problemaDireccion('https://tail970b93.ts.net:8443', movilPag), /carlos25\.tail970b93\.ts\.net:8443/);
});

test('resolver todos los conflictos de una vez', async () => {
  const movil = await dispositivo('movil');
  const pc = await dispositivo('pc');
  const ids = [];
  for (const n of ['T1', 'T2']) ids.push((await movil.s.save('aviso', nuevoAviso({ numero: n, observaciones: 'x' }))).id);
  await movil.sync.sincronizar();
  await pc.sync.sincronizar();
  for (const id of ids) { await movil.s.patch(id, { observaciones: 'móvil' }); await pc.s.patch(id, { observaciones: 'pc' }); }
  await movil.sync.sincronizar();
  assert.equal((await pc.sync.sincronizar()).conflictos, 2);
  assert.equal(await pc.sync.resolverTodos('local'), 2);
  assert.deepEqual(await pc.sync.conflictos(), {});
  await pc.sync.sincronizar();
  await movil.sync.sincronizar();
  for (const id of ids) assert.equal((await movil.s.get(id)).data.observaciones, 'pc');
});
