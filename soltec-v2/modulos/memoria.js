// SOLTEC V2 · Formulario de la memoria CNMC dentro del aviso y generación del PDF.

import { h, toast, abrirBlob, compartir, descargar } from '../ui.js';
import { normalizarMemoria, totales, kw, TIPOS_SOLICITUD, USOS_FINCA, TENSIONES, ALMACENAMIENTO, generarMemoria } from '../core/memoria.js';
import { nombreMemoria, normalizarAviso } from '../core/model.js';
import { leerEmpresa } from './empresa.js';
import { cargarPdfLib } from './comunicaciones.js';

const opciones = (lista, valor, vacio = '—') => [h('option', { value: '' }, vacio), ...lista.map((o) => h('option', { value: o, selected: o === valor || null }, o))];

/**
 * Bloque editable. Modifica draft.memoria y avisa con alCambiar().
 * Si el aviso no tiene potencia, toma el total A+B+C+D.
 */
export function bloqueMemoria(app, draft, alCambiar, avisoId) {
  draft.memoria = normalizarMemoria(draft.memoria);
  const m = draft.memoria;
  const totalBox = h('div', { class: 'total-cnmc', id: 'total-cnmc' });
  const actualizarTotal = () => {
    const t = totales(m);
    totalBox.replaceChildren(h('span', {}, `A ${kw(t.A)} · B ${kw(t.B)} · C ${kw(t.C)} · D ${kw(t.D)} kW`), h('b', {}, `Total A+B+C+D: ${kw(t.total)} kW`));
    if (t.total && !String(draft.electrico?.potenciaKw || '').trim()) {
      draft.electrico.potenciaKw = kw(t.total);
      const p = document.getElementById('f-electrico-potenciaKw');
      if (p) p.value = draft.electrico.potenciaKw;
    }
  };
  const cambio = () => { actualizarTotal(); alCambiar(); };

  const sel = (obj, k, lista, etiqueta, id) => h('div', { class: 'campo' }, h('label', { for: id }, etiqueta),
    h('select', { id, onchange: (e) => { obj[k] = e.target.value; cambio(); } }, ...opciones(lista, obj[k])));
  const inp = (obj, k, etiqueta, id, modo) => h('div', { class: 'campo' }, h('label', { for: id }, etiqueta),
    h('input', { id, type: 'text', value: obj[k] || '', inputmode: modo, oninput: (e) => { obj[k] = e.target.value; cambio(); } }));
  const check = (obj, id, texto) => h('label', { class: 'check-linea' }, h('input', { type: 'checkbox', id, checked: obj.aplica || null, onchange: (e) => { obj.aplica = e.target.checked; cuerpoFila(e.target); cambio(); } }), ' ', texto);
  const cuerpoFila = (input) => { const c = input.closest('.fila-cnmc')?.querySelector('.grid2'); if (c) c.hidden = !input.checked; };

  const fila = (lista, i, campos, pref) => {
    const f = lista[i];
    const id = `${pref}-${i}`;
    return h('div', { class: 'fila-cnmc' }, check(f, id + '-aplica', f.nombre),
      h('div', { class: 'grid2', hidden: !f.aplica || null }, ...campos.map(([k, etq, tipo]) => tipo === 'tension' ? sel(f, k, TENSIONES, etq, `${id}-${k}`)
        : tipo === 'grado' ? sel(f, k, ['BÁSICA', 'ELEVADA'], etq, `${id}-${k}`)
          : inp(f, k, etq, `${id}-${k}`, tipo === 'num' ? 'decimal' : undefined))));
  };
  const apartado = (titulo, lista, campos, pref) => h('details', { class: 'sub' }, h('summary', {}, titulo), ...lista.map((_, i) => fila(lista, i, campos, pref)));
  const pot = ['potencia', 'Potencia (kW)', 'num'], ten = ['tension', 'Tensión', 'tension'];

  const resultado = h('div');
  const generar = async () => {
    if (app.guardia?.()) { toast('Guarda primero los cambios del aviso', true); return; }
    try {
      const blob = await crearMemoriaPdf(app, avisoId);
      const reg = await app.storage.get(avisoId);
      const nombre = nombreMemoria(reg.data);
      await app.storage.addEvent(avisoId, 'doc_preparada', `Memoria CNMC generada: ${nombre}`);
      resultado.replaceChildren(h('div', { class: 'aviso ok' }, h('b', {}, 'Memoria generada: '), nombre,
        h('div', { class: 'fila' },
          h('button', { class: 'btn peq', type: 'button', onclick: () => abrirBlob(blob) }, 'Ver'),
          h('button', { class: 'btn peq', type: 'button', onclick: () => compartir(blob, nombre) }, 'Compartir'),
          h('button', { class: 'btn peq', type: 'button', id: 'descargar-memoria', onclick: () => descargar(blob, nombre) }, 'Descargar'),
          h('button', { class: 'btn peq prim', type: 'button', onclick: async (e) => {
            const ficha = await app.storage.putFile({ name: nombre, mime: 'application/pdf', bytes: new Uint8Array(await blob.arrayBuffer()) });
            const a = normalizarAviso((await app.storage.get(avisoId)).data);
            if (!a.archivos.some((x) => x.hash === ficha.hash)) a.archivos.push({ tipo: 'memoria', ...ficha });
            await app.storage.save('aviso', a, { id: avisoId });
            e.target.disabled = true; e.target.textContent = 'Guardada en el aviso';
          } }, 'Guardar copia en el aviso'))));
    } catch (err) { toast(err.message, true); }
  };

  const ac = m.acumulacion, au = m.autoconsumo;
  const bloque = h('div', {},
    h('div', { class: 'grid2' },
      sel(m, 'tipoSolicitud', TIPOS_SOLICITUD, 'Tipo de solicitud', 'm-tipo'),
      sel(m, 'usoFinca', USOS_FINCA, 'Uso de la finca', 'm-uso'),
      h('div', { class: 'ancho' }, inp(m, 'cupsGas', 'CUPS gas (si existe)', 'm-cupsgas'))),
    h('p', { class: 'muted' }, 'Marca solo los conceptos que apliquen. El total se calcula solo y, si el aviso no tiene potencia, se usa como potencia del aviso.'),
    apartado('A. Viviendas', m.viviendas, [['escalera', 'Escalera'], ['piso', 'Piso'], ['puerta', 'Puerta'], pot, ten, ['grado', 'Grado de electrificación', 'grado']], 'm-viv'),
    apartado('B. Locales comerciales', m.locales, [['aclarador', 'Aclarador'], pot, ten, ['superficie', 'Superficie (m²)', 'num']], 'm-loc'),
    apartado('C. Servicios comunes', m.servicios, [['aclarador', 'Aclarador'], pot, ten], 'm-ser'),
    apartado('D. Garajes y recarga de VE', m.garajes, [['tipo', 'Tipo / nº de plazas'], pot, ten, ['superficie', 'Superficie (m²)', 'num']], 'm-gar'),
    h('details', { class: 'sub' }, h('summary', {}, 'E. Acumulación de energía'),
      h('div', { class: 'fila-cnmc' }, check(ac, 'm-acu-aplica', 'Aplica'),
        h('div', { class: 'grid2', hidden: !ac.aplica || null }, sel(ac, 'tipo', ALMACENAMIENTO, 'Tecnología', 'm-acu-tipo'), inp(ac, 'potencia', 'Potencia (kW)', 'm-acu-pot', 'decimal'), inp(ac, 'capacidad', 'Capacidad (kWh)', 'm-acu-cap', 'decimal')))),
    h('details', { class: 'sub' }, h('summary', {}, 'F. Generación asociada / autoconsumo'),
      h('div', { class: 'fila-cnmc' }, check(au, 'm-auto-aplica', 'Aplica'),
        h('div', { class: 'grid2', hidden: !au.aplica || null }, inp(au, 'consumo', 'Capacidad por consumo (kW)', 'm-auto-cons', 'decimal'), inp(au, 'generacion', 'Capacidad para generación (kW)', 'm-auto-gen', 'decimal'),
          h('p', { class: 'muted ancho' }, 'Si aplica, hay que adjuntar el esquema unifilar simplificado.')))),
    totalBox,
    avisoId ? h('div', { class: 'fila' }, h('button', { class: 'btn prim', type: 'button', id: 'generar-memoria', onclick: generar }, 'Generar memoria CNMC (PDF)')) : h('p', { class: 'muted' }, 'Guarda el aviso para generar la memoria.'),
    resultado);
  actualizarTotal();
  return bloque;
}

/** Reúne aviso, empresa, logos, plano y fotos, y genera el PDF. */
export async function crearMemoriaPdf(app, avisoId) {
  const [PDFLib, empresa, reg] = await Promise.all([cargarPdfLib(), leerEmpresa(app), app.storage.get(avisoId)]);
  const aviso = normalizarAviso(reg.data);
  const imagen = async (ficha) => {
    if (!ficha) return null;
    const f = await app.storage.getFile(ficha.hash);
    if (!f) return null;
    if (/png|jpe?g/.test(f.mime)) return { bytes: new Uint8Array(f.bytes), mime: f.mime };
    // Otros formatos (webp, svg, heic convertidas por el navegador) → PNG
    const url = URL.createObjectURL(new Blob([f.bytes], { type: f.mime }));
    try {
      const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error(`No se puede leer la imagen ${ficha.name}`)); i.src = url; });
      const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      cv.getContext('2d').drawImage(img, 0, 0);
      return { bytes: new Uint8Array(await (await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.85))).arrayBuffer()), mime: 'image/jpeg' };
    } finally { URL.revokeObjectURL(url); }
  };
  let edist = null;
  try { edist = { bytes: new Uint8Array(await (await fetch('./assets/logo_e-distribucion.jpg')).arrayBuffer()), mime: 'image/jpeg' }; } catch { /* sin logo */ }
  const fotos = [];
  for (const f of aviso.fotos || []) { const im = await imagen(f); if (im) fotos.push({ ...im, nombre: f.nombre || f.name, cgp: !!f.cgp }); }
  const plano = aviso.plano ? await imagen(aviso.plano) : null;
  const bytes = await generarMemoria(PDFLib, {
    aviso, empresa, edist, fotos,
    logo: await imagen(empresa.logo), firma: await imagen(empresa.firma), sello: await imagen(empresa.sello),
    plano: plano && { ...plano, nombre: aviso.plano.name },
    fecha: new Date().toLocaleDateString('es-ES'),
  });
  return new Blob([bytes], { type: 'application/pdf' });
}
