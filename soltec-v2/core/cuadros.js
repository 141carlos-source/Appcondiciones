// SOLTEC V2 · Cuadros eléctricos del aviso. El diseño lo hace CuadroLab (assets/cuadrolab.html)
// y el proyecto completo se guarda dentro del aviso (aviso.cuadro), igual que el resto de sus datos.
// Funciones puras: sin DOM ni almacenamiento.

export const VERSION_CUADRO = 1;

/** Un proyecto de CuadroLab tiene al menos la lista de aparatos (dv). */
export const esProyecto = (p) => !!p && typeof p === 'object' && !Array.isArray(p) && Array.isArray(p.dv);

export function cuadroVacio() { return { v: VERSION_CUADRO, proyecto: null, actualizado: '' }; }

export function normalizarCuadro(d) {
  const b = cuadroVacio();
  if (!d || typeof d !== 'object') return b;
  return {
    v: VERSION_CUADRO,
    proyecto: esProyecto(d.proyecto) ? d.proyecto : null,
    actualizado: typeof d.actualizado === 'string' ? d.actualizado : '',
  };
}

/** Los cuadros del proyecto. El abierto se sincroniza en `cs` al guardar; si no hay `cs`, es el único. */
export function cuadrosDe(proyecto) {
  if (!esProyecto(proyecto)) return [];
  if (Array.isArray(proyecto.cs) && proyecto.cs.length) return proyecto.cs.filter((q) => q && Array.isArray(q.dv));
  return [{ k: 'q', c: proyecto.p?.c || '', dv: proyecto.dv, w: proyecto.w, r: proyecto.r }];
}

/**
 * Resumen para mostrar en la ficha.
 * potenciaW es la suma de la potencia prevista de los magnetotérmicos (no es la demanda real).
 */
export function resumenCuadro(cuadro) {
  const c = normalizarCuadro(cuadro);
  const qs = cuadrosDe(c.proyecto);
  const aparatos = qs.reduce((n, q) => n + q.dv.length, 0);
  // El P.I.A. de cabecera de un diferencial (ID.pp) no es un circuito: no cuenta ni suma potencia
  const circuitosDe = (q) => { const cab = new Set(q.dv.filter((d) => d.t === 'ID' && d.pp).map((d) => d.pp)); return q.dv.filter((d) => d.t === 'PIA' && !cab.has(d.id)); };
  const circuitos = qs.reduce((n, q) => n + circuitosDe(q).length, 0);
  const potenciaW = qs.reduce((n, q) => n + circuitosDe(q).reduce((s, d) => s + (Number(d.pw) || 0), 0), 0);
  return { hay: aparatos > 0, cuadros: qs.length, nombres: qs.map((q) => q.c).filter(Boolean), aparatos, circuitos, potenciaW, actualizado: c.actualizado };
}

/** Texto corto: «2 cuadros · 14 circuitos · 21,4 kW previstos». */
export function textoResumen(r) {
  if (!r.hay) return 'Sin cuadro diseñado';
  const kw = (r.potenciaW / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 });
  return `${r.cuadros} cuadro${r.cuadros === 1 ? '' : 's'} · ${r.circuitos} circuito${r.circuitos === 1 ? '' : 's'} · ${kw} kW previstos`;
}
