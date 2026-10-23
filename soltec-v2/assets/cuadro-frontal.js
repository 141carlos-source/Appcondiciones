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

  // ---------------------------------------------------------------- dibujo del aparato (estilo esquema)
  /**
   * Frontal de un aparato en estilo esquema, como los dibujos de las cajas de cuadros: cuerpo blanco con contorno,
   * marca y calibre arriba y las palancas oscuras abajo, una por polo. El diferencial lleva el botón de prueba
   * naranja y una sola palanca alta. Devuelve un <svg> de 32 px por módulo × 96 px.
   * @param d        aparato {t, m, in, cu, sn, mk, nom}
   * @param nombres  nombres de los tipos (para «Mis aparatos»)
   */
  function svgAparato(d, nombres = {}) {
    const P = 32, H = 96, m = Math.max(1, +d.m || 1), W = m * P, t = d.t;
    const AZ = '#1f2b5c', AZ2 = '#33437f', NAR = '#f07a1e', LIN = '#26304f';
    const e = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const tx = (x, y, z, s, o = {}) => `<text x="${x}" y="${y}" font-size="${z}" font-weight="${o.w || 700}" fill="${o.c || AZ}" font-family="Arial, Helvetica, sans-serif"${o.mid ? ' text-anchor="middle"' : ''}>${e(s)}</text>`;
    const rc = (x, y, w, h, f, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx || 0}" fill="${f}"${o.s ? ` stroke="${o.s}" stroke-width="${o.sw || 1}"` : ''}/>`;
    // Palanca de un polo: base ancha con el mando en relieve (como «piano»)
    const palanca = (x) => rc(x + 3, 66, P - 6, 13, AZ, { rx: 1.5 }) + rc(x + 8, 59, P - 16, 9, AZ, { rx: 1.5 }) + rc(x + 9, 60, P - 18, 2, AZ2);
    // Marca: la del aparato si se ha escrito (primera palabra), si no CHINT (la que monta SOLTEC)
    const marca = String(d.mk || 'CHINT').trim().split(/\s+/)[0].toUpperCase().slice(0, 7);
    // Modelo (para el pedido): el escrito en el aparato o, en CHINT, la serie según la intensidad
    const modelo = String(d.mk || '').trim().split(/\s+/).slice(1).join(' ') || (marca === 'CHINT' ? ((t === 'ID' ? 'NXL-' : 'NXB-') + (+d.in > 63 ? '125' : '63')) : '');
    let s = `<svg viewBox="0 0 ${W} ${H}" style="flex:none;height:${H}px;width:100%;pointer-events:none;text-transform:none" data-estilo="esquema">`;
    s += rc(0.75, 0.75, W - 1.5, H - 1.5, '#fff', { s: LIN, sw: 1.5, rx: 2 });
    for (let k = 1; k < m; k++) s += `<line x1="${k * P}" y1="6" x2="${k * P}" y2="${H - 6}" stroke="#c9cdd6" stroke-width="1"/>`;
    const conPalancas = t === 'PIA' || t === 'IGA' || t === 'SOB';
    if (conPalancas) {
      for (let k = 0; k < m; k++) s += palanca(k * P);
      if (m > 1) s += rc(6, 73, W - 12, 3, AZ2, { rx: 1 }); // palancas unidas (corte de todos los polos)
      s += tx(4, 13, 7.5, marca) + tx(4, 24, 8.5, (d.in ? d.in + 'A' : ''), { w: 400, c: '#222' });
      if (t === 'PIA' && d.cu) s += tx(W - 4, 24, 7, d.cu, { w: 400, c: '#222' }).replace('<text ', '<text text-anchor="end" ');
      if (t === 'PIA' && modelo) s += tx(4, 33, 6, modelo, { w: 400, c: '#555' });
      if (t === 'IGA') s += tx(4, 36, 7.5, 'IGA') + (modelo ? tx(4, 45, 6, modelo, { w: 400, c: '#555' }) : '');
      if (t === 'SOB') s += rc(4, 31, 9, 7, '#2e8b3a', { rx: 1 }) + tx(15, 37, 6, 'SOBRETENS.', { w: 700 });
    } else if (t === 'ID') {
      s += rc(4, 6, 9, 8, NAR, { s: '#b55a0e', sw: 0.8, rx: 1 }) + tx(15, 13, 7, marca) + tx(4, 24, 8.5, (d.in || 40) + 'A', { w: 400, c: '#222' })
        + tx(4, 33, 7, (d.sn || 30) + 'mA', { w: 400, c: '#222' }) + (d.cl ? tx(4, 41, 6.5, 'CLASE ' + d.cl, { w: 400, c: '#555' }) : '') + (m > 1 && modelo ? tx(P + 3, 24, 6, modelo, { w: 400, c: '#555' }) : '');
      s += rc(9, 48, 14, 32, AZ, { rx: 3 }) + rc(11, 50, 10, 3, AZ2, { rx: 1 }); // una sola palanca alta
      if (m > 1) s += tx(P + P / 2, 70, 7, 'N', { w: 700, c: '#8a90a0', mid: true });
    } else if (t === 'CON') {
      s += tx(4, 13, 7.5, marca) + tx(4, 24, 8.5, (d.in || '') + 'A', { w: 400, c: '#222' }) + rc(6, 40, W - 12, 12, '#eef1f6', { s: LIN, sw: 0.8, rx: 1 }) + tx(W / 2, 49, 6, 'A1  A2', { w: 700, mid: true }) + rc(W / 2 - 5, 62, 10, 14, AZ, { rx: 2 });
    } else if (t === 'REL') {
      s += tx(4, 13, 7, 'RELOJ') + `<circle cx="${W / 2}" cy="56" r="13" fill="#fff" stroke="${LIN}" stroke-width="1.5"/><path d="M${W / 2} 56v-9M${W / 2} 56l6 4" stroke="${AZ}" stroke-width="1.6" fill="none"/>`;
    } else if (t === 'BOR') {
      s += tx(4, 13, 7, 'BORNERO');
      const n = Math.max(2, m * 2);
      for (let k = 0; k < n; k++) { const cx = 4 + (k + 0.5) * ((W - 8) / n); s += `<circle cx="${cx}" cy="46" r="3.2" fill="#fff" stroke="${LIN}"/><circle cx="${cx}" cy="68" r="3.2" fill="#fff" stroke="${LIN}"/>`; }
      s += rc(4, 55, W - 8, 4, (d.fs == '3' ? AZ : '#3a7bd5'), { rx: 1 });
    } else {
      s += tx(W / 2, 50, 7.5, (t === 'OTR' ? 'OTRO' : (nombres[t] || 'APARATO')).slice(0, Math.max(5, m * 5)), { mid: true });
    }
    return s + '</svg>';
  }

  return { SOBM, SOBT, DIF, PIA1, PIA2, PAL, opcion, aplicarOpcion, libre, primerHueco, siguienteHueco, columnaSoltar, nuevoAparato, huecoCabecera, datosCabecera, mover, caben, svgAparato };
});
