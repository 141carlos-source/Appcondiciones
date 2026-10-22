import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLAVES_AUTORIZACION, normalizarAutorizacion, datosAutorizacion, sugerenciasAutorizacion, representanteDeEmpresa, resumenAutorizacion } from '../core/autorizacion.js';
import { nuevoAviso, normalizarAviso } from '../core/model.js';
import { empresaVacia } from '../core/empresa.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const empresa = { ...empresaVacia(), empresa: { ...empresaVacia().empresa, nombre: 'M. A. SOLTEC SL', nombreComercial: 'M. A. SOLTEC', nif: 'b12345678', localidad: 'La Puebla de Alfindén', direccion: 'Calle Industria 3', email: 'info@soltec.es', telefono: '976000000' } };

test('una autorización vacía, nula o dañada se normaliza sin fallar', () => {
  for (const x of [undefined, null, 5, 'texto', {}, { datos: 'roto' }]) {
    const a = normalizarAutorizacion(x);
    assert.equal(a.datos, null);
    assert.equal(resumenAutorizacion(a).hay, false);
  }
});

test('solo se guardan las claves del formulario y las firmas deben ser imágenes', () => {
  const d = datosAutorizacion({ sol_nombre: 'Ana', raro: 'x', firma_sol: 'javascript:alert(1)', firma_rep: 'data:image/png;base64,AAAA', sum_potencia: 15 });
  assert.equal(d.raro, undefined);
  assert.equal(d.firma_sol, '');
  assert.equal(d.firma_rep, 'data:image/png;base64,AAAA');
  assert.equal(d.sum_potencia, '15');
  assert.deepEqual(Object.keys(d), CLAVES_AUTORIZACION);
});

test('el representante sale de Ajustes › Empresa', () => {
  const r = representanteDeEmpresa(empresa);
  assert.deepEqual(r, { aut_nombre: 'M. A. SOLTEC SL', aut_nif: 'B12345678', aut_municipio: 'La Puebla de Alfindén', aut_via: 'Calle Industria 3', aut_email: 'info@soltec.es', aut_tel: '976000000' });
});

test('sugerencias a partir del aviso: solicitante, suministro y potencia', () => {
  const aviso = nuevoAviso({ cliente: { nombre: 'Luis Pérez', nif: '12345678z', telefono: '600111222', email: 'l@x.es' },
    suministro: { direccion: 'Calle Mayor', numero: '12', piso: '2º', puerta: 'B', cp: '50001', poblacion: 'Zaragoza', provincia: 'Zaragoza', refCatastral: '1234567AB1234C0001XY', cups: '' },
    electrico: { potenciaKw: '5.75' } });
  const s = sugerenciasAutorizacion(aviso, empresa);
  assert.equal(s.sol_nombre, 'Luis Pérez');
  assert.equal(s.sol_nif, '12345678Z');
  assert.equal(s.sum_dir, 'Calle Mayor 12, 2º B');
  assert.equal(s.sum_dir2, 'Ref. catastral 1234567AB1234C0001XY');
  assert.equal(s.sum_municipio, 'Zaragoza');
  assert.equal(s.sum_potencia, '5,75');
  assert.equal(s.aut_nombre, 'M. A. SOLTEC SL');
  assert.equal(s.firma_lugar, 'La Puebla de Alfindén');
  assert.equal(s.fact_opcion, '');
  assert.equal(s.sol_via, 'Calle Mayor 12, 2º B');
  assert.equal(s.sol_municipio, 'Zaragoza');
});

test('si el aviso factura a otro titular se propone «Tercero»', () => {
  const aviso = nuevoAviso({ facturacion: { mismoCliente: false, nombre: 'Ayto. de Ejemplo', nif: 'p5000000j', direccion: 'Plaza 1', cp: '50001', poblacion: 'Zaragoza', provincia: 'Zaragoza' } });
  const s = sugerenciasAutorizacion(aviso, empresa);
  assert.equal(s.fact_opcion, 'ter');
  assert.equal(s.tf_nombre, 'Ayto. de Ejemplo');
  assert.equal(s.tf_nif, 'P5000000J');
});

test('resumen para la ficha', () => {
  const r = resumenAutorizacion({ datos: { sol_nombre: 'Luis', fact_opcion: 'rep', firma_sol: 'data:image/png;base64,AA' }, actualizado: '2026-10-16T08:00:00.000Z' });
  assert.equal(r.texto, 'Luis · factura al representante · 1 firma');
});

test('un aviso con autorización la conserva al normalizarse', () => {
  const a = normalizarAviso({ numero: 'X', autorizacion: { v: 1, datos: { sol_nombre: 'Ana' }, actualizado: 'z' } });
  assert.equal(a.autorizacion.datos.sol_nombre, 'Ana');
});

test('las claves coinciden con las del formulario', () => {
  const html = readFileSync(join(raiz, 'assets/autorizacion-datos.js'), 'utf8'); // modelo del formulario
  const m = /const KEYS = \[([\s\S]*?)\];/.exec(html);
  const claves = [...m[1].replace(/\/\/.*$/gm, '').matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]);
  assert.deepEqual(claves, CLAVES_AUTORIZACION);
});

test('el service worker guarda el formulario para usarlo sin conexión', () => {
  const sw = readFileSync(join(raiz, 'sw.js'), 'utf8');
  for (const f of ['./assets/autorizacion.html', './assets/autorizacion-datos.js', './assets/autorizacion-pdf.js', './core/autorizacion.js', './modulos/autorizacion.js']) assert.ok(sw.includes(`'${f}'`), f);
  const app = readFileSync(join(raiz, 'app.js'), 'utf8');
  assert.equal(/VERSION = '([^']+)'/.exec(sw)[1], /VERSION = '([^']+)'/.exec(app)[1]);
});
