// SOLTEC V2 · Autorización de representatividad dentro del aviso.
// El formulario (assets/autorizacion.html) se abre a pantalla completa y habla con la ficha por mensajes:
// no guarda nada por su cuenta. Los datos vuelven al aviso (draft.autorizacion) y, si cambiaron, el aviso se guarda solo al volver.

import { conocidosAutorizacion } from '../core/autorrelleno.js';
import { h, toast, hace, confirmar } from '../ui.js';
import { normalizarAutorizacion, datosAutorizacion, sugerenciasAutorizacion, representanteDeEmpresa, representanteDeTecnico, resumenAutorizacion } from '../core/autorizacion.js';
import { leerEmpresa } from './empresa.js';

const RUTA = './assets/autorizacion.html'; // en el caché del service worker; «#host» activa el modo incrustado
const aDataUrl = (blob) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(blob); });
const cargarImg = (blob) => new Promise((ok) => { if (!blob) return ok(null); const u = URL.createObjectURL(blob); const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = u; });

/**
 * Firma de la empresa para el representante: el sello estampado y la firma del técnico encima,
 * en una sola imagen PNG transparente. Si solo hay una de las dos, va esa sola.
 */
export async function firmaConSello(firmaBlob, selloBlob) {
  const [f, s] = await Promise.all([cargarImg(firmaBlob), cargarImg(selloBlob)]);
  if (!f && !s) return null;
  const H = 320;
  const ws = s ? Math.round(s.naturalWidth * H / s.naturalHeight) : 0;
  const hf = Math.round(H * 0.78), wf = f ? Math.round(f.naturalWidth * hf / f.naturalHeight) : 0;
  const x0 = s ? Math.round(ws * 0.5) : 0; // la firma pisa la mitad derecha del sello
  const c = document.createElement('canvas');
  c.width = Math.max(ws, x0 + wf); c.height = H;
  const g = c.getContext('2d');
  if (s) { g.globalAlpha = 0.92; g.drawImage(s, 0, 0, ws, H); g.globalAlpha = 1; }
  if (f) g.drawImage(f, x0, Math.round((H - hf) / 2), wf, hf);
  return c.toDataURL('image/png');
}

/** Bloque de la ficha. Modifica draft.autorizacion y avisa con alCambiar(); al volver con cambios llama a alVolver() (guarda el aviso). */
export function bloqueAutorizacion(app, draft, alCambiar, alVolver) {
  draft.autorizacion = normalizarAutorizacion(draft.autorizacion);
  const caja = h('div', { id: 'bloque-autorizacion' });

  const pintar = () => {
    const r = resumenAutorizacion(draft.autorizacion);
    caja.replaceChildren(
      h('p', { class: r.hay ? '' : 'muted', id: 'autorizacion-resumen' }, h('b', {}, r.texto),
        r.actualizado ? h('span', { class: 'muted' }, ` · ${hace(r.actualizado)}`) : null),
      h('div', { class: 'fila' },
        h('button', { class: 'btn prim', type: 'button', id: 'abrir-autorizacion', onclick: abrir }, r.hay ? 'Abrir autorización' : 'Preparar autorización'),
        r.hay ? h('button', { class: 'btn', type: 'button', id: 'quitar-autorizacion', onclick: quitar }, 'Quitar') : null),
      h('p', { class: 'muted' }, 'Modelo de e-distribución para representante y destinatario de facturación. Se rellena con los datos del aviso y de Ajustes › Empresa (incluido el logo). Se imprime o guarda en PDF desde el propio formulario.'));
  };

  const quitar = async () => {
    if (!(await confirmar('¿Quitar la autorización de este aviso? Se borrará al guardar el aviso.', { si: 'Quitar', peligro: true }))) return;
    draft.autorizacion = { v: 1, datos: null, actualizado: new Date().toISOString() };
    alCambiar(); pintar();
  };

  async function abrir() {
    let empresa, logo = null, firmaEmpresa = null;
    try {
      empresa = await leerEmpresa(app);
      if (empresa.logo) { const b = await app.storage.getFileBlob(empresa.logo.hash); if (b) logo = await aDataUrl(b); }
      const blob = async (ficha) => (ficha ? app.storage.getFileBlob(ficha.hash) : null);
      firmaEmpresa = await firmaConSello(await blob(empresa.firma), await blob(empresa.sello)).catch(() => null);
    } catch (err) { toast('No se pudieron leer los datos de empresa: ' + err.message, true); return; }
    const iframe = h('iframe', { src: RUTA + '#host', title: 'Autorización de representatividad', id: 'iframe-autorizacion' });
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
    const titulo = 'Autorización de representatividad' + (draft.numero ? ` · Aviso ${draft.numero}` : '');
    const capa = h('div', { class: 'capa-cuadro', role: 'dialog', 'aria-label': 'Autorización de representatividad' },
      h('div', { class: 'barra-cuadro' },
        h('b', {}, titulo),
        h('button', { class: 'btn peq', type: 'button', id: 'volver-autorizacion', onclick: cerrar }, '← Volver al aviso')),
      iframe);
    async function alMensaje(e) {
      if (e.origin !== location.origin || e.source !== iframe.contentWindow) return;
      const m = e.data || {};
      if (m.tipo === 'au-listo') {
        iframe.contentWindow.postMessage({
          tipo: 'au-cargar',
          datos: draft.autorizacion.datos,
          sugeridos: sugerenciasAutorizacion(draft, empresa),
          representante: representanteDeEmpresa(empresa),
          tecnico: representanteDeTecnico(empresa),
          conocidos: conocidosAutorizacion((await app.storage.list('aviso')).filter((r) => !draft.numero || r.data.numero !== draft.numero)),
          firmaEmpresa,
          logo,
          titulo: [draft.numero ? `Aviso ${draft.numero}` : '', draft.cliente?.nombre].filter(Boolean).join(' · '),
        }, location.origin);
      } else if (m.tipo === 'au-cambio' && m.datos && typeof m.datos === 'object') {
        draft.autorizacion = { v: 1, datos: datosAutorizacion(m.datos), actualizado: new Date().toISOString() };
        tocado = true;
        alCambiar();
      } else if (m.tipo === 'au-volver') cerrar();
    }
    window.addEventListener('message', alMensaje);
    document.body.classList.add('con-capa');
    document.body.append(capa);
  }

  pintar();
  return caja;
}
