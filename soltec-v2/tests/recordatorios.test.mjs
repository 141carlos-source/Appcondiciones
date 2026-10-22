// Recordatorios automáticos (core/recordatorios.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordatorios, plazosDe, fechaEnvio, diasDesde, PLAZOS_RECORDATORIO, pendientesDeAvisar, contenidoNotificacion } from '../core/recordatorios.js';
import { readFileSync } from 'node:fs';

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

test('notificaciones: una vez al día por recordatorio, solo de 8:00 a 21:00', () => {
  const lista = recordatorios([aviso('a'), aviso('b')], [ev('a', 'solicitud_presentada', hace(20)), ev('b', 'solicitud_presentada', hace(16))], AHORA);
  const p1 = pendientesDeAvisar(lista, {}, AHORA);
  assert.equal(p1.nuevos.length, 2);
  const p2 = pendientesDeAvisar(lista, p1.avisados, new Date(2026, 9, 22, 20, 30));
  assert.equal(p2.nuevos.length, 0, 'el mismo día no se repite');
  const manana = new Date(2026, 9, 23, 9, 0);
  assert.equal(pendientesDeAvisar(recordatorios([aviso('a')], [ev('a', 'solicitud_presentada', hace(20))], manana), p2.avisados, manana).nuevos.length, 1, 'al día siguiente vuelve a avisar');
  assert.equal(pendientesDeAvisar(lista, {}, new Date(2026, 9, 22, 7, 59)).nuevos.length, 0, 'de madrugada no');
  assert.equal(pendientesDeAvisar(lista, {}, new Date(2026, 9, 22, 21, 0)).nuevos.length, 0, 'de noche no');
  const viejo = { 'x|condiciones|2026-01-01|2026-01-01': new Date(2026, 0, 1).toISOString() };
  assert.deepEqual(Object.keys(pendientesDeAvisar([], viejo, AHORA).avisados), [], 'se olvidan los de hace más de 14 días');
});

test('contenido: una notificación aunque haya varios recordatorios, y abre el aviso o Inicio', () => {
  const uno = recordatorios([aviso('a')], [ev('a', 'solicitud_presentada', hace(20))], AHORA);
  const n1 = contenidoNotificacion(uno);
  assert.equal(n1.titulo, 'SOLTEC · Recordatorio');
  assert.equal(n1.cuerpo, 'Condiciones solicitadas hace 20 días sin respuesta\n2026-a · Cliente a');
  assert.equal(n1.url, '#/aviso/a');
  const muchos = recordatorios(['a', 'b', 'c', 'd', 'e', 'f'].map((x) => aviso(x)), ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => ev(x, 'solicitud_presentada', hace(20))), AHORA);
  const n = contenidoNotificacion(muchos);
  assert.equal(n.titulo, 'SOLTEC · 6 recordatorios sin respuesta');
  assert.equal(n.url, '#/inicio');
  assert.equal(n.cuerpo.split('\n').length, 5);
  assert.match(n.cuerpo, /… y 2 más$/);
  assert.equal(contenidoNotificacion([]), null);
});

test('el service worker carga las mismas reglas y avisa con la app cerrada', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /importScripts\('\.\/core\/recordatorios-reglas\.js'\)/);
  assert.ok(sw.includes("'./core/recordatorios-reglas.js'"), 'en el caché');
  assert.match(sw, /addEventListener\('periodicsync'/);
  assert.match(sw, /notification\.data && e\.notification\.data\.url/);
});
