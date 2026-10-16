import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Storage } from '../core/storage.js';
import * as V from '../core/validate.js';
import { nuevoAviso, siguienteNumero, isExpediente, conPdfCondiciones, datosPendientes, nombreMemoria } from '../core/model.js';
import { buscar, duplicados, bandeja } from '../core/search.js';

let n = 0;
const abrir = () => Storage.open({ name: 'test_' + n++ });

const avisoCompleto = () => nuevoAviso({
  numero: '2026-0001',
  cliente: { nombre: 'María Pérez Gómez', contacto: '', nif: '12345678Z', telefono: '+34 600 123 456', email: 'maria@ejemplo.es', iban: 'ES9121000418450200051332' },
  suministro: { direccion: 'Calle Ramón y Cajal 12', piso: '3', puerta: 'B', cp: '44001', poblacion: 'Teruel', provincia: 'Teruel', refCatastral: '9872023VH5797S0001WX', lat: '', lon: '', cups: '' },
  electrico: { potenciaKw: '5,75', tension: '230', fases: '1', uso: 'vivienda' },
});

// ---------- Validadores ----------
test('DNI, NIE y CIF', () => {
  assert.equal(V.validarNif('12345678Z'), null);
  assert.equal(V.validarNif('12.345.678-z'), null);
  assert.match(V.validarNif('12345678A'), /incorrecta/);
  assert.equal(V.validarNif('X1234567L'), null);
  assert.equal(V.validarNif('A28015865'), null);
  assert.equal(V.validarNif('B12345674'), null);
  assert.match(V.validarNif('B12345675'), /CIF/);
});

test('CUPS con control mod 529', () => {
  const base = 'ES0031408123456789';
  const r = Number(BigInt('0031408123456789') % 529n);
  const L = 'TRWAGMYFPDXBNJZSQVHLCKE';
  const ok = base + L[Math.floor(r / 23)] + L[r % 23];
  assert.equal(V.validarCups(ok), null);
  assert.equal(V.validarCups(ok + '0F'), null);
  assert.match(V.validarCups(base + 'AA'), /control/);
  assert.match(V.validarCups('ES123'), /16 dígitos/);
  assert.equal(V.cupsBase(ok + '0F'), ok);
});

test('IBAN, teléfono, correo, CP, referencia catastral', () => {
  assert.equal(V.validarIban('ES91 2100 0418 4502 0005 1332'), null);
  assert.match(V.validarIban('ES9121000418450200051333'), /control/);
  assert.equal(V.formatearIban('es9121000418450200051332'), 'ES91 2100 0418 4502 0005 1332');
  assert.equal(V.validarTelefono('0034 978 123 456'), null);
  assert.ok(V.validarTelefono('12345'));
  assert.equal(V.validarEmail('a@b.es'), null);
  assert.ok(V.validarEmail('a@b'));
  assert.equal(V.validarCp('44001'), null);
  assert.ok(V.validarCp('60001'));
  assert.equal(V.provinciaDeCp('44001'), 'TERUEL');
  assert.equal(V.validarRefCatastral('9872023 VH5797S 0001 WX'), null);
  assert.match(V.validarRefCatastral('9872023VH5797S0001WY'), /control/);
  assert.match(V.validarRefCatastral('9872023VH5797S'), /20/);
});

// ---------- Modelo ----------
test('datos pendientes por destino y coherencia de potencia', () => {
  const a = avisoCompleto();
  assert.deepEqual(datosPendientes(a, 'ficha'), []);
  assert.deepEqual(datosPendientes(a, 'boletin'), []);
  assert.deepEqual(datosPendientes(a, 'contrato').map((x) => x.campo), ['suministro.cups']);
  a.electrico.potenciaKw = '20';
  assert.ok(datosPendientes(a, 'boletin').some((x) => /trifásico/.test(x.problema)));
  assert.ok(datosPendientes(nuevoAviso()).length > 8);
});

test('regla de expediente, versiones de PDF y nombre de la memoria', () => {
  let a = avisoCompleto();
  assert.equal(isExpediente(a), false);
  a = conPdfCondiciones(a, { hash: 'h1', name: 'v1.pdf' });
  a = conPdfCondiciones(a, { hash: 'h2', name: 'v2.pdf' });
  a = conPdfCondiciones(a, { hash: 'h1', name: 'v1.pdf' });
  assert.equal(isExpediente(a), true);
  assert.deepEqual(a.condiciones.pdfs.map((p) => p.hash), ['h1', 'h2']);
  assert.equal(nombreMemoria(a), 'CNMC_CIRCULAR_1_2024_ENDESA_CALLE_RAMON_Y_CAJAL_12_PISO_3_PUERTA_B.pdf');
  assert.equal(isExpediente(nuevoAviso({ condiciones: { ref: '0000123456', pdfs: [] } })), true);
});

test('número correlativo por año', () => {
  const regs = [{ data: { numero: '2026-0007' } }, { data: { numero: '2025-0099' } }, { data: { numero: '' } }];
  assert.equal(siguienteNumero(regs, new Date('2026-10-10')), '2026-0008');
  assert.equal(siguienteNumero(regs, new Date('2027-01-02')), '2027-0001');
});

// ---------- Storage ----------
test('guardar, historial en la misma transacción y cola agrupada', async () => {
  const s = await abrir();
  const cambios = [];
  s.subscribe((c) => cambios.push(c));
  const r1 = await s.save('aviso', avisoCompleto(), { event: { kind: 'creado', text: 'Aviso creado' } });
  assert.equal(r1.rev, 1);
  assert.equal(r1.deviceId, s.deviceId);
  const r2 = await s.patch(r1.id, { tramite: 'firma' }, { event: { kind: 'tramite', text: 'Pendiente de firma' } });
  assert.equal(r2.rev, 2);
  assert.equal(r2.data.cliente.nombre, 'María Pérez Gómez');
  assert.equal(r2.createdAt, r1.createdAt);
  const hist = await s.history(r1.id);
  assert.deepEqual(hist.map((e) => e.data.kind), ['creado', 'tramite']);
  // 1 aviso (agrupado) + 2 eventos
  assert.deepEqual(await s.pendingCounts(), { records: 3, files: 0 });
  assert.equal(cambios.filter((c) => c.type === 'aviso').length, 2);
  await assert.rejects(s.save('evento', {}, { id: hist[0].id }), /no se modifican/);
  await assert.rejects(s.save('cita', {}, { id: r1.id }), /es de tipo aviso/);
});

test('papelera: no aparece en listados pero no se pierde', async () => {
  const s = await abrir();
  const r = await s.save('aviso', avisoCompleto());
  await s.trash(r.id, 'duplicado');
  assert.equal((await s.list('aviso')).length, 0);
  assert.equal((await s.list('aviso', { onlyDeleted: true })).length, 1);
  await s.restore(r.id);
  const back = await s.get(r.id);
  assert.equal(back.deleted, false);
  assert.equal(back.data.cliente.nif, '12345678Z');
  assert.deepEqual((await s.history(r.id)).map((e) => e.data.kind), ['papelera', 'restaurado']);
});

test('una transacción fallida no deja nada a medias', async () => {
  const s = await abrir();
  await assert.rejects(s.patch('no-existe', { a: 1 }, { event: { kind: 'nota' } }));
  assert.deepEqual(await s.pendingCounts(), { records: 0, files: 0 });
  assert.equal((await s.dumpAll()).records.length, 0);
});

test('archivos: deduplicados por huella y recuperables', async () => {
  const s = await abrir();
  const bytes = new TextEncoder().encode('%PDF-1.4 condiciones');
  const f1 = await s.putFile({ name: 'cond.pdf', mime: 'application/pdf', bytes });
  const f2 = await s.putFile({ name: 'otro-nombre.pdf', mime: 'application/pdf', bytes });
  assert.equal(f1.hash, f2.hash);
  assert.equal(f1.hash.length, 64);
  assert.deepEqual(await s.pendingCounts(), { records: 0, files: 1 });
  const back = await s.getFile(f1.hash);
  assert.equal(new TextDecoder().decode(back.bytes), '%PDF-1.4 condiciones');
  const blob = await s.getFileBlob(f1.hash);
  assert.equal(blob.type, 'application/pdf');
});

test('meta e id de dispositivo persistentes', async () => {
  const name = 'test_meta';
  const s1 = await Storage.open({ name });
  await s1.setMeta('sync', { url: 'https://pc', clave: 'x' });
  s1.close();
  const s2 = await Storage.open({ name });
  assert.equal(s2.deviceId, s1.deviceId);
  assert.deepEqual(await s2.getMeta('sync'), { url: 'https://pc', clave: 'x' });
});

// ---------- Búsqueda, duplicados, bandeja ----------
test('buscador único sin acentos, por teléfono, CUPS y referencia', async () => {
  const s = await abrir();
  const a = avisoCompleto();
  a.condiciones.ref = '0000-412-345';
  await s.save('aviso', a);
  await s.save('aviso', nuevoAviso({ numero: '2026-0002', cliente: { nombre: 'Juan López' } }));
  const regs = await s.list('aviso');
  assert.equal(buscar(regs, 'maria perez').length, 1);
  assert.equal(buscar(regs, 'RAMÓN cajal 12').length, 1);
  assert.equal(buscar(regs, '600123456').length, 1);
  assert.equal(buscar(regs, '0000412345')[0].expediente, true);
  assert.equal(buscar(regs, '2026-0002')[0].registro.data.cliente.nombre, 'Juan López');
  assert.equal(buscar(regs, 'zaragoza').length, 0);
});

test('duplicados por CUPS y por dirección; nunca el propio registro', () => {
  const a = avisoCompleto();
  a.suministro.cups = 'ES0031408123456789' + 'XX';
  const regs = [
    { id: 'yo', data: a },
    { id: 'otro', data: { suministro: { ...a.suministro, direccion: 'C/ Ramon y Cajal, 12', cups: '' } } },
    { id: 'borrado', deleted: true, data: a },
    { id: 'distinto', data: { suministro: { ...a.suministro, puerta: 'A', cups: '' } } },
  ];
  const d = duplicados(a, regs, 'yo');
  assert.deepEqual(d.map((x) => x.registro.id), ['otro']);
  assert.deepEqual(d[0].motivos, ['misma dirección, piso y puerta']);

  const av = { suministro: { direccion: 'Avda. de Sagunto 5', piso: '1', puerta: 'A', cp: '44002' } };
  const otros = [
    { id: 'x', data: { suministro: { direccion: 'Avenida Sagunto, 5', piso: '1º', puerta: 'a', cp: '44002' } } },
    { id: 'y', data: { suministro: { direccion: 'Avenida Sagunto, 15', piso: '1', puerta: 'A', cp: '44002' } } },
  ];
  assert.deepEqual(duplicados(av, otros).map((x) => x.registro.id), ['x']);
});

test('bandeja «Qué toca hoy»', () => {
  const ahora = new Date('2026-10-10T10:00:00');
  const completo = { ...avisoCompleto(), tramite: 'presentado', docs: { dni: 'recibido' } };
  completo.suministro.cups = (() => { const r = Number(BigInt('0031408123456789') % 529n); const L = 'TRWAGMYFPDXBNJZSQVHLCKE'; return 'ES0031408123456789' + L[Math.floor(r / 23)] + L[r % 23]; })();
  const avisos = [
    { id: 'a1', data: { ...completo, numero: '1' } },
    { id: 'a2', data: { ...completo, numero: '2' } },
    { id: 'a3', data: { ...completo, numero: '3', docs: { contrato: 'pendiente' } } },
    { id: 'a4', data: { ...completo, numero: '4', tramite: 'finalizado', docs: { contrato: 'pendiente' } } },
    { id: 'a5', data: { ...completo, numero: '5' } },
  ];
  const citas = [
    { id: 'c1', ref: 'a1', data: { titulo: 'Llamar', fecha: '2026-10-10' } },
    { id: 'c2', ref: 'a2', data: { titulo: 'Reclamar', fecha: '2026-10-01' } },
    { id: 'c3', ref: 'a5', data: { titulo: 'Hecho', fecha: '2026-10-01', hecho: true } },
  ];
  assert.deepEqual(bandeja(avisos, citas, 'todo', ahora).map((i) => i.numero), ['2', '1', '3']);
  assert.deepEqual(bandeja(avisos, citas, 'hoy', ahora).map((i) => i.numero), ['1']);
  assert.deepEqual(bandeja(avisos, citas, 'vencidos', ahora).map((i) => i.numero), ['2']);
  assert.deepEqual(bandeja(avisos, citas, 'docs', ahora).map((i) => i.numero), ['3']);
  assert.equal(bandeja(avisos, citas, 'datos', ahora).length, 0);
});

test('la versión de la app y la del service worker coinciden', async () => {
  const { readFileSync } = await import('node:fs');
  const v = (f, re) => re.exec(readFileSync(new URL('../' + f, import.meta.url), 'utf8'))[1];
  assert.equal(v('app.js', /VERSION = '([^']+)'/), v('sw.js', /VERSION = '([^']+)'/));
});

test('el número de la calle va en su campo', async () => {
  const { separarNumero, calleNumero, direccionCompleta } = await import('../core/model.js');
  assert.deepEqual(separarNumero('CALLE MAYOR 10'), { calle: 'CALLE MAYOR', numero: '10' });
  assert.deepEqual(separarNumero('Avda. Madrid, 25 B'), { calle: 'Avda. Madrid', numero: '25 B' });
  assert.deepEqual(separarNumero('CALLE DOS DE MAYO Nº 3'), { calle: 'CALLE DOS DE MAYO', numero: '3' });
  assert.deepEqual(separarNumero('CALLE 2 DE MAYO'), { calle: 'CALLE 2 DE MAYO', numero: '' });
  assert.deepEqual(separarNumero('CARRETERA N-232 KM 5'), { calle: 'CARRETERA N-232 KM 5', numero: '' });
  assert.equal(calleNumero({ direccion: 'CALLE MAYOR', numero: '10' }), 'CALLE MAYOR 10');
  assert.equal(direccionCompleta({ direccion: 'CALLE MAYOR', numero: '10', piso: '2', puerta: 'B' }), 'CALLE MAYOR 10, Piso 2, Puerta B');
});

test('sin contrato («No aplica») el IBAN vacío no sale como falta; con contrato sí', () => {
  const a = nuevoAviso();
  assert.ok(datosPendientes(a).some((p) => p.campo === 'cliente.iban'));
  assert.ok(datosPendientes(a, 'contrato').some((p) => p.campo === 'cliente.iban'));
  a.docs.contrato = 'na';
  assert.ok(!datosPendientes(a).some((p) => p.campo === 'cliente.iban'));
  assert.ok(!datosPendientes(a, 'contrato').some((p) => p.campo === 'cliente.iban'));
  a.cliente.iban = 'ES00 1234';
  assert.ok(datosPendientes(a).some((p) => p.campo === 'cliente.iban'), 'si se escribe mal, se avisa igual');
});
