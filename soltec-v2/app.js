// SOLTEC V2 · Capa 5 · Carcasa de la aplicación: navegación, estado de sincronización,
// ajustes, copias, salida segura y actualización. Un único render por pantalla.

import { Storage } from './core/storage.js';
import { SyncManager, SyncError } from './core/sync.js';
import { exportar, exportarBlob, importar, verificar } from './core/backup.js';
import { isExpediente } from './core/model.js';

export const VERSION = 'V2-1.6.1';

import { h, toast, hace, descargar, activarMayusculas } from './ui.js';
import { vistaAvisos, vistaExpedientes, vistaFicha } from './modulos/avisos.js';
import { vistaAgenda, vistaCita, iniciarAlarmas } from './modulos/agenda.js';
import { vistaEmpresa } from './modulos/empresa.js';
import { vistaFirma } from './modulos/comunicaciones.js';
import { vistaPartes, vistaParte } from './modulos/partes.js';
import { vistaImportar, hayV1Local } from './modulos/importar.js';
import { bandeja, buscar, FILTROS_BANDEJA } from './core/search.js';
import { direccionCompleta, hoyLocal, numerosRepetidos, siguienteNumero } from './core/model.js';

const ICONOS = {
  inicio: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  avisos: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
  expedientes: '<path d="M3 6h7l2 2h9v11H3z"/><path d="M3 10h18"/>',
  agenda: '<rect x="3" y="5" width="18" height="16"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  salir: '<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
};
const icono = (n) => h('span', { html: `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[n]}</svg>` });

// ---------------------------------------------------------------- estado
const app = { storage: null, sync: null, estado: { pendientes: 0, archivos: 0, ultima: null, error: null, sincronizando: false }, timer: null };

const RUTAS = {
  inicio: { titulo: 'Inicio', vista: vistaInicio },
  avisos: { titulo: 'Avisos', vista: () => vistaAvisos(app) },
  expedientes: { titulo: 'Expedientes', vista: () => vistaExpedientes(app) },
  aviso: { titulo: 'Aviso', vista: (id) => vistaFicha(app, id), nav: 'avisos' },
  agenda: { titulo: 'Agenda', vista: () => vistaAgenda(app) },
  cita: { titulo: 'Cita', vista: (id) => vistaCita(app, id), nav: 'agenda' },
  empresa: { titulo: 'Empresa', vista: () => vistaEmpresa(app), nav: 'ajustes' },
  firma: { titulo: 'Firma', vista: (id) => vistaFirma(app, id), nav: 'avisos' },
  partes: { titulo: 'Partes', vista: () => vistaPartes(app), nav: 'inicio' },
  importar: { titulo: 'Importar V1.35', vista: () => vistaImportar(app), nav: 'ajustes' },
  parte: { titulo: 'Parte', vista: (id) => vistaParte(app, id), nav: 'inicio' },
  ajustes: { titulo: 'Ajustes', vista: vistaAjustes },
  salir: { titulo: 'Salir', vista: vistaSalir },
};
const partesRuta = () => location.hash.replace(/^#\/?/, '').split('?')[0].split('/');
const rutaActual = () => partesRuta()[0] || 'inicio';

let renderN = 0;
let hashActual = location.hash;
let ignorarHash = false;
/** Cambio de pantalla: si la actual tiene cambios sin guardar, se pregunta antes. */
function alCambiarHash() {
  if (ignorarHash) { ignorarHash = false; return; }
  if (app.guardia?.() && location.hash !== hashActual && !confirm('Hay cambios sin guardar. ¿Salir sin guardar?')) {
    ignorarHash = true;
    location.hash = hashActual; // se vuelve a la pantalla con los cambios
    return;
  }
  render();
}
async function render() {
  app.guardia = null;
  hashActual = location.hash;
  const ruta = RUTAS[rutaActual()] ? rutaActual() : 'inicio';
  const n = ++renderN;
  document.title = `SOLTEC · ${RUTAS[ruta].titulo}`;
  const marcada = RUTAS[ruta].nav || ruta;
  for (const a of document.querySelectorAll('nav.inferior a')) {
    if (a.dataset.ruta === marcada) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const vista = await RUTAS[ruta].vista(partesRuta()[1]);
  if (n !== renderN) return; // el usuario ya ha cambiado de pantalla
  document.querySelector('main').replaceChildren(vista);
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- estado de sincronización
async function refrescarEstado() {
  const c = await app.storage.pendingCounts();
  const cfg = await app.sync.config();
  app.estado.pendientes = c.records;
  app.estado.archivos = c.files;
  app.estado.ultima = (await app.storage.getMeta('ultimaSync'))?.fin || null;
  app.estado.configurado = !!(cfg.url && cfg.clave);
  app.estado.ultimoContacto = (await app.storage.getMeta('ultimoContactoPC')) || app.estado.ultimo;
  pintarEstado();
}

function textoEstado() {
  const e = app.estado;
  if (e.sincronizando) return ['pend', 'Sincronizando…'];
  if (!e.configurado) return ['', 'PC sin configurar'];
  if (e.error) return ['err', 'Sin conexión con el PC'];
  const n = e.pendientes + e.archivos;
  if (n) return ['pend', `${n} cambio${n === 1 ? '' : 's'} sin subir`];
  return ['ok', `Sincronizado ${hace(e.ultima)}`];
}

function pintarEstado() {
  const b = document.querySelector('.estado');
  if (!b) return;
  const [cls, txt] = textoEstado();
  b.replaceChildren(h('span', {}, txt), h('span', { class: 'punto ' + cls }));
  b.title = app.estado.error || txt;
  pintarBanda();
}

/** Registro abierto ahora en pantalla (para avisar si otro dispositivo tiene el mismo). */
function registroAbierto() {
  const [ruta, id] = partesRuta();
  return ['aviso', 'cita', 'parte', 'firma'].includes(ruta) && id && !/^nuev[oa]$/.test(id) ? id : null;
}

const SIN_CONTACTO_MIN = 60;
/** Banda bajo la cabecera: aviso de edición a la vez en otro dispositivo y de cambios que llevan tiempo sin subir. */
function pintarBanda() {
  const banda = document.getElementById('banda-sync');
  if (!banda) return;
  const e = app.estado;
  const partes = [];
  const abierto = registroAbierto();
  const otros = abierto ? (e.otros || []).filter((o) => o.abierto === abierto) : [];
  if (otros.length) {
    partes.push(h('div', { class: 'aviso info aviso-sync', id: 'aviso-otro-dispositivo' },
      h('b', {}, 'Abierto también en ' + otros.map((o) => `«${o.nombre || 'otro dispositivo'}»`).join(' y ') + '. '),
      'Si cambiáis lo mismo en los dos, la app te pedirá elegir qué versión se queda. Mejor termina en uno y sigue en el otro.'));
  }
  const n = (e.pendientes || 0) + (e.archivos || 0);
  const minutos = e.ultimoContacto ? (Date.now() - new Date(e.ultimoContacto).getTime()) / 60000 : Infinity;
  if (e.configurado && n && minutos > SIN_CONTACTO_MIN) {
    partes.push(h('div', { class: 'aviso err aviso-sync', id: 'aviso-sin-subir' },
      h('b', {}, !e.ultimoContacto ? 'Este dispositivo aún no ha conectado con el PC: '
        : minutos < 1440 ? `Llevas ${minutos < 120 ? Math.round(minutos) + ' min' : Math.round(minutos / 60) + ' h'} sin conectar con el PC: `
          : `Sin conectar con el PC desde el ${new Date(e.ultimoContacto).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}: `),
      `${n} cambio${n === 1 ? '' : 's'} solo está${n === 1 ? '' : 'n'} en este dispositivo. No los continúes en otro aparato hasta que se sincronicen. `,
      h('button', { class: 'btn peq', type: 'button', onclick: () => sincronizar() }, 'Sincronizar ahora')));
  }
  banda.replaceChildren(...partes);
}

/** Latido: cada 25 s con la app visible. Si en el PC hay algo nuevo (o aquí hay algo sin subir), sincroniza. */
const LATIDO_MS = 25 * 1000;
async function latido() {
  if (!app.estado.configurado || document.visibilityState !== 'visible' || !navigator.onLine || app.estado.sincronizando) return;
  try {
    const r = await app.sync.latido(registroAbierto());
    app.estado.otros = r.otros;
    app.estado.ultimoContacto = new Date().toISOString();
    if (app.estado.error) app.estado.error = null;
    if (r.hayCambios || app.estado.pendientes || app.estado.archivos) await sincronizar({ silencioso: true });
    else pintarEstado();
  } catch (e) {
    app.estado.error = e.message;
    app.estado.otros = [];
    pintarEstado();
  }
}

async function sincronizar({ silencioso = false } = {}) {
  if (!app.estado.configurado) {
    if (!silencioso) toast('Configura primero el PC en Ajustes › Sincronización', true);
    return null;
  }
  if (!navigator.onLine) {
    app.estado.error = 'Sin conexión a Internet';
    pintarEstado();
    return null;
  }
  app.estado.sincronizando = true;
  pintarEstado();
  try {
    const inf = await app.sync.sincronizar();
    app.estado.error = null;
    if (!silencioso) toast(`Sincronizado: ${inf.subidos} subidos, ${inf.bajados} recibidos${inf.conflictos ? `, ${inf.conflictos} conflicto(s)` : ''}`);
    if (inf.conflictos) toast(`Hay ${inf.conflictos} conflicto(s): revísalos en Ajustes`, true);
    return inf;
  } catch (e) {
    app.estado.error = e.message;
    if (!silencioso || !(e instanceof SyncError)) toast(e.message, true);
    return null;
  } finally {
    app.estado.sincronizando = false;
    await refrescarEstado();
  }
}

/** Sincronización automática: 2 s después de guardar, al recuperar conexión, al volver a la app,
 *  y con el latido (cada 25 s) en cuanto el PC tiene algo nuevo. */
function programarSync(ms) {
  clearTimeout(app.timer);
  app.timer = setTimeout(() => sincronizar({ silencioso: true }), ms);
}

// ---------------------------------------------------------------- vistas
async function vistaInicio() {
  const avisos = await app.storage.list('aviso');
  const citas = await app.storage.list('cita');
  const exp = avisos.filter((r) => isExpediente(r.data)).length;
  const hoy = hoyLocal();
  const proximas = citas.filter((c) => !c.data.hecho && (c.data.fecha || '') >= hoy).length;
  const partesAbiertos = (await app.storage.list('parte')).filter((r) => !r.data.cerrado).length;

  // Buscador único: avisos y expedientes, activos y finalizados (sin papelera)
  const resultados = h('div', { class: 'lista' });
  const busca = h('input', { type: 'search', class: 'buscador', id: 'buscador-unico', placeholder: 'Buscar cliente, teléfono, dirección, CUPS, referencia o nº de aviso', oninput: (e) => {
    const q = e.target.value;
    const rs = q.trim() ? buscar(avisos, q).slice(0, 20) : [];
    resultados.replaceChildren(...(q.trim() && !rs.length ? [h('div', { class: 'card muted' }, 'Sin resultados.')] : rs.map(({ registro: r, expediente }) =>
      h('a', { class: 'tarjeta', href: `#/aviso/${r.id}` },
        h('div', { class: 'tarjeta-cab' }, h('span', { class: 'mono' }, r.data.numero), expediente ? h('span', { class: 'insignia ok' }, 'Expediente') : h('span', { class: 'etiqueta' }, 'Aviso')),
        h('b', {}, r.data.cliente?.nombre || '(sin nombre)'), h('div', { class: 'muted' }, direccionCompleta(r.data.suministro))))));
  } });

  // Bandeja «Qué toca hoy»
  const filtro = sessionStorageGet('bandeja') || 'todo';
  const items = bandeja(avisos, citas, filtro);
  const chips = h('div', { class: 'chips' }, ...FILTROS_BANDEJA.map((f) => h('button', { class: 'chip' + (f.id === filtro ? ' activo' : ''), type: 'button', onclick: () => { sessionStorageSet('bandeja', f.id); render(); } }, f.label)));
  const tarjetas = items.length ? items.map((i) => h('div', { class: 'tarjeta' },
    h('div', { class: 'tarjeta-cab' }, h('span', { class: 'mono' }, i.numero + (i.refCondiciones ? ' · ' + i.refCondiciones : '')), i.tramite ? h('span', { class: 'etiqueta' }, i.tramite) : null),
    h('b', {}, i.cliente), h('div', { class: 'muted' }, i.direccion || 'Sin dirección'),
    i.seguimiento ? h('div', { class: 'seg' + (i.vencido ? ' vencido' : '') }, `${i.vencido ? 'Vencido' : i.hoy ? 'Hoy' : 'Próximo'}: ${i.seguimiento.texto || 'Seguimiento'} · ${i.seguimiento.fecha}${i.seguimiento.hora ? ' ' + i.seguimiento.hora : ''}${i.seguimiento.responsable ? ' · ' + i.seguimiento.responsable : ''}`) : null,
    i.faltan.length ? h('div', { class: 'faltan' }, 'Faltan: ' + i.faltan.map((f) => f.etiqueta).join(', ')) : null,
    i.docs.length ? h('div', { class: 'faltan' }, 'Documentación pendiente: ' + i.docs.join(', ')) : null,
    i.firma ? h('div', { class: 'faltan' }, 'Firma del cliente por recibir') : null,
    h('div', { class: 'fila' },
      i.faltan.length ? h('a', { class: 'btn peq prim', href: `#/aviso/${i.registro.id}?campo=${i.faltan[0].campo}` }, 'Completar datos') : null,
      h('a', { class: 'btn peq', href: `#/aviso/${i.registro.id}` }, 'Abrir'))))
    : [h('div', { class: 'card muted' }, avisos.length ? 'Nada pendiente con este filtro.' : 'Todavía no hay avisos. Crea el primero desde Avisos.')];

  // Números repetidos: dos dispositivos crearon avisos sin conexión a la vez
  const repetidos = numerosRepetidos(avisos);
  const avisoRepetidos = repetidos.length ? h('div', { class: 'aviso err' },
    h('b', {}, 'Números de aviso repetidos: '), repetidos.map((g) => `${g.numero} (${g.registros.length})`).join(', '),
    h('div', { class: 'muted' }, 'Pasa si se crean avisos en dos dispositivos sin conexión. Se conserva el más antiguo y los demás reciben un número nuevo; queda anotado en su historial.'),
    h('div', { class: 'fila' }, h('button', { class: 'btn peq prim', onclick: async () => {
      for (const g of repetidos) {
        for (const r of g.registros.slice(1)) {
          const nuevo = siguienteNumero(await app.storage.list('aviso', { includeDeleted: true }));
          await app.storage.patch(r.id, { numero: nuevo }, { event: { kind: 'nota', text: `Número cambiado de ${g.numero} a ${nuevo} por estar repetido` } });
        }
      }
      toast('Avisos renumerados');
      render();
    } }, 'Renumerar'))) : null;

  const [, txt] = textoEstado();
  // Cabecera del día: lo primero que se ve es qué hay que hacer hoy
  const ahora = new Date();
  const diaSemana = ahora.toLocaleDateString('es-ES', { weekday: 'long' });
  const pendientesHoy = bandeja(avisos, citas, 'todo').length;
  const segHoy = bandeja(avisos, citas, 'hoy').length;
  const vencidos = bandeja(avisos, citas, 'vencidos').length;
  const resumen = pendientesHoy
    ? [h('b', {}, pendientesHoy), pendientesHoy === 1 ? ' aviso necesita atención' : ' avisos necesitan atención',
      segHoy ? [', ', h('b', {}, segHoy), segHoy === 1 ? ' seguimiento hoy' : ' seguimientos hoy'] : null,
      vencidos ? [' y ', h('b', { style: 'color:var(--rojo-oscuro)' }, vencidos), vencidos === 1 ? ' vencido' : ' vencidos'] : null, '.']
    : [avisos.length ? 'Nada pendiente por ahora.' : 'Empieza creando tu primer aviso.'];
  return h('div', {},
    h('section', { class: 'hoy' },
      h('p', { class: 'hoy-dia' }, diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)),
      h('h1', {}, ahora.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })),
      h('p', { class: 'hoy-resumen' }, ...resumen)),
    !avisos.length && hayV1Local() ? h('a', { class: 'card enlace-card', href: '#/importar' }, h('b', {}, 'Hay datos de la V1.35 en este navegador'), h('span', { class: 'muted' }, 'Tráelos a la V2 sin tocar la V1.35 ›')) : null,
    busca, resultados,
    avisoRepetidos,
    h('div', { class: 'cifras' },
      h('a', { class: 'cifra', href: '#/avisos' }, h('b', {}, avisos.length - exp), h('span', {}, 'Avisos')),
      h('a', { class: 'cifra', href: '#/expedientes' }, h('b', {}, exp), h('span', {}, 'Expedientes')),
      h('a', { class: 'cifra', href: '#/agenda' }, h('b', {}, proximas), h('span', {}, 'Citas próximas'))),
    h('div', { class: 'accesos' },
      h('a', { class: 'btn', href: '#/partes', id: 'acceso-partes' }, `Partes de trabajo${partesAbiertos ? ` (${partesAbiertos} abiertos)` : ''}`),
      h('a', { class: 'btn', href: '#/aviso/nuevo' }, '+ Nuevo aviso'),
      h('a', { class: 'btn', href: '#/empresa' }, 'Empresa')),
    h('h2', {}, 'Qué toca hoy'), chips, h('div', { class: 'lista' }, ...tarjetas),
    h('h2', {}, 'Sincronización con el PC'),
    h('div', { class: 'card' },
      h('div', {}, txt),
      app.estado.error ? h('div', { class: 'aviso err' }, app.estado.error) : null,
      h('div', { class: 'fila' },
        h('button', { class: 'btn prim', onclick: async () => { await sincronizar(); render(); } }, 'Sincronizar ahora'),
        h('a', { class: 'btn', href: '#/ajustes' }, 'Configurar'))));
}

function sessionStorageGet(k) { try { return sessionStorage.getItem('soltec_' + k); } catch { return null; } }
function sessionStorageSet(k, v) { try { sessionStorage.setItem('soltec_' + k, v); } catch { /* sin almacenamiento de sesión */ } }


async function vistaAjustes() {
  const cfg = await app.sync.config();
  const conflictos = await app.sync.conflictos();
  const ultimaSync = await app.storage.getMeta('ultimaSync');
  const ultimaCopia = await app.storage.getMeta('ultimaCopia');
  const nConf = Object.keys(conflictos).length;
  const msg = h('div');
  const pon = (cls, t) => msg.replaceChildren(h('div', { class: 'aviso ' + cls }, t));

  // Abierta desde el propio PC (prueba local): la dirección del servidor es la de este equipo.
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const urlInicial = cfg.url || (local ? 'http://127.0.0.1:8766' : '');
  const fUrl = h('input', { type: 'url', id: 'sync-url', placeholder: 'Ejemplo: https://carlos25.tail970b93.ts.net:8443', value: urlInicial, autocomplete: 'off', inputmode: 'url' });
  const fClave = h('input', { type: 'password', id: 'sync-clave', value: cfg.clave, autocomplete: 'off' });
  const fNombre = h('input', { type: 'text', id: 'sync-nombre', placeholder: 'Ejemplo: MÓVIL, TABLET, PC CASA', value: cfg.nombre });
  const guardar = async () => { await app.sync.guardarConfig({ url: fUrl.value, clave: fClave.value, nombre: fNombre.value }); await refrescarEstado(); };

  const persistente = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
  const uso = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
  const mb = (b) => (b / 1048576).toFixed(1).replace('.', ',') + ' MB';

  const fichero = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const copia = JSON.parse(await f.text());
      const v = await verificar(copia);
      if (!confirm(`Copia del ${new Date(v.creada).toLocaleString('es-ES')}\n${v.registros} registros y ${v.archivos} archivos.\n\nSe añadirá a lo que hay. No se borra nada. ¿Continuar?`)) return;
      const inf = await importar(app.storage, copia);
      toast(`Importado: ${inf.nuevos} nuevos, ${inf.actualizados} actualizados${inf.conflictos.length ? `, ${inf.conflictos.length} conservados por tener cambios sin subir` : ''}`);
      await refrescarEstado();
      render();
    } catch (e) { toast(e.message, true); }
  } });

  return h('div', {},
    h('h1', {}, 'Ajustes'),
    nConf ? h('div', { class: 'aviso err' }, `${nConf} conflicto(s) de sincronización por revisar`) : null,
    h('a', { class: 'card enlace-card', href: '#/empresa' }, h('b', {}, 'Empresa'), h('span', { class: 'muted' }, 'Nombre, logo, técnico, solicitante y correos ›')),
    h('a', { class: 'card enlace-card', href: '#/importar', id: 'enlace-importar' }, h('b', {}, 'Traer datos de la V1.35'), h('span', { class: 'muted' }, 'Avisos, expedientes, PDF, fotos, planos, agenda y partes. Repítelo para traer los cambios ›')),

    h('details', { class: 'card', open: !cfg.url || null },
      h('summary', {}, 'Sincronización con el PC'),
      h('div', { class: 'cuerpo' },
        h('label', { for: 'sync-url' }, local ? 'Dirección del servidor (en este PC)' : 'Dirección del PC (Tailscale, termina en :8443)'), fUrl,
        h('label', { for: 'sync-clave' }, 'Clave de sincronización (la muestra la ventana del servidor en el PC)'), fClave,
        h('label', { for: 'sync-nombre' }, 'Nombre de este dispositivo'), fNombre,
        h('div', { class: 'fila' },
          h('button', { class: 'btn', onclick: async () => {
            try { await guardar(); const r = await app.sync.probar(); pon('ok', `PC conectado (${r.version}): ${r.registros} registros y ${r.archivos} archivos.`); }
            catch (e) { pon('err', e.message); }
          } }, 'Probar conexión'),
          h('button', { class: 'btn prim', onclick: async () => {
            try { await guardar(); pon('ok', 'Guardado.'); await sincronizar(); } catch (e) { pon('err', e.message); }
          } }, 'Guardar y sincronizar')),
        msg,
        h('p', { class: 'muted' }, ultimaSync ? `Última: ${hace(ultimaSync.fin)} · ${ultimaSync.subidos} subidos, ${ultimaSync.bajados} recibidos, ${ultimaSync.archivosSubidos + ultimaSync.archivosBajados} archivos` : 'Todavía no se ha sincronizado.'))),

    nConf ? h('details', { class: 'card', open: true },
      h('summary', {}, `Conflictos (${nConf})`),
      h('div', { class: 'cuerpo' },
        h('p', { class: 'muted' }, 'El mismo registro cambió aquí y en otro dispositivo. Ahora se ve la versión del PC; la de este dispositivo está guardada. Elige cuál se queda.'),
        nConf > 1 ? h('div', { class: 'fila', id: 'conflictos-todos' },
          h('button', { class: 'btn', type: 'button', onclick: async () => { if (!confirm(`¿Quedarte con la versión del PC en los ${nConf}?`)) return; await app.sync.resolverTodos('servidor'); toast('Conflictos resueltos con lo del PC'); render(); } }, `Todos: la del PC (${nConf})`),
          h('button', { class: 'btn', type: 'button', onclick: async () => { if (!confirm(`¿Quedarte con la versión de este dispositivo en los ${nConf}?`)) return; await app.sync.resolverTodos('local'); await refrescarEstado(); programarSync(500); toast('Conflictos resueltos con lo de este dispositivo'); render(); } }, `Todos: la de aquí (${nConf})`)) : null,
        ...Object.entries(conflictos).map(([id, c]) => h('div', { class: 'card' },
          h('b', {}, c.local.data?.numero || c.local.data?.titulo || c.local.type), h('div', { class: 'muted mono' }, id),
          h('div', { class: 'muted' }, `Este dispositivo: ${hace(c.local.updatedAt)} · PC: ${hace(c.servidor.updatedAt)}`),
          h('div', { class: 'fila' },
            h('button', { class: 'btn', onclick: async () => { await app.sync.resolverConflicto(id, 'servidor'); render(); } }, 'Quedarme la del PC'),
            h('button', { class: 'btn prim', onclick: async () => { await app.sync.resolverConflicto(id, 'local'); await refrescarEstado(); programarSync(500); render(); } }, 'Quedarme la de aquí')))))) : null,

    h('details', { class: 'card' },
      h('summary', {}, 'Copias de seguridad'),
      h('div', { class: 'cuerpo' },
        h('p', { class: 'muted' }, ultimaCopia ? `Última copia: ${hace(ultimaCopia.creada)} (${ultimaCopia.registros} registros, ${ultimaCopia.archivos} archivos)` : 'Todavía no se ha hecho ninguna copia en este dispositivo.'),
        h('div', { class: 'fila' },
          h('button', { class: 'btn prim', onclick: async () => {
            const { blob, nombre, totales } = await exportarBlob(app.storage);
            descargar(blob, nombre);
            toast(`Copia descargada: ${totales.registros} registros, ${totales.archivos} archivos`);
          } }, 'Descargar copia'),
          h('button', { class: 'btn', onclick: async () => {
            try { const r = await app.sync.enviarCopia(await exportar(app.storage)); toast(`Copia guardada en el PC: ${r.archivo}`); }
            catch (e) { toast(e.message, true); }
          } }, 'Enviar copia al PC'),
          h('button', { class: 'btn', onclick: () => fichero.click() }, 'Importar copia'), fichero))),

    h('details', { class: 'card' },
      h('summary', {}, 'Almacenamiento del dispositivo'),
      h('div', { class: 'cuerpo' },
        h('p', {}, persistente ? 'Protegido: el navegador no borrará los datos por falta de espacio.' : 'Sin protección: el navegador podría borrar datos si se queda sin espacio.'),
        uso ? h('p', { class: 'muted' }, `En uso: ${mb(uso.usage || 0)} de ${mb(uso.quota || 0)} disponibles`) : null,
        persistente ? null : h('button', { class: 'btn', onclick: async () => {
          const ok = await navigator.storage?.persist?.();
          toast(ok ? 'Datos protegidos' : 'El navegador no lo ha permitido. Instala la app en la pantalla de inicio y vuelve a intentarlo.', !ok);
          render();
        } }, 'Proteger datos'))),

    h('details', { class: 'card' },
      h('summary', {}, 'Acerca de'),
      h('div', { class: 'cuerpo' },
        h('p', {}, `SOLTEC ${VERSION}`),
        h('p', { class: 'muted mono' }, `Dispositivo ${app.storage.deviceId}`),
        h('button', { class: 'btn', onclick: () => buscarActualizacion(true) }, 'Buscar actualización'))));
}

/** Salida segura: sube lo pendiente, ofrece copia si hace falta y confirma que se puede cerrar. */
async function vistaSalir() {
  const lista = h('ul', { class: 'lista-chk' });
  const final = h('div');
  const paso = (ico, texto, cls = '') => { lista.append(h('li', {}, h('span', { class: 'ico ' + cls }, ico), h('span', {}, texto))); };
  const cont = h('div', {}, h('h1', {}, 'Salida segura'), h('div', { class: 'card' }, lista), final);

  (async () => {
    paso('✓', 'Todos los cambios están guardados en este dispositivo.');
    await refrescarEstado();
    let todoArriba = app.estado.pendientes + app.estado.archivos === 0;
    if (app.estado.configurado && !todoArriba) {
      paso('…', 'Subiendo cambios al PC…');
      const inf = await sincronizar({ silencioso: true });
      lista.lastChild.remove();
      await refrescarEstado();
      todoArriba = app.estado.pendientes + app.estado.archivos === 0;
      if (inf && todoArriba) paso('✓', `Cambios subidos al PC (${inf.subidos}).`);
      else paso('!', `No se pudo subir todo al PC: ${app.estado.error || 'quedan cambios pendientes'}. Se subirán la próxima vez.`);
    } else if (app.estado.configurado) paso('✓', 'No hay nada pendiente de subir al PC.');
    else paso('!', 'El PC no está configurado: los datos solo están en este dispositivo.');

    const ultimaCopia = await app.storage.getMeta('ultimaCopia');
    const vieja = !ultimaCopia || Date.now() - new Date(ultimaCopia.creada).getTime() > 24 * 3600 * 1000;
    if (vieja && (!app.estado.configurado || !todoArriba)) {
      paso('!', 'Hace más de un día que no se descarga una copia en este dispositivo.');
      final.append(h('button', { class: 'btn ancho', onclick: async () => {
        const { blob, nombre } = await exportarBlob(app.storage); descargar(blob, nombre); toast('Copia descargada');
      } }, 'Descargar copia antes de salir'));
    }
    final.append(h('div', { class: 'aviso ok' }, 'Ya puedes cerrar la aplicación.'),
      h('div', { class: 'fila' }, h('a', { class: 'btn', href: '#/inicio', style: 'text-decoration:none' }, 'Seguir trabajando')));
  })();
  return cont;
}

// ---------------------------------------------------------------- actualización (service worker)
let swEsperando = null;
let actualizando = false; // solo se recarga cuando el usuario pulsa «Actualizar»
function mostrarBandaActualizacion() {
  if (document.querySelector('.banda')) return;
  document.body.append(h('div', { class: 'banda', role: 'alert' },
    h('span', {}, 'Hay una versión nueva de SOLTEC.'),
    h('button', { class: 'btn', onclick: () => { actualizando = true; swEsperando?.postMessage({ tipo: 'ACTIVAR' }); } }, 'Actualizar')));
}

async function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.register('./sw.js');
  const vigilar = (w) => w && w.addEventListener('statechange', () => {
    if (w.state === 'installed' && navigator.serviceWorker.controller) { swEsperando = w; mostrarBandaActualizacion(); }
  });
  if (reg.waiting && navigator.serviceWorker.controller) { swEsperando = reg.waiting; mostrarBandaActualizacion(); }
  vigilar(reg.installing);
  reg.addEventListener('updatefound', () => vigilar(reg.installing));
  // La primera instalación también cambia de controlador: ahí no se recarga.
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (actualizando) { actualizando = false; location.reload(); } });
  app.reg = reg;
}

async function buscarActualizacion(avisar) {
  if (avisar && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    // Copia del PC: sus archivos salen de la carpeta descomprimida, no de internet
    toast(`Esta es la copia del PC (${VERSION}). Para actualizarla, descarga el paquete nuevo, descomprímelo y ejecuta INSTALAR_SOLTEC_V2.bat: tus datos se conservan.`);
    return;
  }
  try {
    await app.reg?.update();
    if (avisar && !swEsperando) toast('Tienes la última versión');
  } catch { if (avisar) toast('No se pudo comprobar ahora', true); }
}

// ---------------------------------------------------------------- arranque
function carcasa() {
  const nav = h('nav', { class: 'inferior', 'aria-label': 'Navegación principal' },
    ...['inicio', 'avisos', 'expedientes', 'agenda', 'ajustes'].map((r) =>
      h('a', { href: '#/' + r, 'data-ruta': r }, icono(r), h('span', {}, RUTAS[r].titulo))),
    h('a', { href: '#/salir', 'data-ruta': 'salir', class: 'salir' }, icono('salir'), h('span', {}, 'Salir')));
  document.body.replaceChildren(
    h('header', { class: 'top' },
      h('div', { class: 'marca' }, h('div', {}, h('b', {}, 'SOLTEC'), h('small', {}, 'Avisos y expedientes'))),
      h('button', { class: 'estado', onclick: () => sincronizar() })),
    h('div', { id: 'banda-sync', 'aria-live': 'polite' }),
    h('main', { id: 'contenido' }),
    nav);
}

export async function iniciar() {
  carcasa();
  activarMayusculas();
  try {
    app.storage = await Storage.open();
  } catch (e) {
    document.querySelector('main').replaceChildren(h('div', { class: 'aviso err' }, `No se puede abrir la base de datos: ${e.message}`));
    return;
  }
  app.sync = new SyncManager(app.storage);
  window.soltec = app; // acceso para diagnóstico desde la consola

  app.storage.subscribe((c) => {
    if (c.sync && (c.sync.bajados || c.sync.conflictos) && ['inicio', 'avisos', 'expedientes', 'agenda'].includes(rutaActual())) render();
    if (c.sync || c.type === '*') return;
    refrescarEstado();
    programarSync(2000);
  });
  window.addEventListener('hashchange', alCambiarHash);
  window.addEventListener('beforeunload', (e) => { if (app.guardia?.()) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('online', () => { app.estado.error = null; programarSync(1000); });
  window.addEventListener('offline', () => { app.estado.error = 'Sin conexión a Internet'; pintarEstado(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && app.estado.pendientes) sincronizar({ silencioso: true });
    if (document.visibilityState === 'visible') { programarSync(1000); buscarActualizacion(false); }
  });
  setInterval(latido, LATIDO_MS);
  // Por si el latido falla en silencio: sincronización completa cada 5 min con la app visible.
  setInterval(() => { if (document.visibilityState === 'visible') sincronizar({ silencioso: true }); }, 5 * 60 * 1000);
  // Al cambiar de pantalla se avisa al momento de qué registro está abierto
  window.addEventListener('hashchange', () => setTimeout(latido, 300));

  // Pedir al navegador que no borre los datos (en la PWA instalada suele concederlo sin preguntar)
  navigator.storage?.persist?.().catch(() => {});

  await refrescarEstado();
  await render();
  app.revisarAlarmas = iniciarAlarmas(app);
  registrarSW().catch((e) => console.warn('Service worker no registrado:', e));
  if (app.estado.configurado) programarSync(500);
}
