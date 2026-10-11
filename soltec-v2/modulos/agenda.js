// SOLTEC V2 · Capa 6 · Agenda: citas y seguimientos de avisos (un único tipo de registro, «cita»).
// Un seguimiento es una cita con ref = id del aviso; completarla o reabrirla queda en el historial del aviso.

import { h, toast, ir, descargar } from '../ui.js';
import { ANTELACIONES, debeSonar, momentoAlarma, enlaceGoogle, icsCita, nombreIcs } from '../core/calendario.js';
import { hoyLocal, direccionCompleta } from '../core/model.js';
import { buscar } from '../core/search.js';

const DIAS = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const diaTexto = (iso) => {
  if (!iso) return 'Sin fecha';
  const hoy = hoyLocal();
  const manana = hoyLocal(new Date(Date.now() + 86400000));
  if (iso === hoy) return 'Hoy';
  if (iso === manana) return 'Mañana';
  const t = DIAS.format(new Date(iso + 'T12:00:00'));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const orden = (a, b) => ((a.data.fecha || '9') + (a.data.hora || '99')).localeCompare((b.data.fecha || '9') + (b.data.hora || '99'));

/** Marca una cita como hecha o la reabre, y lo anota en el historial del aviso. */
export async function cambiarHecho(app, cita, hecho) {
  await app.storage.patch(cita.id, { hecho, hechoAt: hecho ? new Date().toISOString() : null });
  if (cita.ref) await app.storage.addEvent(cita.ref, hecho ? 'seguimiento_hecho' : 'seguimiento_reabierto', cita.data.titulo || 'Seguimiento');
}

/** Crea una cita; si va unida a un aviso, queda en su historial. */
export async function crearCita(app, datos, avisoId = null) {
  const r = await app.storage.save('cita', { hecho: false, alarma: false, ...datos }, { ref: avisoId });
  if (avisoId) await app.storage.addEvent(avisoId, 'seguimiento', `${datos.titulo || 'Seguimiento'} · ${datos.fecha}${datos.hora ? ' ' + datos.hora : ''}${datos.responsable ? ' · ' + datos.responsable : ''}`);
  return r;
}

function lineaCita(app, c, aviso, alCambiar) {
  const vencida = !c.data.hecho && c.data.fecha && c.data.fecha < hoyLocal();
  return h('div', { class: 'tarjeta cita' + (c.data.hecho ? ' hecha' : '') + (vencida ? ' vencida' : '') },
    h('div', { class: 'cita-fila' },
      h('button', { class: 'check', type: 'button', 'aria-label': c.data.hecho ? 'Reabrir' : 'Marcar como hecha', title: c.data.hecho ? 'Reabrir' : 'Marcar como hecha',
        onclick: async () => { await cambiarHecho(app, c, !c.data.hecho); toast(c.data.hecho ? 'Reabierta' : 'Hecha'); alCambiar(); } }, c.data.hecho ? '✓' : ''),
      h('a', { class: 'cita-texto', href: `#/cita/${c.id}` },
        h('div', {}, c.data.hora ? [h('span', { class: 'mono' }, c.data.hora), ' '] : null, h('b', {}, c.data.titulo || 'Sin título'), c.data.alarma ? ' 🔔' : ''),
        c.data.responsable ? h('div', { class: 'muted' }, c.data.responsable) : null,
        aviso ? h('div', { class: 'muted' }, `Aviso ${aviso.data.numero} · ${aviso.data.cliente?.nombre || ''}`) : null,
        vencida ? h('div', { class: 'faltan' }, 'Vencida') : null)));
}

export async function vistaAgenda(app) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const verHechas = params.get('ver') === 'hechas';
  const citas = await app.storage.list('cita');
  const avisos = new Map((await app.storage.list('aviso', { includeDeleted: true })).map((r) => [r.id, r]));
  const lista = h('div');
  const pintar = () => {
    const sel = citas.filter((c) => !!c.data.hecho === verHechas).sort(orden);
    if (verHechas) sel.reverse();
    const hoy = hoyLocal();
    const grupos = new Map();
    for (const c of sel) {
      const clave = !verHechas && c.data.fecha && c.data.fecha < hoy ? 'Vencidas' : diaTexto(c.data.fecha);
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(c);
    }
    lista.replaceChildren(...(grupos.size ? [...grupos].map(([dia, cs]) => h('div', {},
      h('h2', { class: dia === 'Vencidas' ? 'rojo' : '' }, dia),
      h('div', { class: 'lista' }, ...cs.map((c) => lineaCita(app, c, avisos.get(c.ref), () => { c.data.hecho = !c.data.hecho; pintar(); })))))
      : [h('div', { class: 'card muted' }, verHechas ? 'No hay citas hechas.' : 'No hay citas pendientes.')]));
  };
  pintar();
  return h('div', {},
    h('div', { class: 'titulo-fila' }, h('h1', {}, 'Agenda'), h('a', { class: 'btn prim', href: '#/cita/nueva' }, '+ Nueva cita')),
    h('div', { class: 'chips' },
      h('a', { class: 'chip' + (verHechas ? '' : ' activo'), href: '#/agenda' }, 'Pendientes'),
      h('a', { class: 'chip' + (verHechas ? ' activo' : ''), href: '#/agenda?ver=hechas' }, 'Hechas')),
    lista,
    h('p', { class: 'muted' }, 'Los avisos suenan con SOLTEC abierta. Para que suenen siempre, abre la cita y añádela al calendario del teléfono.'));
}

/** Ficha de cita: nueva, desde un aviso (?aviso=id) o editar. */
export async function vistaCita(app, id) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const nueva = id === 'nueva';
  let cita = nueva ? null : await app.storage.get(id);
  if (!nueva && !cita) return h('div', {}, h('h1', {}, 'Cita no encontrada'), h('a', { class: 'btn', href: '#/agenda' }, 'Volver'));
  const d = cita ? { antelacion: 0, ...cita.data } : { titulo: '', fecha: hoyLocal(), hora: '', responsable: '', notas: '', alarma: true, antelacion: 15, hecho: false };
  let avisoId = cita ? cita.ref : params.get('aviso');
  const avisos = await app.storage.list('aviso');
  let cambiado = false;
  app.guardia = () => cambiado;
  const marca = () => { cambiado = true; };

  const inp = (k, tipo, etiqueta, extra = {}) => h('div', { class: 'campo' + (extra.ancho ? ' ancho' : '') },
    h('label', { for: 'c-' + k }, etiqueta),
    h('input', { id: 'c-' + k, type: tipo, value: d[k] || '', oninput: (e) => { d[k] = e.target.value; marca(); }, placeholder: extra.placeholder }));

  // Aviso vinculado: buscador
  const avisoSel = h('div');
  const pintarAviso = () => {
    const a = avisos.find((r) => r.id === avisoId);
    if (a) {
      avisoSel.replaceChildren(h('div', { class: 'tarjeta' },
        h('b', {}, `Aviso ${a.data.numero} · ${a.data.cliente?.nombre || ''}`), h('div', { class: 'muted' }, direccionCompleta(a.data.suministro)),
        h('div', { class: 'fila' }, h('a', { class: 'btn peq', href: `#/aviso/${a.id}` }, 'Abrir aviso'),
          cita ? null : h('button', { class: 'btn peq', type: 'button', onclick: () => { avisoId = null; marca(); pintarAviso(); } }, 'Quitar'))));
      return;
    }
    const res = h('div', { class: 'lista' });
    avisoSel.replaceChildren(
      h('input', { type: 'search', class: 'buscador', id: 'c-aviso', placeholder: 'Unir a un aviso (opcional): buscar cliente, dirección…', oninput: (e) => {
        res.replaceChildren(...buscar(avisos, e.target.value).slice(0, 6).map(({ registro: r }) => h('button', { type: 'button', class: 'tarjeta', style: 'text-align:left;width:100%', onclick: () => { avisoId = r.id; marca(); pintarAviso(); } },
          h('b', {}, `${r.data.numero} · ${r.data.cliente?.nombre || ''}`), h('div', { class: 'muted' }, direccionCompleta(r.data.suministro)))));
      } }), res);
  };
  pintarAviso();

  const selAnt = h('select', { id: 'c-antelacion', 'aria-label': 'Cuándo avisar', disabled: !d.alarma || null, onchange: (e) => { d.antelacion = Number(e.target.value); marca(); } },
    ...ANTELACIONES.map((a) => h('option', { value: a.min, selected: Number(d.antelacion || 0) === a.min || null }, a.texto)));

  const guardar = async () => {
    if (!d.titulo.trim()) { toast('Escribe qué hay que hacer', true); document.getElementById('c-titulo')?.focus(); return; }
    if (!d.fecha) { toast('Indica la fecha', true); return; }
    let guardada;
    if (nueva) guardada = await crearCita(app, d, avisoId);
    else guardada = await app.storage.save('cita', d, { id: cita.id });
    cambiado = false;
    if (nueva) {
      // Se abre la cita guardada para ofrecer «Añadir al calendario del teléfono»
      toast('Cita guardada. Añádela al calendario para que suene siempre.');
      ir(`cita/${guardada.id}${avisoId && params.get('aviso') ? '?aviso=' + avisoId : ''}`);
      return;
    }
    toast('Cita guardada');
    if (avisoId && params.get('aviso')) ir('aviso/' + avisoId); else ir('agenda');
  };

  return h('form', { class: 'ficha', onsubmit: (e) => { e.preventDefault(); guardar(); } },
    h('div', { class: 'titulo-fila' }, h('h1', {}, nueva ? (avisoId ? 'Nuevo seguimiento' : 'Nueva cita') : 'Cita'),
      h('a', { class: 'btn', href: avisoId && params.get('aviso') ? `#/aviso/${avisoId}` : '#/agenda' }, 'Volver')),
    cita && !d.hecho ? bloqueCalendario(cita, avisos.find((r) => r.id === avisoId)) : null,
    h('div', { class: 'card' },
      h('div', { class: 'grid2' },
        inp('titulo', 'text', 'Qué hay que hacer', { ancho: true, placeholder: 'Ejemplo: Llamar para pedir el IBAN' }),
        inp('fecha', 'date', 'Fecha'),
        inp('hora', 'time', 'Hora'),
        inp('responsable', 'text', 'Responsable', { ancho: true }),
        h('div', { class: 'campo ancho' }, h('label', { for: 'c-notas' }, 'Notas'),
          h('textarea', { id: 'c-notas', rows: 3, value: d.notas || '', oninput: (e) => { d.notas = e.target.value; marca(); } }))),
      h('div', { class: 'fila alarma-fila' },
        h('label', { class: 'check-linea' }, h('input', { type: 'checkbox', id: 'c-alarma', checked: d.alarma || null, onchange: (e) => { d.alarma = e.target.checked; marca(); selAnt.disabled = !d.alarma; if (e.target.checked) prepararAvisos(); } }),
          ' Avisar con sonido'),
        selAnt),
      h('p', { class: 'muted' }, 'Con SOLTEC abierta suena aquí. Para que suene siempre, aunque el móvil esté bloqueado, añádela al calendario del teléfono al guardar.'),
      h('label', {}, 'Aviso'), avisoSel),
    cita ? h('div', { class: 'fila' },
      h('button', { class: 'btn', type: 'button', onclick: async () => { await cambiarHecho(app, cita, !d.hecho); cambiado = false; toast(d.hecho ? 'Reabierta' : 'Hecha'); ir('agenda'); } }, d.hecho ? 'Reabrir' : 'Marcar como hecha'),
      h('button', { class: 'btn', type: 'button', onclick: async () => { if (!confirm('¿Enviar esta cita a la papelera?')) return; await app.storage.trash(cita.id); cambiado = false; ir('agenda'); } }, 'Eliminar')) : null,
    h('div', { class: 'barra-guardar' }, h('button', { class: 'btn prim ancho', type: 'submit', id: 'guardar-cita' }, 'Guardar cita')));
}

/** Bloque «Seguimiento» dentro de la ficha del aviso. */
export async function bloqueSeguimiento(app, avisoId) {
  const citas = (await app.storage.listByRef(avisoId, 'cita')).filter((c) => !c.deleted).sort(orden);
  const cont = h('div');
  const pintar = () => {
    const pend = citas.filter((c) => !c.data.hecho);
    const hechas = citas.filter((c) => c.data.hecho);
    cont.replaceChildren(
    pend.length ? h('div', { class: 'lista' }, ...pend.map((c) => lineaCita(app, c, null, () => { c.data.hecho = !c.data.hecho; pintar(); }))) : h('p', { class: 'muted' }, 'Sin seguimientos pendientes.'),
    hechas.length ? h('p', { class: 'muted' }, `${hechas.length} seguimiento(s) completado(s).`) : null,
    h('div', { class: 'fila' }, h('a', { class: 'btn', href: `#/cita/nueva?aviso=${avisoId}` }, '+ Programar seguimiento')));
  };
  pintar();
  return cont;
}

// ---------------------------------------------------------------- calendario del teléfono
function bloqueCalendario(cita, aviso) {
  const lugar = aviso ? direccionCompleta(aviso.data.suministro) : '';
  const google = enlaceGoogle(cita.data, { aviso, lugar });
  if (!google) return null;
  return h('div', { class: 'card', id: 'bloque-calendario' },
    h('b', {}, 'Añadir al calendario del teléfono'),
    h('p', { class: 'muted' }, 'El calendario del teléfono avisa con su sonido aunque SOLTEC esté cerrada y el móvil bloqueado.'
      + (cita.data.alarma ? '' : ' Activa «Avisar con sonido» para incluir el aviso.')),
    h('div', { class: 'fila' },
      h('a', { class: 'btn prim', id: 'cal-google', href: google, target: '_blank', rel: 'noopener' }, 'Google Calendar (Android)'),
      h('button', { class: 'btn', type: 'button', id: 'cal-ics', onclick: () => {
        const datos = { ...cita.data, ...(cita.data.alarma ? {} : { antelacion: 0 }) };
        descargar(new Blob([icsCita(datos, { id: cita.id, aviso, lugar })], { type: 'text/calendar;charset=utf-8' }), nombreIcs(cita.data));
      } }, 'Archivo de calendario (iPhone, Outlook)')),
    h('p', { class: 'muted' }, 'En Google Calendar revisa que la notificación esté puesta antes de pulsar Guardar. Si cambias la fecha u hora aquí, vuelve a añadirla.'));
}

// ---------------------------------------------------------------- alarmas con la app abierta
let audio = null;
/** Prepara sonido y notificaciones (el navegador solo lo permite tras pulsar algo). */
export function prepararAvisos() {
  try {
    if (!audio) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audio = new AC(); }
    audio?.resume?.();
  } catch { /* sin sonido */ }
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
}

/** Tres pitidos dobles, bien audibles. */
export function sonar() {
  try {
    if (!audio) prepararAvisos();
    if (!audio) return;
    const t0 = audio.currentTime + 0.05;
    for (let i = 0; i < 6; i++) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'square';
      o.frequency.value = i % 2 ? 1320 : 990;
      const t = t0 + Math.floor(i / 2) * 0.7 + (i % 2) * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(g).connect(audio.destination);
      o.start(t);
      o.stop(t + 0.16);
    }
  } catch { /* sin sonido */ }
}

async function notificar(titulo, cuerpo, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const opciones = { body: cuerpo, tag, renotify: true, requireInteraction: true, vibrate: [300, 150, 300, 150, 300], icon: './icon-192.png', badge: './icon-192.png' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg?.showNotification) { await reg.showNotification(titulo, opciones); return true; }
    new Notification(titulo, opciones);
    return true;
  } catch { return false; }
}

function ventanaAlarma(app, c, posponer) {
  document.querySelector('.alarma-ventana')?.remove();
  const cerrar = () => v.remove();
  const v = h('div', { class: 'alarma-ventana', role: 'alertdialog', 'aria-label': 'Aviso de agenda' },
    h('div', { class: 'alarma-caja' },
      h('div', { class: 'alarma-hora' }, '⏰ ' + (c.data.hora || 'Hoy')),
      h('b', {}, c.data.titulo || 'Cita'),
      c.data.notas ? h('p', { class: 'muted' }, c.data.notas) : null,
      h('div', { class: 'fila' },
        h('button', { class: 'btn prim', type: 'button', onclick: async () => { cerrar(); await cambiarHecho(app, c, true); toast('Hecha'); } }, 'Hecha'),
        h('button', { class: 'btn', type: 'button', onclick: () => { cerrar(); posponer(c, 10); toast('Te aviso en 10 min'); } }, 'Dentro de 10 min'),
        h('a', { class: 'btn', href: `#/cita/${c.id}`, onclick: cerrar }, 'Ver'),
        h('button', { class: 'btn', type: 'button', onclick: cerrar }, 'Cerrar'))));
  document.body.append(v);
}

/** Revisa cada 30 s las citas con aviso. Devuelve la función que hace una revisión (para pruebas). */
export function iniciarAlarmas(app) {
  // El navegador solo deja sonar después de una pulsación: se prepara con la primera.
  const desbloquear = () => { prepararAvisos(); window.removeEventListener('pointerdown', desbloquear); };
  window.addEventListener('pointerdown', desbloquear);

  const posponer = async (c, min) => {
    const pos = (await app.storage.getMeta('alarmasPospuestas')) || {};
    pos[c.id] = new Date(Date.now() + min * 60000).toISOString();
    await app.storage.setMeta('alarmasPospuestas', pos);
  };

  const revisar = async () => {
    const ahora = new Date();
    const avisadas = (await app.storage.getMeta('alarmasAvisadas')) || {};
    const pos = (await app.storage.getMeta('alarmasPospuestas')) || {};
    let cambio = false;
    for (const c of await app.storage.list('cita')) {
      let clave = null;
      if (pos[c.id] && new Date(pos[c.id]) <= ahora) {
        clave = `${c.id}@pospuesta ${pos[c.id]}`;
        delete pos[c.id];
        cambio = true;
        if (c.data.hecho) continue;
      } else if (debeSonar(c.data, ahora) && momentoAlarma(c.data).getTime() >= new Date(c.updatedAt || 0).getTime() - 60000) {
        // (si al guardar la cita la hora del aviso ya había pasado, no suena)
        clave = `${c.id}@${momentoAlarma(c.data).toISOString()}`;
      }
      if (!clave || avisadas[clave]) continue;
      avisadas[clave] = ahora.toISOString();
      cambio = true;
      const texto = `${c.data.hora || 'Hoy'} · ${c.data.titulo || 'Cita'}`;
      sonar();
      navigator.vibrate?.([300, 150, 300, 150, 300]);
      await notificar('SOLTEC · Agenda', texto, clave);
      ventanaAlarma(app, c, posponer);
    }
    if (cambio) {
      // Se guardan solo las de las últimas 2 semanas
      const limite = Date.now() - 14 * 86400000;
      for (const [k, v] of Object.entries(avisadas)) if (new Date(v).getTime() < limite) delete avisadas[k];
      await app.storage.setMeta('alarmasAvisadas', avisadas);
      await app.storage.setMeta('alarmasPospuestas', pos);
    }
  };
  setInterval(revisar, 30 * 1000);
  setTimeout(revisar, 3000);
  return revisar;
}
