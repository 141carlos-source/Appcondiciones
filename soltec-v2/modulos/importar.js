// SOLTEC V2 · Pantalla «Traer datos de la V1.35».
// Lee (sin modificar) la V1.35 de este navegador o el archivo soltec-central.json del PC.

import { h, toast, ir } from '../ui.js';
import { leerSnapshot, planificar, ejecutar } from '../core/importarV1.js';
import { ID_EMPRESA, empresaVacia, normalizarEmpresa } from '../core/empresa.js';
import { aplicarImportacion } from './empresa.js';

/** ¿Hay datos de la V1.35 en este navegador? (misma web) */
export function hayV1Local() {
  try { return !!localStorage.getItem('APP_AVISOS_WEB_DATOS_V116_PERSISTENTE'); } catch { return false; }
}

/** Arma un snapshot con el mismo formato que el archivo central, leyendo la V1.35 de este navegador. */
async function snapshotLocal() {
  const ls = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('APP_AVISOS_')) ls[k] = localStorage.getItem(k);
  }
  const stores = { estado: [], planos: [] };
  // Solo se abre la base de la V1.35 si existe (abrirla sin existir la crearía vacía)
  const lista = indexedDB.databases ? await indexedDB.databases() : [];
  if (lista.some((d) => d.name === 'APP_AVISOS_PERSISTENCIA')) {
    const db = await new Promise((ok, mal) => { const r = indexedDB.open('APP_AVISOS_PERSISTENCIA'); r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); });
    try {
      for (const st of ['estado', 'planos']) {
        if (!db.objectStoreNames.contains(st)) continue;
        stores[st] = await new Promise((ok, mal) => {
          const out = [];
          const c = db.transaction(st).objectStore(st).openCursor();
          c.onsuccess = () => { const cur = c.result; if (!cur) { ok(out); return; } out.push({ key: cur.key, value: cur.value }); cur.continue(); };
          c.onerror = () => mal(c.error);
        });
      }
    } finally { db.close(); }
  }
  return { snapshot: { localStorage: ls, indexedDB: { stores } } };
}

export async function vistaImportar(app) {
  const panel = h('div');
  const estado = h('p', { class: 'muted', 'aria-live': 'polite' });

  const mostrarPlan = async (entrada, origenTexto) => {
    let snap;
    try { snap = leerSnapshot(entrada); } catch (e) { panel.replaceChildren(h('div', { class: 'aviso err' }, e.message)); return; }
    const plan = planificar(snap, { avisosExistentes: await app.storage.list('aviso', { includeDeleted: true }) });
    const r = plan.resumen;
    const yaImportados = (await Promise.all(plan.avisos.map((x) => app.storage.get(x.id)))).filter(Boolean).length;
    const fila = (n, t) => h('li', {}, h('b', {}, String(n)), ' ', t);
    panel.replaceChildren(h('div', { class: 'card' },
      h('b', {}, `Datos encontrados ${origenTexto}`),
      plan.origen.revision != null ? h('p', { class: 'muted' }, `Revisión ${plan.origen.revision}${plan.origen.fecha ? ' · ' + new Date(plan.origen.fecha).toLocaleString('es-ES') : ''}`) : null,
      h('ul', { class: 'resumen-import' },
        fila(r.avisos, `avisos activos (${r.expedientes} con condiciones: irán a Expedientes)`),
        fila(r.papelera, 'avisos de la papelera (irán a la papelera)'),
        fila(r.pdfs, 'PDF de condiciones'), fila(r.fotos, 'fotografías'), fila(r.planos, 'planos de situación'),
        fila(r.citas, 'citas de la agenda'), fila(r.partes, 'partes de trabajo'),
        r.empresa ? h('li', {}, 'Datos de empresa (solo se rellenan los campos vacíos)') : null),
      yaImportados ? h('div', { class: 'aviso info' }, `${yaImportados} de estos avisos ya se importaron antes: no se duplican ni se cambian.`) : null,
      h('p', { class: 'muted' }, 'La V1.35 no se modifica. Los avisos reciben número de la V2 y conservan el de la V1.35, que también sirve para buscarlos.'),
      h('div', { class: 'fila' }, h('button', { class: 'btn rojo ancho', type: 'button', id: 'confirmar-importar', onclick: async (e) => {
        e.target.disabled = true;
        try {
          const inf = await ejecutar(app.storage, plan, {
            progreso: (t) => { estado.textContent = t; },
            empresaVaciaRellenar: async (imp) => {
              const reg = await app.storage.get(ID_EMPRESA);
              const d = reg ? normalizarEmpresa(reg.data) : empresaVacia();
              await aplicarImportacion(app, d, imp);
              await app.storage.save('config', d, { id: ID_EMPRESA });
            },
          });
          const n = inf.nuevos;
          panel.replaceChildren(h('div', { class: 'aviso ok', id: 'resultado-importar' },
            h('b', {}, 'Importación terminada. '),
            `${n.avisos} avisos, ${n.papelera} a la papelera, ${n.citas} citas, ${n.partes} partes y ${inf.archivos} archivos.`,
            inf.yaEstaban ? ` ${inf.yaEstaban} ya estaban y no se han tocado.` : '',
            inf.errores.length ? h('div', {}, `${inf.errores.length} archivo(s) no se pudieron leer: ${inf.errores.slice(0, 3).join('; ')}`) : null,
            h('div', { class: 'fila' }, h('a', { class: 'btn prim', href: '#/inicio' }, 'Ver Inicio'), h('a', { class: 'btn', href: '#/expedientes' }, 'Ver Expedientes'))),
          h('div', { class: 'aviso info' }, 'Revisa en cada aviso el estado del trámite y la documentación: la V1.35 no los guardaba igual y empiezan como «Pendiente de datos» y «Por revisar».'));
          estado.textContent = '';
          toast('Datos de la V1.35 importados');
        } catch (err) { e.target.disabled = false; toast(err.message, true); }
      } }, 'Importar ahora'))));
  };

  const archivo = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', id: 'archivo-central', onchange: async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    estado.textContent = `Leyendo ${f.name} (${Math.round(f.size / 1048576)} MB)…`;
    try { await mostrarPlan(JSON.parse(await f.text()), `en ${f.name}`); } catch { panel.replaceChildren(h('div', { class: 'aviso err' }, 'El archivo no se puede leer como datos de SOLTEC.')); }
    estado.textContent = '';
  } });

  const local = hayV1Local();
  return h('div', {},
    h('div', { class: 'titulo-fila' }, h('h1', {}, 'Traer datos de la V1.35'), h('a', { class: 'btn', href: '#/ajustes' }, 'Volver')),
    h('div', { class: 'card' },
      h('b', {}, 'Desde el PC central (recomendado)'),
      h('p', { class: 'muted' }, 'Reúne lo sincronizado desde todos los dispositivos. Está en la carpeta del servidor de la V1.35: soltec-sync-pc › data › soltec-central.json'),
      h('div', { class: 'fila' }, h('button', { class: 'btn prim', type: 'button', onclick: () => archivo.click() }, 'Elegir soltec-central.json'), archivo)),
    h('div', { class: 'card' },
      h('b', {}, 'Desde este navegador'),
      h('p', { class: 'muted' }, local ? 'En este navegador hay datos de la V1.35. Solo incluyen lo que tenga este dispositivo.' : 'En este navegador no hay datos de la V1.35. Usa el archivo del PC central.'),
      local ? h('div', { class: 'fila' }, h('button', { class: 'btn', type: 'button', id: 'leer-local', onclick: async () => {
        estado.textContent = 'Leyendo la V1.35 de este navegador…';
        try { await mostrarPlan(await snapshotLocal(), 'en este navegador'); } catch (e) { panel.replaceChildren(h('div', { class: 'aviso err' }, e.message)); }
        estado.textContent = '';
      } }, 'Leer la V1.35 de este navegador')) : null),
    estado, panel);
}
