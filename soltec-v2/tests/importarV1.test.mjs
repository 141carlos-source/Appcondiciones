import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Storage } from '../core/storage.js';
import { leerSnapshot, planificar, ejecutar, decodificar } from '../core/importarV1.js';
import { isExpediente } from '../core/model.js';
import { totales } from '../core/memoria.js';
import { buscar } from '../core/search.js';
import { centralDePrueba, IDS } from './fixture-v1.mjs';

let n = 0;
const importar = async (s, central = centralDePrueba()) => ejecutar(s, planificar(leerSnapshot(central), { avisosExistentes: await s.list('aviso', { includeDeleted: true }) }));

test('plan: resumen de lo que hay en la V1.35', () => {
  const p = planificar(leerSnapshot(centralDePrueba()));
  assert.deepEqual(p.resumen, { avisos: 3, papelera: 1, expedientes: 2, pdfs: 2, fotos: 4, planos: 1, citas: 1, partes: 1, empresa: true });
  assert.deepEqual(p.avisos.map((x) => x.data.numero), ['2026-0001', '2026-0002', '2026-0003', '2026-0004'], 'activos primero, luego papelera');
  assert.throws(() => leerSnapshot({ algo: 1 }), /snapshot/);
});

test('aviso completo: cliente, suministro, IBAN, condiciones con versiones, fotos, CGP, trabajos y memoria', async () => {
  const s = await Storage.open({ name: 'imp_' + n++ });
  const inf = await importar(s);
  assert.deepEqual(inf.nuevos, { avisos: 3, papelera: 1, citas: 1, partes: 1 });
  assert.equal(inf.errores.length, 0);
  const a = (await s.get('v1-' + IDS.A)).data;
  assert.equal(a.cliente.nombre, 'Cliente Uno');
  assert.equal(a.cliente.nif, '12345678Z');
  assert.equal(a.cliente.iban, 'ES9121000418450200051332');
  assert.equal(a.suministro.poblacion, 'Zaragoza');
  assert.equal(a.suministro.cups, 'ES0031408123456789XX');
  assert.equal(a.suministro.lat, '41.65');
  assert.equal(a.electrico.potenciaKw, '15');
  assert.equal(a.electrico.potenciaCalculada, '14,49');
  assert.equal(a.electrico.iga, '63');
  assert.equal(a.electrico.tension, '230');
  assert.equal(a.condiciones.ref, '0000111222');
  assert.deepEqual(a.condiciones.pdfs.map((p) => p.name), ['COND_V1.pdf', 'COND_V2.pdf'], 'histórico + actual, en orden');
  assert.equal(new TextDecoder().decode((await s.getFile(a.condiciones.pdfs[1].hash)).bytes), '%PDF-1.4 condiciones version 2');
  assert.equal(a.docs.condiciones, 'recibido');
  assert.equal(a.fotos.length, 2);
  assert.equal(a.fotos.filter((f) => f.cgp).length, 1);
  assert.equal(a.archivos[0].tipo, 'foto_trabajos');
  assert.equal(a.obra, 'Obra Uno');
  assert.deepEqual(a.presupuesto, { es: true, numero: 'P-77' });
  assert.equal(a.observaciones, 'Acometida subterránea');
  assert.equal(a.v1.id, String(IDS.A));
  assert.ok(isExpediente(a));
  assert.match((await s.history('v1-' + IDS.A))[0].data.text, /Importado de la V1.35/);
});

test('estados, trifásica, datos técnicos, plano, facturación e historial', async () => {
  const s = await Storage.open({ name: 'imp_' + n++ });
  await importar(s);
  const b = (await s.get('v1-' + IDS.B)).data;
  assert.equal(b.estado, 'Cerrado');
  assert.equal(b.tramite, 'finalizado');
  const c = (await s.get('v1-' + IDS.C)).data;
  assert.equal(c.estado, 'Abierto');
  assert.equal(c.electrico.tension, '400');
  assert.equal(c.condiciones.ref, '0000333444', 'referencia desde los datos de suministro');
  assert.equal(c.memoria.tipoSolicitud, 'NUEVO SUMINISTRO');
  assert.equal(c.memoria.viviendas[0].aplica, true);
  assert.equal(c.memoria.viviendas[1].aplica, false);
  assert.equal(c.memoria.garajes[1].aplica, true);
  assert.equal(c.memoria.autoconsumo.aplica, true);
  assert.equal(totales(c.memoria).total, 16.6);
  assert.ok(c.plano?.hash);
  assert.equal(c.facturacion.direccion, 'Calle Fiscal 5');
  assert.equal(c.facturacion.mismoCliente, false);
  assert.ok((await s.history('v1-' + IDS.C)).some((e) => /Solicitud presentada: por la web/.test(e.data.text)));
});

test('papelera, agenda, partes con firma y empresa', async () => {
  const s = await Storage.open({ name: 'imp_' + n++ });
  let empresa = null;
  await ejecutar(s, planificar(leerSnapshot(centralDePrueba())), { empresaVaciaRellenar: async (imp) => { empresa = imp; } });
  assert.equal((await s.get('v1-' + IDS.T)).deleted, true);
  assert.equal((await s.list('aviso')).length, 3);
  const [cita] = await s.list('cita');
  assert.equal(cita.data.titulo, 'Visita obra');
  assert.match(cita.data.notas, /Cliente: Cliente Uno/);
  const [p] = await s.list('parte');
  assert.equal(p.ref, 'v1-' + IDS.A);
  assert.equal(p.data.numero, 'PT-2026-00001');
  assert.equal(p.data.avisoNumero, '2026-0001');
  assert.equal(p.data.cerrado, true);
  assert.equal(p.data.firma.nif, '12345678Z');
  assert.deepEqual(p.data.materiales, [{ ref: 'REF-1', desc: 'Diferencial 40A', cantidad: '1' }]);
  assert.equal(p.data.fotos.length, 1);
  assert.equal(empresa.datos.empresa.nombre, 'EMPRESA DE PRUEBA SL');
  assert.ok(empresa.imagenes.logo && empresa.imagenes.sello);
});

test('importar dos veces no duplica ni pisa lo cambiado en la V2', async () => {
  const s = await Storage.open({ name: 'imp_' + n++ });
  await importar(s);
  await s.patch('v1-' + IDS.A, { observaciones: 'Cambiado en la V2' });
  const inf = await importar(s);
  assert.deepEqual(inf.nuevos, { avisos: 0, papelera: 0, citas: 0, partes: 0 });
  assert.equal(inf.yaEstaban, 6);
  assert.equal(inf.actualizados, 0);
  assert.equal((await s.get('v1-' + IDS.A)).data.observaciones, 'Cambiado en la V2');
  assert.equal((await s.list('aviso', { includeDeleted: true })).length, 4);
});

test('uso en paralelo: reimportar actualiza lo no tocado en la V2 y conserva lo editado', async () => {
  const s = await Storage.open({ name: 'imp_' + n++ });
  await importar(s);
  const numA = (await s.get('v1-' + IDS.A)).data.numero;
  await s.patch('v1-' + IDS.C, { observaciones: 'Editado en la V2' }); // C se toca en la V2
  await s.patch('v1-' + IDS.A, { tramite: 'presentado' }); // trámite: solo existe en la V2

  // En la V1.35 cambian A, B y C, se mueve B a la papelera y aparece un aviso nuevo
  const central = centralDePrueba();
  const ls = central.snapshot.localStorage;
  const main = JSON.parse(ls.APP_AVISOS_WEB_DATOS_V116_PERSISTENTE);
  main.avisos[2].telefono = '699999999'; // C
  const b = main.avisos.splice(1, 1)[0]; b.eliminadoEn = '2026-10-10T10:00:00Z'; main.papelera.push(b);
  main.avisos.push({ ...main.avisos[0], id: 1788600000005, cliente: 'Cliente Nuevo', creado: '2026-10-09T10:00:00Z' });
  ls.APP_AVISOS_WEB_DATOS_V116_PERSISTENTE = JSON.stringify(main);
  ls.APP_AVISOS_FLAGS_V120 = JSON.stringify({ [IDS.A]: { iban: 'ES7620770024003102575766', condicionesSuministro: true, contratoElectricidad: true } }); // A

  const inf = await importar(s, central);
  assert.equal(inf.nuevos.avisos, 1);
  const A = (await s.get('v1-' + IDS.A)).data, C = (await s.get('v1-' + IDS.C)).data;
  assert.ok(inf.conservados.includes(C.numero), 'C cambiado en las dos: se conserva');
  assert.equal(C.observaciones, 'Editado en la V2');
  assert.equal(C.cliente.telefono, '');
  assert.ok(inf.conservados.includes(A.numero), 'A también se tocó en la V2 (trámite)');
  assert.equal(A.cliente.iban, 'ES9121000418450200051332');
  assert.equal(A.numero, numA);
  // B no se tocó en la V2: se actualiza y pasa a la papelera
  assert.equal((await s.get('v1-' + IDS.B)).deleted, true);
  assert.ok(inf.actualizados >= 1);
  // El nuevo continúa la numeración sin huecos
  const nuevo = (await s.get('v1-1788600000005')).data;
  assert.equal(nuevo.numero, '2026-0005');
  // Una tercera vez sin cambios en la V1.35: nada que hacer
  const inf3 = await importar(s, central);
  assert.equal(inf3.actualizados, 0);
  assert.equal(inf3.nuevos.avisos, 0);
});

test('reimportar actualiza un aviso no tocado en la V2', async () => {
  const s = await Storage.open({ name: 'imp_' + n++ });
  await importar(s);
  const central = centralDePrueba();
  const ls = central.snapshot.localStorage;
  const main = JSON.parse(ls.APP_AVISOS_WEB_DATOS_V116_PERSISTENTE);
  main.avisos[0].telefono = '611222333';
  ls.APP_AVISOS_WEB_DATOS_V116_PERSISTENTE = JSON.stringify(main);
  const inf = await importar(s, central);
  assert.equal(inf.actualizados, 1);
  assert.deepEqual(inf.conservados, []);
  const A = await s.get('v1-' + IDS.A);
  assert.equal(A.data.cliente.telefono, '611222333');
  assert.equal(A.data.condiciones.pdfs.length, 2, 'sin duplicar archivos');
  assert.ok((await s.history('v1-' + IDS.A)).some((e) => /Actualizado con los cambios de la V1.35/.test(e.data.text)));
});

test('el número de la V1.35 sirve para buscar', async () => {
  const s = await Storage.open({ name: 'imp_' + n++ });
  await importar(s);
  const r = buscar(await s.list('aviso'), String(IDS.A));
  assert.equal(r.length, 1);
  assert.equal(r[0].registro.data.cliente.nombre, 'Cliente Uno');
});

test('decodificar admite data:URL, objeto V1.35 y Blob', async () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal((await decodificar(png)).mime, 'image/png');
  assert.equal((await decodificar({ __soltecBlob: 1, mime: 'image/png', data: png })).bytes.length, 8);
  assert.equal((await decodificar(new Blob(['hola'], { type: 'text/plain' }))).bytes.length, 4);
  assert.equal(await decodificar(null), null);
});
