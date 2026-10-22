// Reglas eléctricas de CuadroLab (assets/cuadro-reglas.js), probadas sin pantalla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
// Se carga igual que en CuadroLab (como <script>): deja CuadroReglas en el ámbito global
const ctx = { module: { exports: {} } };
vm.runInNewContext(readFileSync(new URL('../assets/cuadro-reglas.js', import.meta.url), 'utf8'), ctx);
const R0 = ctx.module.exports;
// Los objetos que devuelve vienen de otro contexto: se copian para compararlos
const R = Object.fromEntries(Object.entries(R0).map(([k, v]) => [k, typeof v === 'function' ? (...a) => { const r = v(...a); return r && typeof r === 'object' && !(r instanceof Set) && r.constructor?.name !== 'Set' ? JSON.parse(JSON.stringify(r)) : r; } : v]));

let n = 0;
const ap = (t, extra = {}) => ({ id: 'd' + (++n), t, m: 2, row: 0, col: n * 2, nom: '', ...extra });
const pia = (inA, extra = {}) => { const d = ap('PIA', { in: inA, cu: 'C', fs: '1', cb: 'H07Z1-K', ...extra }); d.se = extra.se ?? R.SA(inA, d.cb); d.pw = extra.pw ?? R.pc(d); return d; };

test('sección según la tabla de SOLTEC y, fuera de ella, la primera que aguanta', () => {
  const t = { 6: 1.5, 10: 1.5, 16: 2.5, 20: 4, 25: 6, 32: 10, 40: 10, 50: 16, 63: 16, 80: 25, 100: 35, 125: 50 };
  for (const [i, s] of Object.entries(t)) assert.equal(R.SA(+i, 'H07Z1-K'), s, `${i} A`);
  assert.equal(R.SA(160, 'H07Z1-K'), 70);
  assert.equal(R.SA(30, 'RZ1-K'), 4, 'fuera de la tabla con RZ1-K: Iz 38 ≥ 30');
});

test('cumple / no cumple el cable: In ≤ Iz y Ib ≤ In, sin falsos NO CUMPLE en trifásico', () => {
  for (const i of [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125]) {
    for (const fs of ['1', '3']) {
      const q = { dv: [pia(i, { fs, m: fs === '3' ? 4 : 2 })] };
      assert.ok(R.OKC(q, q.dv[0]), `${i} A ${fs === '3' ? 'trifásico' : 'monofásico'}`);
    }
  }
  const q = { dv: [pia(32, { se: 2.5 })] };
  assert.equal(R.OKC(q, q.dv[0]), false, '32 A con 2,5 mm² (Iz 21) no cumple');
  const sobre = { dv: [pia(16, { pw: 5000 })] };
  assert.equal(R.OKC(sobre, sobre.dv[0]), false, '5000 W en 16 A monofásico: Ib 21,7 A > 16 A');
});

test('P.I.A. de cabecera: hace falta si los circuitos suman más que el diferencial, salvo que algo aguas arriba lo limite', () => {
  const id = ap('ID', { in: 40, sn: 30 });
  const cs = [pia(16, { dep: id.id }), pia(16, { dep: id.id }), pia(16, { dep: id.id })];
  const q = { dv: [id, ...cs] };
  assert.equal(R.SUMID(q, id), 48);
  assert.equal(R.NCAB(q, id), 48, 'sin protector: hace falta cabecera');
  const sob40 = ap('SOB', { in: 40, m: 3, fs: '1' });
  assert.equal(R.NCAB({ dv: [sob40, ...q.dv] }, id), 0, 'protector de 40 A: ya lo limita');
  const sob63 = ap('SOB', { in: 63, m: 3, fs: '1' });
  assert.equal(R.NCAB({ dv: [sob63, ...q.dv] }, id), 48, 'protector de 63 A: no lo limita');
  const cab = pia(40);
  const conCab = { dv: [{ ...id, pp: cab.id }, cab, ...cs] };
  assert.equal(R.NCAB(conCab, conCab.dv[0]), 0, 'con su cabecera de 40 A');
  assert.equal(R.ISCAB(conCab, cab), true);
  assert.equal(R.PW(conCab, cab), cs.reduce((a, c) => a + c.pw, 0), 'la carga de la cabecera es la de sus circuitos');
  const sub = { dv: [id, ...cs], pa: 'q1|dX', cs: [{ k: 'q1', dv: [{ id: 'dX', t: 'PIA', in: 32 }] }] };
  assert.equal(R.NCAB(sub, id), 0, 'subcuadro alimentado por un P.I.A. de 32 A');
});

test('numeración de circuitos: las cabeceras no cuentan; con «no numerar» no hay números', () => {
  const id = ap('ID', { in: 40, sn: 30, col: 2 });
  const cab = pia(40, { col: 0 });
  const a = pia(16, { col: 4, dep: id.id }), b = pia(10, { col: 6, dep: id.id });
  const q = { dv: [b, { ...id, pp: cab.id }, a, cab] };
  assert.deepEqual(R.NU(q), { [a.id]: 'C1', [b.id]: 'C2' });
  assert.deepEqual(R.NU({ ...q, nu: 0 }), {});
});

test('comprobaciones del cuadro', () => {
  const id = ap('ID', { in: 40, sn: 30, nom: 'DIFERENCIAL 1' });
  const id2 = ap('ID', { in: 25, sn: 300, m: 4, fs: '3', nom: 'DIFERENCIAL 2' });
  const cs = [pia(16, { dep: id.id, nom: 'ALUMBRADO' }), pia(16, { dep: id.id, nom: 'TOMAS' }), pia(16, { dep: id.id, nom: 'COCINA' })];
  const suelto = pia(10);
  const rel = ap('REL', { m: 1 });
  let w = R.comprobaciones({ dv: [id, id2, ...cs, suelto, rel] });
  const tiene = (re) => w.some((x) => re.test(x));
  assert.ok(tiene(/FALTA EL PROTECTOR DE SOBRETENSIONES/));
  assert.ok(tiene(/DIFERENCIAL 1 \(40A\/30MA\): LOS MAGNETOTÉRMICOS QUE CUELGAN SUMAN 48A/));
  assert.ok(tiene(/DIFERENCIAL 2 \(25A\/300MA\): SIN MAGNETOTÉRMICOS/));
  assert.ok(tiene(/MAGNETOTÉRMICO SIN NOMBRE .*: SIN DIFERENCIAL ASIGNADO/));
  assert.ok(tiene(/RELOJ .*SIN MAGNETOTÉRMICO ASIGNADO/));
  const sob = ap('SOB', { in: 40, m: 3, fs: '1' });
  w = R.comprobaciones({ dv: [sob, id, id2, ...cs] });
  assert.ok(!tiene(/FALTA EL PROTECTOR/));
  assert.ok(!tiene(/SUMAN 48A/), 'el protector de 40 A ya protege');
  assert.ok(tiene(/PROTECTOR DE SOBRETENSIONES ES MONOFÁSICO Y HAY APARATOS TRIFÁSICOS: DIFERENCIAL 2/));
  const malCable = pia(32, { se: 2.5, dep: id.id, nom: 'HORNO' });
  w = R.comprobaciones({ dv: [sob, id, malCable] });
  assert.ok(tiene(/HORNO: CABLE NO CUMPLE \(2,5 MM² H07Z1-K, IZ 21A, IN 32A\)/));
});
