// SOLTEC V2 · Cuadros eléctricos dentro del aviso.
// CuadroLab (assets/cuadrolab.html) se abre a pantalla completa dentro de la app y se comunica por mensajes:
// no guarda nada por su cuenta. El proyecto vuelve a la ficha del aviso (draft.cuadro) y, si cambió, el aviso se guarda solo al volver.

import { h, toast, hace } from '../ui.js';
import { normalizarCuadro, resumenCuadro, textoResumen, esProyecto } from '../core/cuadros.js';
import { leerEmpresa } from './empresa.js';

const RUTA_CUADRO = './assets/cuadrolab.html'; // en el caché del service worker; «#host» activa el modo incrustado
const aDataUrl = (blob) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(blob); });

/** Datos de empresa y aviso que CuadroLab muestra en cabecera y cajetín. */
async function datosParaCuadro(app, draft) {
  const e = await leerEmpresa(app);
  let logo = null;
  if (e.logo) { const b = await app.storage.getFileBlob(e.logo.hash); if (b) logo = await aDataUrl(b); }
  const em = e.empresa;
  const dir = [em.direccion, [em.cp, em.localidad].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const s = draft.suministro || {};
  const dirAviso = [s.direccion, [s.cp, s.localidad].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return {
    empresa: { nombre: em.nombreComercial || em.nombre, direccion: dir, telefono: em.telefono, email: em.email, web: em.web, nif: em.nif, logo },
    aviso: { titulo: draft.numero ? `Aviso ${draft.numero}` : draft.cliente?.nombre || '', direccion: dirAviso },
  };
}

/** Bloque de la ficha. Modifica draft.cuadro y avisa con alCambiar(); al volver con cambios llama a alVolver() (guarda el aviso). */
export function bloqueCuadros(app, draft, alCambiar, alVolver) {
  draft.cuadro = normalizarCuadro(draft.cuadro);
  const caja = h('div', { id: 'bloque-cuadros' });

  const pintar = () => {
    const r = resumenCuadro(draft.cuadro);
    caja.replaceChildren(
      h('p', { class: r.hay ? '' : 'muted', id: 'cuadro-resumen' }, h('b', {}, textoResumen(r)),
        r.nombres.length ? h('span', { class: 'muted' }, ' — ' + r.nombres.join(', ')) : null,
        r.actualizado ? h('span', { class: 'muted' }, ` · ${hace(r.actualizado)}`) : null),
      h('div', { class: 'fila' },
        h('button', { class: 'btn prim', type: 'button', id: 'abrir-cuadro', onclick: abrir }, r.hay ? 'Abrir cuadro eléctrico' : 'Diseñar cuadro eléctrico'),
        r.hay ? h('button', { class: 'btn', type: 'button', id: 'quitar-cuadro', onclick: quitar }, 'Quitar cuadro') : null),
      h('p', { class: 'muted' }, 'El cuadro se guarda solo dentro del aviso al volver del diseñador. Unifilar, etiquetas, pedido y memoria se imprimen desde el propio diseñador.'));
  };

  const quitar = () => {
    if (!confirm('¿Quitar el cuadro eléctrico de este aviso? Se borrará al guardar el aviso.')) return;
    draft.cuadro = normalizarCuadro(null);
    alCambiar(); pintar();
  };

  async function abrir() {
    let datos;
    try { datos = await datosParaCuadro(app, draft); } catch (err) { toast('No se pudieron leer los datos de empresa: ' + err.message, true); return; }
    const iframe = h('iframe', { src: RUTA_CUADRO + '#host', title: 'Cuadro eléctrico', id: 'iframe-cuadro' });
    let tocado = false;
    const cerrar = async () => {
      window.removeEventListener('message', alMensaje);
      capa.remove();
      document.body.classList.remove('con-capa');
      pintar();
      if (tocado && alVolver) {
        try { await alVolver(); } catch (err) { toast('No se pudo guardar el aviso: ' + err.message, true); }
      }
    };
    const capa = h('div', { class: 'capa-cuadro', role: 'dialog', 'aria-label': 'Cuadro eléctrico' },
      h('div', { class: 'barra-cuadro' },
        h('b', {}, 'Cuadro eléctrico' + (draft.numero ? ` · Aviso ${draft.numero}` : '')),
        h('button', { class: 'btn peq', type: 'button', id: 'volver-cuadro', onclick: cerrar }, '← Volver al aviso')),
      iframe);
    function alMensaje(e) {
      if (e.origin !== location.origin || e.source !== iframe.contentWindow) return;
      const m = e.data || {};
      if (m.tipo === 'cl-listo') {
        iframe.contentWindow.postMessage({ tipo: 'cl-cargar', proyecto: draft.cuadro.proyecto, ...datos }, location.origin);
      } else if (m.tipo === 'cl-cambio' && esProyecto(m.proyecto)) {
        draft.cuadro = { v: 1, proyecto: m.proyecto, actualizado: new Date().toISOString() };
        tocado = true;
        alCambiar();
      } else if (m.tipo === 'cl-volver') cerrar();
    }
    window.addEventListener('message', alMensaje);
    document.body.classList.add('con-capa');
    document.body.append(capa);
  }

  pintar();
  return caja;
}
