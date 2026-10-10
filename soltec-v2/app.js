// SOLTEC V2 · Capa 5 · Carcasa de la aplicación: navegación, estado de sincronización,
// ajustes, copias, salida segura y actualización. Un único render por pantalla.

import { Storage } from './core/storage.js';
import { SyncManager, SyncError } from './core/sync.js';
import { exportar, exportarBlob, importar, verificar } from './core/backup.js';
import { isExpediente } from './core/model.js';

export const VERSION = 'V2-0.5.0';

// ---------------------------------------------------------------- utilidades DOM
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v; // solo para iconos SVG propios
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

function toast(msg, err = false) {
  document.querySelector('.toast')?.remove();
  const t = h('div', { class: 'toast' + (err ? ' err' : ''), role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), err ? 6000 : 3000);
}

const hace = (iso) => {
  if (!iso) return 'nunca';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

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
  avisos: { titulo: 'Avisos', vista: vistaAvisos },
  expedientes: { titulo: 'Expedientes', vista: vistaExpedientes },
  agenda: { titulo: 'Agenda', vista: vistaAgenda },
  ajustes: { titulo: 'Ajustes', vista: vistaAjustes },
  salir: { titulo: 'Salir', vista: vistaSalir },
};
const rutaActual = () => (location.hash.replace(/^#\/?/, '').split('/')[0] || 'inicio');

async function render() {
  const ruta = RUTAS[rutaActual()] ? rutaActual() : 'inicio';
  document.title = `SOLTEC · ${RUTAS[ruta].titulo}`;
  for (const a of document.querySelectorAll('nav.inferior a')) {
    if (a.dataset.ruta === ruta) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const main = document.querySelector('main');
  const vista = await RUTAS[ruta].vista();
  if (rutaActual() === ruta || !RUTAS[rutaActual()]) main.replaceChildren(vista);
}

// ---------------------------------------------------------------- estado de sincronización
async function refrescarEstado() {
  const c = await app.storage.pendingCounts();
  const cfg = await app.sync.config();
  app.estado.pendientes = c.records;
  app.estado.archivos = c.files;
  app.estado.ultima = (await app.storage.getMeta('ultimaSync'))?.fin || null;
  app.estado.configurado = !!(cfg.url && cfg.clave);
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

/** Sincronización automática: tras cambios, al recuperar conexión y cada 5 min con la app visible. */
function programarSync(ms) {
  clearTimeout(app.timer);
  app.timer = setTimeout(() => sincronizar({ silencioso: true }), ms);
}

// ---------------------------------------------------------------- vistas
async function vistaInicio() {
  const avisos = await app.storage.list('aviso');
  const citas = await app.storage.list('cita');
  const exp = avisos.filter((r) => isExpediente(r.data)).length;
  const hoy = new Date().toISOString().slice(0, 10);
  const proximas = citas.filter((c) => !c.data.hecho && (c.data.fecha || '') >= hoy).length;
  const [, txt] = textoEstado();
  return h('div', {},
    h('h1', {}, 'Inicio'),
    h('div', { class: 'cifras' },
      h('div', { class: 'cifra' }, h('b', {}, avisos.length - exp), h('span', {}, 'Avisos')),
      h('div', { class: 'cifra' }, h('b', {}, exp), h('span', {}, 'Expedientes')),
      h('div', { class: 'cifra' }, h('b', {}, proximas), h('span', {}, 'Citas próximas'))),
    h('h2', {}, 'Sincronización con el PC'),
    h('div', { class: 'card' },
      h('div', {}, txt),
      app.estado.error ? h('div', { class: 'aviso err' }, app.estado.error) : null,
      h('div', { class: 'fila' },
        h('button', { class: 'btn prim', onclick: async () => { await sincronizar(); render(); } }, 'Sincronizar ahora'),
        h('a', { class: 'btn', href: '#/ajustes', style: 'text-decoration:none;display:inline-flex;align-items:center' }, 'Configurar'))),
    h('div', { class: 'aviso info' }, 'Versión en construcción: las pantallas de avisos, expedientes y agenda llegan en la capa 6. La V1.35 sigue funcionando aparte.'));
}

const enConstruccion = (titulo, texto) => async () => h('div', {}, h('h1', {}, titulo), h('div', { class: 'card muted' }, texto));
async function vistaAvisos() { return enConstruccion('Avisos', 'Esta pantalla llega en la capa 6: listado, ficha compacta con desplegables, datos pendientes y duplicados.')(); }
async function vistaExpedientes() { return enConstruccion('Expedientes', 'Esta pantalla llega en la capa 6: avisos con referencia o PDF de condiciones, con sus versiones.')(); }
async function vistaAgenda() { return enConstruccion('Agenda', 'Esta pantalla llega en la capa 6: citas y seguimientos de los avisos en un mismo calendario.')(); }

async function vistaAjustes() {
  const cfg = await app.sync.config();
  const conflictos = await app.sync.conflictos();
  const ultimaSync = await app.storage.getMeta('ultimaSync');
  const ultimaCopia = await app.storage.getMeta('ultimaCopia');
  const nConf = Object.keys(conflictos).length;
  const msg = h('div');
  const pon = (cls, t) => msg.replaceChildren(h('div', { class: 'aviso ' + cls }, t));

  const fUrl = h('input', { type: 'url', id: 'sync-url', placeholder: 'https://carlos25.tail970b93.ts.net:8443', value: cfg.url, autocomplete: 'off', inputmode: 'url' });
  const fClave = h('input', { type: 'password', id: 'sync-clave', value: cfg.clave, autocomplete: 'off' });
  const fNombre = h('input', { type: 'text', id: 'sync-nombre', placeholder: 'MÓVIL, TABLET, PC CASA…', value: cfg.nombre });
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

    h('details', { class: 'card', open: !cfg.url || null },
      h('summary', {}, 'Sincronización con el PC'),
      h('div', { class: 'cuerpo' },
        h('label', { for: 'sync-url' }, 'Dirección del PC (Tailscale, termina en :8443)'), fUrl,
        h('label', { for: 'sync-clave' }, 'Clave de sincronización'), fClave,
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
      h('div', { class: 'marca' }, h('div', {}, h('b', {}, 'SOLTEC'), h('small', {}, 'AVISOS V2'))),
      h('button', { class: 'estado', onclick: () => sincronizar() })),
    h('main', { id: 'contenido' }),
    nav);
}

export async function iniciar() {
  carcasa();
  try {
    app.storage = await Storage.open();
  } catch (e) {
    document.querySelector('main').replaceChildren(h('div', { class: 'aviso err' }, `No se puede abrir la base de datos: ${e.message}`));
    return;
  }
  app.sync = new SyncManager(app.storage);
  window.soltec = app; // acceso para diagnóstico desde la consola

  app.storage.subscribe((c) => {
    if (c.sync || c.type === '*') return;
    refrescarEstado();
    programarSync(8000);
  });
  window.addEventListener('hashchange', render);
  window.addEventListener('online', () => { app.estado.error = null; programarSync(1000); });
  window.addEventListener('offline', () => { app.estado.error = 'Sin conexión a Internet'; pintarEstado(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && app.estado.pendientes) sincronizar({ silencioso: true });
    if (document.visibilityState === 'visible') { programarSync(1000); buscarActualizacion(false); }
  });
  setInterval(() => { if (document.visibilityState === 'visible') sincronizar({ silencioso: true }); }, 5 * 60 * 1000);

  // Pedir al navegador que no borre los datos (en la PWA instalada suele concederlo sin preguntar)
  navigator.storage?.persist?.().catch(() => {});

  await refrescarEstado();
  await render();
  registrarSW().catch((e) => console.warn('Service worker no registrado:', e));
  if (app.estado.configurado) programarSync(500);
}
