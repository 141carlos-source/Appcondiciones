import { test } from 'node:test';
import assert from 'node:assert/strict';
import { momentoAlarma, debeSonar, enlaceGoogle, icsCita, nombreIcs } from '../core/calendario.js';

test('la alarma suena con la antelación elegida y solo una vez dentro de un margen', () => {
  const c = { titulo: 'Llamar', fecha: '2026-10-12', hora: '10:00', alarma: true, antelacion: 15 };
  assert.equal(momentoAlarma(c).getTime(), new Date('2026-10-12T09:45:00').getTime());
  assert.equal(debeSonar(c, new Date('2026-10-12T09:44:00')), false);
  assert.equal(debeSonar(c, new Date('2026-10-12T09:45:30')), true);
  assert.equal(debeSonar({ ...c, hecho: true }, new Date('2026-10-12T09:50:00')), false);
  assert.equal(debeSonar({ ...c, alarma: false }, new Date('2026-10-12T09:50:00')), false);
  assert.equal(debeSonar(c, new Date('2026-10-13T09:50:00')), false); // demasiado antigua
  // Sin hora: a las 9:00
  assert.equal(momentoAlarma({ fecha: '2026-10-12', alarma: true }).getTime(), new Date('2026-10-12T09:00:00').getTime());
});

test('enlace de Google Calendar con la cita rellenada', () => {
  const u = new URL(enlaceGoogle({ titulo: 'Visita obra', fecha: '2026-10-12', hora: '10:00', notas: 'Llevar CGP' }, { aviso: { numero: '2026-0003', cliente: { nombre: 'Ana', telefono: '600000000' } }, lugar: 'C/ Mayor 1, Zaragoza' }));
  assert.equal(u.hostname, 'calendar.google.com');
  assert.equal(u.searchParams.get('action'), 'TEMPLATE');
  assert.equal(u.searchParams.get('text'), 'SOLTEC · Visita obra');
  const ini = new Date('2026-10-12T10:00:00');
  const z = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  assert.equal(u.searchParams.get('dates'), `${z(ini)}/${z(new Date(ini.getTime() + 30 * 60000))}`);
  assert.match(u.searchParams.get('details'), /Aviso 2026-0003 · Ana\nTel\. 600000000\nLlevar CGP/);
  assert.equal(u.searchParams.get('location'), 'C/ Mayor 1, Zaragoza');
  assert.match(enlaceGoogle({ titulo: 'Todo el día', fecha: '2026-12-31' }), /dates=20261231%2F20270101/);
});

test('archivo .ics válido con su aviso', () => {
  const ics = icsCita({ titulo: 'Llamar, pedir IBAN; urgente', fecha: '2026-10-12', hora: '10:00', alarma: true, antelacion: 30, notas: 'línea 1\nlínea 2' }, { id: 'abc', ahora: new Date('2026-10-11T08:00:00Z') });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.match(ics, /UID:abc@soltec-v2/);
  assert.ok(ics.includes('SUMMARY:SOLTEC · Llamar\\, pedir IBAN\\; urgente'));
  assert.match(ics, /TRIGGER:-PT30M/);
  assert.match(ics, /DESCRIPTION:línea 1\\nlínea 2/);
  for (const l of ics.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75, l);
  const dia = icsCita({ titulo: 'Sin hora', fecha: '2026-10-12', alarma: true, antelacion: 1440 });
  assert.match(dia, /DTSTART;VALUE=DATE:20261012/);
  assert.match(dia, /TRIGGER:-PT900M/); // 9:00 del día anterior
  assert.equal(nombreIcs({ titulo: 'Revisión ¿CGP?', fecha: '2026-10-12' }), 'SOLTEC_2026-10-12_Revision_CGP.ics');
});
