import { test } from 'node:test';
import assert from 'node:assert/strict';
import { desdeCartoCiudad, parcelasCercanas, inmueblesParcela, inmuebleQueCoincide, mercator, urlPlanoIgn, coordsValidas, urlCandidatos, aJsonp, desdeNominatim, urlNominatim } from '../core/geo.js';

test('candidato de CartoCiudad → campos del aviso', () => {
  const r = desdeCartoCiudad({ tip_via: 'CALLE', address: 'RAMON Y CAJAL', portalNumber: 12, postalCode: '44001', muni: 'TERUEL', province: 'TERUEL', lat: 40.344512345, lng: -1.106789123 });
  assert.equal(r.direccion, 'CALLE RAMON Y CAJAL');
  assert.equal(r.numero, '12');
  assert.equal(r.cp, '44001');
  assert.equal(r.poblacion, 'TERUEL');
  assert.equal(r.lat, '40.344512');
  assert.equal(r.lon, '-1.106789');
  assert.equal(r.texto, 'CALLE RAMON Y CAJAL 12, 44001, TERUEL, TERUEL');
  assert.match(urlCandidatos('calle mayor 1'), /\/candidates\?q=calle%20mayor%201&limit=8$/);
  assert.match(aJsonp(urlCandidatos('x')), /\/candidatesJsonp\?q=x/);
  assert.equal(desdeCartoCiudad({ address: 'MAYOR', portalNumber: 0 }).numero, '');
});

test('respuesta real del Catastro: parcela más cercana', () => {
  // Respuesta obtenida del servicio Consulta_RCCOOR_Distancia (Puerta del Sol, Madrid)
  const json = { Consulta_RCCOOR_DistanciaResult: { control: { cucoor: 1 }, coordenadas_distancias: { coordd: [{ geo: { xcen: '-3.70379', ycen: '40.41678', srs: 'EPSG:4326' }, lpcd: [{ pc: { pc1: '0444101', pc2: 'VK4704C' }, dt: {}, ldt: 'PZ PUERTA DEL SOL 7 MADRID (MADRID)', dis: '23.61' }] }] } } };
  assert.deepEqual(parcelasCercanas(json), [{ rc14: '0444101VK4704C', direccion: 'PZ PUERTA DEL SOL 7 MADRID (MADRID)', distancia: 23.61 }]);
  assert.deepEqual(parcelasCercanas({ Consulta_RCCOORResult: { lerr: [{ cod: '16' }] } }), []);
});

test('respuesta real del Catastro: inmueble único', () => {
  // Respuesta obtenida de Consulta_DNPRC para 9872023VH5797S
  const json = { consulta_dnprcResult: { control: { cudnp: 1 }, bico: { bi: { idbi: { cn: 'UR', rc: { pc1: '9872023', pc2: 'VH5797S', car: '0001', cc1: 'W', cc2: 'X' } }, dt: { locs: { lous: { lourb: { loint: { es: 'T', pt: 'OD', pu: 'OS' } } } } }, ldt: 'CL GLORIA 51 13730 SANTA CRUZ DE MUDELA (CIUDAD REAL)', debi: { luso: 'Residencial' } } } } };
  const l = inmueblesParcela(json);
  assert.equal(l.length, 1);
  assert.equal(l[0].rc, '9872023VH5797S0001WX');
  assert.equal(inmuebleQueCoincide(l, '3', 'B'), l[0], 'si solo hay uno, es ese');
});

test('edificio con varios pisos: elige el que coincide con piso y puerta', () => {
  const pisos = [['01', 'A', '0001'], ['01', 'B', '0002'], ['02', 'A', '0003'], ['02', 'B', '0004']];
  const json = { consulta_dnprcResult: { lrcdnp: { rcdnp: pisos.map(([pt, pu, car]) => ({ rc: { pc1: '1234567', pc2: 'AB1234C', car, cc1: 'Q', cc2: 'W' }, dt: { locs: { lous: { lourb: { loint: { es: '1', pt, pu }, dir: { tv: 'CL', nv: 'MAYOR', pnp: '3' } } } } } })) } } };
  const l = inmueblesParcela(json);
  assert.equal(l.length, 4);
  assert.equal(inmuebleQueCoincide(l, '2º', 'b').rc, '1234567AB1234C0004QW');
  assert.equal(inmuebleQueCoincide(l, '', ''), null, 'sin piso ni puerta no adivina');
  assert.equal(l[0].direccion, 'CL MAYOR 3');
});

test('plano IGN centrado en las coordenadas', () => {
  const p = mercator(0, 0);
  assert.ok(Math.abs(p.x) < 1e-6 && Math.abs(p.y) < 1e-6);
  const m = mercator(40.4168, -3.7038);
  assert.ok(Math.abs(m.x - -412305) < 50 && Math.abs(m.y - 4926570) < 200);
  assert.match(urlPlanoIgn(40.4168, -3.7038), /^https:\/\/www\.ign\.es\/wms-inspire\/ign-base\?.*CRS=EPSG:3857&BBOX=/);
  assert.equal(coordsValidas('40.4', '-3.7'), true);
  assert.equal(coordsValidas('4.4', '-3.7'), false);
});

test('respaldo OpenStreetMap (Nominatim) → mismos campos', () => {
  const r = desdeNominatim({ lat: '41.6562345', lon: '-0.8773456', address: { road: 'Calle de Alfonso I', house_number: '17', postcode: '50003', city: 'Zaragoza', province: 'Zaragoza' } });
  assert.deepEqual([r.direccion, r.numero, r.cp, r.poblacion, r.provincia, r.lat, r.lon], ['CALLE DE ALFONSO I', '17', '50003', 'ZARAGOZA', 'ZARAGOZA', '41.656235', '-0.877346']);
  const u = new URL(urlNominatim({ calle: 'CALLE MAYOR', numero: '10', poblacion: 'ZARAGOZA', cp: '50001' }));
  assert.equal(u.searchParams.get('street'), '10 CALLE MAYOR');
  assert.equal(u.searchParams.get('countrycodes'), 'es');
});
