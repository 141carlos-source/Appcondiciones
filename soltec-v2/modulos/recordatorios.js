// SOLTEC V2 · Recordatorios automáticos en pantalla (Inicio y ficha del aviso) y sus plazos en Ajustes.

import { h, toast, confirmar } from '../ui.js';
import { recordatorios, plazosDe, PLAZOS_RECORDATORIO, TIPOS_RECORDATORIO } from '../core/recordatorios.js';
import { direccionCompleta } from '../core/model.js';
import { ID_EMPRESA, normalizarEmpresa, empresaVacia } from '../core/empresa.js';

const leerEmpresaRaw = async (app) => { const r = await app.storage.get(ID_EMPRESA); return r ? normalizarEmpresa(r.data) : empresaVacia(); };

/** Recordatorios de todos los avisos (o solo de uno). */
export async function calcularRecordatorios(app, { avisos, avisoId } = {}) {
  const [lista, eventos, empresa] = await Promise.all([
    avisos ? Promise.resolve(avisos) : app.storage.list('aviso'),
    avisoId ? app.storage.listByRef(avisoId, 'evento') : app.storage.list('evento'),
    leerEmpresaRaw(app),
  ]);
  const solo = avisoId ? lista.filter((r) => r.id === avisoId) : lista;
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
