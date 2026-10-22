// Frontal de CuadroLab (assets/cuadro-frontal.js): paleta, huecos, aparato nuevo, cabecera, mover y envolvente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
// Igual que en CuadroLab: primero las reglas (CuadroReglas global) y después el frontal
const ctx = vm.createContext({ module: undefined });
vm.runInContext(readFileSync(new URL('../assets/cuadro-reglas.js', import.meta.url), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('../assets/cuadro-frontal.js', import.meta.url), 'utf8'), ctx);
const F0 = ctx.CuadroFrontal;
const J = (r) => (r && typeof r === 'object' ? JSON.parse(JSON.stringify(r)) : r);
const F = Object.fromEntries(Object.entries(F0).map(([k, v]) => [k, typeof v === 'function' ? (...a) => J(v(...a)) : J(v)]));
const cuadro = (dv = [], w = 12, r = 2) => ({ w, r, n: dv.length, dv });
const ap = (id, t, m, row, col, extra = {}) => ({ id, t, m, row, col, nom: '', ...extra });

test('paleta: desplegables con los valores de SOLTEC', () => {
  assert.deepEqual(F.SOBM, [25, 32, 40, 63, 80]);
  assert.equal(F.SOBT.at(-1), 200);
  assert.equal(F.PIA1.at(-1), 80);
  assert.deepEqual(F.PIA2.slice(-3), [80, 100, 125]);
  assert.deepEqual(F.PAL.map((p) => p[0]), ['SOB', 'BOR', 'ID', 'PIA']);
  assert.deepEqual(F.opcion('SOB', 3, '200'), ['200', '200 A', 9, '3']);
  assert.deepEqual(F.opcion('ID', 1, '63|300'), ['63|300', '4x63A 300mA', 4, '3']);
  assert.deepEqual(F.opcion('PIA', 0, '80'), ['80', '80 A', 1, '1']);
  assert.equal(F.opcion('PIA', 0, '100'), null, '1 módulo no llega a 100 A');
  assert.equal(F.opcion('XXX', 0, '1'), null);
});

test('aplicar la opción: intensidad, sección, potencia, sensibilidad y fases', () => {
  const p = F0.aplicarOpcion({ t: 'PIA', m: 2, cb: 'H07Z1-K' }, '25', F0.opcion('PIA', 1, '25'));
  assert.equal(p.in, 25); assert.equal(p.se, 6); assert.equal(p.pw, 25 * 230); assert.equal(p.fs, '1');
  const t = F0.aplicarOpcion({ t: 'PIA', m: 4, cb: 'H07Z1-K' }, '125', F0.opcion('PIA', 3, '125'));
  assert.equal(t.fs, '3'); assert.equal(t.se, 50); assert.equal(t.pw, Math.round(125 * Math.sqrt(3) * 400));
  const i = F0.aplicarOpcion({ t: 'ID', m: 2 }, '40|300', F0.opcion('ID', 0, '40|300'));
  assert.equal(i.in, 40); assert.equal(i.sn, 300);
  const s = F0.aplicarOpcion({ t: 'SOB', m: 5, pw: 99 }, '160', F0.opcion('SOB', 2, '160'));
  assert.equal(s.in, 160); assert.equal(s.pw, 0); assert.equal(s.fs, '3');
});

test('huecos libres: ocupado, bordes, primero y siguiente', () => {
  const q = cuadro([ap('a', 'ID', 2, 0, 0), ap('b', 'PIA', 1, 0, 2)], 4, 2);
  assert.equal(F.libre(q, 0, 1, 1), false);
  assert.equal(F.libre(q, 0, 3, 1), true);
  assert.equal(F.libre(q, 0, 3, 2), false, 'se sale por la derecha');
  assert.equal(F.libre(q, 2, 0, 1), false, 'fila que no existe');
  assert.equal(F.libre(q, 0, 0, 2, 'a'), true, 'el que se mueve no se estorba a sí mismo');
  assert.deepEqual(F.primerHueco(q, 1), { r: 0, c: 3 });
  assert.deepEqual(F.primerHueco(q, 2), { r: 1, c: 0 });
  assert.equal(F.primerHueco(cuadro([ap('x', 'OTR', 4, 0, 0)], 4, 1), 1), null);
  assert.deepEqual(F.siguienteHueco(q, 1, 3, 1), { r: 1, c: 3 });
  assert.deepEqual(F.siguienteHueco(cuadro([ap('x', 'OTR', 3, 0, 1)], 4, 1), 0, 3, 1), { r: 0, c: 0 }, 'da la vuelta');
  assert.equal(F.columnaSoltar(q, 2, 1000, 20), 2);
  assert.equal(F.columnaSoltar(q, 2, -50, 20), 0);
  assert.equal(F.columnaSoltar(q, 1, 50, 20), 2);
});

test('aparato nuevo: valores por defecto y DIFERENCIAL n con el primer número libre', () => {
  const q = cuadro([ap('d1', 'ID', 2, 0, 0, { nom: 'DIFERENCIAL 1' }), ap('d2', 'ID', 2, 0, 2, { nom: 'DIFERENCIAL 3' })]);
  const i = F0.nuevoAparato(q, 'ID', 2, 1, 0);
  assert.equal(i.id, 'd3'); assert.equal(q.n, 3);
  assert.equal(i.nom, 'DIFERENCIAL 2'); assert.equal(i.in, 40); assert.equal(i.sn, 30);
  assert.equal(q.dv.length, 2, 'no lo añade');
  const p = F0.nuevoAparato(q, 'PIA', 1, 1, 2);
  assert.equal(p.in, 16); assert.equal(p.se, 2.5); assert.equal(p.cb, 'H07Z1-K'); assert.equal(p.fs, '1'); assert.equal(p.pw, 16 * 230);
  const s = F0.nuevoAparato(q, 'SOB', 5, 1, 3);
  assert.equal(s.fs, '3'); assert.equal(s.cb, undefined);
  assert.equal(F0.nuevoAparato(q, 'CON', 2, 1, 0).in, 16);
  assert.deepEqual(J(F0.nuevoAparato(q, 'UNI', 1, 1, 0).v), {});
});

test('P.I.A. de cabecera: a la izquierda, corriendo la fila o en el primer hueco', () => {
  let q = cuadro([ap('i', 'ID', 2, 0, 4, { in: 40 }), ap('p', 'PIA', 1, 0, 6)], 12, 2);
  assert.deepEqual(F.huecoCabecera(q, q.dv[0]), { r: 0, c: 2, m: 2, correr: [] });
  q = cuadro([ap('s', 'SOB', 3, 0, 0), ap('i', 'ID', 4, 0, 3, { in: 63, m: 4 }), ap('p', 'PIA', 1, 0, 7)], 12, 2);
  assert.deepEqual(F.huecoCabecera(q, q.dv[1]), { r: 0, c: 3, m: 4, correr: ['i', 'p'] });
  q = cuadro([ap('s', 'SOB', 3, 0, 0), ap('i', 'ID', 2, 0, 3, { in: 40 }), ap('p', 'OTR', 7, 0, 5)], 12, 2);
  assert.deepEqual(F.huecoCabecera(q, q.dv[1]), { r: 1, c: 0, m: 2, correr: [] });
  q = cuadro([ap('i', 'ID', 2, 0, 0, { in: 40 }), ap('p', 'OTR', 10, 0, 2)], 12, 1);
  assert.equal(F.huecoCabecera(q, q.dv[0]), null);
});

test('datos de la cabecera: la mayor intensidad que no supera al diferencial', () => {
  const q = cuadro([ap('a', 'ID', 2, 0, 0, { in: 25 }), ap('b', 'ID', 4, 0, 2, { in: 80 })]);
  assert.deepEqual(F.datosCabecera(q, q.dv[0]), { in: 25, fs: '1', pw: 0, dep: '', nom: 'CABECERA ID 1', se: 6 });
  const b = F.datosCabecera(q, q.dv[1]);
  assert.equal(b.in, 63); assert.equal(b.fs, '3'); assert.equal(b.nom, 'CABECERA ID 2'); assert.equal(b.se, 16);
});

test('mover y cambiar el tamaño de la envolvente', () => {
  const q = cuadro([ap('a', 'PIA', 1, 0, 0), ap('b', 'PIA', 1, 0, 1)], 3, 2);
  assert.equal(F0.mover(q, q.dv[0], 1, 0), false, 'ocupado');
  assert.equal(F0.mover(q, q.dv[0], -1, 0), false, 'fuera');
  assert.equal(F0.mover(q, q.dv[0], 0, 1), true);
  assert.deepEqual([q.dv[0].row, q.dv[0].col], [1, 0]);
  assert.equal(F.caben(q, 2, 2), true);
  assert.equal(F.caben(q, 1, 2), false);
  assert.equal(F.caben(q, 3, 1), false);
});
