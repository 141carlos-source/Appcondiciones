// SOLTEC V2 · Pestaña «Certificados» del aviso (por ahora: medición de la toma de tierra).

import { h, toast, abrirBlob, compartir, descargar, sugerencias } from '../ui.js';
import { clientesConocidos, buscarClientes, textoSuministro } from '../core/autorrelleno.js';
import { formatearTelefono } from '../core/validate.js';
import { normalizarAviso, hoyLocal } from '../core/model.js';
import { ID_EMPRESA } from '../core/empresa.js';
import {
  TIPOS_CERTIFICADO, METODOS_TIERRA, ELECTRODOS, TERRENOS, SENSIBILIDADES, normalizarCertTierra, evaluarTierra, fmt,
  medidorVacio, nombreMedidor, estadoCalibracion, generarCertTierra, nombreCertTierra, partesCertificado, faltaTitular,
} from '../core/certificados.js';
import { leerEmpresa } from './empresa.js';
import { cargarPdfLib, imagenParaPdf } from './comunicaciones.js';
import { bloqueFotos } from './ubicacion.js';

const nuevoId = () => 'med_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Guarda la lista de equipos de medida en la empresa (se sincroniza con todos los dispositivos). */
async function guardarMedidores(app, cambiar) {
  const reg = await app.storage.get(ID_EMPRESA);
  const d = { ...(reg?.data || {}) };
  d.medidores = Array.isArray(d.medidores) ? [...d.medidores] : [];
  cambiar(d);
  await app.storage.save('config', d, { id: ID_EMPRESA });
  return d;
}

/** Formato del PDF guardado: 2 = con «Solicitante» y «Titular de la instalación» por separado. */
export const FORMATO_CERT = 2;
/** Certificados de tierra guardados con un formato anterior (para rehacerlos). */
export const certificadosAntiguos = (avisos) => avisos.filter((r) => !r.deleted && r.data?.certificados?.tierra
  && (r.data.archivos || []).some((a) => a.tipo === 'cert_tierra' && (a.formato || 1) < FORMATO_CERT));

/**
 * Rehace con el formato nuevo los certificados de tierra ya guardados, con los datos que tiene cada aviso.
 * Si a un aviso le falta en este dispositivo alguna foto o el plano, se salta (no sale peor que el que había).
 * @returns {{rehechos: string[], saltados: {numero, faltan}[]}}
 */
export async function rehacerCertificados(app, alProgreso = () => {}) {
  const lista = certificadosAntiguos(await app.storage.list('aviso'));
  const out = { rehechos: [], saltados: [] };
  for (const [i, r] of lista.entries()) {
    alProgreso(i, lista.length, r.data.numero);
    try {
      const { bytes, nombre, faltan } = await crearCertificadoTierra(app, r.data);
      if (faltan.length) { out.saltados.push({ numero: r.data.numero, faltan }); continue; }
      const ficha = await app.storage.putFile({ name: nombre, mime: 'application/pdf', bytes });
      const actual = await app.storage.get(r.id); // por si cambió mientras tanto
      const d = { ...actual.data };
      d.archivos = (d.archivos || []).filter((a) => a.tipo !== 'cert_tierra');
      d.archivos.push({ tipo: 'cert_tierra', hash: ficha.hash, name: ficha.name, mime: 'application/pdf', size: ficha.size, addedAt: new Date().toISOString(), formato: FORMATO_CERT });
      await app.storage.save('aviso', d, { id: r.id, event: { kind: 'documento', text: 'Certificado de toma de tierra rehecho con solicitante y titular de la instalación' } });
      out.rehechos.push(r.data.numero);
    } catch (e) { out.saltados.push({ numero: r.data.numero, faltan: [e.message] }); }
  }
  alProgreso(lista.length, lista.length, '');
  return out;
}

/** Bloque de Ajustes: rehacer los certificados ya hechos con el formato nuevo. */
export function bloqueCertificadosAntiguos(app) {
  const caja = h('div', { id: 'bloque-cert-antiguos' });
  const pintar = async () => {
    const n = certificadosAntiguos(await app.storage.list('aviso')).length;
    caja.replaceChildren(n
      ? h('div', {},
        h('p', {}, `${n} certificado${n > 1 ? 's' : ''} de toma de tierra guardado${n > 1 ? 's' : ''} con el formato anterior (sin «Solicitante» y «Titular» por separado).`),
        h('p', { class: 'muted' }, 'Se rehacen con los datos de cada aviso: solicitante = cliente del aviso; titular = el mismo, salvo que en el certificado se haya marcado otro. El PDF anterior se sustituye.'),
        h('div', { class: 'fila' }, h('button', { class: 'btn prim', type: 'button', id: 'rehacer-certificados', onclick: async (e) => {
          e.target.disabled = true;
          const prog = h('p', { class: 'muted', id: 'rehacer-progreso' });
          caja.append(prog);
          const r = await rehacerCertificados(app, (i, t, num) => { prog.textContent = i < t ? `Rehaciendo ${i + 1} de ${t}… (aviso ${num})` : 'Terminado.'; });
          toast(`Rehechos ${r.rehechos.length}${r.saltados.length ? ` · ${r.saltados.length} sin rehacer` : ''}`, !!r.saltados.length);
          await pintar();
          if (r.rehechos.length || r.saltados.length) caja.append(h('div', { class: 'aviso ' + (r.saltados.length ? 'info' : 'ok'), id: 'rehacer-resultado' },
            r.rehechos.length ? h('div', {}, h('b', {}, 'Rehechos: '), r.rehechos.join(', ')) : null,
            ...r.saltados.map((x) => h('div', {}, h('b', {}, `Aviso ${x.numero}: `), `no se ha rehecho porque falta en este dispositivo: ${x.faltan.join(', ')}. Sincroniza o hazlo desde un dispositivo que lo tenga.`))));
        } }, `Rehacer ${n > 1 ? 'los ' + n : 'el'} certificado${n > 1 ? 's' : ''}`)))
      : h('p', { class: 'muted' }, 'Todos los certificados de toma de tierra están con el formato actual (solicitante y titular).'));
  };
  pintar();
  return caja;
}

/**
 * PDF del certificado de tierra de un aviso con lo que hay en este dispositivo.
 * @returns {{bytes, nombre, faltan: string[]}}  faltan = imágenes que no están en este dispositivo (fotos, plano…)
 */
export async function crearCertificadoTierra(app, avisoData) {
  const aviso = normalizarAviso(avisoData);
  const c = normalizarCertTierra(aviso.certificados?.tierra);
  const [PDFLib, emp] = await Promise.all([cargarPdfLib(), leerEmpresa(app)]);
  const medidor = (Array.isArray(emp.medidores) ? emp.medidores : []).find((m) => m.id === c.medidorId) || null;
  const faltan = [];
  const im = async (f, que) => { if (!f) return null; const x = await imagenParaPdf(app, f).catch(() => null); if (!x) faltan.push(que); return x; };
  const fotos = [];
  for (const [i, f] of c.fotos.entries()) { const x = await im(f, `foto ${i + 1}`); if (x) fotos.push({ ...x, nombre: f.nombre || '' }); }
  const bytes = await generarCertTierra(PDFLib, { aviso, empresa: emp, cert: c, medidor, logo: await im(emp.logo, 'logo'), firma: await im(emp.firma, 'firma'), sello: await im(emp.sello, 'sello'), plano: aviso.plano ? await im(aviso.plano, 'plano') : null, fotos });
  return { bytes, nombre: nombreCertTierra(aviso), faltan, medidor };
}

/**
 * @param planoEl  bloque del plano del aviso (para generarlo si falta)
 * @param guardarArchivo  (ficha) => guarda el PDF en los documentos del aviso
 */
export async function bloqueCertificados(app, draft, alCambiar, planoEl, guardarArchivo) {
  draft.certificados = draft.certificados && typeof draft.certificados === 'object' ? draft.certificados : {};
  let empresa = await leerEmpresa(app);
  const conocidos = clientesConocidos(await app.storage.list('aviso'));
  const cont = h('div', { id: 'bloque-certificados' });
  const tipo = h('select', { id: 'cert-tipo', onchange: () => pintar() },
    h('option', { value: '' }, 'Elige un certificado…'),
    ...TIPOS_CERTIFICADO.map((t) => h('option', { value: t.id }, t.label)));

  const pintar = () => {
    if (tipo.value === 'tierra') cont.replaceChildren(formTierra());
    else cont.replaceChildren(h('p', { class: 'muted' }, 'Elige el certificado que quieres preparar.'));
  };

  const formTierra = () => {
    draft.certificados.tierra = normalizarCertTierra(draft.certificados.tierra);
    const c = draft.certificados.tierra;
    if (!c.fecha) c.fecha = hoyLocal();
    const medidores = () => (Array.isArray(empresa.medidores) ? empresa.medidores : []);
    if (!c.medidorId && empresa.medidorPorDefecto && medidores().some((m) => m.id === empresa.medidorPorDefecto)) c.medidorId = empresa.medidorPorDefecto;
    const cambio = () => { alCambiar(); pintarResultado(); };

    const txt = (k, etq, extra = {}) => h('div', { class: 'campo' + (extra.ancho ? ' ancho' : '') }, h('label', { for: 'ct-' + k }, etq),
      h('input', { id: 'ct-' + k, type: extra.tipo || 'text', value: c[k] || '', inputmode: extra.inputmode, placeholder: extra.ph, oninput: (e) => { c[k] = e.target.value; cambio(); } }));
    const sel = (k, etq, lista, extra = {}) => h('div', { class: 'campo' + (extra.ancho ? ' ancho' : '') }, h('label', { for: 'ct-' + k }, etq),
      h('select', { id: 'ct-' + k, onchange: (e) => { c[k] = e.target.value; cambio(); } },
        ...lista.map((v) => { const [val, t] = Array.isArray(v) ? v : [v, v]; return h('option', { value: val, selected: String(c[k]) === String(val) || null }, t); })));
    const chk = (k, etq) => h('label', { class: 'check-linea' }, h('input', { type: 'checkbox', id: 'ct-' + k, checked: c[k] || null, onchange: (e) => { c[k] = e.target.checked; cambio(); } }), ' ' + etq);

    // Resultado en directo
    const resultado = h('div', { class: 'card', id: 'cert-resultado' });
    const pintarResultado = () => {
      const ev = evaluarTierra(c);
      if (!ev.completo) { resultado.className = 'aviso info'; resultado.replaceChildren('Escribe la resistencia medida para ver el resultado.'); return; }
      resultado.className = 'aviso ' + (ev.apto ? 'ok' : 'err');
      resultado.replaceChildren(...[
        h('b', {}, ev.apto ? `APTO · ${fmt(ev.R)} Ω` : `NO APTO · ${fmt(ev.R)} Ω`),
        h('div', {}, `Tensión de contacto: ${fmt(ev.R)} Ω × ${fmt(ev.I / 1000, 3)} A = ${fmt(ev.uc)} V ${ev.okUc ? '≤' : '>'} ${ev.limiteUc} V (ITC-BT-18). Con este diferencial el máximo sería ${fmt(ev.rMaxUc, 0)} Ω.`),
        c.refViviendas ? h('div', {}, `Referencia ITC-BT-26 (viviendas${c.pararrayos ? ', con pararrayos' : ''}): ≤ ${ev.limiteR} Ω → ${ev.okR ? 'cumple' : 'no cumple'}.`) : null].filter(Boolean));
    };

    // Equipo de medida: se da de alta una vez y queda guardado en la empresa
    const zonaMedidor = h('div');
    const pintarMedidor = () => {
      const lista = medidores();
      const actual = lista.find((m) => m.id === c.medidorId);
      const estado = actual && estadoCalibracion(actual, c.fecha);
      zonaMedidor.replaceChildren(...[
        lista.length ? h('div', { class: 'campo ancho' }, h('label', { for: 'ct-medidor' }, 'Equipo de medida'),
          h('select', { id: 'ct-medidor', onchange: async (e) => {
            c.medidorId = e.target.value; cambio(); pintarMedidor();
            if (c.medidorId) empresa = await guardarMedidores(app, (d) => { d.medidorPorDefecto = c.medidorId; });
          } }, h('option', { value: '' }, 'Elige el equipo…'), ...lista.map((m) => h('option', { value: m.id, selected: m.id === c.medidorId || null }, nombreMedidor(m)))))
          : h('p', { class: 'muted' }, 'Todavía no hay equipos de medida. Dalo de alta una vez y quedará guardado para todos los certificados.'),
        estado === 'caducada' ? h('div', { class: 'aviso err' }, `La calibración de este equipo caducó el ${actual.validoHasta.split('-').reverse().join('/')}.`) : null,
        actual ? h('div', { class: 'muted' }, [actual.certificado && `Certificado de calibración ${actual.certificado}`, actual.calibracion && `calibrado el ${actual.calibracion.split('-').reverse().join('/')}`, actual.validoHasta && `válido hasta ${actual.validoHasta.split('-').reverse().join('/')}`].filter(Boolean).join(' · ')) : null,
        h('div', { class: 'fila' }, h('button', { class: 'btn peq', type: 'button', id: 'ct-nuevo-medidor', onclick: () => formMedidor() }, '+ Añadir equipo de medida'),
          actual ? h('button', { class: 'btn peq', type: 'button', onclick: () => formMedidor(actual) }, 'Editar este equipo') : null)].filter(Boolean));
    };
    const formMedidor = (orig = null) => {
      const m = { ...medidorVacio(), ...(orig || {}) };
      const f = (k, etq, tipoI = 'text') => h('div', { class: 'campo' }, h('label', { for: 'md-' + k }, etq), h('input', { id: 'md-' + k, type: tipoI, value: m[k] || '', autocomplete: 'off', enterkeyhint: 'next', oninput: (e) => { m[k] = e.target.value; } }));
      zonaMedidor.replaceChildren(h('div', { class: 'card' },
        h('b', {}, orig ? 'Editar equipo de medida' : 'Nuevo equipo de medida'),
        h('p', { class: 'muted' }, 'Se guarda en la empresa: no hay que volver a escribirlo.'),
        h('div', { class: 'grid2' }, f('tipo', 'Tipo de equipo'), f('marca', 'Marca'), f('modelo', 'Modelo'), f('serie', 'Nº de serie'),
          f('certificado', 'Nº certificado de calibración'), f('calibracion', 'Fecha de calibración', 'date'), f('validoHasta', 'Calibración válida hasta', 'date')),
        h('div', { class: 'fila' },
          h('button', { class: 'btn prim', type: 'button', id: 'md-guardar', onclick: async () => {
            if (!m.marca.trim() && !m.modelo.trim()) { toast('Escribe al menos la marca o el modelo', true); return; }
            if (!m.id) m.id = nuevoId();
            empresa = await guardarMedidores(app, (d) => {
              const i = d.medidores.findIndex((x) => x.id === m.id);
              if (i >= 0) d.medidores[i] = m; else d.medidores.push(m);
              d.medidorPorDefecto = m.id;
            });
            c.medidorId = m.id; cambio();
            toast('Equipo de medida guardado en la empresa');
            pintarMedidor();
          } }, 'Guardar equipo'),
          h('button', { class: 'btn', type: 'button', onclick: () => pintarMedidor() }, 'Cancelar'))));
    };

    // Ubicación y plano: los del aviso (CartoCiudad / Catastro / IGN)
    const zonaUbic = h('div');
    const pintarUbic = () => {
      const su = draft.suministro || {};
      zonaUbic.replaceChildren(...[h('div', { class: 'muted' },
        su.lat && su.lon ? `Coordenadas: ${su.lat}, ${su.lon}` : 'Sin coordenadas: usa «Buscar dirección» en Cliente y suministro.',
        ' · ', draft.plano ? 'Plano de situación: sí' : 'Plano de situación: no',
        su.refCatastral ? ` · Ref. catastral ${su.refCatastral}` : ''),
        !draft.plano && su.lat && planoEl?.generar ? h('div', { class: 'fila' }, h('button', { class: 'btn peq', type: 'button', onclick: async () => { await planoEl.generar(); pintarUbic(); } }, 'Generar el plano ahora')) : null].filter(Boolean));
    };

    // Firma y sello de la empresa
    const faltaFirma = [!empresa.firma && 'firma', !empresa.sello && 'sello'].filter(Boolean);
    const salida = h('div', { id: 'cert-salida' });
    const generar = async (e) => {
      e.target.disabled = true;
      try {
        const ft = faltaTitular(c);
        if (ft.length) toast(`Titular distinto: falta su ${ft.join(' y su ')}`, true);
        const { bytes, nombre, medidor } = await crearCertificadoTierra(app, draft);
        if (!medidor) toast('No has elegido el equipo de medida: saldrá en blanco', true);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        salida.replaceChildren(h('div', { class: 'aviso ok' }, h('b', {}, 'Certificado preparado: '), nombre,
          h('div', { class: 'fila' },
            h('button', { class: 'btn peq', type: 'button', onclick: () => abrirBlob(blob) }, 'Ver'),
            h('button', { class: 'btn peq', type: 'button', onclick: () => compartir(blob, nombre) }, 'Compartir'),
            h('button', { class: 'btn peq', type: 'button', onclick: () => descargar(blob, nombre) }, 'Descargar'),
            h('button', { class: 'btn peq prim', type: 'button', id: 'cert-guardar', onclick: async (ev) => {
              ev.target.disabled = true;
              const ficha = await app.storage.putFile({ name: nombre, mime: 'application/pdf', bytes });
              await guardarArchivo({ tipo: 'cert_tierra', hash: ficha.hash, name: ficha.name, mime: 'application/pdf', size: ficha.size, addedAt: new Date().toISOString(), formato: FORMATO_CERT });
              ev.target.textContent = 'Guardado en el aviso';
            } }, 'Guardar copia en el aviso'))));
      } catch (err) { toast('No se pudo crear el certificado: ' + err.message, true); } finally { e.target.disabled = false; }
    };

    // Solicitante (el cliente del aviso) y titular de la instalación (puede ser otro)
    const zonaTitular = h('div', { id: 'cert-titular' });
    const pintarTitular = () => {
      const pc = partesCertificado(draft, c);
      const t = c.titular;
      const campoT = (k, etq, o = {}) => {
        const input = h('input', { id: 'ct-titular-' + k, type: o.tipo || 'text', value: t[k] || '', autocomplete: 'off', inputmode: o.inputmode,
          oninput: (e) => { t[k] = e.target.value; alCambiar(); },
          onblur: k === 'telefono' ? (e) => { const f = formatearTelefono(e.target.value); if (f !== e.target.value) { e.target.value = f; t[k] = f; alCambiar(); } } : null });
        // Titulares ya trabajados (clientes de otros avisos): un toque y se rellena
        const sug = k === 'nombre' || k === 'nif' ? sugerencias(input, {
          buscar: (q) => buscarClientes(conocidos, k, q).map((x) => ({ titulo: x.cliente.nombre, sub: [x.cliente.nif, x.cliente.telefono].filter(Boolean).join(' · '), x })),
          elegir: (it) => {
            const cl = it.x.cliente, dir = it.x.suministros[0] ? textoSuministro(it.x.suministros[0]) : '';
            Object.assign(t, { nombre: cl.nombre || t.nombre, nif: cl.nif || t.nif, telefono: formatearTelefono(cl.telefono || t.telefono), direccion: t.direccion || dir });
            // Se ponen en sus campos sin redibujar (si no, el campo que se estaba escribiendo pisaría el nombre al salir)
            for (const kk of ['nombre', 'nif', 'telefono', 'direccion']) { const el = document.getElementById('ct-titular-' + kk); if (el) el.value = t[kk] || ''; }
            alCambiar();
          },
        }) : null;
        return h('div', { class: 'campo' + (o.ancho ? ' ancho' : '') }, h('label', { for: 'ct-titular-' + k }, etq), input, sug);
      };
      zonaTitular.replaceChildren(...[
        h('p', {}, h('b', {}, 'Solicitante: '), pc.solicitante.nombre || h('span', { class: 'muted' }, 'falta el cliente del aviso'),
          pc.solicitante.nif ? ` · ${pc.solicitante.nif}` : '', h('span', { class: 'muted' }, ' (el cliente del aviso)')),
        h('label', { class: 'check-linea' }, h('input', { type: 'checkbox', id: 'ct-titularDistinto', checked: c.titularDistinto || null,
          onchange: (e) => { c.titularDistinto = e.target.checked; alCambiar(); pintarTitular(); if (c.titularDistinto) setTimeout(() => document.getElementById('ct-titular-nombre')?.focus(), 30); } }),
          ' El titular de la instalación es distinto del solicitante'),
        c.titularDistinto ? h('div', { class: 'grid2' },
          campoT('nombre', 'Titular: nombre o razón social', { ancho: true }), campoT('nif', 'DNI / NIF / CIF'), campoT('telefono', 'Teléfono', { tipo: 'tel' }),
          campoT('direccion', 'Dirección del titular', { ancho: true }))
          : h('p', { class: 'muted' }, 'Titular: el mismo que el solicitante.')]);
    };

    pintarMedidor(); pintarUbic(); pintarResultado(); pintarTitular();
    const antiguo = (draft.archivos || []).some((x) => x.tipo === 'cert_tierra' && (x.formato || 1) < FORMATO_CERT);
    return h('div', {},
      antiguo ? h('div', { class: 'aviso info', id: 'cert-formato-antiguo' }, 'El certificado guardado en este aviso es del formato anterior (sin solicitante y titular por separado). Revisa el titular, pulsa «Generar certificado PDF» y «Guardar copia en el aviso».') : null,
      h('h3', {}, 'Solicitante y titular'), zonaTitular,
      h('h3', {}, 'Toma de tierra'),
      h('div', { class: 'grid2' },
        sel('electrodo', 'Tipo de electrodo', ELECTRODOS),
        txt('numPicas', 'Nº de picas', { inputmode: 'numeric' }),
        txt('longitud', 'Longitud de pica (m)', { inputmode: 'decimal' }),
        txt('seccion', 'Sección conductor de tierra (mm²)', { inputmode: 'decimal' }),
        sel('terreno', 'Terreno', TERRENOS),
        txt('clima', 'Condiciones el día de la medida', { ph: 'Ejemplo: soleado, terreno seco' })),
      chk('pararrayos', 'El edificio tiene pararrayos'),
      h('h3', {}, 'Medición'),
      h('div', { class: 'grid2' },
        txt('fecha', 'Fecha de la medición', { tipo: 'date' }),
        sel('metodo', 'Método', METODOS_TIERRA, { ancho: true }),
        sel('diferencial', 'Sensibilidad del diferencial', SENSIBILIDADES.map((s) => [s, s + ' mA'])),
        txt('medida', 'Resistencia de tierra medida (Ω)', { inputmode: 'decimal', ph: 'Ejemplo: 12,5' })),
      chk('humedo', 'Local húmedo o conductor (límite 24 V en lugar de 50 V)'),
      chk('refViviendas', 'Aplicar la referencia ITC-BT-26 de viviendas (37 Ω, o 15 Ω con pararrayos)'),
      resultado,
      h('h3', {}, 'Equipo de medida'), zonaMedidor,
      h('h3', {}, 'Ubicación y plano'), zonaUbic,
      h('h3', {}, 'Fotografías (hasta 6)'), bloqueFotos(app, c, alCambiar, { cgp: false, max: 6, id: 'cert-fotos' }),
      h('h3', {}, 'Observaciones'),
      h('textarea', { id: 'ct-observaciones', rows: 3, value: c.observaciones || '', oninput: (e) => { c.observaciones = e.target.value; alCambiar(); } }),
      faltaFirma.length ? h('div', { class: 'aviso info' }, `Falta la ${faltaFirma.join(' y el ')} de la empresa: el certificado saldrá sin ella. `, h('a', { href: '#/empresa' }, 'Configurar en Empresa')) : null,
      h('div', { class: 'fila' }, h('button', { class: 'btn prim ancho', type: 'button', id: 'cert-generar', onclick: generar }, 'Generar certificado PDF')),
      salida);
  };

  if (draft.certificados.tierra) tipo.value = 'tierra';
  pintar();
  return h('div', {}, h('div', { class: 'campo ancho' }, h('label', { for: 'cert-tipo' }, 'Certificado'), tipo), cont);
}
