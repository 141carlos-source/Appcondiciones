// SOLTEC V2 · Formulario de datos para el cliente (página pública, sin cuenta ni servidor).
// Los datos llegan dentro del enlace (después de «#», no se envían a ningún sitio) y el cliente
// devuelve la ficha rellena y firmada por WhatsApp o correo. La app la lee automáticamente.

import { h, lienzoFirma, activarMayusculas, descargar } from './ui.js';
import { CAMPOS_FICHA, GRUPOS_FICHA, leerEnlace, problemaCampo, lineaDatos, empresaDePaquete, infoProteccionDatos } from './core/fichaCliente.js';
import { potenciasNormalizadas, problemaPotencia, TENSIONES, USOS } from './core/potencias.js';
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

/** Logo de la empresa que viene en el enlace (data:URL) → {bytes, mime} para el PDF. */
export function logoDeEnlace(dataUrl) {
  const m = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  try { return { mime: m[1], bytes: Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)) }; } catch { return null; }
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
  const empresa = empresaDePaquete(p);
  const el = p.el || {};
  const datos = { ...p.d };
  const campos = new Map();

  const comprobar = (ruta) => {
    const c = campos.get(ruta);
    const prob = ruta === 'electrico.potenciaContratar' ? problemaPotencia(datos[ruta], el.pc) : problemaCampo(ruta, datos[ruta]);
    c.wrap.classList.toggle('pend', !!prob);
    c.msg.textContent = prob && datos[ruta] ? prob : prob === 'Obligatorio' ? 'Obligatorio' : '';
    return prob;
  };

  // Datos eléctricos del proyecto: el cliente los ve pero no los cambia
  const fijos = (g) => g !== 'electrico' ? [] : [
    ['Tensión', TENSIONES[el.t] || el.t], ['Uso', USOS[el.u] || el.u], ['Interruptor general (IGA)', el.i && el.i + ' A'], ['Potencia máxima que admite (kW)', el.pc],
  ].filter(([, v]) => v).map(([t, v], i) => h('div', { class: 'campo', 'data-fijo': i }, h('label', {}, t), h('div', { class: 'dato-fijo' }, v)));
  const chipsPotencia = (input) => {
    const lista = potenciasNormalizadas(el.t, el.pc);
    if (!lista.length) return null;
    const caja = h('div', { class: 'chips potencias', id: 'c-potencias' });
    const pintar = () => caja.replaceChildren(...lista.map((x) => h('button', { class: 'chip' + (datos['electrico.potenciaContratar'] === x.kw ? ' activo' : ''), type: 'button', 'data-kw': x.kw, onclick: () => {
      input.value = x.kw; datos['electrico.potenciaContratar'] = x.kw; comprobar('electrico.potenciaContratar'); pintar();
    } }, x.kw)));
    pintar();
    input.addEventListener('input', pintar);
    return caja;
  };
  const grupo = (g) => h('div', { class: 'card' }, h('h2', {}, GRUPOS_FICHA[g]),
    g === 'electrico' ? h('p', { class: 'muted' }, 'La potencia a contratar es la que pagará en su factura. Puede ser menor que la máxima de su instalación; elija una o escriba otra. Si no lo sabe, déjela vacía y se la indicaremos.') : null,
    h('div', { class: 'grid2' }, ...fijos(g),
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
      const wrap = h('div', { class: 'campo' + (o.peso >= 2 || ruta === 'electrico.potenciaContratar' ? ' ancho' : ''), 'data-campo': ruta }, h('label', { for: id }, etiqueta + (o.req ? ' *' : '')), input,
        ruta === 'electrico.potenciaContratar' ? chipsPotencia(input) : null, msg);
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
      const aviso = { numero: p.n, condiciones: { ref: p.ref }, cliente: {}, suministro: {}, electrico: { tension: el.t || '', uso: el.u || '', iga: el.i || '', potenciaCalculada: el.pc || '' } };
      for (const [ruta] of CAMPOS_FICHA) { const [g, k] = ruta.split('.'); aviso[g][k] = datos[ruta] || ''; }
      const [PDFLib, edist] = await Promise.all([cargarPdfLib(), logoEdist()]);
      const texto = textoVuelta(p, datos, firma);
      const bytes = await generarFicha(PDFLib, { aviso, empresa, logo: logoDeEnlace(p.e?.l), edist, firma: { ...firma, png: await lienzo.png() }, datosCliente: texto.split('\n').pop() });
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

  const e = p.e || {};
  const rgpd = h('details', { class: 'card rgpd', id: 'rgpd', open: true },
    h('summary', {}, h('b', {}, 'Protección de sus datos')),
    h('table', {}, h('tbody', {}, ...infoProteccionDatos(empresa).map(([t, x]) => h('tr', {}, h('th', { scope: 'row' }, t), h('td', {}, x))))));
  main.replaceChildren(
    h('div', { class: 'card', id: 'empresa-cab' },
      h('div', { class: 'empresa-cab' },
        e.l ? h('img', { src: e.l, alt: e.n || 'Logo de la empresa', id: 'empresa-logo' }) : null,
        h('div', {},
          h('b', { id: 'empresa-nombre' }, e.n || 'Su instalador'),
          h('div', { class: 'datos-emp', id: 'empresa-datos' },
            ...[e.rs && e.rs !== e.n ? e.rs : null, e.f ? 'NIF ' + e.f : null, e.d, [e.t, e.m].filter(Boolean).join(' · '), e.w].filter(Boolean).map((x) => h('div', {}, x)))))),
    h('div', { class: 'titulo-fila' }, h('h1', {}, 'Ficha de datos del cliente')),
    h('div', { class: 'card' },
      p.n ? h('div', { class: 'muted' }, `Aviso ${p.n}${p.ref ? ' · Ref. ' + p.ref : ''}`) : null,
      h('p', {}, `${e.n || 'Su instalador'} le pide estos datos para tramitar su suministro eléctrico. Revíselos y complete lo que falte (en rojo). Al terminar, firme y pulse «Preparar ficha firmada» para devolverla por WhatsApp o correo.`),
      h('p', { class: 'muted' }, 'Esta página no guarda nada ni envía nada por sí sola: los datos solo salen de su móvil cuando usted envía la ficha. Más abajo tiene la información sobre protección de datos.')),
    grupo('cliente'), grupo('suministro'), grupo('electrico'),
    rgpd,
    h('div', { class: 'card' }, h('h2', {}, 'CONFORMIDAD Y FIRMA'),
      h('p', { class: 'muted' }, 'Firme con el dedo (o el ratón) en el recuadro.'), lienzo.el,
      h('div', { class: 'fila' }, h('button', { class: 'btn peq', type: 'button', onclick: () => lienzo.borrar() }, 'Borrar firma')),
      h('label', { for: 'c-firmante' }, 'Nombre de quien firma'), firmante,
      h('label', { class: 'check-linea' }, acepto, ' Declaro que los datos son correctos, que he leído la información sobre protección de datos y autorizo su uso para tramitar la solicitud con la distribuidora y la comercializadora.'),
      h('div', { class: 'fila' }, h('button', { class: 'btn prim ancho', type: 'button', id: 'btn-preparar', onclick: enviar }, 'Preparar ficha firmada'))),
    resultado);
  for (const [ruta] of CAMPOS_FICHA) comprobar(ruta);
}
