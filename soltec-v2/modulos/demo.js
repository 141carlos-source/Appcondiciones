// SOLTEC V2 · Modo demostración y temas de aspecto: siembra los datos de ejemplo y pone la barra para cambiar de tema.

import { h } from '../ui.js';
import { TEMAS, datosDemo } from '../core/demo.js';

/** Carga el tema N (assets/temas/tema-N.css) encima del aspecto actual. 0 = sin tema. */
export function aplicarTema(n) {
  document.documentElement.dataset.tema = String(n || 0);
  document.getElementById('css-tema')?.remove();
  if (!n) return;
  document.head.append(h('link', { rel: 'stylesheet', href: `./assets/temas/tema-${n}.css`, id: 'css-tema' }));
}

/** Datos de ejemplo en la base de datos de demostración (ids fijos: no se duplican). Solo la primera vez. */
export async function sembrarDemo(storage) {
  if (await storage.getMeta('demoSembrada')) return;
  const d = datosDemo();
  await storage.save('config', d.empresa.data, { id: d.empresa.id });
  for (const a of d.avisos) await storage.save('aviso', a.data, { id: a.id });
  for (const e of d.eventos) await storage.save('evento', e.data, { id: e.id, ref: e.ref });
  for (const c of d.citas) await storage.save('cita', c.data, { id: c.id, ref: c.ref });
  for (const p of d.partes) await storage.save('parte', p.data, { id: p.id, ref: p.ref });
  await storage.setMeta('demoSembrada', new Date().toISOString());
}

/** Barra fija de la demostración: tema actual, cambiar de tema y volver a la app de verdad. */
export function barraDemo(actual) {
  const url = (n) => `${location.pathname}?demo=1&tema=${n}${location.hash}`;
  const t = TEMAS.find((x) => x.id === actual) || TEMAS[0];
  return h('div', { class: 'barra-demo', id: 'barra-demo', role: 'region', 'aria-label': 'Demostración de temas' },
    h('div', { class: 'barra-demo-txt' }, h('b', {}, `Demo · ${t.nombre}`), h('span', {}, 'datos de ejemplo, sin sincronizar')),
    h('div', { class: 'barra-demo-temas' }, ...TEMAS.map((x) => h('a', { href: url(x.id), class: x.id === actual ? 'activo' : null, title: x.idea, 'aria-current': x.id === actual ? 'true' : null }, x.id ? String(x.id) : 'Actual'))),
    h('a', { class: 'barra-demo-salir', href: './temas.html' }, 'Comparar'));
}
