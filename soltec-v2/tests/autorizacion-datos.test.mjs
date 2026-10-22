// Autorización de representatividad (assets/autorizacion-datos.js): datos, validación, pendientes, documento y correo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const ctx = vm.createContext({ module: undefined });
vm.runInContext(readFileSync(new URL('../assets/autorizacion-datos.js', import.meta.url), 'utf8'), ctx);
const A = ctx.AutorizacionDatos;
const J = (x) => JSON.parse(JSON.stringify(x));
const datos = (o = {}) => Object.assign(A.empty(), o);

test('modelo: todas las claves vacías y normalizar descarta lo desconocido y pasa a texto', () => {
  const e = A.empty();
  assert.equal(Object.keys(e).length, A.KEYS.length);
  assert.ok(Object.values(e).every((v) => v === ''));
  const n = A.normalize({ sol_nombre: 'Ana', sum_potencia: 5.75, raro: 'x', firma_dia: null });
  assert.equal(n.sol_nombre, 'Ana'); assert.equal(n.sum_potencia, '5.75'); assert.equal(n.firma_dia, ''); assert.equal('raro' in n, false);
  assert.ok(A.KEYS.includes('env_correo') && A.KEYS.includes('env_para'));
});

test('NIF, NIE y CIF con su dígito de control', () => {
  assert.equal(A.checkNIF('12345678Z'), 'NIF');
  assert.equal(A.checkNIF('12.345.678-z'), 'NIF');
  assert.equal(A.checkNIF('12345678A'), false);
  assert.equal(A.checkNIF('X1234567L'), 'NIE');
  assert.equal(A.checkNIF('B12345674'), 'CIF');
  assert.equal(A.checkNIF('B12345678'), false);
  assert.equal(A.checkNIF('AB123'), 'otro');
  assert.equal(A.checkNIF(''), null);
});

test('validación de correo, CP, teléfono y número', () => {
  assert.equal(A.validate('email', 'a@b.es'), '');
  assert.match(A.validate('email', 'malo'), /no válido/);
  assert.equal(A.validate('cp', '50171'), '');
  assert.match(A.validate('cp', '60000'), /CP/);
  assert.equal(A.validate('tel', '976 123 456'), '');
  assert.equal(A.validate('tel', '+34 600123123'), '');
  assert.match(A.validate('tel', '12345'), /Teléfono/);
  assert.equal(A.validate('num', '5,75'), '');
  assert.match(A.validate('num', 'abc'), /número/);
  assert.equal(A.validate('nif', ''), '', 'vacío no es error de formato');
});

test('pendientes: obligatorios vacíos e inválidos; los grupos ocultos no cuentan', () => {
  const vacios = J(A.issues(A.empty()));
  assert.ok(vacios.length > 0);
  assert.ok(vacios.every((x) => x.g && x.k && x.msg));
  const conMalCorreo = J(A.issues(datos({ sol_email: 'malo' })));
  assert.ok(conMalCorreo.some((x) => x.k === 'sol_email' && /Email no válido/.test(x.msg)));
  const pasaporte = J(A.issues(datos({ sol_nif: 'AB123' })));
  assert.ok(!pasaporte.some((x) => x.k === 'sol_nif'), 'un pasaporte no se marca como error');
  const ter = J(A.issues(datos({ fact_opcion: 'ter' }))).map((x) => x.g), sol = J(A.issues(datos())).map((x) => x.g);
  assert.ok(ter.length >= sol.length);
  assert.deepEqual(J(A.SIG_KEYS(datos())), ['firma_sol', 'firma_rep']);
  assert.deepEqual(J(A.SIG_KEYS(datos({ fact_opcion: 'ter' }))), ['firma_sol', 'firma_rep', 'firma_dest']);
});

test('fecha de hoy y lugar del representante', () => {
  const d = datos({ aut_municipio: 'La Puebla de Alfindén' });
  A.fillToday(d, new Date(2026, 9, 22));
  assert.deepEqual([d.firma_dia, d.firma_mes, d.firma_anio, d.firma_lugar], ['22', 'octubre', '26', 'La Puebla de Alfindén']);
  const e = datos({ firma_lugar: 'Zaragoza' });
  A.fillToday(e, new Date(2027, 0, 5));
  assert.equal(e.firma_lugar, 'Zaragoza');
  assert.equal(e.firma_anio, '27');
  assert.equal(A.SOLTEC_DEFAULT.aut_nombre, 'M. A. SOLTEC SL');
});

test('documento A4: 2 páginas, datos escapados, logos opcionales, casillas editables', () => {
  const d = datos({ sol_nombre: 'José <Ñúñez> & Cía', sum_dir: 'C/ Mayor 1', fact_opcion: 'rep' });
  const html = A.makeDoc(d, false, { show: false });
  assert.equal((html.match(/class="page/g) || []).length, 2);
  assert.ok(html.includes('José &lt;Ñúñez&gt; &amp; Cía'));
  assert.ok(!html.includes('<Ñúñez>'));
  assert.ok(html.includes('PROTECCIÓN DE DATOS'));
  assert.ok(!html.includes('alt="SOLTEC"'));
  const conLogo = A.makeDoc(d, false, { show: true, soltec: 'data:image/png;base64,AA', edist: '' });
  assert.ok(conLogo.includes('alt="SOLTEC"'));
  assert.ok(A.makeDoc(d, true, null).includes('<input'), 'editable = campos sobre las líneas');
});

test('correo: nombre del PDF, asunto, cuerpo y dirección válida', () => {
  assert.equal(A.nombrePdf(datos({ sol_nombre: 'José Ñúñez, S.L.' })), 'AUTORIZACION_REPRESENTATIVIDAD_JOSE_NUNEZ_S_L.pdf');
  assert.equal(A.nombrePdf(datos()), 'AUTORIZACION_REPRESENTATIVIDAD_CLIENTE.pdf');
  assert.equal(A.asuntoCorreo(datos({ sum_dir: 'C/ Mayor 1' })), 'Autorización de representatividad · C/ Mayor 1');
  const c = A.cuerpoCorreo(datos({ sum_dir: 'C/ Mayor 1', aut_nombre: 'M. A. SOLTEC SL', aut_tel: '976000000' }));
  assert.match(c, /suministro de C\/ Mayor 1\./);
  assert.match(c, /M\. A\. SOLTEC SL\nTel\. 976000000$/);
  assert.equal(A.correoValido(' cliente@correo.es '), true);
  assert.equal(A.correoValido('cliente@correo'), false);
});
