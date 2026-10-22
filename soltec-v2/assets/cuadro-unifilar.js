/* SOLTEC V2 · Esquema unifilar de CuadroLab, separado de la pantalla para poder probarlo.
   Qué se dibuja (alimentación, diferenciales con sus circuitos, cabeceras, protectores), cómo se reparte en hojas
   A4/A3 con «continúa en la hoja…» y el SVG de cada hoja. Funciones puras: reciben el cuadro q (el estado S).
   Necesita CuadroReglas (assets/cuadro-reglas.js) cargado antes. */
(function (raiz, fabrica) {
  const U = fabrica(raiz.CuadroReglas || (typeof require === 'function' ? require('./cuadro-reglas.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = U;
  else raiz.CuadroUnifilar = U;
})(typeof globalThis !== 'undefined' ? globalThis : self, function (R) {
  'use strict';
  const E = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /** Medidas del dibujo: ancho por circuito, altura del embarrado, primera columna y eje de la alimentación. */
  const W = 64, BY = 130, X0 = 70, ax = 50;
  /** Opciones de «circuitos por hoja» (0 = todo en una hoja). */
  const OPC_HOJA = [[14, '14 (A4 LEGIBLE)'], [6, '6'], [8, '8'], [10, '10'], [12, '12'], [16, '16'], [20, '20'], [24, '24'], [0, 'TODOS EN UNA HOJA']];
  const papel = (q) => ((q.p || {}).pp == 'A3' ? 'A3' : 'A4');
  const circuitosPorHoja = (q) => ((q.p || {}).ch === undefined ? 14 : +q.p.ch);

  /**
   * Reparte los grupos (diferencial + sus circuitos) en hojas de «lim» circuitos como mucho. Un diferencial con
   * más circuitos que caben se parte en tramos (cont = viene de la hoja anterior, sigue = continúa en la siguiente).
   */
  function repartir(gr, cph) {
    const lim = cph || 1e9;
    let q0 = 0; const tro = [];
    gr.forEach((g) => { const qq = g.i ? ++q0 : 0, k = g.k.length ? g.k : [null]; for (let a = 0; a < k.length; a += lim) tro.push({ i: g.i, q: qq, k: k.slice(a, a + lim).filter(Boolean), cont: a > 0, sigue: a + lim < k.length }); });
    const hojas = []; let ac = [], na = 0;
    tro.forEach((t) => { const n = Math.max(1, t.k.length); if (ac.length && na + n > lim) { hojas.push(ac); ac = []; na = 0; } ac.push(t); na += n; });
    hojas.push(ac);
    return hojas;
  }

  /** Lo que lleva el unifilar: alimentación (IGA / protector / P.I.A. del cuadro padre), grupos y hojas. */
  function esquema(q) {
    const ig0 = R.V(q, 'IGA')[0];
    const ig = ig0 ? { on: 1, m: ig0.po || ig0.m, in: ig0.in, mk: ig0.mk || 'CHINT NXB-63', cu: ig0.cu || 'C' } : null;
    const sb = ig ? null : R.V(q, 'SOB')[0], sbs = R.V(q, 'SOB').filter((d) => d !== sb);
    const ids = R.V(q, 'ID'), pi0 = R.V(q, 'PIA'), cab = R.CABS(q), pi = pi0.filter((p) => !cab.has(p.id));
    const gr = ids.map((i) => ({ i, k: pi.filter((p) => p.dep == i.id) }));
    const orf = pi.filter((p) => !ids.some((i) => i.id == p.dep));
    if (orf.length) gr.push({ i: null, k: orf });
    const [pk, pid] = (q.pa || '').split('|'), pq = (q.cs || []).find((c) => c.k == pk), pp = pq && pq.dv.find((d) => d.id == pid);
    const fd = pp ? 'P.I.A. ' + pp.m + 'x' + pp.in + 'A' : '';
    const PAP = papel(q), CPH = circuitosPorHoja(q), hojas = repartir(gr, CPH);
    return { ig, sb, sbs, ids, pi0, pi, gr, pq, pp, fd, PAP, CPH, hojas, NH: hojas.length };
  }

  /** SVG de la hoja h del esquema e. nombres = nombres de los tipos de aparato (TN, con los personalizados). */
  function svgHoja(q, e, h, nombres = R.TN) {
    const { ig, sb, sbs, pi0, pq, pp, fd, NH } = e, hj = e.hojas[h], N = R.NU(q), idn = (i) => R.IDN(q, i);
    const L=(a,b,c,d,z)=>`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="#111" stroke-width="1"${z?' stroke-dasharray="4 3"':''}/>`;
const T=(t,a,b,r,z,w,n)=>`<text transform="translate(${a},${b}) rotate(${r})" font-size="${z||9}" font-weight="${w||400}" text-anchor="${n||'start'}" fill="#111" font-family="Arial">${E(t)}</text>`;
const DOT=(a,b)=>`<circle cx="${a}" cy="${b}" r="2" fill="#111"/>`,FL=(a,b)=>`<path d="M${a-7} ${b-4}L${a} ${b}L${a-7} ${b+4}" fill="none" stroke="#111"/>`,sy=(c,y,dif,m,k)=>{const w=k?1.8:1,l=(a,b,e,f,z,d)=>`<line x1="${a}" y1="${b}" x2="${e}" y2="${f}" stroke="#111" stroke-width="${z||w}"${d?' stroke-dasharray="2 1.5"':''}/>`;
return l(c,y,c,y+7)+l(c,y+21,c,y+28)+l(c,y+7,c+6.5,y+19.5,w+.2)+`<circle cx="${c}" cy="${y+7}" r="1.5" fill="#111"/><circle cx="${c}" cy="${y+21}" r="1.5" fill="#111"/>`+l(c-2.5,y+.5,c+2.5,y+5.5,.9)+l(c-2.5,y+5.5,c+2.5,y+.5,.9)+Array.from({length:m>1?Math.min(m,4):0},(_,n)=>l(c-2.5,y+24.6+n*1.8,c+2.5,y+22.4+n*1.8,.8)).join('')+(dif?`<rect x="${c-19}" y="${y+8}" width="10" height="13" fill="#fff" stroke="#111" stroke-width=".9"/><text x="${c-14}" y="${y+17}" font-size="5.5" text-anchor="middle" font-family="Arial">IΔ</text>`+l(c-9,y+14,c+3,y+14,.7,1):`<rect x="${c-9}" y="${y+10}" width="4" height="8" fill="#fff" stroke="#111" stroke-width=".8"/>`+l(c-5,y+14,c+3,y+14,.7,1))};
    const pri=h==0,ult=h==NH-1,ex=ult?sbs:[],tot=hj.reduce((a,t)=>a+Math.max(1,t.k.length)*W,0)+X0+110+ex.length*70;let s='',x=X0;
s+=`<rect x="24" y="36" width="${tot-48}" height="614" fill="none" stroke="#222" stroke-dasharray="12 3 2 3"/>`+T('CUADRO '+(q.p.c||'PRINCIPAL')+(NH>1?' — HOJA '+(h+1)+' DE '+NH:''),32,52,0,10,700);
if(pri){s+=T(pq?'A CUADRO '+(pq.c||'PRINCIPAL'):'ACOMETIDA',ax+8,22,0,9)+L(ax,8,ax,60);
s+=ig?sy(ax,60,0,ig.m,1)+L(ax,88,ax,BY)+T('I.G.A. '+ig.m+'x'+ig.in+'A'+(ig.cu?' '+ig.cu:''),ax+18,76,0,12,700)+(ig.mk?T(ig.mk,ax+18,91,0,10):''):sb?sy(ax,60,0,sb.m)+L(ax,88,ax,BY)+T('PROT. SOBRETENSIONES',ax+18,74,0,12,700)+T(R.FSN(R.FS(sb))+(sb.in?' '+sb.in+'A '+(sb.cu||''):''),ax+18,90,0,10.5)+(fd?T('DESDE '+fd,ax+18,104,0,9.5):''):fd?sy(ax,60,0,pp.m)+L(ax,88,ax,BY)+T(fd,ax+18,80,0,12,700):L(ax,60,ax,BY,1);
s+=L(ax,BY,ult?tot-50:tot-30,BY)}else s+=L(30,BY,ult?tot-50:tot-30,BY)+T('VIENE DE LA HOJA '+h,34,BY-8,0,10,700);
if(!ult)s+=FL(tot-30,BY)+T('CONTINÚA EN LA HOJA '+(h+2),tot-34,BY-8,0,10,700,'end');
hj.forEach(g=>{const n=Math.max(1,g.k.length),cx=x+n*W/2,x1=x+W/2,x2=x+(n-.5)*W;
if(g.i&&!g.cont){const hp=pi0.find(p=>p.id==g.i.pp),yI=hp?206:168;s+=DOT(cx,BY)+(hp?L(cx,BY,cx,140)+sy(cx,140,0,hp.m)+L(cx,168,cx,yI)+T('P.I.A. '+hp.m+'x'+hp.in+'A '+hp.cu,cx-24,157,0,11,400,'end'):L(cx,BY,cx,168))+sy(cx,yI,1,g.i.m)+L(cx,yI+28,cx,276)+T('('+String(g.q).padStart(2,'0')+')',cx,BY-8,0,11,400,'middle')+T(g.i.m+'x'+g.i.in+'A',cx-24,yI+13,0,11,400,'end')+T(g.i.sn+'mA',cx-24,yI+27,0,11,400,'end')+T(idn(g.i),cx+8,yI+46,0,10.5,700)}
else if(g.i)s+=T('(SIGUE '+idn(g.i)+')',x1-6,262,0,10,700);
else s+=L(cx,BY,cx,276,1)+T('SIN DIFERENCIAL',cx+12,270,-90,11);
const xs=g.k.map((_,j)=>x+W*(j+.5));if(xs.length)s+=L(g.cont?x1-W/2+6:Math.min(xs[0],cx),276,g.sigue?x2+W/2-6:Math.max(xs[xs.length-1],cx),276);
if(g.sigue)s+=FL(x2+W/2-6,276);
g.k.forEach((p,j)=>{const a=xs[j];s+=L(a,276,a,300)+DOT(a,276)+sy(a,300,0,p.m)+L(a,328,a,630)+`<circle cx="${a}" cy="630" r="2.2" fill="#fff" stroke="#111"/>`+T('P.I.A. '+p.m+'x'+p.in+'A '+p.cu,a-10,425,-90,11)+T(p.m+'x'+R.F(p.se)+'mm²+TT '+R.CB(p),a+14,565,-90,10.5)+(p.pw?T(p.pw+' W',a+14,624,-90,10.5):'')+T((N[p.id]?N[p.id]+' ':'')+(p.nom||'SIN NOMBRE')+q.cs.filter(c=>c.pa==q.ck+'|'+p.id).map(c=>' → '+c.c).join('')+q.dv.filter(z=>(z.t=='REL'||z.t=='CON')&&z.dep==p.id).map(z=>' + '+nombres[z.t]+(z.t=='CON'?' '+z.in+'A':'')).join(''),a-10,598,-90,11,700)});x+=n*W});
ex.forEach((d,k)=>{const sx=tot-60-70*k;s+=L(sx,BY,sx,150)+DOT(sx,BY)+sy(sx,150,0,d.m)+L(sx,178,sx,276)+`<circle cx="${sx}" cy="276" r="2.2" fill="#fff" stroke="#111"/>`+T('PROT. SOBRETENSIONES',sx-10,272,-90,10.5)+T(R.FSN(R.FS(d))+(d.in?' '+d.in+'A '+d.cu:''),sx+14,272,-90,10.5)+(d.nom?T(d.nom,sx+28,272,-90,10.5,700):'')});
return `<svg viewBox="0 0 ${tot} 660" style="width:100%;max-width:${tot*1.6}px">${s}</svg>`
  }

  /** CSS de impresión: cada hoja en una página del papel elegido, en horizontal. */
  const cssImpresion = (PAP) => `@page uni{size:${PAP} landscape;margin:8mm}@media print{#t1 .hoja-uni{display:flex!important;flex-direction:column;height:${PAP == 'A3' ? 278 : 191}mm;break-inside:avoid;overflow:hidden}#t1 .hoja-uni svg{flex:1 1 0;min-height:0;max-height:none!important;width:100%!important;height:auto}}`;

  return { W, BY, X0, OPC_HOJA, papel, circuitosPorHoja, repartir, esquema, svgHoja, cssImpresion, E };
});
