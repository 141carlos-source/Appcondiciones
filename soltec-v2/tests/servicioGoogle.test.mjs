import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idServicio, urlServicio, servicioListo, claveNueva, cifrar, descifrar, leerEnlaceCorto, crearEnlaceCorto, cargarEnlaceCorto, llamar } from '../core/servicioGoogle.js';
import { paqueteFicha } from '../core/fichaCliente.js';

const DEP = 'AKfycbx' + 'A'.repeat(60);
const URL_S = urlServicio(DEP);

/** Servicio de Google simulado (como SOLTEC_Formularios.gs). */
function servicioFalso(clave) {
  const guardado = new Map(); const correos = []; let logo = '';
  const fetchFn = async (url, o = {}) => {
    const resp = (j) => ({ json: async () => j });
    if (o.method === 'POST') {
      const b = JSON.parse(o.body);
      if (b.clave !== clave) return resp({ ok: false, error: 'clave' });
      if (b.accion === 'guardar') { const id = 'Ab' + (guardado.size + 1) + 'xYz9'; guardado.set(id, b.datos); return resp({ ok: true, id }); }
      if (b.accion === 'logo') { logo = b.logo; return resp({ ok: true }); }
      if (b.accion === 'correo') { correos.push(b); return resp({ ok: true }); }
      return resp({ ok: true, cuenta: 'yo@gmail.com' });
    }
    const u = new URL(url);
    if (u.searchParams.get('logo')) return resp({ ok: true, logo });
    const d = guardado.get(u.searchParams.get('id'));
    return resp(d ? { ok: true, datos: d } : { ok: false, error: 'caducado' });
  };
  return { fetchFn, guardado, correos, setLogo: (l) => { logo = l; } };
}

test('URL del servicio y configuración', () => {
  assert.equal(idServicio(URL_S), DEP);
  assert.equal(idServicio('https://script.google.com/a/macros/soltec.es/s/' + DEP + '/exec'), DEP);
  assert.equal(idServicio('https://otra.web/macros/s/' + DEP + '/exec'), '');
  assert.equal(servicioListo({ envio: { url: URL_S, clave: claveNueva() } }), true);
  assert.equal(servicioListo({ envio: { url: URL_S, clave: '' } }), false);
  assert.ok(claveNueva().length >= 20);
});

test('cifrado: sin la clave no se leen los datos', async () => {
  const { datos, clave } = await cifrar({ hola: 'ANA GIL' });
  assert.ok(!datos.includes('ANA'));
  assert.deepEqual(await descifrar(datos, clave), { hola: 'ANA GIL' });
  const otra = (await cifrar({})).clave;
  await assert.rejects(descifrar(datos, otra));
});

test('enlace corto: se guarda cifrado y el formulario lo recupera (con el logo del servicio)', async () => {
  const clave = claveNueva(), s = servicioFalso(clave);
  const empresa = { empresa: { nombre: 'M. A. SOLTEC SL' }, envio: { url: URL_S, clave } };
  const aviso = { id: 'a1', numero: '2026-0001', cliente: { nombre: 'ANA GIL', telefono: '600123456' }, suministro: { direccion: 'CALLE MAYOR' } };
  const paquete = paqueteFicha(aviso, empresa, { logoServicio: true });
  const url = await crearEnlaceCorto(empresa, 'https://x.github.io/soltec-v2/', paquete, { fetchFn: s.fetchFn });
  assert.match(url, /^https:\/\/x\.github\.io\/soltec-v2\/cliente\.html#g\./);
  assert.ok(url.length < 170, `enlace de ${url.length} caracteres`);
  assert.ok(![...s.guardado.values()][0].includes('ANA'), 'en Google solo hay datos cifrados');
  s.setLogo('data:image/png;base64,iVBORw0KGgo=');
  const p = await cargarEnlaceCorto(leerEnlaceCorto(new URL(url).hash), { fetchFn: s.fetchFn });
  assert.equal(p.d['cliente.nombre'], 'ANA GIL');
  assert.equal(p.n, '2026-0001');
  assert.equal(p.e.l, 'data:image/png;base64,iVBORw0KGgo=');
  await assert.rejects(cargarEnlaceCorto({ ...leerEnlaceCorto(new URL(url).hash), codigo: 'NoExiste1' }, { fetchFn: s.fetchFn }), /caducado/);
  await assert.rejects(llamar(URL_S, { accion: 'prueba', clave: 'mala' }, { fetchFn: s.fetchFn }), /clave no coincide/);
});

test('WhatsApp enseña el enlace como tarjeta: título, texto e imagen del formulario', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const html = readFileSync(new URL('../cliente.html', import.meta.url), 'utf8');
  for (const p of ['og:title', 'og:description', 'og:image']) assert.match(html, new RegExp(`property="${p}" content="[^"]+"`));
  const img = /property="og:image" content="([^"]+)"/.exec(html)[1];
  assert.match(img, /^https:\/\/141carlos-source\.github\.io\/Appcondiciones\/soltec-v2\/assets\/formulario-whatsapp\.jpg$/);
  assert.ok(existsSync(new URL('../assets/formulario-whatsapp.jpg', import.meta.url)));
});
