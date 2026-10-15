import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarCuadro, resumenCuadro, textoResumen, esProyecto, cuadrosDe } from '../core/cuadros.js';
import { normalizarAviso } from '../core/model.js';

const pia = (pw, extra = {}) => ({ id: 'd' + Math.random(), t: 'PIA', m: 1, in: 16, pw, ...extra });
const proyecto = { p: { n: 'X', d: '', c: 'GENERAL' }, w: 12, r: 2, dv: [{ t: 'ID', m: 2 }, pia(3680), pia(3680)] };

test('un cuadro vacío, nulo o dañado se normaliza sin fallar', () => {
  for (const x of [undefined, null, 5, 'texto', {}, { proyecto: 'roto' }, { proyecto: { dv: 'no' } }]) {
    const c = normalizarCuadro(x);
    assert.equal(c.proyecto, null);
    assert.equal(resumenCuadro(c).hay, false);
  }
});

test('un proyecto válido se conserva tal cual', () => {
  const c = normalizarCuadro({ v: 1, proyecto, actualizado: '2026-10-15T08:00:00.000Z' });
  assert.equal(c.proyecto, proyecto);
  assert.equal(c.actualizado, '2026-10-15T08:00:00.000Z');
  assert.ok(esProyecto(proyecto));
});

test('resumen de un cuadro: aparatos, circuitos y potencia prevista', () => {
  const r = resumenCuadro({ proyecto });
  assert.deepEqual([r.cuadros, r.aparatos, r.circuitos, r.potenciaW], [1, 3, 2, 7360]);
  assert.equal(textoResumen(r), '1 cuadro · 2 circuitos · 7,4 kW previstos');
});

test('con varios cuadros (subcuadros) se suman todos', () => {
  const p = { ...proyecto, cs: [{ k: 'a', c: 'GENERAL', dv: proyecto.dv }, { k: 'b', c: 'SUB-CUADRO QUIRÓFANO', dv: [pia(1000), pia(2300)] }] };
  const r = resumenCuadro({ proyecto: p });
  assert.deepEqual([r.cuadros, r.circuitos, r.potenciaW], [2, 4, 10660]);
  assert.deepEqual(r.nombres, ['GENERAL', 'SUB-CUADRO QUIRÓFANO']);
  assert.equal(cuadrosDe(p).length, 2);
});

test('el aviso conserva el cuadro al normalizarse (no se pierde al guardar)', () => {
  const a = normalizarAviso({ cuadro: { v: 1, proyecto, actualizado: 'x' } });
  assert.equal(a.cuadro.proyecto, proyecto);
  assert.equal(normalizarAviso({}).cuadro, undefined); // los avisos antiguos no se tocan
});

test('el P.I.A. de cabecera de un diferencial no cuenta como circuito ni suma potencia', () => {
  const dv = [
    { id: 'd1', t: 'IGA', m: 2, in: 63 },
    { id: 'd2', t: 'PIA', m: 2, in: 40, pw: 9200 },
    { id: 'd3', t: 'ID', m: 2, in: 40, pp: 'd2' },
    { id: 'd4', t: 'PIA', m: 2, in: 16, pw: 3680, dep: 'd3' },
    { id: 'd5', t: 'PIA', m: 2, in: 10, pw: 2300, dep: 'd3' },
  ];
  const r = resumenCuadro({ proyecto: { dv, w: 12, r: 2 } });
  assert.equal(r.circuitos, 2);
  assert.equal(r.potenciaW, 5980);
});
