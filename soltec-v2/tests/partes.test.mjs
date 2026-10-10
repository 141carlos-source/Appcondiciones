import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { nuevoParte, normalizarParte, siguienteNumeroParte, horasNumero, faltaParaCerrar, nombrePartePdf, generarPartePdf } from '../core/partes.js';
import { nuevoAviso } from '../core/model.js';
import { normalizarEmpresa } from '../core/empresa.js';

globalThis.self ??= globalThis;
const _r = createRequire(import.meta.url)('../vendor/pdf-lib.min.js');
const PDFLib = _r?.PDFDocument ? _r : globalThis.PDFLib;
const jpg = { bytes: readFileSync(new URL('../assets/logo_e-distribucion.jpg', import.meta.url)), mime: 'image/jpeg' };

test('parte nuevo con los datos del aviso y el técnico de la empresa', () => {
  const a = nuevoAviso({ numero: '2026-0003', cliente: { nombre: 'Ana', telefono: '600' }, suministro: { direccion: 'Calle Sol 3', piso: '1', poblacion: 'Teruel' } });
  const p = nuevoParte(a, normalizarEmpresa({ tecnico: { nombre: 'Carlos' } }));
  assert.equal(p.avisoNumero, '2026-0003');
  assert.equal(p.cliente.nombre, 'Ana');
  assert.equal(p.cliente.localidad, 'Teruel');
  assert.equal(p.tecnico, 'Carlos');
  assert.equal(normalizarParte({ cliente: { nombre: 'X' } }).conceptos.urgencia, false);
});

test('numeración P-AAAA-NNNN y horas', () => {
  assert.equal(siguienteNumeroParte([{ data: { numero: 'P-2026-0009' } }, { data: { numero: '2026-0050' } }], new Date('2026-10-10')), 'P-2026-0010');
  assert.equal(horasNumero('1,5'), 1.5);
  assert.equal(horasNumero('3.25'), 3.25);
  assert.equal(horasNumero('2h 30'), 2.5);
  assert.equal(horasNumero(''), 0);
  assert.equal(horasNumero('mucho'), null);
});

test('para cerrar hacen falta trabajos, resultado, horas válidas y firma', () => {
  const p = nuevoParte();
  assert.deepEqual(faltaParaCerrar({ ...p, horas: 'x' }), ['los trabajos realizados', 'el resultado', 'unas horas válidas (ej.: 1,5)', 'la firma del cliente']);
  assert.deepEqual(faltaParaCerrar({ ...p, trabajos: 'Cambio de diferencial', resultado: 'Resuelto', horas: '1', firma: { nombre: 'Ana' } }), []);
});

test('PDF del parte con materiales, firmas y fotos', async () => {
  const p = { ...nuevoParte(), numero: 'P-2026-0001', fecha: '2026-10-10', avisoNumero: '2026-0003', tecnico: 'Carlos',
    cliente: { nombre: 'Ana Gil', direccion: 'Calle Sol 3', piso: '1', puerta: 'A', localidad: 'Teruel' },
    trabajos: 'Sustitución de diferencial 40A 30mA.\nComprobación de disparo y aislamiento.', conceptos: { desplazamiento: true, disponibilidad: false, urgencia: true }, horas: '1,5',
    materiales: [{ ref: 'NIE-123', desc: 'Diferencial 2P 40A 30mA', cantidad: 1 }, { ref: '', desc: 'Cable 6 mm²', cantidad: '3 m' }],
    observaciones: 'Se recomienda revisar la toma de tierra.', resultado: 'Resuelto', firma: { nombre: 'Ana Gil', nif: '12345678Z', fecha: '10/10/2026' } };
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
  const bytes = await generarPartePdf(PDFLib, { parte: p, empresa: normalizarEmpresa({ empresa: { nombre: 'M. A. SOLTEC SL' } }), logo: jpg, firmaCliente: { bytes: png }, firmaTecnico: jpg, fotos: [{ ...jpg, nombre: 'Cuadro' }] });
  const doc = await PDFLib.PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 2);
  const { execFileSync } = await import('node:child_process');
  writeFileSync('/tmp/parte-t.pdf', bytes);
  const txt = execFileSync('pdftotext', ['-layout', '/tmp/parte-t.pdf', '-']).toString();
  assert.match(txt, /30mA\.\s*\n.*Comprobación de disparo/, 'respeta los saltos de línea');
  assert.match(txt, /—/, 'el guion largo de los campos vacíos se ve');
  assert.equal(nombrePartePdf(p), 'PARTE_P_2026_0001_CALLE_SOL_3_PISO_1_PUERTA_A.pdf');
  writeFileSync(new URL('./parte-ejemplo.pdf', import.meta.url), bytes);
});
