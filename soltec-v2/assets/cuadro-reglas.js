/* SOLTEC V2 · Reglas eléctricas de CuadroLab, separadas del dibujo para poder probarlas.
   Cables (Iz según ITC-BT-19), sección según la tabla de SOLTEC, cumple / no cumple, P.I.A. de cabecera,
   numeración de circuitos y comprobaciones del cuadro.
   Todas las funciones son puras: reciben el cuadro (q = {dv, pa, cs, nu}) y no tocan la pantalla.
   Funciona como <script> en CuadroLab (window.CuadroReglas) y como módulo en las pruebas (require). */
(function (raiz, fabrica) {
  const R = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = R;
  else raiz.CuadroReglas = R;
})(typeof globalThis !== 'undefined' ? globalThis : self, function () {
  'use strict';

  // ---------------------------------------------------------------- tablas
  /** Intensidad admisible (A) por sección (mm²). Cobre, conductores en tubo, método B, 40 °C (ITC-BT-19). */
  const IZ = { 1.5: 15, 2.5: 21, 4: 27, 6: 36, 10: 50, 16: 66, 25: 84, 35: 104, 50: 125, 70: 160, 95: 194 };
  const CAB = {
    'H07Z1-K': { n: 'H07Z1-K 450/750 V', iz: IZ },
    'RZ1-K': { n: 'RZ1-K 0,6/1 KV', iz: { 1.5: 21, 2.5: 29, 4: 38, 6: 49, 10: 68, 16: 91, 25: 116, 35: 144, 50: 175, 70: 224, 95: 271 } },
  };
  /** Sección por intensidad del magnetotérmico (tabla de SOLTEC). */
  const SECI = { 6: 1.5, 10: 1.5, 16: 2.5, 20: 4, 25: 6, 32: 10, 40: 10, 50: 16, 63: 16, 80: 25, 100: 35, 125: 50 };
  const SEC = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95];

  // ---------------------------------------------------------------- aparato suelto
  const F = (s) => String(s).replace('.', ',');
  const FS = (d) => d.fs || (d.m >= 3 ? '3' : '1');
  const FSN = (f) => (f == '3' ? 'TRIFÁSICO' : 'MONOFÁSICO');
  const tension = (d) => (FS(d) == '3' ? Math.sqrt(3) * 400 : 230);
  /** Potencia que admite un magnetotérmico (W). */
  const pc = (d) => Math.round(d.in * tension(d));
  const CB = (d) => (CAB[d.cb] ? d.cb : 'H07Z1-K');
  const IZC = (d) => CAB[CB(d)].iz[d.se];
  /** Sección para una intensidad: la de la tabla de SOLTEC o, si no está, la primera que aguanta. */
  const SA = (i, cb) => SECI[i] || SEC.find((x) => (CAB[cb] || CAB['H07Z1-K']).iz[x] >= i) || 95;

  // ---------------------------------------------------------------- cuadro
  const ord = (a, b) => a.row - b.row || a.col - b.col;
  const V = (q, t) => q.dv.filter((d) => d.t == t).sort(ord);
  const ISCAB = (q, d) => !!d && d.t == 'PIA' && q.dv.some((i) => i.t == 'ID' && i.pp == d.id);
  /** Carga de un magnetotérmico; la de una cabecera es la suma de los circuitos de su diferencial. */
  const PW = (q, d) => {
    if (!ISCAB(q, d)) return Number(d.pw) || 0;
    const i = q.dv.find((x) => x.t == 'ID' && x.pp == d.id);
    return q.dv.filter((x) => x.t == 'PIA' && x.dep == i.id).reduce((a, x) => a + (Number(x.pw) || 0), 0);
  };
  /** Cumple el cable: In ≤ Iz y Ib ≤ In (la cabecera solo In ≤ Iz). Sin falsos negativos por redondeo. */
  const OKC = (q, d) => {
    const iz = IZC(d), P = ISCAB(q, d) ? 0 : PW(q, d), ib = P / tension(d);
    return !!iz && d.in <= iz && (!P || Math.round(ib * 100) <= Math.round(d.in * 100));
  };
  const CABS = (q) => new Set(V(q, 'ID').map((i) => i.pp).filter(Boolean));
  const IDCAB = (q, p) => V(q, 'ID').findIndex((i) => i.pp == p.id);
  /** Protección aguas arriba de los diferenciales: IGA (cuadros antiguos), protector de sobretensiones o P.I.A. que alimenta el subcuadro. */
  const AGU = (q) => {
    const g = V(q, 'IGA')[0];
    if (g) return { t: 'IGA', in: g.in };
    const sb = V(q, 'SOB')[0];
    if (sb && sb.in) return { t: 'SOB', in: sb.in };
    const [pk, pid] = (q.pa || '').split('|');
    const pq = (q.cs || []).find((c) => c.k == pk), pp = pq && pq.dv.find((d) => d.id == pid);
    return pp ? { t: 'PIA', in: pp.in } : null;
  };
  const SUMID = (q, i) => V(q, 'PIA').filter((p) => p.dep == i.id).reduce((a, p) => a + (+p.in || 0), 0);
  const IDN = (q, i) => i.nom || 'DIFERENCIAL ' + (V(q, 'ID').indexOf(i) + 1);
  /**
   * ¿Hace falta P.I.A. de cabecera? Si los magnetotérmicos del diferencial suman más que él, salvo que ya lo
   * limite su cabecera o lo de aguas arriba (≤ In del diferencial). Devuelve la suma (0 = no hace falta).
   */
  const NCAB = (q, i) => {
    const su = SUMID(q, i);
    if (su <= i.in) return 0;
    const cp = i.pp && q.dv.find((x) => x.id == i.pp);
    if (cp && cp.in <= i.in) return 0;
    const a = AGU(q);
    if (a && a.in <= i.in) return 0;
    return su;
  };
  /** Números de circuito C1, C2… (las cabeceras no son circuitos). */
  const NU = (q) => {
    const m = {};
    if (q.nu !== 0) V(q, 'PIA').filter((p) => !ISCAB(q, p)).forEach((p, i) => { m[p.id] = 'C' + (i + 1); });
    return m;
  };

  const TN = { PIA: 'MAGNETOTÉRMICO (PIA)', ID: 'DIFERENCIAL (ID)', IGA: 'IGA', REL: 'RELOJ', CON: 'CONTACTOR', SOB: 'PROTECTOR SOBRETENSIONES', BOR: 'BORNERO', OTR: 'OTRO APARATO' };

  /** Avisos del cuadro (lista de textos). */
  function comprobaciones(q, nombres = TN) {
    const w = [], ids = V(q, 'ID'), cab = CABS(q), pi = V(q, 'PIA'), N = NU(q);
    const noCumple = (n, p) => w.push(n + ': CABLE NO CUMPLE (' + F(p.se) + ' MM² ' + CB(p) + ', IZ ' + (IZC(p) || '—') + 'A, IN ' + p.in + 'A)');
    pi.forEach((p) => {
      const n = p.nom || 'MAGNETOTÉRMICO SIN NOMBRE (FILA ' + (p.row + 1) + ', POS. ' + (p.col + 1) + ')';
      const i = ids.find((x) => x.id == p.dep);
      if (cab.has(p.id)) {
        const di = ids.find((x) => x.pp == p.id);
        if (di && p.in > di.in) w.push(n + ': EL P.I.A. DE CABECERA (' + p.in + 'A) SUPERA A ' + IDN(q, di) + ' (' + di.in + 'A), NO LO PROTEGE');
        if (!OKC(q, p)) noCumple(n, p);
        return;
      }
      if (!p.nom) w.push(n);
      if (!i) w.push(n + ': SIN DIFERENCIAL ASIGNADO');
      if (!OKC(q, p)) noCumple(n, p);
    });
    if (ids.length && !AGU(q) && !V(q, 'SOB').length) w.push('FALTA EL PROTECTOR DE SOBRETENSIONES: LOS DIFERENCIALES CUELGAN DE ÉL');
    const sb0 = V(q, 'SOB')[0];
    if (sb0 && FS(sb0) == '1') {
      const tri = ids.filter((i) => FS(i) == '3').map((i) => IDN(q, i)).concat(pi.filter((p) => FS(p) == '3').map((p) => N[p.id] || p.nom || 'MAGNETOTÉRMICO ' + p.in + 'A'));
      if (tri.length) w.push('EL PROTECTOR DE SOBRETENSIONES ES MONOFÁSICO Y HAY APARATOS TRIFÁSICOS: ' + tri.join(', '));
    }
    ids.forEach((i) => {
      const nm = IDN(q, i) + ' (' + i.in + 'A/' + i.sn + 'MA)';
      if (!pi.some((p) => p.dep == i.id)) w.push(nm + ': SIN MAGNETOTÉRMICOS');
      const su = NCAB(q, i);
      if (su) w.push(nm + ': LOS MAGNETOTÉRMICOS QUE CUELGAN SUMAN ' + su + 'A. PON UN P.I.A. DE CABECERA DE ' + i.in + 'A O MENOS ANTES DEL DIFERENCIAL (O UN PROTECTOR DE SOBRETENSIONES DE ' + i.in + 'A O MENOS)');
    });
    V(q, 'REL').concat(V(q, 'CON')).forEach((d) => {
      if (!pi.some((p) => p.id == d.dep)) w.push((nombres[d.t] || d.t) + ' (FILA ' + (d.row + 1) + ', POS. ' + (d.col + 1) + '): SIN MAGNETOTÉRMICO ASIGNADO');
    });
    return w;
  }

  return { IZ, CAB, SECI, SEC, TN, F, FS, FSN, pc, CB, IZC, SA, ord, V, ISCAB, PW, OKC, CABS, IDCAB, AGU, SUMID, IDN, NCAB, NU, comprobaciones };
});
