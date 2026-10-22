// Recordatorios automáticos (core/recordatorios.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordatorios, plazosDe, fechaEnvio, diasDesde, PLAZOS_RECORDATORIO } from '../core/recordatorios.js';

const AHORA = new Date(2026, 9, 22, 18, 0); // 22/10/2026 18:00 (hora local)
const hace = (dias, h = 10) => new Date(2026, 9, 22 - dias, h, 0).toISOString();
const aviso = (id, data = {}) => ({ id, type: 'aviso', deleted: false, data: { numero: '2026-' + id, cliente: { nombre: 'Cliente ' + id }, tramite: 'presentado', estado: 'Abierto', docs: {}, condiciones: { ref: '', pdfs: [] }, ...data } });
const ev = (ref, kind, at, extra = {}) => ({ id: 'e' + Math.random(), type: 'evento', ref, deleted: false, data: { at, kind, text: extra.text || '', ...extra } });
const tipos = (rs) => rs.map((r) => [r.registro.id, r.tipo, r.dias]);

test('condiciones solicitadas hace 15 días sin respuesta (por «Solicitud presentada» o el trámite a «Presentado»)', () => {
  const avisos = [aviso('a'), aviso('b'), aviso('c'), aviso('d')];
  const evs = [
    ev('a', 'solicitud_presentada', hace(16)),
    ev('b', 'tramite', hace(20), { text: 'Pendiente de firma → Presentado' }),
    ev('c', 'tramite', hace(15), { text: 'Presentado → Esperando distribuidora' }),
    ev('d', 'solicitud_presentada', hace(14)), // aún no
  ];
  const r = recordatorios(avisos, evs, AHORA);
  assert.deepEqual(tipos(r), [['b', 'condiciones', 20], ['a', 'condiciones', 16], ['c', 'condiciones', 15]]);
  assert.equal(r[0].texto, 'Condiciones solicitadas hace 20 días sin respuesta');
});

test('condiciones: se quita al llegar el PDF, al marcarlas recibidas o con «Condiciones recibidas»', () => {
  const avisos = [
    aviso('a'), aviso('b', { docs: { condiciones: 'recibido' } }),
    aviso('c', { condiciones: { ref: 'X', pdfs: [{ hash: 'h', addedAt: hace(2) }] } }), aviso('d'), aviso('e'),
  ];
  const evs = ['a', 'b', 'c', 'd', 'e'].map((id) => ev(id, 'solicitud_presentada', hace(30)))
    .concat([ev('a', 'condiciones_pdf', hace(3)), ev('d', 'condiciones_recibidas', hace(1)), ev('e', 'condiciones_pdf', hace(40))]);
  assert.deepEqual(tipos(recordatorios(avisos, evs, AHORA)), [['e', 'condiciones', 30]], 'un PDF anterior a la solicitud no cuenta');
});

test('autorización enviada hace 7 días sin firmar', () => {
  const aut = (env_fecha, extra = {}) => ({ autorizacion: { v: 1, datos: { env_correo: 'si', env_para: 'c@c.es', env_fecha, firma_sol: '', ...extra } } });
  const avisos = [
    aviso('a', aut('15/10/2026 09:30')), // 7 días
    aviso('b', aut('16/10/2026 09:30')), // 6 días: aún no
    aviso('c', aut('01/10/2026 09:30', { firma_sol: 'data:image/png;base64,AA' })), // firmada
    aviso('d', { ...aut('01/10/2026 09:30'), docs: { autorizacion: 'recibido' } }), // marcada recibida
    aviso('e', aut('')), // no enviada
    aviso('f', aut('01/10/2026 09:30', { env_correo: 'no' })),
  ];
  const r = recordatorios(avisos, [], AHORA);
  assert.deepEqual(tipos(r), [['a', 'autorizacion', 7]]);
  assert.equal(r[0].texto, 'Autorización enviada hace 7 días sin firmar');
});

test('documentación enviada al cliente sin respuesta', () => {
  const avisos = [aviso('a', { tramite: 'datos' }), aviso('b', { tramite: 'datos' }), aviso('c', { tramite: 'datos' })];
  const evs = [
    ev('a', 'doc_enviada', hace(12)),
    ev('b', 'doc_enviada', hace(12)), ev('b', 'doc_recibida', hace(5)),
    ev('c', 'doc_recibida', hace(20)), ev('c', 'doc_enviada', hace(10)), // la respuesta es anterior al envío
  ];
  assert.deepEqual(tipos(recordatorios(avisos, evs, AHORA)), [['a', 'documentacion', 12], ['c', 'documentacion', 10]]);
});

test('«Reclamado hoy» vuelve a contar; «Ya está» lo quita hasta otra solicitud', () => {
  const avisos = [aviso('a'), aviso('b'), aviso('c')];
  const evs = [
    ev('a', 'solicitud_presentada', hace(30)), ev('a', 'reclamado', hace(5), { tipo: 'condiciones' }),
    ev('b', 'solicitud_presentada', hace(30)), ev('b', 'reclamado', hace(16), { tipo: 'condiciones' }),
    ev('c', 'solicitud_presentada', hace(40)), ev('c', 'recordatorio_resuelto', hace(20), { tipo: 'condiciones' }),
  ];
  const r = recordatorios(avisos, evs, AHORA);
  assert.deepEqual(tipos(r), [['b', 'condiciones', 16]]);
  assert.equal(r[0].reclamado, true);
  // Nueva solicitud después de «Ya está»: vuelve a contar
  evs.push(ev('c', 'solicitud_presentada', hace(18)));
  assert.deepEqual(tipos(recordatorios(avisos, evs, AHORA)).find((x) => x[0] === 'c'), ['c', 'condiciones', 18]);
  // «Reclamado» de otro tipo no afecta
  const r2 = recordatorios([aviso('d')], [ev('d', 'solicitud_presentada', hace(20)), ev('d', 'reclamado', hace(1), { tipo: 'autorizacion' })], AHORA);
  assert.deepEqual(tipos(r2), [['d', 'condiciones', 20]]);
});

test('no avisa de avisos finalizados, cerrados o en la papelera', () => {
  const avisos = [aviso('a', { tramite: 'finalizado' }), aviso('b', { estado: 'Cerrado' }), { ...aviso('c'), deleted: true }];
  const evs = ['a', 'b', 'c'].map((id) => ev(id, 'solicitud_presentada', hace(60)));
  assert.deepEqual(recordatorios(avisos, evs, AHORA), []);
});

test('plazos: los de la empresa, 0 = no avisar, valores raros → los de siempre', () => {
  assert.deepEqual(plazosDe(null), PLAZOS_RECORDATORIO);
  assert.deepEqual(plazosDe({ recordatorios: { condiciones: 30, autorizacion: 0, documentacion: 'x' } }), { condiciones: 30, autorizacion: 0, documentacion: 10 });
  const avisos = [aviso('a', { autorizacion: { datos: { env_correo: 'si', env_fecha: '01/01/2026 10:00' } } })];
  const evs = [ev('a', 'solicitud_presentada', hace(20))];
  assert.deepEqual(tipos(recordatorios(avisos, evs, AHORA, plazosDe({ recordatorios: { condiciones: 30, autorizacion: 0 } }))), []);
});

test('fechas: envío «dd/mm/aaaa hh:mm» o ISO y días naturales', () => {
  assert.equal(new Date(fechaEnvio('5/3/2026 17:45')).getMonth(), 2);
  assert.equal(new Date(fechaEnvio('05/03/2026, 17:45')).getHours(), 17);
  assert.equal(fechaEnvio('2026-10-01T08:00:00.000Z'), '2026-10-01T08:00:00.000Z');
  assert.equal(fechaEnvio(''), null);
  assert.equal(fechaEnvio('ayer'), null);
  assert.equal(diasDesde(new Date(2026, 9, 21, 23, 59), new Date(2026, 9, 22, 0, 1)), 1, 'cambia de día a medianoche');
  assert.equal(diasDesde(new Date(2026, 9, 22, 1), AHORA), 0);
});
