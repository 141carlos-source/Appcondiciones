// SOLTEC V2 · Pantalla «Probar en este dispositivo»: prueba en real guiada con informe para pegar en el chat.
// Los resultados se guardan en el dispositivo (no se sincronizan): cada dispositivo tiene su propia prueba.

import { h, toast, confirmar, ir } from '../ui.js';
import { PASOS, pasoAplica, comprobaciones, resumenPruebas, informePruebas } from '../core/pruebas.js';
import { leerErrores } from '../core/errores.js';
import { probarNotificacion, estadoPeriodico } from './recordatorios.js';

const CLAVE = 'pruebasReales';
const esTactil = () => matchMedia('(pointer: coarse)').matches;
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
/** Marca de «prueba en curso»: muestra el botón para volver a la lista desde otras pantallas. */
const marcarEnCurso = (si) => { try { if (si) sessionStorage.setItem('soltec_pruebas', '1'); else sessionStorage.removeItem('soltec_pruebas'); } catch { /* nada */ } };
export const pruebaEnCurso = () => { try { return sessionStorage.getItem('soltec_pruebas') === '1'; } catch { return false; } };

/** Botón flotante «Volver a las pruebas» (lo pone la carcasa en las demás pantallas mientras dura la prueba). */
export function botonVolverPruebas() {
  return h('a', { class: 'btn prim volver-pruebas', href: '#/pruebas', id: 'volver-pruebas' }, '✓ Volver a las pruebas');
}

/** CuadroLab suelto en una capa a pantalla completa (no toca ningún aviso). */
function abrirCuadroLabPrueba() {
  const cerrar = () => { capa.remove(); document.body.classList.remove('con-capa'); };
  const capa = h('div', { class: 'capa-cuadro', role: 'dialog', 'aria-label': 'CuadroLab de prueba' },
    h('div', { class: 'barra-cuadro' }, h('b', {}, 'CuadroLab de prueba (no se guarda en ningún aviso)'),
      h('button', { class: 'btn peq', type: 'button', id: 'cerrar-cuadrolab-prueba', onclick: cerrar }, '← Volver a las pruebas')),
    h('iframe', { src: './assets/cuadrolab.html', title: 'CuadroLab de prueba', id: 'iframe-cuadrolab-prueba' }));
  document.body.classList.add('con-capa');
  document.body.append(capa);
}

export async function vistaPruebas(app, { version = '' } = {}) {
  marcarEnCurso(true);
  let res = (await app.storage.getMeta(CLAVE)) || {};
  // Tipo de dispositivo: se decide al empezar (y se puede cambiar); así el informe no cambia de una vez a otra
  if (!res._tipo) { res._tipo = esTactil() ? 'tactil' : 'pc'; await app.storage.setMeta(CLAVE, res); }
  const tactil = res._tipo === 'tactil';
  const guardar = async () => { await app.storage.setMeta(CLAVE, res); pintarResumen(); };

  // --- comprobaciones automáticas
  const cajaAuto = h('div', { class: 'lista-chk', id: 'pruebas-auto' }, h('p', { class: 'muted' }, 'Comprobando…'));
  let auto = [];
  const comprobar = async () => {
    const cfg = await app.sync.config();
    let pc = { sinConfigurar: true };
    if (cfg.url && cfg.clave) {
      try { const r = await app.sync.probar(); pc = { ok: true, version: r.version }; } catch (e) { pc = { ok: false, error: e.message }; }
    }
    auto = comprobaciones({
      instalada: instalada(), sw: !!navigator.serviceWorker?.controller,
      persistente: navigator.storage?.persisted ? await navigator.storage.persisted() : undefined,
      permisoNotif: 'Notification' in window ? Notification.permission : 'no',
      periodico: await estadoPeriodico(app), pc, errores: (await leerErrores(app.storage)).length,
    });
    cajaAuto.replaceChildren(...auto.map((c) => h('div', { class: 'prueba-auto', 'data-id': c.id },
      h('span', { class: 'ico' }, c.ok === true ? '✅' : c.ok === false ? '❌' : '·'),
      h('span', {}, h('b', {}, c.titulo + ': '), c.texto))));
  };
  comprobar();

  // --- pasos
  const resumen = h('p', { class: 'hoy-resumen', id: 'pruebas-resumen' });
  const pintarResumen = () => {
    const r = resumenPruebas(res, tactil);
    resumen.replaceChildren(h('b', {}, r.ok), ' funcionan · ', h('b', { style: r.falla ? 'color:var(--rojo-oscuro)' : null }, r.falla), ' fallan · ', h('b', {}, r.falta), ` sin probar (de ${r.total})`);
  };
  const accion = async (a) => {
    if (a.ruta) { ir(a.ruta); return; }
    if (a.probar === 'ventana') { const si = await confirmar('Así son las ventanas de SOLTEC: botones grandes, Intro acepta y Esc cancela.\n\n¿Se ve bien?', { si: 'Se ve bien', no: 'Cancelar' }); toast(si ? 'Pulsaste «Se ve bien»' : 'Cancelado'); return; }
    if (a.probar === 'notificacion') { const ok = await probarNotificacion(app); toast(ok ? 'Notificación enviada: mira la barra de notificaciones' : 'No se ha podido mostrar (permiso denegado o navegador sin notificaciones)', !ok); comprobar(); return; }
    if (a.probar === 'cuadrolab') abrirCuadroLabPrueba();
  };
  const tarjeta = (p) => {
    const x = res[p.id] || {};
    const nota = h('input', { type: 'text', class: 'prueba-nota', 'data-minusculas': '', placeholder: 'Nota (qué ha pasado, si falla)', value: x.nota || '', autocomplete: 'off',
      oninput: (e) => { res[p.id] = { ...(res[p.id] || {}), nota: e.target.value, fecha: new Date().toISOString() }; guardar(); } });
    const marcar = (estado) => async () => {
      res[p.id] = { ...(res[p.id] || {}), estado: res[p.id]?.estado === estado ? '' : estado, fecha: new Date().toISOString() };
      await guardar();
      el.replaceWith(tarjeta(p));
      if (estado === 'falla' && res[p.id].estado === 'falla') document.querySelector(`[data-paso="${p.id}"] .prueba-nota`)?.focus();
    };
    const el = h('div', { class: 'card prueba' + (x.estado ? ' ' + x.estado : ''), 'data-paso': p.id },
      h('div', { class: 'tarjeta-cab' }, h('b', {}, p.titulo), x.estado ? h('span', { class: 'insignia' + (x.estado === 'ok' ? ' ok' : ' pend') }, x.estado === 'ok' ? 'Funciona' : 'Falla') : null),
      h('p', {}, h('b', {}, 'Haz: '), p.como),
      h('p', {}, h('b', {}, 'Debe pasar: '), p.espera),
      p.nota ? h('p', { class: 'muted' }, p.nota) : null,
      h('div', { class: 'fila' },
        p.accion ? h('button', { class: 'btn', type: 'button', 'data-accion': p.id, onclick: () => accion(p.accion) }, p.accion.texto) : null,
        h('button', { class: 'btn' + (x.estado === 'ok' ? ' prim' : ''), type: 'button', 'data-marca': 'ok', onclick: marcar('ok') }, '✓ Funciona'),
        h('button', { class: 'btn' + (x.estado === 'falla' ? ' peligro' : ''), type: 'button', 'data-marca': 'falla', onclick: marcar('falla') }, '✗ Falla')),
      x.estado === 'falla' || x.nota ? nota : null);
    return el;
  };
  const grupos = [];
  let g = null;
  for (const p of PASOS.filter((q) => pasoAplica(q, tactil))) {
    if (!g || g.nombre !== p.grupo) { g = { nombre: p.grupo, pasos: [] }; grupos.push(g); }
    g.pasos.push(p);
  }
  pintarResumen();

  // --- informe
  const informe = async () => informePruebas(res, {
    version, dispositivo: (await app.sync.config()).nombre || app.storage.deviceId, navegador: navigator.userAgent,
    pantalla: `${screen.width}×${screen.height}`, tactil, auto, errores: await leerErrores(app.storage),
  });

  return h('div', {},
    h('div', { class: 'titulo-fila' }, h('h1', {}, 'Probar en este dispositivo'),
      h('a', { class: 'btn', href: '#/ajustes', onclick: () => marcarEnCurso(false) }, 'Terminar')),
    h('p', { class: 'muted' }, `Haz cada paso y marca «Funciona» o «Falla» (con una nota si falla). Los botones te llevan a cada sitio; para volver, «✓ Volver a las pruebas» abajo a la derecha. Al final, «Copiar informe» y pégalo en el chat. ${tactil ? 'Pasos para tablet y móvil.' : 'Pasos para PC.'}`),
    resumen,
    h('div', { class: 'fila', id: 'pruebas-tipo' }, h('span', { class: 'muted' }, 'Pasos para:'),
      ...[['tactil', 'Tablet o móvil'], ['pc', 'PC']].map(([v, t]) => h('button', { class: 'btn peq' + (res._tipo === v ? ' prim' : ''), type: 'button', 'data-tipo': v, onclick: async () => {
        if (res._tipo === v) return;
        res._tipo = v; await app.storage.setMeta(CLAVE, res); window.dispatchEvent(new HashChangeEvent('hashchange'));
      } }, t))),
    h('h2', {}, 'Lo que la app comprueba sola'), cajaAuto,
    ...grupos.flatMap((x) => [h('h2', {}, x.nombre), ...x.pasos.map(tarjeta)]),
    h('h2', {}, 'Informe'),
    h('div', { class: 'card' },
      h('p', {}, 'Cuando termines (o aunque falten pasos), copia el informe y pégalo en el chat.'),
      h('div', { class: 'fila' },
        h('button', { class: 'btn prim', type: 'button', id: 'pruebas-copiar', onclick: async () => {
          const t = await informe();
          try { await navigator.clipboard.writeText(t); toast('Informe copiado: pégalo en el chat'); } catch { (await import('../ui.js')).preguntar('Copia el informe:', { valor: t, si: 'Hecho' }); }
        } }, 'Copiar informe'),
        navigator.share ? h('button', { class: 'btn', type: 'button', id: 'pruebas-compartir', onclick: async () => { try { await navigator.share({ title: 'Informe de prueba SOLTEC V2', text: await informe() }); } catch { /* cancelado */ } } }, 'Compartir') : null,
        h('button', { class: 'btn', type: 'button', id: 'pruebas-reiniciar', onclick: async () => {
          if (!(await confirmar('¿Borrar los resultados de la prueba en este dispositivo y empezar de nuevo?', { si: 'Empezar de nuevo', peligro: true }))) return;
          res = { _tipo: res._tipo }; await app.storage.setMeta(CLAVE, res); window.dispatchEvent(new HashChangeEvent('hashchange'));
        } }, 'Empezar de nuevo'))));
}
