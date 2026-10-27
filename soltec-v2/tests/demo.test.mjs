// Modo demostración y temas (core/demo.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { opcionesDemo, datosDemo, TEMAS, DB_DEMO } from '../core/demo.js';
import { validarNif } from '../core/validate.js';
import { readFileSync, existsSync } from 'node:fs';

test('opciones de la dirección: ?demo=1&tema=N', () => {
  assert.deepEqual(opcionesDemo('?demo=1&tema=3'), { demo: true, tema: 3 });
  assert.deepEqual(opcionesDemo(''), { demo: false, tema: 0 });
  assert.deepEqual(opcionesDemo('?tema=9'), { demo: false, tema: 0 }, 'tema que no existe: el actual');
  assert.notEqual(DB_DEMO, 'SOLTEC_V2', 'la demo nunca usa la base de datos real');
});

test('datos de ejemplo: ids únicos y fijos, NIF bien escritos, referencias a avisos que existen', () => {
  const d = datosDemo('2026-10-27');
  const ids = [...d.avisos, ...d.eventos, ...d.citas, ...d.partes].map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.startsWith('demo_')));
  for (const a of d.avisos) if (a.data.cliente.nif) assert.equal(validarNif(a.data.cliente.nif), null, a.data.cliente.nif);
  const avisos = new Set(d.avisos.map((a) => a.id));
  for (const x of [...d.eventos, ...d.citas, ...d.partes]) assert.ok(avisos.has(x.ref), x.id);
  assert.deepEqual(datosDemo('2026-10-27'), d, 'siempre los mismos para el mismo día');
});

test('cada tema tiene su hoja de estilos y está en el caché de la app', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  for (const t of TEMAS.filter((x) => x.id)) {
    const f = `assets/temas/tema-${t.id}.css`;
    assert.ok(existsSync(new URL('../' + f, import.meta.url)), f);
    assert.ok(sw.includes(`'./${f}'`), f + ' en el SW');
    assert.match(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), new RegExp(`html\\[data-tema="${t.id}"\\]`), 'solo actúa con su tema');
  }
  assert.ok(sw.includes("'./temas.html'"));
});
