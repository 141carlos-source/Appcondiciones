// SOLTEC V2 · Formulario de datos para el cliente (página pública, sin cuenta ni servidor).
// Los datos llegan dentro del enlace (después de «#», no se envían a ningún sitio) y el cliente
// devuelve la ficha rellena y firmada por WhatsApp o correo. La app la lee automáticamente.

import { h, lienzoFirma, activarMayusculas, descargar } from './ui.js';
import { CAMPOS_FICHA, GRUPOS_FICHA, leerEnlace, problemaCampo, lineaDatos } from './core/fichaCliente.js';
import { generarFicha, telefonoWhatsApp } from './core/documentos.js';
import { provinciaDeCp } from './core/validate.js';

const leer = (o, ruta) => ruta.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const hoy = () => new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

function cargarPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  return new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = './vendor/pdf-lib.min.js';
    s.onload = () => ok(window.PDFLib);
    s.onerror = () => mal(new Error('No se pudo preparar el PDF. Revise la conexión e inténtelo de nuevo.'));
    document.head.append(s);
  });
}

async function logoEdist() {
  try { const r = await fetch('./assets/logo_e-distribucion.jpg'); return { bytes: new Uint8Array(await r.arrayBuffer()), mime: 'image/jpeg' }; } catch { return null; }
}

/** Texto del mensaje de vuelta: legible para la empresa y con la línea que lee la app. */
export function textoVuelta(p, datos, firma) {
  const l = [`Ficha de datos${p.n ? ' · Aviso ' + p.n : ''}`, ''];
  for (const [ruta, etiqueta] of CAMPOS_FICHA) if (datos[ruta]) l.push(`${etiqueta.replace(/ \(.*\)$/, '')}: ${datos[ruta]}`);
  l.push('', firma ? `Firmado por ${firma.nombre} el ${firma.fecha}.` : '', '', '(Código para la app, no lo borre)', lineaDatos({ v: 1, id: p.id, n: p.n, d: datos, firma }));
  return l.filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');
}

export function iniciarFormulario() {
  activarMayusculas();
  const main = document.getElementById('contenido');
  const p = leerEnlace(location.hash);
  if (!p) {
    main.replaceChildren(h('div', { class: 'card' }, h('h1', {}, 'Enlace incompleto'),
      h('p', {}, 'Este enlace no contiene la ficha. Pida a la empresa que se lo vuelva a enviar (a veces WhatsApp o el correo lo cortan).')));
    return;
  }
  const empresa = { empresa: { nombre: p.e?.n || '', telefono: p.e?.t || '', email: p.e?.m || '' } };
  const datos = { ...p.d };
  const campos = new Map();

  const comprobar = (ruta) => {
    const c = campos.get(ruta);
    const prob = problemaCampo(ruta, datos[ruta]);
    c.wrap.classList.toggle('pend', !!prob);
    c.msg.textContent = prob && datos[ruta] ? prob : prob === 'Obligatorio' ? 'Obligatorio' : '';
    return prob;
  };

  const grupo = (g) => h('div', { class: 'card' }, h('h2', {}, GRUPOS_FICHA[g]), h('div', { class: 'grid2' },
    ...CAMPOS_FICHA.filter(([, , o]) => o.grupo === g).map(([ruta, etiqueta, o]) => {
      const id = 'c-' + ruta.replace('.', '-');
      const input = h('input', { id, type: o.tipo || 'text', value: datos[ruta] || '', inputmode: o.inputmode, autocomplete: 'off',
        oninput: (e) => {
          datos[ruta] = e.target.value.trim();
          if (ruta === 'suministro.cp' && /^\d{5}$/.test(datos[ruta]) && !datos['suministro.provincia']) {
            datos['suministro.provincia'] = provinciaDeCp(datos[ruta]);
            const pr = document.getElementById('c-suministro-provincia'); if (pr) pr.value = datos['suministro.provincia'];
            comprobar('suministro.provincia');
          }
          comprobar(ruta);
        } });
      const msg = h('div', { class: 'msg-pend' });
      const wrap = h('div', { class: 'campo' + (o.peso >= 2 ? ' ancho' : ''), 'data-campo': ruta }, h('label', { for: id }, etiqueta + (o.req ? ' *' : '')), input, msg);
      campos.set(ruta, { wrap, msg, input });
      return wrap;
    })));

  const lienzo = lienzoFirma('firma-cliente');
  const firmante = h('input', { id: 'c-firmante', type: 'text', value: datos['cliente.contacto'] || datos['cliente.nombre'] || '' });
  const acepto = h('input', { type: 'checkbox', id: 'c-acepto' });
  const resultado = h('div', { id: 'resultado', 'aria-live': 'polite' });

  const enviar = async (e) => {
    const malos = CAMPOS_FICHA.map(([r]) => r).filter((r) => comprobar(r));
    if (malos.length) { campos.get(malos[0]).input.focus(); resultado.replaceChildren(h('div', { class: 'aviso err' }, 'Revise los campos marcados en rojo.')); return; }
    if (lienzo.vacio()) { resultado.replaceChildren(h('div', { class: 'aviso err' }, 'Falta la firma: firme con el dedo en el recuadro.')); return; }
    if (!firmante.value.trim()) { firmante.focus(); resultado.replaceChildren(h('div', { class: 'aviso err' }, 'Escriba el nombre de quien firma.')); return; }
    if (!acepto.checked) { resultado.replaceChildren(h('div', { class: 'aviso err' }, 'Marque la casilla de conformidad.')); return; }
    e.target.disabled = true;
    resultado.replaceChildren(h('div', { class: 'aviso info' }, 'Preparando la ficha firmada…'));
    try {
      const firma = { nombre: firmante.value.trim(), fecha: hoy() };
      const aviso = { numero: p.n, condiciones: { ref: p.ref }, cliente: {}, suministro: {}, electrico: {} };
      for (const [ruta] of CAMPOS_FICHA) { const [g, k] = ruta.split('.'); aviso[g][k] = datos[ruta] || ''; }
      const [PDFLib, edist] = await Promise.all([cargarPdfLib(), logoEdist()]);
      const texto = textoVuelta(p, datos, firma);
      const bytes = await generarFicha(PDFLib, { aviso, empresa, edist, firma: { ...firma, png: await lienzo.png() }, datosCliente: texto.split('\n').pop() });
      const nombre = `FICHA_DATOS_${(p.n || 'CLIENTE').replace(/[^A-Z0-9]+/gi, '_')}_FIRMADA.pdf`;
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const file = new File([blob], nombre, { type: 'application/pdf' });
      const tel = telefonoWhatsApp(p.e?.t);
      const puedeCompartir = !!navigator.canShare?.({ files: [file] });
      resultado.replaceChildren(h('div', { class: 'card' },
        h('div', { class: 'aviso ok' }, h('b', {}, 'Ficha preparada. '), 'Ahora envíela a ', p.e?.n || 'la empresa', ':'),
        h('div', { class: 'acciones' },
          puedeCompartir ? h('button', { class: 'btn prim', type: 'button', id: 'btn-compartir', onclick: async () => {
            try { await navigator.share({ files: [file], text: texto, title: nombre }); } catch (err) { if (err.name !== 'AbortError') descargar(blob, nombre); }
          } }, 'Enviar el PDF (WhatsApp, correo…)') : null,
          h('a', { class: 'btn' + (puedeCompartir ? '' : ' prim'), id: 'btn-wa', href: `https://wa.me/${tel || ''}?text=${encodeURIComponent(texto)}`, target: '_blank', rel: 'noopener' }, tel ? 'Enviar los datos por WhatsApp' : 'Abrir WhatsApp con los datos'),
          p.e?.m ? h('a', { class: 'btn', id: 'btn-correo', href: `mailto:${p.e.m}?subject=${encodeURIComponent(`Ficha de datos · Aviso ${p.n || ''}`)}&body=${encodeURIComponent(texto)}` }, 'Enviar por correo') : null,
          h('button', { class: 'btn', type: 'button', id: 'btn-descargar', onclick: () => descargar(blob, nombre) }, 'Descargar el PDF')),
        h('p', { class: 'muted' }, puedeCompartir
          ? '«Enviar el PDF» abre la lista de aplicaciones: elija WhatsApp o su correo y el contacto de la empresa.'
          : 'Si envía los datos por WhatsApp o correo, adjunte también el PDF descargado si puede.')));
      resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      resultado.replaceChildren(h('div', { class: 'aviso err' }, err.message || 'No se pudo preparar la ficha.'));
    } finally { e.target.disabled = false; }
  };

  main.replaceChildren(
    h('div', { class: 'titulo-fila' }, h('h1', {}, 'Ficha de datos del cliente')),
    h('div', { class: 'card' },
      h('b', {}, p.e?.n || 'Su instalador'), p.n ? h('div', { class: 'muted' }, `Aviso ${p.n}${p.ref ? ' · Ref. ' + p.ref : ''}`) : null,
      h('p', {}, 'Revise sus datos y complete lo que falte (en rojo). Al terminar, firme y pulse «Preparar ficha firmada» para devolverla por WhatsApp o correo.'),
      h('p', { class: 'muted' }, 'Sus datos solo se usan para tramitar su suministro eléctrico. Esta página no guarda nada: solo se envía lo que usted mande.')),
    grupo('cliente'), grupo('suministro'),
    h('div', { class: 'card' }, h('h2', {}, 'CONFORMIDAD Y FIRMA'),
      h('p', { class: 'muted' }, 'Firme con el dedo (o el ratón) en el recuadro.'), lienzo.el,
      h('div', { class: 'fila' }, h('button', { class: 'btn peq', type: 'button', onclick: () => lienzo.borrar() }, 'Borrar firma')),
      h('label', { for: 'c-firmante' }, 'Nombre de quien firma'), firmante,
      h('label', { class: 'check-linea' }, acepto, ' Declaro que los datos son correctos y autorizo su uso para tramitar la solicitud con la distribuidora y la comercializadora.'),
      h('div', { class: 'fila' }, h('button', { class: 'btn prim ancho', type: 'button', id: 'btn-preparar', onclick: enviar }, 'Preparar ficha firmada'))),
    resultado);
  for (const [ruta] of CAMPOS_FICHA) comprobar(ruta);
}
