import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codigoAlta, enlaceAlta, leerAlta, nombreSugerido, instaladorWindows, esDireccionLocal } from '../core/alta.js';

const BASE = 'https://141carlos-source.github.io/Appcondiciones/soltec-v2/';

test('el enlace de alta lleva la dirección y la clave del PC y se lee igual', () => {
  const c = codigoAlta({ url: 'https://carlos25.tail970b93.ts.net:8443/', clave: 'AbC-123_xyz', pc: 'PC CASA' });
  const e = enlaceAlta(BASE, c);
  assert.ok(e.startsWith(BASE + '#/alta/'));
  assert.deepEqual(leerAlta(e), { url: 'https://carlos25.tail970b93.ts.net:8443', clave: 'AbC-123_xyz', pc: 'PC CASA' });
  assert.deepEqual(leerAlta(c), leerAlta(e));
  assert.match(c, /^[A-Za-z0-9_-]+$/);
});

test('no se puede preparar con la dirección local del PC ni sin clave', () => {
  assert.equal(esDireccionLocal('http://127.0.0.1:8766'), true);
  assert.equal(esDireccionLocal('https://carlos25.tail970b93.ts.net:8443'), false);
  assert.throws(() => codigoAlta({ url: 'http://127.0.0.1:8766', clave: 'x' }), /Tailscale/);
  assert.throws(() => codigoAlta({ url: 'https://a.ts.net:8443', clave: '' }), /clave/);
});

test('un enlace dañado no se acepta', () => {
  assert.equal(leerAlta('basura'), null);
  assert.equal(leerAlta(''), null);
});

test('nombre propuesto según el aparato', () => {
  assert.equal(nombreSugerido('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'TABLET');
  assert.equal(nombreSugerido('Mozilla/5.0 (Linux; Android 14; SM-X200) Safari'), 'TABLET');
  assert.equal(nombreSugerido('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari'), 'MÓVIL');
  assert.equal(nombreSugerido('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'PC');
});

test('instalador para otro PC: icono en el escritorio y abre el enlace de alta', () => {
  const c = codigoAlta({ url: 'https://carlos25.tail970b93.ts.net:8443', clave: 'AbC-123_xyz', pc: 'PC CASA' });
  const bat = instaladorWindows(BASE, c);
  assert.match(bat, /^@echo off\r\n/);
  assert.ok(bat.includes('set "APP=' + BASE + '"'));
  assert.ok(bat.includes('set "ALTA=' + enlaceAlta(BASE, c) + '"'));
  assert.match(bat, /SOLTEC V2\.lnk/);
  assert.match(bat, /--app=/);
  assert.ok(!/[^\x00-\x7f]/.test(bat), 'solo caracteres ASCII');
});
