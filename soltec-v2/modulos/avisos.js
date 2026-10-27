// SOLTEC V2 · Capa 6 · Avisos y Expedientes: listados y ficha.
// Un expediente es un aviso con referencia o PDF de condiciones: misma ficha, distinto listado.

import { h, toast, fecha, fechaHora, abrirBlob, compartir, ir, confirmar, sugerencias, accionesContacto } from '../ui.js';
import { clientesConocidos, suministrosConocidos, buscarClientes, buscarSuministros, rellenoCliente, rellenoSuministro, valoresUsados, datosDeLocalidad, textoSuministro, normal } from '../core/autorrelleno.js';
import {
  nuevoAviso, normalizarAviso, siguienteNumero, isExpediente, conPdfCondiciones, pdfCondicionesActual, datosPendientes,
  docsPendientes, direccionCompleta, FASES_TRAMITE, DOCUMENTOS, ESTADOS_DOC, ESTADOS_AVISO, EVENTOS, EVENTOS_MANUALES, DESTINOS,
  separarNumero,
} from '../core/model.js';
import { buscar, duplicados } from '../core/search.js';
import { provinciaDeCp, formatearIban, validarCups, formatearTelefono } from '../core/validate.js';
import { bloqueSeguimiento } from './agenda.js';
import { bloqueComunicaciones, listaArchivos } from './comunicaciones.js';
import { bloqueMemoria } from './memoria.js';
import { usoFincaDeUso } from '../core/memoria.js';
import { bloqueUbicacion, bloquePlano, bloqueFotos } from './ubicacion.js';
import { bloqueCertificados } from './certificados.js';
import { bloqueCuadros } from './cuadros.js';
import { bloqueAutorizacion } from './autorizacion.js';
import { bloquePartes } from './partes.js';
import { calcularRecordatorios, tarjetasRecordatorios } from './recordatorios.js';
import { IGAS, potenciaDeIga, potenciasNormalizadas, problemaPotencia } from '../core/potencias.js';

const faseLabel = (id) => FASES_TRAMITE.find((f) => f.id === id)?.label || '';
const leer = (o, ruta) => ruta.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const escribir = (o, ruta, v) => { const ks = ruta.split('.'); let x = o; for (const k of ks.slice(0, -1)) x = x[k] ??= {}; x[ks.at(-1)] = v; };
const clonar = (o) => structuredClone(o);

// ---------------------------------------------------------------- listados
function tarjetaAviso(r) {
  const a = r.data;
  const faltan = datosPendientes(a).length;
  const docs = docsPendientes(a).length;
  return h('a', { class: 'tarjeta', href: `#/aviso/${r.id}` },
    h('div', { class: 'tarjeta-cab' }, h('span', { class: 'mono' }, a.numero || 'Sin número'), h('span', { class: 'etiqueta' }, a.estado || '')),
    h('b', {}, a.cliente?.nombre || '(sin nombre)'),
    h('div', { class: 'muted' }, direccionCompleta(a.suministro) || 'Sin dirección'),
    h('div', { class: 'insignias' },
      a.tramite ? h('span', { class: 'insignia' }, faseLabel(a.tramite)) : null,
      faltan ? h('span', { class: 'insignia pend' }, `${faltan} dato${faltan > 1 ? 's' : ''} pendiente${faltan > 1 ? 's' : ''}`) : null,
      docs ? h('span', { class: 'insignia pend' }, `${docs} doc. pendiente${docs > 1 ? 's' : ''}`) : null));
}

function tarjetaExpediente(r) {
  const a = r.data;
  const ind = (ok, txt) => h('span', { class: 'insignia' + (ok ? ' ok' : ' pend') }, (ok ? '✓ ' : '✗ ') + txt);
  return h('a', { class: 'tarjeta exp', href: `#/aviso/${r.id}` },
    h('div', { class: 'exp-cab' },
      h('div', {},
        h('div', { class: 'etq' }, 'AVISO'), h('div', { class: 'mono' }, a.numero || '—'),
        h('div', { class: 'etq' }, 'REF. CONDICIONES'), h('div', { class: 'mono' }, a.condiciones?.ref || (a.condiciones?.pdfs?.length ? 'Solo PDF' : '—'))),
      h('img', { class: 'logo-edist', src: './assets/logo_e-distribucion.jpg', alt: 'e-distribución' })),
    h('b', {}, a.cliente?.nombre || '(sin nombre)'),
    h('div', { class: 'muted' }, direccionCompleta(a.suministro)),
    h('div', { class: 'insignias' },
      ind(!validarCups(a.suministro?.cups), 'CUPS'),
      ind(a.docs?.contrato === 'recibido' || a.docs?.contrato === 'na', 'Contrato'),
      a.tramite ? h('span', { class: 'insignia' }, faseLabel(a.tramite)) : null));
}

async function listado(app, { expedientes }) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const papelera = params.get('ver') === 'papelera';
  const todos = await app.storage.list('aviso', papelera ? { onlyDeleted: true } : {});
  const base = papelera ? todos : todos.filter((r) => isExpediente(r.data) === expedientes);
  const ruta = expedientes ? 'expedientes' : 'avisos';
  const lista = h('div', { class: 'lista' });
  const pintar = (q) => {
    const regs = q.trim() ? buscar(base, q).map((x) => x.registro) : base;
    const orden = [...regs].sort((a, b) => (b.data.numero || '').localeCompare(a.data.numero || '') || b.updatedAt.localeCompare(a.updatedAt));
    lista.replaceChildren(...(orden.length ? orden.map((r) => (expedientes && !papelera ? tarjetaExpediente(r) : tarjetaAviso(r)))
      : [h('div', { class: 'card muted' }, q.trim() ? 'Sin resultados.' : papelera ? 'La papelera está vacía.' : expedientes ? 'Todavía no hay expedientes. Un aviso pasa aquí al tener referencia o PDF de condiciones.' : 'Todavía no hay avisos.')]));
  };
  const busca = h('input', { type: 'search', class: 'buscador', placeholder: 'Buscar: cliente, teléfono, dirección, CUPS, referencia…', oninput: (e) => pintar(e.target.value) });
  pintar('');
  return h('div', {},
    h('div', { class: 'titulo-fila' },
      h('h1', {}, papelera ? 'Papelera' : expedientes ? 'Expedientes' : 'Avisos'),
      expedientes || papelera ? null : h('a', { class: 'btn prim', href: '#/aviso/nuevo' }, '+ Nuevo aviso')),
    busca,
    h('div', { class: 'chips' },
      h('a', { class: 'chip' + (papelera ? '' : ' activo'), href: `#/${ruta}` }, expedientes ? 'Expedientes' : 'Activos'),
      h('a', { class: 'chip' + (papelera ? ' activo' : ''), href: `#/${ruta}?ver=papelera` }, 'Papelera')),
    lista);
}

export const vistaAvisos = (app) => listado(app, { expedientes: false });
export const vistaExpedientes = (app) => listado(app, { expedientes: true });

// ---------------------------------------------------------------- ficha
// [ruta, etiqueta, tipo, opciones]  · tipo: text|tel|email|select|textarea|numero
const CAMPOS_CLIENTE = [
  ['cliente.nombre', 'Cliente o razón social', 'text', { ancho: 2 }],
  ['cliente.contacto', 'Persona de contacto', 'text'],
  ['cliente.nif', 'DNI / NIF / CIF', 'text', { mayus: true }],
  ['cliente.telefono', 'Teléfono', 'tel'],
  ['suministro.provincia', 'Provincia', 'text'],
  ['suministro.poblacion', 'Población', 'text'],
  ['suministro.cp', 'Código postal', 'text', { inputmode: 'numeric' }],
  ['cliente.email', 'Correo electrónico', 'email', { ancho: 2 }],
  ['cliente.iban', 'IBAN', 'text', { ancho: 2, mayus: true }],
  ['suministro.direccion', 'Calle / vía del suministro', 'text', { ancho: 2 }],
  ['suministro.numero', 'Número', 'text'],
  ['suministro.piso', 'Piso', 'text'],
  ['suministro.puerta', 'Puerta', 'text'],
  ['suministro.cups', 'CUPS', 'text', { ancho: 2, mayus: true, mono: true }],
  ['suministro.refCatastral', 'Referencia catastral', 'text', { ancho: 2, mayus: true, mono: true }],
  ['suministro.lat', 'Latitud', 'text', { inputmode: 'decimal' }],
  ['suministro.lon', 'Longitud', 'text', { inputmode: 'decimal' }],
];
export { potenciaDeIga };
const CAMPOS_ELEC = [
  ['electrico.tension', 'Tensión', 'select', { opciones: [['', '—'], ['230', '230 V (monofásico)'], ['400', '400 V (trifásico)']] }],
  ['electrico.iga', 'IGA (A)', 'select', { opciones: [['', '—'], ...IGAS.map((a) => [String(a), a + ' A'])] }],
  ['electrico.potenciaCalculada', 'Potencia calculada (kW) · según IGA y tensión', 'text', { inputmode: 'decimal', soloLectura: true }],
  ['electrico.potenciaContratar', 'Potencia a contratar (kW) · con la comercializadora', 'text', { inputmode: 'decimal', placeholder: 'La que quiere el cliente', potencias: true }],
  ['electrico.potenciaKw', 'Potencia CNMC (kW) · la que va en la memoria', 'text', { inputmode: 'decimal', placeholder: '¿Qué potencia va en la CNMC?' }],
  ['electrico.contador', 'Contador', 'text'],
  ['electrico.contadorCercano', 'Contador cercano', 'text'],
  ['electrico.uso', 'Uso', 'select', { opciones: [['', '—'], ['vivienda', 'Vivienda'], ['local', 'Local comercial'], ['comunes', 'Servicios comunes'], ['garaje', 'Garaje / recarga'], ['nave', 'Nave'], ['otro', 'Otro']] }],
];
const CAMPOS_OBRA = [
  ['fecha', 'Fecha del aviso', 'date'],
  ['estado', 'Estado general', 'select', { opciones: ESTADOS_AVISO.map((e) => [e, e]) }],
  ['obra', 'Nombre de obra (por defecto, la dirección del suministro)', 'text', { ancho: 2 }],
  ['concepto', 'Concepto', 'text', { ancho: 2 }],
  ['observaciones', 'Observaciones', 'textarea', { ancho: 2 }],
];

export async function vistaFicha(app, id) {
  const esNuevo = id === 'nuevo' || id === 'duplicar';
  let registro = null;
  let draft;
  if (id === 'duplicar') {
    const origen = await app.storage.get(new URLSearchParams(location.hash.split('?')[1] || '').get('de'));
    if (!origen) { ir('avisos'); return h('div'); }
    const o = origen.data;
    draft = nuevoAviso({ cliente: clonar(o.cliente), facturacion: clonar(o.facturacion), suministro: clonar(o.suministro), electrico: clonar(o.electrico), obra: o.obra });
  } else if (esNuevo) {
    draft = nuevoAviso();
  } else {
    registro = await app.storage.get(id);
    if (!registro) return h('div', {}, h('h1', {}, 'Aviso no encontrado'), h('a', { class: 'btn', href: '#/avisos' }, 'Volver a avisos'));
    draft = normalizarAviso(clonar(registro.data));
  }
  const original = clonar(draft);
  let cambiado = false;
  // Aviso de cambios sin guardar al cambiar de pantalla o cerrar la pestaña
  app.guardia = () => cambiado; // la carcasa pregunta antes de salir si hay cambios
  const todos = await app.storage.list('aviso');

  // --- datos pendientes y duplicados, recalculados en cada cambio
  const resumen = h('div');
  const avisoDup = h('div');
  // Recordatorios automáticos de este aviso (condiciones, autorización o documentación sin respuesta)
  const recordatoriosEl = h('div', { id: 'recordatorios-aviso' });
  const pintarRecordatorios = async () => {
    if (!registro || registro.deleted) return;
    const items = await calcularRecordatorios(app, { avisos: [registro], avisoId: registro.id });
    recordatoriosEl.replaceChildren(...tarjetasRecordatorios(app, items, { enFicha: true, alCambiar: () => { pintarRecordatorios(); pintarHistorial(); } }));
  };
  const marcarPendientes = () => {
    const pend = datosPendientes(draft);
    const porCampo = new Map(pend.map((p) => [p.campo, p.problema]));
    for (const w of cont.querySelectorAll('.campo[data-campo]')) {
      const p = porCampo.get(w.dataset.campo);
      w.classList.toggle('pend', !!p);
      w.querySelector('.msg-pend').textContent = p || '';
    }
    const destinos = Object.entries(DESTINOS).map(([k, label]) => [label, datosPendientes(draft, k).length]);
    resumen.replaceChildren(pend.length
      ? h('div', { class: 'aviso err' },
        h('b', {}, `Faltan o hay que revisar ${pend.length} dato${pend.length > 1 ? 's' : ''}`),
        h('div', { class: 'destinos' }, ...destinos.map(([l, n]) => h('span', { class: 'insignia' + (n ? ' pend' : ' ok') }, `${l}: ${n ? n + ' pendiente' + (n > 1 ? 's' : '') : 'completo'}`))),
        h('div', { class: 'enlaces-pend' }, ...pend.map((p) => h('button', { class: 'enlace', type: 'button', onclick: () => irACampo(p.campo) }, p.etiqueta))),
        porCampo.has('cliente.iban') && !String(draft.cliente?.iban || '').trim() ? h('div', { class: 'fila' },
          h('button', { class: 'btn peq', type: 'button', id: 'sin-contrato', onclick: () => {
            draft.docs = { ...(draft.docs || {}), contrato: 'na' };
            const sel = cont.querySelector('#doc-contrato');
            if (sel) { sel.value = 'na'; sel.parentElement.classList.remove('pend'); }
            alCambiar();
            toast('Sin contrato: el IBAN ya no se pide (Documentos › Contrato: No aplica)');
          } }, 'No lleva contrato: no pedir IBAN')) : null)
      : h('div', { class: 'aviso ok' }, 'Datos completos para ficha, contrato y boletín.'));
  };
  const comprobarDuplicados = () => {
    const d = duplicados(draft, todos, registro?.id);
    avisoDup.replaceChildren(d.length ? h('div', { class: 'aviso info' },
      h('b', {}, 'Posible duplicado: '),
      ...d.map((x) => h('div', {}, `${x.registro.data.numero || 'Sin número'} · ${x.registro.data.cliente?.nombre || ''} (${x.motivos.join(' y ')}) `,
        h('a', { href: `#/aviso/${x.registro.id}`, target: '_blank' }, 'Ver')))) : '');
    return d;
  };
  const irACampo = (campo) => {
    const w = cont.querySelector(`.campo[data-campo="${campo}"]`);
    if (!w) return;
    const det = w.closest('details');
    if (det) det.open = true;
    w.scrollIntoView({ block: 'center', behavior: 'smooth' });
    w.querySelector('input,select,textarea')?.focus({ preventScroll: true });
  };
  const alCambiar = () => { cambiado = true; marcarPendientes(); };

  // --- autorrelleno con lo ya trabajado (clientes, suministros y valores usados otras veces)
  const conocidos = clientesConocidos(todos, { excluir: registro?.id });
  const sumsConocidos = suministrosConocidos(todos, { excluir: registro?.id });
  let clienteElegido = null;
  /** Escribe varios datos a la vez en el aviso y en sus campos. */
  const aplicar = (cambios) => {
    for (let [ruta, v] of Object.entries(cambios)) {
      if (ruta === 'cliente.telefono') v = formatearTelefono(v);
      escribir(draft, ruta, v);
      const el = cont.querySelector('#f-' + ruta.replace('.', '-'));
      if (el) {
        if (el.tagName === 'SELECT' && v && ![...el.options].some((o) => o.value === String(v))) el.append(h('option', { value: String(v) }, String(v)));
        el.value = v;
        el.dispatchEvent(new Event('soltec:valor')); // botones de llamar / correo
      }
      if (ruta === 'electrico.uso' && draft.memoria) { draft.memoria.usoFinca = usoFincaDeUso(v); const u = cont.querySelector('#m-uso'); if (u) u.value = draft.memoria.usoFinca; }
    }
    if (Object.keys(cambios).some((r) => r.startsWith('suministro.'))) { comprobarDuplicados(); obraDeDireccion(); }
    alCambiar();
    return Object.keys(cambios).length;
  };
  const opcionSuministro = (x) => ({ titulo: textoSuministro(x) || x.suministro.cups, sub: [x.suministro.cups, x.cliente, x.numero && 'aviso ' + x.numero].filter(Boolean).join(' · '), sum: x });
  const elegirSuministro = (campo) => (it) => {
    const n = aplicar(rellenoSuministro(draft, it.sum, campo));
    toast(n ? 'Suministro rellenado con lo del aviso ' + (it.sum.numero || 'anterior') : 'Ya estaba todo escrito');
    sumCliente.replaceChildren();
  };
  // Direcciones de suministro del cliente elegido, para elegir con un toque
  const sumCliente = h('div', { class: 'sum-cliente', id: 'sum-cliente' });
  const pintarSumCliente = () => {
    const ss = clienteElegido?.suministros || [];
    const hayDireccion = String(draft.suministro?.direccion || '').trim();
    sumCliente.replaceChildren(...(ss.length && !hayDireccion ? [
      h('div', { class: 'muted' }, ss.length === 1 ? 'Suministro de este cliente:' : `Suministros de este cliente (${ss.length}):`),
      h('div', { class: 'fila' }, ...ss.slice(0, 6).map((x) => h('button', { class: 'btn peq', type: 'button', onclick: () => { elegirSuministro('')(opcionSuministro({ ...x, cliente: '' })); } }, textoSuministro(x)))),
      h('div', { class: 'muted' }, 'O escribe una dirección nueva.')] : []));
  };
  const AUTO_CLIENTE = { 'cliente.nombre': 'nombre', 'cliente.contacto': 'contacto', 'cliente.nif': 'nif', 'cliente.telefono': 'telefono', 'cliente.email': 'email' };
  const AUTO_SUMINISTRO = { 'suministro.direccion': 'direccion', 'suministro.cups': 'cups', 'suministro.refCatastral': 'refCatastral' };
  const AUTO_VALORES = ['suministro.poblacion', 'suministro.provincia', 'suministro.cp', 'concepto', 'electrico.contador', 'electrico.contadorCercano'];
  /** Lista de sugerencias para un campo (o null si ese campo no tiene). */
  const sugerenciasDe = (ruta, input) => {
    if (AUTO_CLIENTE[ruta]) {
      const k = AUTO_CLIENTE[ruta];
      return sugerencias(input, {
        buscar: (t) => buscarClientes(conocidos, k, t).map((c) => ({ titulo: c.cliente.nombre, sub: [c.cliente.nif, c.cliente.telefono, c.cliente.email].filter(Boolean).join(' · ') + ` · ${c.avisos} aviso${c.avisos > 1 ? 's' : ''}`, c })),
        elegir: (it) => {
          aplicar(rellenoCliente(draft, it.c, k));
          clienteElegido = it.c;
          pintarSumCliente();
          toast(`Datos de ${it.c.cliente.nombre} rellenados`);
        },
      });
    }
    if (AUTO_SUMINISTRO[ruta]) {
      const k = AUTO_SUMINISTRO[ruta];
      return sugerencias(input, {
        alEnfocar: k === 'direccion',
        buscar: (t) => (t.trim() ? buscarSuministros(sumsConocidos, k, t) : (clienteElegido?.suministros || []).map((x) => ({ ...x, cliente: clienteElegido.cliente.nombre }))).map(opcionSuministro),
        elegir: elegirSuministro(k),
      });
    }
    if (AUTO_VALORES.includes(ruta)) {
      let usados = null;
      return sugerencias(input, {
        buscar: (t) => {
          usados ??= valoresUsados(todos, ruta);
          const q = normal(t);
          return usados.filter((v) => { const n = normal(v); return n !== q && (n.startsWith(q) || n.includes(' ' + q) || (q.length >= 3 && n.includes(q))); }).slice(0, 6).map((v) => ({ titulo: v, v }));
        },
        elegir: (it) => {
          const c = { [ruta]: it.v };
          if (ruta === 'suministro.poblacion' || ruta === 'suministro.cp') {
            const loc = datosDeLocalidad(todos, ruta === 'suministro.poblacion' ? { poblacion: it.v } : { cp: it.v });
            for (const [k, v] of Object.entries(loc)) if (!String(draft.suministro?.[k] || '').trim()) c['suministro.' + k] = v;
          }
          aplicar(c);
        },
      });
    }
    return null;
  };
  /** Escribe un dato desde otro módulo (localización, catastro…) en el aviso y en su campo. */
  const poner = (ruta, valor) => {
    escribir(draft, ruta, valor);
    const el = cont.querySelector('#f-' + ruta.replace('.', '-'));
    if (el) el.value = valor;
    if (ruta.startsWith('suministro.')) { comprobarDuplicados(); obraDeDireccion(); }
    alCambiar();
  };

  // --- un campo del formulario
  // Nombre de la obra: la dirección del suministro si no tiene otro
  if (!String(draft.obra || '').trim() && direccionCompleta(draft.suministro)) draft.obra = direccionCompleta(draft.suministro);
  let obraAuto = !String(draft.obra || '').trim() || draft.obra === direccionCompleta(draft.suministro);
  /** Nombre de la obra = dirección del suministro, mientras no se haya escrito otro. */
  const obraDeDireccion = () => {
    if (!obraAuto) return;
    draft.obra = direccionCompleta(draft.suministro);
    const ob = cont.querySelector('#f-obra'); if (ob) ob.value = draft.obra;
  };
  // Potencia calculada al día con el IGA y la tensión guardados
  if (draft.electrico && !String(draft.electrico.potenciaCalculada || '').trim()) { const kw = potenciaDeIga(draft.electrico.iga, draft.electrico.tension); if (kw) draft.electrico.potenciaCalculada = kw; }
  const campo = ([ruta, etiqueta, tipo, o = {}]) => {
    const idc = 'f-' + ruta.replace('.', '-');
    let ctrl;
    const valor = leer(draft, ruta) ?? '';
    const on = (e) => {
      let v = e.target.value;
      if (o.mayus && v !== v.toUpperCase()) {
        const pos = e.target.selectionStart;
        v = v.toUpperCase();
        e.target.value = v;
        try { e.target.setSelectionRange(pos, pos); } catch { /* select no tiene cursor */ }
      }
      escribir(draft, ruta, v);
      if (ruta === 'suministro.cp' && /^\d{5}$/.test(v) && !draft.suministro.provincia) {
        draft.suministro.provincia = provinciaDeCp(v);
        const p = cont.querySelector('#f-suministro-provincia');
        if (p) p.value = draft.suministro.provincia;
      }
      if (['suministro.cups', 'suministro.direccion', 'suministro.numero', 'suministro.piso', 'suministro.puerta', 'suministro.cp'].includes(ruta)) comprobarDuplicados();
      if (ruta === 'electrico.uso' && draft.memoria) {
        // El uso pasa también a «Uso de la finca» de la memoria CNMC
        draft.memoria.usoFinca = usoFincaDeUso(v);
        const u = cont.querySelector('#m-uso'); if (u) u.value = draft.memoria.usoFinca;
      }
      if (['suministro.direccion', 'suministro.numero', 'suministro.piso', 'suministro.puerta', 'suministro.cp', 'suministro.poblacion'].includes(ruta)) obraDeDireccion();
      if (ruta === 'obra') obraAuto = !v.trim() || v === direccionCompleta(draft.suministro);
      if (ruta === 'electrico.iga' || ruta === 'electrico.tension') {
        const kw = potenciaDeIga(draft.electrico?.iga, draft.electrico?.tension);
        escribir(draft, 'electrico.potenciaCalculada', kw);
        const c = cont.querySelector('#f-electrico-potenciaCalculada'); if (c) c.value = kw;
        pintarPotencias();
        if (kw && !String(draft.electrico?.potenciaKw || '').trim()) cont.querySelector('#f-electrico-potenciaKw')?.focus();
      }
      alCambiar();
    };
    // Un valor guardado que no está en la lista (p. ej. un IGA antiguo) se conserva como opción
    const opciones = tipo === 'select' && String(valor) && !o.opciones.some(([v]) => v === String(valor)) ? [...o.opciones, [String(valor), String(valor)]] : o.opciones;
    if (tipo === 'select') ctrl = h('select', { id: idc, onchange: on }, ...opciones.map(([v, t]) => h('option', { value: v, selected: String(valor) === v || null }, t)));
    else if (tipo === 'textarea') ctrl = h('textarea', { id: idc, rows: 3, oninput: on, value: valor });
    else ctrl = h('input', { id: idc, type: tipo === 'date' ? 'date' : tipo === 'email' ? 'email' : tipo === 'tel' ? 'tel' : 'text', value: valor, inputmode: o.inputmode, class: o.mono ? 'mono' : null, autocomplete: 'off', oninput: on, readonly: o.soloLectura || null, placeholder: o.placeholder || null,
      onblur: ruta === 'cliente.iban' ? (e) => { const f = formatearIban(e.target.value); if (f) { e.target.value = f; escribir(draft, ruta, f); } }
        : ruta === 'cliente.telefono' ? (e) => { const f = formatearTelefono(e.target.value); if (f !== e.target.value) { e.target.value = f; escribir(draft, ruta, f); alCambiar(); } }
        : ruta === 'suministro.direccion' ? (e) => {
          // Si el número se escribió junto a la calle y su campo está vacío, se pasa a su sitio
          if (String(draft.suministro.numero || '').trim()) return;
          const { calle, numero } = separarNumero(e.target.value);
          if (!numero) return;
          e.target.value = calle; escribir(draft, 'suministro.direccion', calle);
          escribir(draft, 'suministro.numero', numero);
          const n = cont.querySelector('#f-suministro-numero'); if (n) n.value = numero;
          obraDeDireccion();
          comprobarDuplicados(); alCambiar();
        } : null });
    const sug = ctrl.tagName === 'INPUT' && !o.soloLectura && !o.potencias ? sugerenciasDe(ruta, ctrl) : null;
    // Potencia a contratar: botones con las potencias normalizadas hasta la que admite el IGA
    const potencias = o.potencias ? cajaPotencias : null;
    if (o.potencias) { ctrlPotencia = ctrl; ctrl.addEventListener('input', () => avisoPotencia()); }
    // Llamar / WhatsApp / correo al cliente directamente desde la ficha
    const contacto = ruta === 'cliente.telefono' ? accionesContacto(ctrl, 'telefono')
      : ruta === 'cliente.email' ? accionesContacto(ctrl, 'correo', { asunto: () => ['Aviso', draft.numero, direccionCompleta(draft.suministro)].filter(Boolean).join(' ') }) : null;
    return h('div', { class: 'campo' + (o.ancho === 2 ? ' ancho' : ''), 'data-campo': ruta }, h('label', { for: idc }, etiqueta), ctrl, sug, potencias, contacto, h('div', { class: 'msg-pend' }), o.potencias ? msgPotencia : null);
  };
  // --- potencia a contratar
  let ctrlPotencia = null;
  const cajaPotencias = h('div', { class: 'chips potencias', id: 'potencias-normalizadas' });
  const msgPotencia = h('div', { class: 'msg-potencia', id: 'msg-potencia' });
  const avisoPotencia = () => { msgPotencia.textContent = problemaPotencia(draft.electrico?.potenciaContratar, draft.electrico?.potenciaCalculada) || ''; };
  const pintarPotencias = () => {
    const el = draft.electrico || {};
    const lista = potenciasNormalizadas(el.tension, el.potenciaCalculada);
    cajaPotencias.replaceChildren(...lista.map((p) => h('button', { class: 'chip' + (String(el.potenciaContratar || '') === p.kw ? ' activo' : ''), type: 'button', 'data-kw': p.kw, title: `${p.a} A`, onclick: () => {
      escribir(draft, 'electrico.potenciaContratar', p.kw);
      if (ctrlPotencia) ctrlPotencia.value = p.kw;
      pintarPotencias(); avisoPotencia(); alCambiar();
    } }, p.kw)));
    cajaPotencias.hidden = !lista.length;
    avisoPotencia();
  };
  pintarPotencias();
  const seccion = (titulo, abierta, ...hijos) => h('details', { class: 'card', open: abierta || null }, h('summary', {}, titulo), h('div', { class: 'cuerpo' }, ...hijos));

  // --- condiciones y trámite
  const listaPdfs = h('div');
  const pintarPdfs = () => {
    const pdfs = draft.condiciones.pdfs || [];
    listaPdfs.replaceChildren(pdfs.length ? h('ul', { class: 'lista-chk' }, ...[...pdfs].reverse().map((p, i) => h('li', {},
      h('span', { class: 'ico' }, i === 0 ? '●' : '○'),
      h('span', { style: 'flex:1;min-width:0' }, h('div', { class: 'cortar' }, p.name), h('div', { class: 'muted' }, `${i === 0 ? 'Actual' : 'Versión anterior'} · ${fechaHora(p.addedAt)} · ${Math.round(p.size / 1024)} KB`)),
      h('button', { class: 'btn peq', type: 'button', onclick: async () => { const b = await app.storage.getFileBlob(p.hash); b ? abrirBlob(b) : toast('El PDF aún no está en este dispositivo: sincroniza.', true); } }, 'Ver'),
      h('button', { class: 'btn peq', type: 'button', onclick: async () => { const b = await app.storage.getFileBlob(p.hash); b ? compartir(b, p.name) : toast('El PDF aún no está en este dispositivo: sincroniza.', true); } }, 'Compartir'))))
      : h('p', { class: 'muted' }, 'Sin PDF de condiciones.'));
  };
  const pdfsNuevos = [];
  const subirPdf = h('input', { type: 'file', accept: 'application/pdf,.pdf', style: 'display:none', onchange: async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const ficha = await app.storage.putFile(f);
    const antes = draft.condiciones.pdfs.length;
    Object.assign(draft, conPdfCondiciones(draft, ficha));
    if (draft.condiciones.pdfs.length === antes) { toast('Ese PDF ya estaba guardado'); return; }
    pdfsNuevos.push(ficha);
    pintarPdfs();
    alCambiar();
    toast('PDF añadido. Pulsa Guardar.');
  } });
  pintarPdfs();

  // --- documentación
  const docsCtrl = h('div', { class: 'grid2' }, ...DOCUMENTOS.map((d) => {
    const sel = h('select', { id: 'doc-' + d.id, onchange: (e) => { draft.docs[d.id] = e.target.value; sel.parentElement.classList.toggle('pend', e.target.value === 'pendiente'); alCambiar(); } },
      ...ESTADOS_DOC.map((s) => h('option', { value: s.id, selected: (draft.docs?.[d.id] || 'revisar') === s.id || null }, s.label)));
    return h('div', { class: 'campo' + (draft.docs?.[d.id] === 'pendiente' ? ' pend' : '') }, h('label', { for: 'doc-' + d.id }, d.label), sel);
  }));

  // --- historial
  const histLista = h('div');
  const pintarHistorial = async () => {
    if (!registro) { histLista.replaceChildren(h('p', { class: 'muted' }, 'El historial empieza al guardar el aviso.')); return; }
    const ev = (await app.storage.history(registro.id)).reverse();
    histLista.replaceChildren(h('ul', { class: 'lista-chk' }, ...ev.map((e) => h('li', {},
      h('span', { class: 'ico muted' }, '•'),
      h('span', {}, h('b', {}, EVENTOS[e.data.kind] || e.data.kind), e.data.text && e.data.text !== EVENTOS[e.data.kind] ? h('div', {}, e.data.text) : null, h('div', { class: 'muted' }, fechaHora(e.data.at)))))));
  };
  const tipoMov = h('select', { id: 'mov-tipo' }, ...EVENTOS_MANUALES.map((k) => h('option', { value: k }, EVENTOS[k])));
  const textoMov = h('input', { type: 'text', id: 'mov-texto', placeholder: 'Detalle (opcional)' });
  pintarHistorial();

  // --- guardar
  const guardar = async () => {
    const nuevoReg = !registro;
    if (!nuevoReg) {
      const actual = await app.storage.get(registro.id);
      if (actual && actual.updatedAt !== registro.updatedAt) {
        // Otro dispositivo lo cambió mientras lo editabas (llegó por sincronización).
        if (!(await confirmar('Este aviso se ha modificado en otro dispositivo mientras lo editabas.\n\n«Guardar los míos»: tus cambios quedan encima.\n«Ver la nueva»: no se guarda y se abre la versión nueva.', { si: 'Guardar los míos', no: 'Ver la nueva' }))) {
          cambiado = false;
          window.dispatchEvent(new HashChangeEvent('hashchange'));
          return;
        }
      }
    }
    if (nuevoReg) {
      const d = comprobarDuplicados();
      if (d.length && !(await confirmar(`Hay ${d.length} aviso(s) con el mismo CUPS o la misma dirección.\n\n${d.map((x) => `· ${x.registro.data.numero} ${x.registro.data.cliente?.nombre || ''}`).join('\n')}\n\n¿Es otra actuación y quieres crear el aviso igualmente?`, { si: 'Crear igualmente' }))) return;
      draft.numero = siguienteNumero(await app.storage.list('aviso', { includeDeleted: true }));
    }
    // Eventos del historial según lo que cambió
    const eventos = [];
    if (!nuevoReg) {
      if (original.tramite !== draft.tramite) eventos.push({ kind: 'tramite', text: `${faseLabel(original.tramite)} → ${faseLabel(draft.tramite)}` });
      for (const d of DOCUMENTOS) {
        const a = original.docs?.[d.id], b = draft.docs?.[d.id];
        if (a !== b) eventos.push({ kind: 'documento', text: `${d.label}: ${ESTADOS_DOC.find((s) => s.id === b)?.label}` });
      }
      if (original.docs?.firmado !== 'recibido' && draft.docs?.firmado === 'recibido') eventos.push({ kind: 'firma_recibida', text: 'PDF firmado del cliente recibido' });
    }
    if (!nuevoReg && (original.cuadro?.actualizado || '') !== (draft.cuadro?.actualizado || '')) eventos.push({ kind: 'actualizado', text: draft.cuadro?.proyecto ? 'Cuadro eléctrico actualizado' : 'Cuadro eléctrico quitado' });
    if (!nuevoReg && (original.autorizacion?.actualizado || '') !== (draft.autorizacion?.actualizado || '')) eventos.push({ kind: 'actualizado', text: draft.autorizacion?.datos ? 'Autorización de representatividad actualizada' : 'Autorización de representatividad quitada' });
    for (const p of pdfsNuevos) eventos.push({ kind: 'condiciones_pdf', text: p.name });
    const r = await app.storage.save('aviso', draft, { id: registro?.id, event: nuevoReg ? { kind: 'creado', text: `Aviso ${draft.numero} creado` } : eventos.length ? null : { kind: 'actualizado', text: 'Datos actualizados' } });
    for (const ev of eventos) await app.storage.addEvent(r.id, ev.kind, ev.text);
    cambiado = false;
    toast(nuevoReg ? `Aviso ${draft.numero} creado` : 'Guardado');
    if (nuevoReg) ir('aviso/' + r.id);
    else { registro = r; Object.assign(original, clonar(draft)); pdfsNuevos.length = 0; pintarHistorial(); pintarRecordatorios(); }
  };

  const seguimiento = registro ? await bloqueSeguimiento(app, registro.id) : null;
  const comunicaciones = registro ? await bloqueComunicaciones(app, registro.id) : null;
  const partes = registro ? await bloquePartes(app, registro.id) : null;
  const titulo = registro ? `Aviso ${draft.numero}` : id === 'duplicar' ? 'Nuevo aviso (copia)' : 'Nuevo aviso';
  const planoEl = bloquePlano(app, draft, alCambiar);
  const certificados = await bloqueCertificados(app, draft, alCambiar, planoEl, async (ficha) => {
    draft.archivos = (draft.archivos || []).filter((x) => x.tipo !== ficha.tipo); // la copia nueva sustituye a la anterior
    draft.archivos.push(ficha);
    await guardar();
  });
  const cont = h('form', { class: 'ficha', onsubmit: (e) => { e.preventDefault(); guardar(); } },
    h('div', { class: 'titulo-fila' },
      h('div', {}, h('h1', {}, titulo), registro && isExpediente(draft) ? h('span', { class: 'insignia ok' }, 'Expediente') : null, draft.v1?.id ? h('span', { class: 'insignia', style: 'margin-left:6px' }, `V1.35 nº ${draft.v1.id}`) : null),
      h('a', { class: 'btn', href: registro && isExpediente(draft) ? '#/expedientes' : '#/avisos' }, 'Volver')),
    registro?.deleted ? h('div', { class: 'aviso err' }, 'Este aviso está en la papelera. ', h('button', { class: 'btn peq', type: 'button', onclick: async () => { await app.storage.restore(registro.id); toast('Recuperado'); window.dispatchEvent(new HashChangeEvent('hashchange')); } }, 'Recuperar')) : null,
    resumen, recordatoriosEl, avisoDup,
    seccion('Plano de situación y fotografías', false, h('label', {}, 'Plano de situación'), planoEl, h('label', {}, 'Fotografías'), bloqueFotos(app, draft, alCambiar)),
    seccion('Cliente y suministro', esNuevo, h('div', { class: 'grid2' }, ...CAMPOS_CLIENTE.flatMap((c) => (c[0] === 'suministro.direccion' ? [sumCliente, campo(c)] : [campo(c)]))), bloqueUbicacion(app, draft, poner, alCambiar, { alEncontrar: () => planoEl.generar({ auto: true }) })),
    seccion('Datos eléctricos', false, h('div', { class: 'grid2' }, ...CAMPOS_ELEC.map(campo))),
    seccion('Memoria técnica CNMC', false, bloqueMemoria(app, draft, alCambiar, registro?.id, async (ficha) => {
      if (!draft.archivos.some((x) => x.hash === ficha.hash)) draft.archivos.push(ficha);
      await guardar();
    })),
    seccion('Autorización de representatividad', false, bloqueAutorizacion(app, draft, alCambiar, () => guardar())),
    seccion('Condiciones y trámite', false,
      h('div', { class: 'grid2' },
        campo(['condiciones.ref', 'Referencia de condiciones', 'text', { mono: true, mayus: true }]),
        campo(['tramite', 'Estado del trámite', 'select', { opciones: FASES_TRAMITE.map((f) => [f.id, f.label]) }])),
      h('label', {}, 'PDF de condiciones (se guardan todas las versiones)'), listaPdfs,
      h('div', { class: 'fila' }, h('button', { class: 'btn', type: 'button', onclick: () => subirPdf.click() }, 'Añadir PDF de condiciones'), subirPdf)),
    seccion('Documentación', false, docsCtrl, h('p', { class: 'muted' }, 'Marcar «Recibido» registra la recepción; no adjunta ningún archivo.'), listaArchivos(app, draft)),
    registro ? seccion('Solicitudes y comunicaciones', false, comunicaciones) : null,
    seccion('Cuadros eléctricos', false, bloqueCuadros(app, draft, alCambiar, () => guardar())),
    seccion('Certificados', false, certificados),
    seccion('Obra, fecha y observaciones', false, h('div', { class: 'grid2' }, ...CAMPOS_OBRA.map(campo),
      campo(['presupuesto.numero', 'Nº de presupuesto (si corresponde)', 'text']))),
    registro ? seccion('Seguimiento', false, seguimiento) : null,
    registro ? seccion('Partes de trabajo', false, partes) : null,
    seccion('Historial', false, histLista,
      registro ? h('div', { class: 'grid2', style: 'margin-top:8px' },
        h('div', { class: 'campo' }, h('label', { for: 'mov-tipo' }, 'Registrar movimiento'), tipoMov),
        h('div', { class: 'campo' }, h('label', { for: 'mov-texto' }, 'Detalle'), textoMov),
        h('div', { class: 'fila ancho' }, h('button', { class: 'btn', type: 'button', onclick: async () => {
          await app.storage.addEvent(registro.id, tipoMov.value, textoMov.value.trim() || EVENTOS[tipoMov.value]);
          textoMov.value = '';
          pintarHistorial();
          toast('Movimiento registrado');
        } }, 'Añadir al historial'))) : null),
    registro && !registro.deleted ? h('div', { class: 'fila' },
      h('a', { class: 'btn', href: `#/aviso/duplicar?de=${registro.id}` }, 'Duplicar con los mismos datos'),
      h('button', { class: 'btn', type: 'button', onclick: async () => {
        if (!(await confirmar('¿Enviar este aviso a la papelera? Podrás recuperarlo.', { si: 'Enviar a la papelera', peligro: true }))) return;
        await app.storage.trash(registro.id);
        toast('Enviado a la papelera');
        ir('avisos');
      } }, 'Enviar a la papelera')) : null,
    h('div', { class: 'barra-guardar' }, h('button', { class: 'btn prim ancho', type: 'submit', id: 'guardar' }, registro ? 'Guardar cambios' : 'Crear aviso')));

  marcarPendientes();
  comprobarDuplicados();
  pintarRecordatorios();
  // «Completar datos» desde Inicio: abre el desplegable y lleva al campo
  const pedido = new URLSearchParams(location.hash.split('?')[1] || '').get('campo');
  if (pedido) setTimeout(() => irACampo(pedido), 60);
  return cont;
}
