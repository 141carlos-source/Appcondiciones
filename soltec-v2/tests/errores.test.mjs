import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anotarError, describirError, informeErrores, MAX_ERRORES } from '../core/errores.js';

test('registro de errores: el más nuevo primero, sin repetir seguidos y con límite', () => {
  const t0 = new Date('2026-10-22T10:00:00Z');
  let l = anotarError([], { mensaje: 'A', origen: 'app' }, t0);
  l = anotarError(l, { mensaje: 'A', origen: 'app' }, new Date(t0.getTime() + 60000));
  assert.equal(l.length, 1);
  assert.equal(l[0].veces, 2);
  l = anotarError(l, { mensaje: 'B', origen: 'cuadrolab' }, new Date(t0.getTime() + 120000));
  assert.equal(l[0].mensaje, 'B');
  for (let i = 0; i < 150; i++) l = anotarError(l, { mensaje: 'E' + i }, t0);
  assert.equal(l.length, MAX_ERRORES);
});

test('describe errores de cualquier tipo y genera un informe', () => {
  assert.equal(describirError(new TypeError('x is undefined')).mensaje, 'x is undefined');
  assert.equal(describirError('texto').mensaje, 'texto');
  assert.equal(describirError({ reason: new Error('promesa') }).mensaje, 'promesa');
  const inf = informeErrores([{ at: '2026-10-22T10:00:00Z', mensaje: 'fallo', origen: 'app', ruta: 'aviso', veces: 1 }], { version: 'V2-1.19.0', dispositivo: 'TABLET' });
  assert.match(inf, /Versión: V2-1\.19\.0/);
  assert.match(inf, /TABLET/);
  assert.match(inf, /fallo/);
});
