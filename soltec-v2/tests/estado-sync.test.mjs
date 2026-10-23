// Aviso de «sin sincronizar» en Inicio (core/estadoSync.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alertaSincronizacion } from '../core/estadoSync.js';

const AHORA = new Date('2026-10-23T19:00:00Z');
const hace = (horas) => new Date(AHORA.getTime() - horas * 3600000).toISOString();

test('todo bien: sincronizado hace poco y sin cambios viejos', () => {
  assert.equal(alertaSincronizacion({ configurado: true, registros: 50, pendientes: 2, masAntiguo: hace(3), ultima: hace(5) }, AHORA), null);
  assert.equal(alertaSincronizacion({ configurado: false, registros: 0 }, AHORA), null, 'dispositivo vacío: nada que perder');
});

test('sin conectar al PC y con datos: se avisa', () => {
  const a = alertaSincronizacion({ configurado: false, registros: 3 }, AHORA);
  assert.equal(a.nivel, 'err'); assert.equal(a.accion, 'configurar');
  assert.match(a.titulo, /no está conectado al PC CASA/);
});

test('cambios sin subir desde hace más de 24 h', () => {
  const a = alertaSincronizacion({ configurado: true, registros: 50, pendientes: 3, archivos: 1, masAntiguo: hace(30), ultima: hace(30) }, AHORA);
  assert.equal(a.nivel, 'err'); assert.equal(a.accion, 'sincronizar');
  assert.equal(a.titulo, '4 cambios sin subir al PC desde hace 1 día');
  assert.equal(alertaSincronizacion({ configurado: true, registros: 5, pendientes: 1, masAntiguo: hace(80), ultima: hace(1) }, AHORA).titulo, '1 cambio sin subir al PC desde hace 3 días');
  assert.equal(alertaSincronizacion({ configurado: true, registros: 5, pendientes: 1, masAntiguo: hace(23), ultima: hace(23) }, AHORA), null, 'antes de 24 h no');
});

test('sin sincronizar en 3 días (o nunca)', () => {
  const a = alertaSincronizacion({ configurado: true, registros: 50, ultima: hace(24 * 4) }, AHORA);
  assert.equal(a.nivel, 'info'); assert.equal(a.titulo, 'Sin sincronizar con el PC desde hace 4 días');
  assert.equal(alertaSincronizacion({ configurado: true, registros: 50, ultima: null }, AHORA).titulo, 'Todavía no se ha sincronizado con el PC');
  const b = alertaSincronizacion({ configurado: true, registros: 50, pendientes: 2, masAntiguo: hace(2), ultima: hace(24 * 5) }, AHORA);
  assert.equal(b.nivel, 'err', 'con cambios sin subir es más grave'); assert.match(b.texto, /2 cambios sin subir/);
  assert.equal(alertaSincronizacion({ configurado: true, registros: 50, ultima: hace(24 * 2) }, AHORA, { diasSinSync: 3 }), null);
});
