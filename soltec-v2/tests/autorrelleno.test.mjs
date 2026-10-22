// Autorrelleno de la ficha del aviso con lo ya trabajado (core/autorrelleno.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientesConocidos, suministrosConocidos, buscarClientes, buscarSuministros, rellenoCliente, rellenoSuministro, valoresUsados, datosDeLocalidad, textoSuministro } from '../core/autorrelleno.js';
import { nuevoAviso } from '../core/model.js';

let n = 0;
const reg = (data, dia = ++n) => ({ id: 'a' + n, type: 'aviso', deleted: false, updatedAt: `2026-01-${String(dia).padStart(2, '0')}T10:00:00.000Z`, data: nuevoAviso({ numero: '2026-' + String(n).padStart(4, '0'), ...data }) });
const cli = (o) => ({ ...nuevoAviso().cliente, ...o });
const sum = (o) => ({ ...nuevoAviso().suministro, ...o });

const AVISOS = [
  reg({ cliente: cli({ nombre: 'TALLERES EBRO SL', nif: 'B12345674', telefono: '976 111 222' }), suministro: sum({ direccion: 'CALLE MAYOR', numero: '1', cp: '50171', poblacion: 'LA PUEBLA DE ALFINDÉN', provincia: 'ZARAGOZA', cups: 'ES0031405000000001AA' }), electrico: { tension: '400', iga: '63', potenciaKw: '43,65', uso: 'nave' } }),
  reg({ cliente: cli({ nombre: 'Talleres Ebro, S.L.', nif: 'B-12345674', email: 'admin@ebro.es', contacto: 'Pilar' }), suministro: sum({ direccion: 'POLÍGONO MALPICA', numero: '23', cp: '50016', poblacion: 'ZARAGOZA', provincia: 'ZARAGOZA' }) }),
  reg({ cliente: cli({ nombre: 'JOSÉ PÉREZ', telefono: '+34 600 123 123' }), suministro: sum({ direccion: 'CALLE ALFONSO', numero: '5', piso: '2', puerta: 'B', cp: '50003', poblacion: 'ZARAGOZA', provincia: 'ZARAGOZA' }), concepto: 'Nuevo suministro' }),
  reg({ cliente: cli({ nombre: 'Jose Perez', telefono: '600123123', email: 'jose@correo.es' }), concepto: 'Nuevo suministro' }),
  reg({ cliente: cli({ nombre: 'ANA LÓPEZ' }), concepto: 'Aumento de potencia', suministro: sum({ direccion: 'CALLE MAYOR', numero: '1', cp: '50171', poblacion: 'La Puebla de Alfindén', provincia: 'ZARAGOZA', cups: 'ES0031405000000001AA', refCatastral: '1234567XM1213S0001AB' }) }),
];

test('clientes: se juntan los avisos con el mismo NIF o teléfono, con los datos más recientes', () => {
  const cs = clientesConocidos(AVISOS);
  assert.equal(cs.length, 3);
  const ebro = cs.find((c) => c.cliente.nif.replace(/\W/g, '') === 'B12345674');
  assert.equal(ebro.avisos, 2);
  assert.equal(ebro.cliente.nombre, 'Talleres Ebro, S.L.', 'el nombre del aviso más reciente');
  assert.equal(ebro.cliente.telefono, '976 111 222', 'el teléfono del aviso antiguo se conserva');
  assert.equal(ebro.cliente.email, 'admin@ebro.es');
  assert.equal(ebro.suministros.length, 2);
  assert.equal(ebro.suministros[0].suministro.direccion, 'POLÍGONO MALPICA', 'el suministro más reciente primero');
  assert.equal(ebro.suministros[1].electrico.iga, '63');
  const jose = cs.find((c) => /jos/i.test(c.cliente.nombre));
  assert.equal(jose.avisos, 2, '+34 600 123 123 y 600123123 son el mismo teléfono');
  assert.equal(clientesConocidos(AVISOS, { excluir: AVISOS[4].id }).length, 2, 'el aviso abierto no se propone a sí mismo');
});

test('buscar clientes por nombre (sin acentos), NIF, teléfono y correo', () => {
  const cs = clientesConocidos(AVISOS);
  assert.deepEqual(buscarClientes(cs, 'nombre', 'tall').map((c) => c.avisos), [2]);
  assert.equal(buscarClientes(cs, 'nombre', 'ebro').length, 1, 'también por una palabra del medio');
  assert.equal(buscarClientes(cs, 'nombre', 'jose p')[0].cliente.email, 'jose@correo.es');
  assert.equal(buscarClientes(cs, 'nombre', 'lopez')[0].cliente.nombre, 'ANA LÓPEZ');
  assert.equal(buscarClientes(cs, 'nif', 'b-123').length, 1);
  assert.equal(buscarClientes(cs, 'telefono', '600 12').length, 1);
  assert.equal(buscarClientes(cs, 'telefono', '97').length, 0, 'con menos de 3 cifras no busca');
  assert.equal(buscarClientes(cs, 'email', 'ADMIN@').length, 1);
  assert.equal(buscarClientes(cs, 'contacto', 'pilar').length, 0, 'el contacto busca por nombre del cliente');
  assert.equal(buscarClientes(cs, 'contacto', 'talleres').length, 1);
  assert.equal(buscarClientes(cs, 'nombre', 'x').length, 0);
  assert.equal(buscarClientes(cs, 'nombre', 'ANA LÓPEZ').length, 0, 'escrito entero: no se propone');
});

test('rellenar el cliente: solo lo vacío, salvo el campo que se está escribiendo', () => {
  const ebro = clientesConocidos(AVISOS).find((c) => c.avisos === 2 && c.cliente.nif);
  const a = nuevoAviso({ cliente: cli({ nombre: 'TALL', telefono: '699 000 000' }) });
  const r = rellenoCliente(a, ebro, 'nombre');
  assert.equal(r['cliente.nombre'], 'Talleres Ebro, S.L.');
  assert.equal(r['cliente.nif'], 'B-12345674');
  assert.equal(r['cliente.email'], 'admin@ebro.es');
  assert.equal(r['cliente.contacto'], 'Pilar');
  assert.equal('cliente.telefono' in r, false, 'no pisa el teléfono ya escrito');
});

test('facturación a otro nombre: se copia si la del aviso está vacía', () => {
  const av = [reg({ cliente: cli({ nombre: 'COMUNIDAD SOL', nif: 'H50000000' }), facturacion: { mismoCliente: false, nombre: 'ADMINISTRACIÓN FINCAS', nif: 'B99999999', direccion: 'C/ COSO 1', cp: '50001', poblacion: 'ZARAGOZA', provincia: 'ZARAGOZA' } })];
  const c = clientesConocidos(av)[0];
  const r = rellenoCliente(nuevoAviso(), c, 'nombre');
  assert.equal(r['facturacion.mismoCliente'], false);
  assert.equal(r['facturacion.nombre'], 'ADMINISTRACIÓN FINCAS');
  const ya = rellenoCliente(nuevoAviso({ facturacion: { mismoCliente: false, nombre: 'OTRA' } }), c, 'nombre');
  assert.equal('facturacion.nombre' in ya, false);
});

test('suministros: por calle, CUPS o catastro; rellena la dirección y los datos eléctricos vacíos', () => {
  const ss = suministrosConocidos(AVISOS);
  const mayor = ss.find((s) => s.suministro.cups);
  assert.equal(mayor.avisos, 2, 'mismo CUPS = mismo suministro');
  assert.equal(mayor.cliente, 'ANA LÓPEZ');
  assert.equal(mayor.electrico.iga, '63', 'datos eléctricos del aviso anterior');
  assert.equal(buscarSuministros(ss, 'direccion', 'mayo')[0], mayor);
  assert.equal(buscarSuministros(ss, 'direccion', 'alfon').length, 1);
  assert.equal(buscarSuministros(ss, 'cups', 'es0031').length, 1);
  assert.equal(buscarSuministros(ss, 'refCatastral', '1234567').length, 1);
  const r = rellenoSuministro(nuevoAviso({ suministro: sum({ direccion: 'MAYO' }) }), mayor, 'direccion');
  assert.equal(r['suministro.direccion'], 'CALLE MAYOR');
  assert.equal(r['suministro.numero'], '1');
  assert.equal(r['suministro.cups'], 'ES0031405000000001AA');
  assert.equal(r['electrico.iga'], '63');
  assert.equal(r['electrico.uso'], 'nave');
  const r2 = rellenoSuministro(nuevoAviso({ suministro: sum({ direccion: 'MAYO', piso: '3' }), electrico: { iga: '25' } }), mayor, 'direccion');
  assert.equal('suministro.piso' in r2, false, 'no pisa el piso escrito');
  assert.equal('electrico.iga' in r2, false, 'ni el IGA escrito');
  assert.equal(textoSuministro(ss.find((s) => s.suministro.piso)), 'CALLE ALFONSO 5, 2 B · ZARAGOZA');
});

test('valores usados (los más frecuentes primero) y población ⇄ CP ⇄ provincia', () => {
  assert.deepEqual(valoresUsados(AVISOS, 'concepto'), ['Nuevo suministro', 'Aumento de potencia']);
  const pobl = valoresUsados(AVISOS, 'suministro.poblacion');
  assert.ok(pobl.includes('ZARAGOZA'));
  assert.equal(pobl.length, 2, 'La Puebla con y sin acentos/mayúsculas cuenta como una');
  assert.deepEqual(datosDeLocalidad(AVISOS, { poblacion: 'la puebla de alfinden' }), { cp: '50171', provincia: 'ZARAGOZA' });
  assert.deepEqual(datosDeLocalidad(AVISOS, { cp: '50003' }), { poblacion: 'ZARAGOZA', provincia: 'ZARAGOZA' });
  assert.deepEqual(datosDeLocalidad(AVISOS, { cp: '501' }), {});
});

import { formatearTelefono } from '../core/validate.js';
import { comoAvisoDeParte, catalogoMateriales, buscarMateriales, conocidosAutorizacion } from '../core/autorrelleno.js';

test('teléfono con el prefijo del país (+34)', () => {
  assert.equal(formatearTelefono('600123123'), '+34 600 123 123');
  assert.equal(formatearTelefono('600 12 31 23'), '+34 600 123 123');
  assert.equal(formatearTelefono('0034600123123'), '+34 600 123 123');
  assert.equal(formatearTelefono('34 600123123'), '+34 600 123 123');
  assert.equal(formatearTelefono('+34 600-123-123'), '+34 600 123 123');
  assert.equal(formatearTelefono('976111222'), '+34 976 111 222', 'fijos también');
  assert.equal(formatearTelefono('+33  6 12 34 56 78'), '+33 6 12 34 56 78', 'otro país: se deja');
  assert.equal(formatearTelefono('12345'), '12345', 'lo que no se reconoce no se toca');
  assert.equal(formatearTelefono(''), '');
});

test('partes: clientes y direcciones de otros partes; materiales referencia ⇄ descripción', () => {
  const parte = (id, cliente, materiales = [], dia = 1) => ({ id, type: 'parte', deleted: false, updatedAt: `2026-02-0${dia}T10:00:00.000Z`, data: { numero: 'P-' + id, cliente, materiales } });
  const ps = [
    parte('p1', { nombre: 'BAR EL CRUCE', telefono: '976 333 444', direccion: 'CALLE SOL', numero: '3', cp: '50171', localidad: 'LA PUEBLA DE ALFINDÉN' }, [{ ref: 'NZ-2201', desc: 'Interruptor Zenit blanco', cantidad: '2' }, { ref: '', desc: 'Cable 2,5 mm²', cantidad: '20' }], 1),
    parte('p2', { nombre: 'BAR EL CRUCE' }, [{ ref: 'nz-2201', desc: 'Interruptor Zenit blanco', cantidad: '1' }], 2),
  ];
  const cs = clientesConocidos(ps.map(comoAvisoDeParte));
  assert.equal(cs.length, 1);
  assert.equal(cs[0].suministros[0].suministro.poblacion, 'LA PUEBLA DE ALFINDÉN');
  const cat = catalogoMateriales(ps);
  assert.deepEqual(cat.map((x) => [x.ref, x.usos]), [['nz-2201', 2], ['', 1]]);
  assert.equal(buscarMateriales(cat, 'zenit')[0].ref, 'nz-2201', 'por descripción');
  assert.equal(buscarMateriales(cat, 'NZ-22')[0].desc, 'Interruptor Zenit blanco', 'por referencia');
  assert.equal(buscarMateriales(cat, 'cable')[0].desc, 'Cable 2,5 mm²');
  assert.equal(buscarMateriales(cat, 'z').length, 0);
});

test('autorización: solicitantes, terceros y DIR3 de autorizaciones anteriores; clientes sin autorización', () => {
  const aut = (id, datos, cliente = {}) => ({ id, type: 'aviso', deleted: false, updatedAt: '2026-03-01T10:00:00.000Z', data: nuevoAviso({ numero: id, cliente: cli({ nombre: datos.sol_nombre || cliente.nombre || '', ...cliente }), autorizacion: { v: 1, datos } }) });
  const avs = [
    aut('2026-0101', { sol_nombre: 'COMUNIDAD SOL', sol_nif: 'H50000000', sol_via: 'C/ SOL 2', sol_municipio: 'ZARAGOZA', ent_nombre: 'PEDRO GIL', ent_cargo: 'PRESIDENTE', ent_nif: '12345678Z', fact_opcion: 'ter', tf_nombre: 'ADMINISTRACIÓN FINCAS', tf_nif: 'B99999999', tf_calle: 'C/ COSO 1' }),
    aut('2026-0102', { sol_nombre: 'AYUNTAMIENTO DE ALFAJARÍN', sol_nif: 'P5001200A', dir3_oc: 'L01500124', dir3_oc_d: 'Alcaldía', dir3_og: 'L01500124', dir3_ut: 'L01500124' }),
    { id: 'x', type: 'aviso', deleted: false, updatedAt: '2026-01-01T10:00:00.000Z', data: nuevoAviso({ numero: '2026-0050', cliente: cli({ nombre: 'MARÍA RUIZ', nif: '87654321X', telefono: '+34 611 222 333' }) }) },
  ];
  const k = conocidosAutorizacion(avs);
  assert.equal(k.sol.length, 3);
  const com = k.sol.find((x) => x.sol_nif === 'H50000000');
  assert.equal(com.ent_nombre, 'PEDRO GIL');
  assert.equal(com.sol_via, 'C/ SOL 2');
  assert.equal('tf_nombre' in com, false, 'el tercero va aparte');
  assert.deepEqual(k.tf.map((x) => x.tf_nombre), ['ADMINISTRACIÓN FINCAS']);
  assert.deepEqual(k.dir3.map((x) => x.dir3_oc), ['L01500124']);
  const maria = k.sol.find((x) => x.sol_nombre === 'MARÍA RUIZ');
  assert.equal(maria.sol_tel, '+34 611 222 333');
});
