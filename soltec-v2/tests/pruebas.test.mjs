// Prueba en real guiada (core/pruebas.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PASOS, pasoAplica, comprobaciones, resumenPruebas, informePruebas } from '../core/pruebas.js';

test('pasos: ids únicos, todos con qué hacer y qué debe pasar; según el dispositivo', () => {
  assert.equal(new Set(PASOS.map((p) => p.id)).size, PASOS.length);
  for (const p of PASOS) assert.ok(p.titulo && p.como && p.espera && p.grupo, p.id);
  const tablet = PASOS.filter((p) => pasoAplica(p, true)).map((p) => p.id), pc = PASOS.filter((p) => pasoAplica(p, false)).map((p) => p.id);
  assert.ok(tablet.includes('teclado') && tablet.includes('notifCerrada') && !tablet.includes('instalador'));
  assert.ok(pc.includes('instalador') && !pc.includes('teclado'));
  for (const id of ['autorrelleno', 'telefono', 'ventanas', 'recordatorios', 'notif', 'frontal', 'autorizacion', 'partes', 'pdf', 'sinConexion']) assert.ok(tablet.includes(id) && pc.includes(id), id);
});

test('comprobaciones automáticas', () => {
  const c = comprobaciones({ instalada: true, sw: true, persistente: false, permisoNotif: 'denied', periodico: 'si', pc: { ok: false, error: 'Sin conexión' }, errores: 2 });
  const v = Object.fromEntries(c.map((x) => [x.id, x.ok]));
  assert.deepEqual(v, { instalada: true, sw: true, persistente: false, notificaciones: false, periodico: true, pc: false, errores: false });
  assert.match(c.find((x) => x.id === 'pc').texto, /Sin conexión/);
  assert.equal(comprobaciones({ pc: { sinConfigurar: true } }).find((x) => x.id === 'pc').ok, null);
  assert.equal(comprobaciones({ permisoNotif: 'default' }).find((x) => x.id === 'notificaciones').ok, null);
});

test('resumen e informe para pegar en el chat', () => {
  const res = { teclado: { estado: 'ok' }, telefono: { estado: 'falla', nota: 'sale sin espacios' }, frontal: { estado: 'ok' }, instalador: { estado: 'ok' } };
  const r = resumenPruebas(res, true);
  assert.deepEqual([r.ok, r.falla], [2, 1], 'el instalador no cuenta en la tablet');
  assert.equal(r.total, PASOS.filter((p) => pasoAplica(p, true)).length);
  const t = informePruebas(res, { version: 'V2-1.24.0', dispositivo: 'TABLET', tactil: true, auto: comprobaciones({ instalada: true }), errores: [{ at: '2026-10-23T10:00:00Z', origen: 'app', mensaje: 'x is undefined', veces: 3 }] }, new Date(2026, 9, 23, 20, 0));
  assert.match(t, /^INFORME DE PRUEBA EN REAL · SOLTEC V2/);
  assert.match(t, /Versión: V2-1\.24\.0/);
  assert.match(t, /Resultado: 2 funcionan, 1 fallan/);
  assert.match(t, /❌ Teléfono con \+34 — sale sin espacios/);
  assert.match(t, /✅ Instalada como app/);
  assert.match(t, /— Escribir\n/);
  assert.match(t, /x is undefined \(×3\)/);
  assert.ok(!t.includes('Instalador .bat'), 'en la tablet no sale el paso del PC');
});
