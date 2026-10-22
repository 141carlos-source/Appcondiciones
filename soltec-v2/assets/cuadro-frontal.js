/* SOLTEC V2 · Frontal de CuadroLab: paleta de aparatos y dónde se colocan, separado del dibujo para poder probarlo.
   Huecos libres, aparato nuevo con sus valores por defecto, opciones de los desplegables, P.I.A. de cabecera
   pegado al diferencial, mover, duplicar y cambiar el tamaño de la envolvente.
   Funciones puras sobre el cuadro q = {w, r, n, dv}: no dibujan ni preguntan nada.
   Necesita CuadroReglas (assets/cuadro-reglas.js) cargado antes. */
(function (raiz, fabrica) {
  const F = fabrica(raiz.CuadroReglas || (typeof require === 'function' ? require('./cuadro-reglas.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = F;
  else raiz.CuadroFrontal = F;
})(typeof globalThis !== 'undefined' ? globalThis : self, function (R) {
  'use strict';

  // ---------------------------------------------------------------- paleta (desplegables)
  const SOBM = [25, 32, 40, 63, 80], SOBT = [25, 32, 40, 63, 80, 100, 125, 160, 200];
  const DIF = [[25, 30], [25, 300], [40, 30], [40, 300], [63, 30], [63, 300], [80, 30], [80, 300]];
  const PIA1 = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80], PIA2 = PIA1.concat([100, 125]);
  /** [tipo, título, [[etiqueta del desplegable, [[valor, texto, módulos, fases]...]]]] */
  const PAL = [
    ['SOB', 'PROTECTOR SOBRETENSIONES', [['MONOFÁSICO 3 MÓD.', 3, '1'], ['MONOFÁSICO 6 MÓD.', 6, '1'], ['TRIFÁSICO 5 MÓD.', 5, '3'], ['TRIFÁSICO 9 MÓD.', 9, '3']]
      .map(([lb, m, f]) => [lb, (f == '1' ? SOBM : SOBT).map((i) => [String(i), i + ' A', m, f])])],
    ['BOR', 'BORNERO', [['BORNERO', [['1', 'MONOFÁSICO', 2, '1'], ['3', 'TRIFÁSICO', 4, '3']]]]],
    ['ID', 'DIFERENCIAL (ID)', [['MONOFÁSICO', DIF.map(([i, n]) => [i + '|' + n, `2x${i}A ${n}mA`, 2, '1'])], ['TETRAPOLAR', DIF.map(([i, n]) => [i + '|' + n, `4x${i}A ${n}mA`, 4, '3'])]]],
    ['PIA', 'MAGNETOTÉRMICO (PIA)', [1, 2, 3, 4].map((m) => [m + (m == 1 ? ' MÓDULO' : ' MÓDULOS'), (m == 1 ? PIA1 : PIA2).map((i) => [String(i), i + ' A', m, m >= 3 ? '3' : '1'])])],
  ];
  /** Opción elegida en un desplegable de la paleta: [valor, texto, módulos, fases] (o null). */
  const opcion = (t, grupo, valor) => {
    const p = PAL.find((x) => x[0] == t), g = p && p[2][+grupo];
    return (g && g[1].find((x) => x[0] == valor)) || null;
  };
  /** Aplica a un aparato recién puesto lo elegido en el desplegable (intensidad, sensibilidad, fases…). */
  function aplicarOpcion(d, valor, o) {
    d.fs = o[3];
    if (d.t == 'PIA') { d.in = +valor; d.se = R.SA(d.in, R.CB(d)); d.pw = R.pc(d); }
    if (d.t == 'ID') { const [i, n] = String(valor).split('|'); d.in = +i; d.sn = +n; }
    if (d.t == 'SOB') { d.in = +valor; d.pw = 0; }
    return d;
  }

  // ---------------------------------------------------------------- huecos
  /** ¿Cabe un aparato de m módulos en la fila r desde la columna c? (ign = aparato que se está moviendo) */
  const libre = (q, r, c, m, ign) => c >= 0 && c + m <= q.w && r >= 0 && r < q.r && !q.dv.some((d) => d.id != ign && d.row == r && c < d.col + d.m && d.col < c + m);
  /** Primer hueco libre (de arriba abajo y de izquierda a derecha). */
  function primerHueco(q, m) {
    for (let r = 0; r < q.r; r++) for (let c = 0; c <= q.w - m; c++) if (libre(q, r, c, m)) return { r, c };
    return null;
  }
  /** Siguiente hueco libre después de una posición (para duplicar a continuación). */
  function siguienteHueco(q, r0, c0, m) {
    const N = q.r * q.w, st = r0 * q.w + c0;
    for (let i = 0; i < N; i++) { const k = (st + i) % N, r = Math.floor(k / q.w), c = k % q.w; if (libre(q, r, c, m)) return { r, c }; }
    return null;
  }
  /** Columna al soltar un aparato arrastrado en la posición x (px) de una fila de módulos de U px. */
  const columnaSoltar = (q, m, x, U) => Math.max(0, Math.min(q.w - m, Math.round(x / U - m / 2)));

  // ---------------------------------------------------------------- aparato nuevo
  /** Aparato nuevo con sus valores por defecto (aumenta q.n). No lo añade al cuadro. */
  function nuevoAparato(q, t, m, r, c) {
    const d = { id: 'd' + (++q.n), t, m, row: r, col: c, nom: '' };
    if (t == 'PIA' || t == 'SOB') {
      Object.assign(d, { in: 16, cu: 'C', se: 1.5, dep: '', fs: m >= 3 ? '3' : '1' });
      if (t == 'PIA') { d.cb = 'H07Z1-K'; d.se = R.SA(d.in, d.cb); }
      d.pw = R.pc(d);
    }
    if (t == 'ID') {
      Object.assign(d, { in: 40, sn: 30, cl: 'A' });
      // Nombre automático: DIFERENCIAL 1, 2… (el primer número libre)
      const usados = new Set(q.dv.filter((x) => x.t == 'ID').map((x) => x.nom));
      let n = 1;
      while (usados.has('DIFERENCIAL ' + n)) n++;
      d.nom = 'DIFERENCIAL ' + n;
    }
    if (t == 'IGA') { d.po = m > 2 ? 4 : 2; d.in = 63; d.cu = 'C'; d.mk = 'CHINT NXB-63'; }
    if (t == 'CON') d.in = m == 2 ? 16 : 25;
    if (t[0] == 'U') d.v = {};
    return d;
  }

  // ---------------------------------------------------------------- P.I.A. de cabecera
  /**
   * Dónde va el P.I.A. de cabecera de un diferencial: pegado a su izquierda. Si no hay hueco, se corren a la
   * derecha el diferencial y lo que le sigue en la fila (si caben). Si tampoco, el primer hueco libre.
   * @returns {{r, c, correr: string[]} | null}  correr = ids de aparatos que hay que mover m módulos a la derecha
   */
  function huecoCabecera(q, id) {
    const m = id.m >= 4 ? 4 : 2, r = id.row;
    if (libre(q, r, id.col - m, m)) return { r, c: id.col - m, m, correr: [] };
    const fila = q.dv.filter((d) => d.row == r && d.col >= id.col);
    if (Math.max(...fila.map((d) => d.col + d.m)) + m <= q.w) return { r, c: id.col, m, correr: fila.map((d) => d.id) };
    const h = primerHueco(q, m);
    return h ? { ...h, m, correr: [] } : null;
  }
  /** Valores de la cabecera: la mayor intensidad que no supera la del diferencial. */
  function datosCabecera(q, id) {
    const i = [6, 10, 16, 20, 25, 32, 40, 50, 63].filter((x) => x <= id.in).pop() || 16;
    const d = { in: i, fs: id.m >= 4 ? '3' : '1', pw: 0, dep: '', nom: 'CABECERA ID ' + (R.V(q, 'ID').indexOf(id) + 1) };
    d.se = R.SA(d.in, 'H07Z1-K');
    return d;
  }

  // ---------------------------------------------------------------- mover y envolvente
  /** Mueve un aparato dx columnas y dy filas si cabe. Devuelve si se ha movido. */
  function mover(q, d, dx, dy) {
    const c = d.col + dx, r = d.row + dy;
    if (!libre(q, r, c, d.m, d.id)) return false;
    d.col = c; d.row = r;
    return true;
  }
  /** ¿Caben todos los aparatos en una envolvente de w módulos × r filas? */
  const caben = (q, w, r) => !q.dv.some((d) => d.col + d.m > w || d.row >= r);

  return { SOBM, SOBT, DIF, PIA1, PIA2, PAL, opcion, aplicarOpcion, libre, primerHueco, siguienteHueco, columnaSoltar, nuevoAparato, huecoCabecera, datosCabecera, mover, caben };
});
