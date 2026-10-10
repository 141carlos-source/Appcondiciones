import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Storage } from '../core/storage.js';
import { exportar, importar, verificar, nombreCopia } from '../core/backup.js';
import { nuevoAviso, conPdfCondiciones } from '../core/model.js';

let n = 0;
const abrir = () => Storage.open({ name: 'copia_' + n++ });
const pdf = (txt) => ({ name: 'cond.pdf', mime: 'application/pdf', bytes: new TextEncoder().encode(txt) });

async function conDatos() {
  const s = await abrir();
  const f = await s.putFile(pdf('%PDF condiciones v1'));
  const a = conPdfCondiciones(nuevoAviso({ numero: '2026-0001', cliente: { nombre: 'Ana' } }), f);
  const r = await s.save('aviso', a, { event: { kind: 'creado' } });
  await s.save('cita', { titulo: 'Llamar', fecha: '2026-10-11' }, { ref: r.id });
  return { s, r, f };
}

test('exportar → importar en un dispositivo vacío recupera todo', async () => {
  const { s, r, f } = await conDatos();
  const copia = JSON.parse(JSON.stringify(await exportar(s)));
  assert.deepEqual(copia.totales, { registros: 3, archivos: 1 });
  assert.equal((await s.getMeta('ultimaCopia')).registros, 3);

  const d = await abrir();
  const inf = await importar(d, copia);
  assert.equal(inf.nuevos, 3);
  assert.equal(inf.archivos, 1);
  const back = await d.get(r.id);
  assert.equal(back.data.cliente.nombre, 'Ana');
  assert.equal((await d.history(r.id)).length, 1);
  assert.equal(new TextDecoder().decode((await d.getFile(f.hash)).bytes), '%PDF condiciones v1');
  // Importar dos veces no duplica nada
  const inf2 = await importar(d, copia);
  assert.equal(inf2.iguales, 3);
  assert.equal(inf2.nuevos, 0);
});

test('una copia dañada se rechaza sin tocar nada', async () => {
  const { s } = await conDatos();
  const copia = JSON.parse(JSON.stringify(await exportar(s)));
  const d = await abrir();

  const alterada = structuredClone(copia);
  alterada.registros[0].data = { trampa: true };
  await assert.rejects(importar(d, alterada), /huella no coincide/);

  const cortada = structuredClone(copia);
  cortada.archivos[0].b64 = cortada.archivos[0].b64.slice(0, 8);
  await assert.rejects(verificar(cortada), /dañado/);

  await assert.rejects(verificar({ formato: 'otra' }), /no es una copia/);
  assert.equal((await d.dumpAll()).records.length, 0);
});

test('importar nunca pisa un cambio local pendiente ni algo más reciente', async () => {
  const { s, r } = await conDatos();
  const copia = JSON.parse(JSON.stringify(await exportar(s)));
  // Después de la copia, se edita el aviso en el dispositivo
  await s.patch(r.id, { estado: 'En curso' });
  const inf = await importar(s, copia);
  assert.deepEqual(inf.conflictos, [r.id]);
  assert.equal((await s.get(r.id)).data.estado, 'En curso');
});

test('nombre de la copia', () => {
  assert.equal(nombreCopia(new Date(2026, 9, 10, 15, 7)), 'SOLTEC_V2_COPIA_2026-10-10_1507.json');
});
