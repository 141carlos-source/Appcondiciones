// Esquema unifilar de CuadroLab (assets/cuadro-unifilar.js): qué se dibuja y cómo se reparte en hojas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const ctx = vm.createContext({ module: undefined });
vm.runInContext(readFileSync(new URL('../assets/cuadro-reglas.js', import.meta.url), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('../assets/cuadro-unifilar.js', import.meta.url), 'utf8'), ctx);
const U = ctx.CuadroUnifilar;

let n = 0;
const ap = (t, extra = {}) => ({ id: 'd' + (++n), t, m: 2, row: 0, col: n, nom: '', ...extra });
const pia = (inA, extra = {}) => ap('PIA', { in: inA, cu: 'C', fs: '1', cb: 'H07Z1-K', se: 2.5, pw: inA * 230, m: 1, ...extra });
const cuadro = (dv, p = {}) => ({ c: 'PRINCIPAL', ck: 'k1', w: 24, r: 4, dv, p, cs: [], pa: '' });
const J = (x) => JSON.parse(JSON.stringify(x));
const hojasDe = (e) => J(e.hojas.map((h) => h.map((t) => [t.i?.id ?? null, t.k.length, t.cont, t.sigue])));

test('papel y circuitos por hoja: A4 y 14 por defecto', () => {
  assert.equal(U.papel(cuadro([])), 'A4');
  assert.equal(U.papel(cuadro([], { pp: 'A3' })), 'A3');
  assert.equal(U.circuitosPorHoja(cuadro([])), 14);
  assert.equal(U.circuitosPorHoja(cuadro([], { ch: 0 })), 0);
  assert.ok(U.OPC_HOJA.some(([v]) => v === 0));
  assert.match(U.cssImpresion('A3'), /size:A3 landscape/);
  assert.match(U.cssImpresion('A4'), /height:191mm/);
});

test('grupos: cada diferencial con sus circuitos; los sueltos al final; las cabeceras no son circuitos', () => {
  const s = ap('SOB', { in: 40, m: 3 }), i1 = ap('ID', { in: 40, sn: 30 }), i2 = ap('ID', { in: 25, sn: 30 });
  const cab = pia(25, { m: 2 }); i2.pp = cab.id;
  const a = pia(16, { dep: i1.id }), b = pia(10, { dep: i2.id }), c = pia(20);
  const e = U.esquema(cuadro([s, i1, i2, cab, a, b, c]));
  assert.equal(e.sb.id, s.id); assert.equal(e.ig, null);
  assert.deepEqual(e.gr.map((g) => [g.i?.id ?? null, g.k.map((p) => p.id)]), [[i1.id, [a.id]], [i2.id, [b.id]], [null, [c.id]]]);
  assert.equal(e.NH, 1);
});

test('reparto en hojas: un diferencial largo se parte con «viene de» y «continúa»', () => {
  const i = ap('ID', { in: 40, sn: 30 });
  const ps = Array.from({ length: 15 }, () => pia(16, { dep: i.id }));
  const e = U.esquema(cuadro([i, ...ps], { ch: 6 }));
  assert.deepEqual(hojasDe(e), [[[i.id, 6, false, true]], [[i.id, 6, true, true]], [[i.id, 3, true, false]]]);
  assert.equal(U.esquema(cuadro([i, ...ps], { ch: 0 })).NH, 1, '0 = todo en una hoja');
  assert.equal(U.esquema(cuadro([i, ...ps])).NH, 2, '14 por hoja');
});

test('reparto: varios diferenciales llenan la hoja y saltan a la siguiente; uno sin circuitos ocupa un hueco', () => {
  const gr = [{ i: { id: 'a' }, k: [1, 2, 3] }, { i: { id: 'b' }, k: [] }, { i: { id: 'c' }, k: [4, 5] }];
  const h = U.repartir(gr, 4);
  assert.deepEqual(J(h.map((x) => x.map((t) => [t.i.id, t.q, t.k.length]))), [[['a', 1, 3], ['b', 2, 0]], [['c', 3, 2]]]);
});

test('alimentación: IGA, o protector de sobretensiones, o el P.I.A. del cuadro padre', () => {
  const g = ap('IGA', { in: 63, po: 4, cu: 'C' });
  assert.equal(U.esquema(cuadro([g, ap('SOB', { in: 40 })])).ig.m, 4);
  assert.equal(U.esquema(cuadro([g, ap('SOB', { in: 40 })])).sb, null, 'con IGA el protector va aparte');
  const padre = { k: 'k0', c: 'GENERAL', dv: [{ id: 'x', t: 'PIA', m: 2, in: 32 }] };
  const q = cuadro([pia(10)]); q.cs = [padre]; q.pa = 'k0|x';
  assert.equal(U.esquema(q).fd, 'P.I.A. 2x32A');
});

test('SVG: datos del aparato, nombres, hojas y textos escapados', () => {
  const s = ap('SOB', { in: 40, m: 3, fs: '1', cu: 'C' }), i = ap('ID', { in: 40, sn: 30, nom: 'DIFERENCIAL 1' });
  const p = pia(16, { dep: i.id, nom: 'ALUMBRADO <PLANTA>' });
  const q = cuadro([s, i, p]); q.dv.push(ap('REL', { dep: p.id }));
  const e = U.esquema(q), svg = U.svgHoja(q, e, 0);
  assert.match(svg, /^<svg viewBox/);
  for (const t of ['PROT. SOBRETENSIONES', 'MONOFÁSICO 40A', '2x40A', '30mA', 'DIFERENCIAL 1', 'P.I.A. 1x16A C', '1x2,5mm²+TT H07Z1-K', '3680 W', 'C1 ALUMBRADO &lt;PLANTA&gt; + RELOJ'])
    assert.ok(svg.includes(t), t);
  assert.ok(!svg.includes('HOJA 1 DE'), 'una sola hoja: sin numeración');
  const ps = Array.from({ length: 3 }, () => pia(10, { dep: i.id }));
  const q2 = cuadro([s, i, ...ps], { ch: 2 }), e2 = U.esquema(q2);
  assert.match(U.svgHoja(q2, e2, 0), /HOJA 1 DE 2[\s\S]*CONTINÚA EN LA HOJA 2/);
  assert.match(U.svgHoja(q2, e2, 1), /VIENE DE LA HOJA 1[\s\S]*\(SIGUE DIFERENCIAL 1\)/);
});
