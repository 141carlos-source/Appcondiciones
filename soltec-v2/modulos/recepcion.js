// SOLTEC V2 · Recepción automática de la ficha del cliente.
// El PDF (o el mensaje) que devuelve el cliente rellena el aviso solo: la app sabe de qué aviso es,
// aplica los datos correctos, guarda el PDF, marca la firma y lo apunta en el historial. Se puede deshacer.
// Llega por: «Compartir › SOLTEC» (móvil), «Abrir con SOLTEC» o arrastrar el PDF (PC), Inicio y la ficha del aviso.

import { h, toast, irORepintar } from '../ui.js';
import { normalizarAviso, direccionCompleta } from '../core/model.js';
import { datosDePdf, leerDatos, lineaDatos } from '../core/fichaCliente.js';
import { avisoDeFicha, planRecepcion, textoEventoRecepcion, textoFirma, deshacerRecepcion } from '../core/recepcionFicha.js';
import { buscar } from '../core/search.js';
import { cargarPdfLib } from './comunicaciones.js';

const CACHE_RECIBIDOS = 'soltec-recibidos';
let resultados = []; // lo último recibido (se enseña en «Ficha recibida»)

/** Lee una entrada: {archivo:{name, bytes}} o {texto}. Devuelve los datos de la ficha o null. */
async function leerEntrada(e) {
  if (e.archivo) {
    try { return await datosDePdf(await cargarPdfLib(), e.archivo.bytes); } catch { return null; }
  }
  return leerDatos(e.texto);
}

/** Aplica una ficha a su aviso (o al indicado) y la guarda. */
async function aplicar(app, r, archivo, avisoId, avisoPorDefecto) {
  const registros = await app.storage.list('aviso');
  const enc = avisoId ? { registro: registros.find((x) => x.id === avisoId), por: 'elegido' }
    : avisoDeFicha(registros, r) || (avisoPorDefecto ? { registro: registros.find((x) => x.id === avisoPorDefecto), por: 'pantalla' } : null);
  if (!enc?.registro) return { estado: 'sinAviso', r, archivo };
  const antes = normalizarAviso(enc.registro.data);
  const ficha = archivo ? await app.storage.putFile({ name: archivo.name || 'FICHA_CLIENTE.pdf', mime: 'application/pdf', bytes: archivo.bytes }) : null;
  const plan = planRecepcion(antes, r, { archivo: ficha });
  const conPdf = !!ficha && !antes.archivos.some((x) => x.hash === ficha.hash);
  const reg = await app.storage.save('aviso', plan.nuevo, { id: enc.registro.id, event: { kind: 'doc_recibida', text: textoEventoRecepcion(plan, r, conPdf) } });
  return { estado: 'aplicado', r, registro: reg, por: enc.por, antes, plan, archivoHash: conPdf ? ficha.hash : null, otroAviso: r.n && avisoId && r.n !== antes.numero ? r.n : '' };
}

/**
 * Recibe una o varias fichas y enseña el resultado en «Ficha recibida».
 * @param {Array<{archivo?:{name,bytes}, texto?:string}>} entradas
 * @param {{avisoId?:string, avisoPorDefecto?:string, soloFichas?:boolean}} o
 *   avisoId: aplicarlas a ese aviso (desde su ficha) · avisoPorDefecto: si no se sabe de cuál es
 *   soloFichas: si ningún PDF es una ficha, no se hace nada (PDF arrastrado que es otra cosa)
 */
export async function recibirFichas(app, entradas, { avisoId, avisoPorDefecto, soloFichas } = {}) {
  const leidas = [];
  for (const e of entradas) leidas.push({ e, r: await leerEntrada(e) });
  if (soloFichas && !leidas.some((x) => x.r)) { toast('Ese PDF no es una ficha del cliente: si es de condiciones, añádelo en «Condiciones y trámite»', true); return []; }
  const out = [];
  for (const { e, r } of leidas) {
    if (!r) { out.push({ estado: 'sinDatos', nombre: e.archivo?.name || 'Mensaje pegado' }); continue; }
    try { out.push(await aplicar(app, r, e.archivo, avisoId, avisoPorDefecto)); } catch (err) { out.push({ estado: 'error', nombre: e.archivo?.name || 'Mensaje', error: err.message }); }
  }
  resultados = out;
  irORepintar('recibir');
  return out;
}

/** Fichas compartidas con la app («Compartir › SOLTEC»): el service worker las deja en un caché. */
async function recogerCompartidas() {
  if (!('caches' in self)) return [];
  try {
    const cache = await caches.open(CACHE_RECIBIDOS);
    const out = [];
    for (const req of await cache.keys()) {
      const res = await cache.match(req);
      await cache.delete(req);
      if (!res) continue;
      if ((res.headers.get('content-type') || '').startsWith('text/')) out.push({ texto: await res.text() });
      else out.push({ archivo: { name: decodeURIComponent(res.headers.get('x-nombre') || 'FICHA.pdf'), bytes: new Uint8Array(await res.arrayBuffer()) } });
    }
    return out;
  } catch { return []; }
}

// ---------------------------------------------------------------- tarjetas
function tarjetaAplicada(app, x) {
  const a = x.plan.nuevo, { aplicados, revisar } = x.plan;
  const caja = h('div', { class: 'card recepcion', id: 'cambios-ficha', 'data-aviso': x.registro.id });
  const pintar = (deshecho = false) => caja.replaceChildren(
    h('div', { class: 'tarjeta-cab' }, h('b', {}, deshecho ? 'Recepción deshecha' : `✓ Aviso ${a.numero || ''} actualizado`), h('span', { class: 'insignia' + (deshecho ? '' : ' ok') }, deshecho ? 'Deshecho' : 'Automático')),
    h('div', {}, h('b', {}, a.cliente?.nombre || ''), ' · ', direccionCompleta(a.suministro) || ''),
    x.otroAviso ? h('div', { class: 'aviso err' }, `Ojo: la ficha era del aviso ${x.otroAviso}.`) : null,
    h('div', { class: 'muted', id: 'estado-firma' }, textoFirma(x.r), x.archivoHash ? ' PDF guardado en el aviso.' : ''),
    aplicados.length ? h('div', {}, h('div', { class: 'muted' }, `${aplicados.length} dato(s) del cliente ${deshecho ? 'devueltos a como estaban' : 'aplicados'}:`),
      h('ul', { class: 'lista-chk' }, ...aplicados.map((c) => h('li', {}, h('span', { class: 'ico' }, deshecho ? '↺' : '✓'),
        h('span', {}, h('b', {}, c.etiqueta), h('div', { class: 'muted' }, c.antes ? `Antes: ${c.antes}` : 'Estaba vacío'), h('div', {}, `Ahora: ${c.ahora}`))))))
      : h('div', { class: 'muted' }, 'Los datos que envía el cliente ya estaban en el aviso.'),
    revisar.length && !deshecho ? h('div', { class: 'aviso err', id: 'revisar-ficha' }, h('b', {}, `${revisar.length} dato(s) sin aplicar: hay que revisarlos`),
      h('ul', {}, ...revisar.map((c) => h('li', {}, `${c.etiqueta}: «${c.ahora}» · ${c.problema}`)))) : null,
    h('div', { class: 'fila' },
      h('a', { class: 'btn prim', href: `#/aviso/${x.registro.id}`, id: 'abrir-aviso-ficha' }, 'Abrir el aviso'),
      deshecho ? null : h('button', { class: 'btn', type: 'button', id: 'deshacer-ficha', onclick: async (e) => {
        e.target.disabled = true;
        const actual = normalizarAviso((await app.storage.get(x.registro.id)).data);
        await app.storage.save('aviso', deshacerRecepcion(actual, x.antes, { aplicados, archivoHash: x.archivoHash }), { id: x.registro.id, event: { kind: 'actualizado', text: 'Deshecha la recepción automática de la ficha del cliente' } });
        toast('Deshecho: el aviso vuelve a como estaba');
        pintar(true);
      } }, 'Deshacer')));
  pintar();
  return caja;
}

function tarjetaSinAviso(app, x) {
  const lista = h('div', { class: 'lista' });
  const cl = x.r.d?.['cliente.nombre'] || '';
  const busca = h('input', { type: 'search', class: 'buscador', id: 'buscar-aviso-ficha', placeholder: 'Busca el aviso: cliente, dirección, número…', value: cl, oninput: (e) => pintar(e.target.value) });
  let avisos = [];
  const pintar = (q) => lista.replaceChildren(...buscar(avisos, q).slice(0, 8).map(({ registro: r }) => h('button', { class: 'tarjeta', type: 'button', 'data-elegir': r.id, onclick: () => recibirFichas(app, [x.archivo ? { archivo: x.archivo } : { texto: lineaDe(x.r) }], { avisoId: r.id }) },
    h('div', { class: 'tarjeta-cab' }, h('span', { class: 'mono' }, r.data.numero || ''), h('span', { class: 'etiqueta' }, r.data.estado || '')),
    h('b', {}, r.data.cliente?.nombre || '(sin nombre)'), h('div', { class: 'muted' }, direccionCompleta(r.data.suministro)))));
  app.storage.list('aviso').then((rs) => { avisos = rs; pintar(busca.value); });
  return h('div', { class: 'card recepcion', id: 'ficha-sin-aviso' },
    h('b', {}, 'Ficha recibida, pero no sé de qué aviso es'),
    h('p', { class: 'muted' }, `${cl ? cl + ' · ' : ''}${x.r.n ? 'Aviso ' + x.r.n + ' (no está en este dispositivo) · ' : ''}Elige el aviso y se rellena solo.`),
    busca, lista);
}
// La ficha pegada se vuelve a leer al elegir aviso: se rehace la línea
const lineaDe = (r) => lineaDatos(r);

export function tarjetasRecepcion(app, rs = resultados) {
  return rs.map((x) => x.estado === 'aplicado' ? tarjetaAplicada(app, x)
    : x.estado === 'sinAviso' ? tarjetaSinAviso(app, x)
      : h('div', { class: 'aviso err recepcion' }, h('b', {}, x.nombre + ': '), x.estado === 'sinDatos'
        ? 'no lleva datos de la ficha. Si el cliente rellenó el PDF sin guardarlo, que lo guarde y lo reenvíe.' : 'no se ha podido leer (' + x.error + ').'));
}

/** Botones para recibir a mano: elegir PDF(s) o pegar el mensaje. */
export function panelRecibir(app, { avisoId } = {}) {
  const fichero = h('input', { type: 'file', accept: 'application/pdf,.pdf', multiple: true, style: 'display:none', id: 'ficha-devuelta', onchange: async (e) => {
    const fs = [...e.target.files]; e.target.value = '';
    if (!fs.length) return;
    await recibirFichas(app, await Promise.all(fs.map(async (f) => ({ archivo: { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } }))), { avisoId });
  } });
  const pegado = h('textarea', { rows: 3, id: 'texto-devuelto', 'data-minusculas': '', placeholder: 'O pega aquí el mensaje del cliente (el que termina en SOLTEC-DATOS:…)' });
  return h('div', { class: 'card', id: 'panel-recibir' },
    h('b', {}, 'Recibir la ficha del cliente'),
    h('p', { class: 'muted' }, `Elige el PDF que te ha devuelto (o pega su mensaje): los datos se ponen solos en ${avisoId ? 'este aviso' : 'su aviso'}, el PDF se guarda y la firma queda marcada. Lo que esté mal escrito no se aplica y te lo enseña. Se puede deshacer.`),
    h('div', { class: 'fila' }, h('button', { class: 'btn prim', type: 'button', id: 'elegir-ficha', onclick: () => fichero.click() }, 'Elegir PDF devuelto'), fichero),
    pegado,
    h('div', { class: 'fila' }, h('button', { class: 'btn', type: 'button', id: 'leer-texto', onclick: () => {
      if (!pegado.value.trim()) { toast('Pega primero el mensaje', true); return; }
      recibirFichas(app, [{ texto: pegado.value }], { avisoId });
    } }, 'Leer el mensaje pegado')),
    avisoId ? null : h('p', { class: 'muted' }, 'Más rápido: en el móvil, toca el PDF en WhatsApp o en el correo › Compartir › SOLTEC V2. En el PC, arrastra el PDF a la app o ábrelo con SOLTEC.'));
}

/** Pantalla «Ficha recibida». */
export async function vistaRecibir(app) {
  const compartidas = await recogerCompartidas();
  if (compartidas.length) { await recibirFichas(app, compartidas); return h('div', {}, h('p', { class: 'muted' }, 'Leyendo la ficha…')); }
  return h('div', {},
    h('div', { class: 'titulo-fila' }, h('h1', {}, 'Ficha del cliente'), h('a', { class: 'btn', href: '#/inicio' }, 'Inicio')),
    h('div', { id: 'resultados-recepcion' }, ...tarjetasRecepcion(app)),
    panelRecibir(app));
}

/** PDF arrastrado a la app o abierto con «Abrir con SOLTEC» (PC). */
export function iniciarRecepcion(app) {
  // Abrir con SOLTEC (la app instalada en el PC se registra para los PDF)
  if ('launchQueue' in window) {
    window.launchQueue.setConsumer(async (p) => {
      const fs = await Promise.all((p.files || []).map(async (fh) => { const f = await fh.getFile(); return { archivo: { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } }; }));
      if (fs.length) recibirFichas(app, fs);
    });
  }
  // Arrastrar el PDF a cualquier sitio de la app (salvo donde ya se puede soltar algo)
  const esPdf = (dt) => [...(dt?.items || [])].some((i) => i.kind === 'file' && (i.type === 'application/pdf' || i.type === ''));
  window.addEventListener('dragover', (e) => { if (!e.defaultPrevented && esPdf(e.dataTransfer)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  window.addEventListener('drop', async (e) => {
    if (e.defaultPrevented) return;
    const fs = [...(e.dataTransfer?.files || [])].filter((f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
    if (!fs.length) return;
    e.preventDefault();
    const m = /^#\/aviso\/([^/?]+)/.exec(location.hash);
    const avisoPorDefecto = m && !['nuevo', 'duplicar'].includes(m[1]) ? m[1] : undefined;
    if (app.guardia?.()) { toast('Guarda antes los cambios del aviso', true); return; }
    recibirFichas(app, await Promise.all(fs.map(async (f) => ({ archivo: { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } }))), { avisoPorDefecto, soloFichas: true });
  });
}
