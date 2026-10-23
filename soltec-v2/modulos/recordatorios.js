// SOLTEC V2 · Recordatorios automáticos en pantalla (Inicio y ficha del aviso) y sus plazos en Ajustes.

import { h, toast, confirmar } from '../ui.js';
import { recordatorios, plazosDe, PLAZOS_RECORDATORIO, TIPOS_RECORDATORIO, pendientesDeAvisar, contenidoNotificacion, HORARIO_AVISOS } from '../core/recordatorios.js';
import { direccionCompleta } from '../core/model.js';
import { ID_EMPRESA, normalizarEmpresa, empresaVacia } from '../core/empresa.js';

const leerEmpresaRaw = async (app) => { const r = await app.storage.get(ID_EMPRESA); return r ? normalizarEmpresa(r.data) : empresaVacia(); };

/** Recordatorios de todos los avisos (o solo de uno). */
export async function calcularRecordatorios(app, { avisos, avisoId } = {}) {
  const [lista, empresa] = await Promise.all([avisos ? Promise.resolve(avisos) : app.storage.list('aviso'), leerEmpresaRaw(app)]);
  const solo = avisoId ? lista.filter((r) => r.id === avisoId) : lista;
  // Solo el historial de los avisos abiertos (los finalizados o cerrados no dan recordatorios): con años de
  // trabajo es una fracción del historial completo y Inicio abre mucho antes
  const abiertos = solo.filter((r) => !r.deleted && r.data?.tramite !== 'finalizado' && r.data?.estado !== 'Cerrado');
  const eventos = avisoId ? await app.storage.listByRef(avisoId, 'evento')
    : abiertos.length <= 300 ? await app.storage.listByRefs(abiertos.map((r) => r.id), 'evento') // lo normal: pocos abiertos
      : await app.storage.list('evento'); // muchísimos abiertos: una sola lectura de todo es más rápida
  return recordatorios(solo, eventos, new Date(), plazosDe(empresa));
}

/**
 * Tarjetas de recordatorios con «Abrir», «Reclamado hoy» y «Ya está».
 * @param {boolean} enFicha  dentro de la ficha del aviso (sin «Abrir» ni cliente)
 */
export function tarjetasRecordatorios(app, items, { enFicha = false, alCambiar } = {}) {
  const tipoTxt = (t) => ({ condiciones: 'condiciones', autorizacion: 'autorización', documentacion: 'documentación' }[t]);
  return items.map((i) => {
    const marcar = async (kind, texto, ok) => {
      await app.storage.addEvent(i.registro.id, kind, texto, { tipo: i.tipo });
      toast(ok);
      alCambiar?.();
    };
    return h('div', { class: enFicha ? 'aviso info recordatorio' : 'tarjeta recordatorio', 'data-tipo': i.tipo },
      enFicha ? null : h('div', { class: 'tarjeta-cab' }, h('span', { class: 'mono' }, i.numero), h('span', { class: 'etiqueta' }, 'Recordatorio')),
      h('b', { class: 'recordatorio-texto' }, i.texto + (i.reclamado ? ' (desde la última reclamación)' : '')),
      enFicha ? null : h('div', {}, i.cliente),
      enFicha ? null : h('div', { class: 'muted' }, direccionCompleta(i.registro.data?.suministro) || 'Sin dirección'),
      h('div', { class: 'fila' },
        enFicha ? null : h('a', { class: 'btn peq prim', href: `#/aviso/${i.registro.id}` }, 'Abrir'),
        h('button', { class: 'btn peq', type: 'button', 'data-accion': 'reclamado', onclick: () => marcar('reclamado', `Reclamada la ${tipoTxt(i.tipo)} (recordatorio)`, 'Anotado: se vuelve a contar desde hoy') }, 'Reclamado hoy'),
        h('button', { class: 'btn peq', type: 'button', 'data-accion': 'resuelto', onclick: async () => {
          if (!(await confirmar(`¿Quitar este recordatorio?\n\n${i.texto}.\n\nSolo vuelve a salir si se pide o se envía otra vez.`, { si: 'Quitar recordatorio' }))) return;
          marcar('recordatorio_resuelto', `Recordatorio quitado: ${i.texto}`, 'Recordatorio quitado');
        } }, 'Ya está')));
  });
}

/** Bloque de Ajustes: días de cada recordatorio (se guardan con la empresa y se sincronizan). */
export function bloquePlazos(app) {
  const caja = h('div', { id: 'bloque-recordatorios' });
  (async () => {
    const empresa = await leerEmpresaRaw(app);
    const p = plazosDe(empresa);
    const inputs = {};
    caja.replaceChildren(
      h('p', { class: 'muted' }, 'Avisos en Inicio y en la ficha cuando algo lleva días sin respuesta. Pon 0 para no avisar.'),
      ...TIPOS_RECORDATORIO.map((t) => h('div', { class: 'campo' },
        h('label', { for: 'plazo-' + t.id }, `${t.label} (días)`),
        inputs[t.id] = h('input', { id: 'plazo-' + t.id, type: 'number', min: '0', max: '365', inputmode: 'numeric', value: String(p[t.id]) }))),
      h('div', { class: 'fila' },
        h('button', { class: 'btn prim', type: 'button', id: 'plazos-guardar', onclick: async () => {
          const r = await app.storage.get(ID_EMPRESA);
          const d = r ? normalizarEmpresa(r.data) : empresaVacia();
          d.recordatorios = Object.fromEntries(Object.keys(PLAZOS_RECORDATORIO).map((k) => [k, Math.max(0, Math.min(365, Math.round(Number(inputs[k].value) || 0)))]));
          await app.storage.save('config', d, { id: ID_EMPRESA });
          toast('Plazos guardados');
        } }, 'Guardar plazos'),
        h('button', { class: 'btn', type: 'button', onclick: () => { for (const [k, v] of Object.entries(PLAZOS_RECORDATORIO)) inputs[k].value = String(v); } }, 'Volver a los de siempre')));
  })();
  return caja;
}

// ---------------------------------------------------------------- notificaciones
const PERIODICO = 'soltec-recordatorios';
const hayNotificaciones = () => typeof window !== 'undefined' && 'Notification' in window;

/** ¿Están activadas en este dispositivo? (por defecto sí, si el navegador las permite) */
async function activas(app) { const c = await app.storage.getMeta('notifRecordatorios'); return !(c && c.activo === false); }

async function mostrar(app, n) {
  const opciones = { body: n.cuerpo, tag: n.tag, renotify: true, icon: './icon-192.png', badge: './icon-192.png', data: { url: n.url } };
  try {
    const reg = app.reg || (await navigator.serviceWorker?.getRegistration?.());
    if (reg?.showNotification) { await reg.showNotification(n.titulo, opciones); return true; }
    const x = new Notification(n.titulo, opciones);
    x.onclick = () => { window.focus(); location.hash = n.url; x.close(); };
    return true;
  } catch { return false; }
}

/** Pide al navegador que despierte la app de vez en cuando para avisar aunque esté cerrada (Chrome con la app instalada). */
async function registrarPeriodico(app) {
  try {
    const reg = app.reg || (await navigator.serviceWorker?.ready);
    if (!reg?.periodicSync) return 'no';
    const st = await navigator.permissions?.query?.({ name: 'periodic-background-sync' }).catch(() => null);
    if (st && st.state !== 'granted') return 'denegado';
    await reg.periodicSync.register(PERIODICO, { minInterval: 6 * 3600 * 1000 });
    return 'si';
  } catch { return 'no'; }
}

/**
 * Revisa los recordatorios y notifica los que no se han notificado hoy (una notificación aunque haya varios).
 * Solo de 8:00 a 21:00. Devuelve cuántos ha notificado.
 */
export async function revisarNotificaciones(app, ahora = new Date()) {
  if (!hayNotificaciones() || Notification.permission !== 'granted' || !(await activas(app))) return 0;
  const lista = await calcularRecordatorios(app);
  const p = pendientesDeAvisar(lista, (await app.storage.getMeta('recordatoriosAvisados')) || {}, ahora);
  await app.storage.setMeta('recordatoriosAvisados', p.avisados);
  if (!p.nuevos.length) return 0;
  await mostrar(app, contenidoNotificacion(p.nuevos));
  return p.nuevos.length;
}

/** Al arrancar: revisa a los pocos segundos, cada 30 minutos y al volver a la app. */
export function iniciarAvisosRecordatorios(app) {
  const revisar = () => revisarNotificaciones(app).catch(() => 0);
  setTimeout(revisar, 8000);
  setInterval(revisar, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revisar(); });
  // Tocar la notificación con la app abierta: el service worker pide ir a la pantalla del aviso
  navigator.serviceWorker?.addEventListener?.('message', (e) => { if (e.data?.tipo === 'soltec-ir' && e.data.hash) location.hash = e.data.hash; });
  setTimeout(async () => { if (hayNotificaciones() && Notification.permission === 'granted' && (await activas(app))) registrarPeriodico(app); }, 10000);
  return revisar;
}

/** Pide permiso (hace falta pulsar un botón) y activa las notificaciones en este dispositivo. */
export async function activarNotificaciones(app) {
  if (!hayNotificaciones()) return false;
  const r = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (r !== 'granted') { toast('El navegador no ha dado permiso', true); return false; }
  await app.storage.setMeta('notifRecordatorios', { activo: true });
  await registrarPeriodico(app);
  toast('Notificaciones activadas');
  revisarNotificaciones(app);
  return true;
}
/** ¿Tiene sentido ofrecer «Avisarme con notificación»? (el navegador las permite y aún no se han pedido) */
export const ofrecerNotificaciones = () => hayNotificaciones() && Notification.permission === 'default';

/** Bloque de Ajustes: activar, desactivar y probar las notificaciones en este dispositivo. */
export function bloqueNotificaciones(app) {
  const caja = h('div', { id: 'bloque-notificaciones' });
  const pintar = async () => {
    const soporta = hayNotificaciones(), perm = soporta ? Notification.permission : 'no', on = await activas(app);
    const fondo = !!(app.reg || {}).periodicSync || ('serviceWorker' in navigator && 'PeriodicSyncManager' in window);
    const estado = !soporta ? 'Este navegador no permite notificaciones. Los recordatorios se ven al abrir la app (Inicio y ficha del aviso).'
      : perm === 'denied' ? 'Notificaciones bloqueadas para SOLTEC. Actívalas en los ajustes del navegador (icono del candado › Notificaciones) y vuelve aquí.'
        : perm !== 'granted' ? 'Notificaciones sin activar en este dispositivo.'
          : on ? `Activadas en este dispositivo: un aviso al día por recordatorio, de ${HORARIO_AVISOS.desde}:00 a ${HORARIO_AVISOS.hasta}:00.` : 'Desactivadas en este dispositivo.';
    caja.replaceChildren(
      h('h3', {}, 'Notificaciones'),
      h('p', { id: 'notif-estado', class: perm === 'denied' ? 'aviso err' : 'muted' }, estado),
      soporta && perm === 'granted' && on ? h('p', { class: 'muted', id: 'notif-fondo' }, fondo
        ? 'Con la app cerrada también avisa, cuando el sistema lo permite (Chrome con la app instalada; puede tardar unas horas).'
        : 'Con la app cerrada este navegador no avisa: llega al abrirla o mientras está abierta (también minimizada).') : null,
      h('div', { class: 'fila' },
        soporta && perm !== 'denied' && !(perm === 'granted' && on) ? h('button', { class: 'btn prim', type: 'button', id: 'notif-activar', onclick: async () => { await activarNotificaciones(app); pintar(); } }, 'Activar notificaciones') : null,
        soporta && perm === 'granted' && on ? h('button', { class: 'btn', type: 'button', id: 'notif-probar', onclick: async () => {
          const ok = await mostrar(app, { titulo: 'SOLTEC · Prueba', cuerpo: 'Así llegarán los recordatorios.', url: '#/ajustes', tag: 'soltec-prueba' });
          toast(ok ? 'Notificación enviada' : 'No se ha podido mostrar', !ok);
        } }, 'Probar') : null,
        soporta && perm === 'granted' && on ? h('button', { class: 'btn', type: 'button', id: 'notif-desactivar', onclick: async () => {
          await app.storage.setMeta('notifRecordatorios', { activo: false });
          try { await (app.reg || (await navigator.serviceWorker?.ready))?.periodicSync?.unregister(PERIODICO); } catch { /* nada */ }
          toast('Notificaciones desactivadas en este dispositivo');
          pintar();
        } }, 'Desactivar') : null));
  };
  pintar();
  return caja;
}

/** Para la prueba en real: notificación de prueba (pide permiso si hace falta). */
export async function probarNotificacion(app) {
  if (!hayNotificaciones()) return false;
  if (Notification.permission !== 'granted' && !(await activarNotificaciones(app))) return false;
  return mostrar(app, { titulo: 'SOLTEC · Prueba', cuerpo: 'Así llegarán los recordatorios.', url: '#/pruebas', tag: 'soltec-prueba' });
}

/** Para la prueba en real: ¿avisa con la app cerrada? 'si' | 'permitido' | 'denegado' | 'no' */
export async function estadoPeriodico(app) {
  try {
    const reg = app.reg || (await navigator.serviceWorker?.getRegistration?.());
    if (!reg?.periodicSync) return 'no';
    if ((await reg.periodicSync.getTags()).includes(PERIODICO)) return 'si';
    const st = await navigator.permissions?.query?.({ name: 'periodic-background-sync' }).catch(() => null);
    return st && st.state !== 'granted' ? 'denegado' : 'permitido';
  } catch { return 'no'; }
}
