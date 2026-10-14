// SOLTEC V2 · Firma «a bolígrafo» y sello «de caucho» dibujados en un canvas.
// Funciona en el navegador (canvas 2D). Sin dependencias.

/** Azul de bolígrafo BIC Cristal (tinta azul clásica). */
export const AZUL_BIC = '#123a9c';
export const TINTAS_SELLO = { azul: '#27399a', violeta: '#4b2f8f', rojo: '#b3202a', negro: '#2b2b2b' };

/** Números pseudoaleatorios repetibles (para que el sello no cambie cada vez que se dibuja). */
export function aleatorio(semilla = 1) {
  let s = semilla >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

// ---------------------------------------------------------------- firma con bolígrafo
/**
 * Dibuja un trazo como un bolígrafo: más fino cuanto más rápido, curvas suavizadas y una tinta
 * ligeramente irregular. puntos: [{x, y, t}] (t en ms).
 */
export function trazoBoli(ctx, puntos, { color = AZUL_BIC, grosor = 2.4, rnd = Math.random } = {}) {
  if (!puntos.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  if (puntos.length === 1) {
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(puntos[0].x, puntos[0].y, grosor * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  let anchoPrevio = grosor;
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1], b = puntos[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const v = d / Math.max(1, (b.t ?? 0) - (a.t ?? 0)); // px/ms
    // Rápido → más fino; lento → la bola deja más tinta
    const objetivo = Math.max(grosor * 0.45, Math.min(grosor * 1.15, grosor * (1.2 - v * 0.35)));
    const ancho = anchoPrevio * 0.6 + objetivo * 0.4;
    anchoPrevio = ancho;
    const p0 = i > 1 ? { x: (puntos[i - 2].x + a.x) / 2, y: (puntos[i - 2].y + a.y) / 2 } : a;
    const p2 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    ctx.globalAlpha = 0.82 + rnd() * 0.16; // la tinta del boli no es uniforme
    ctx.lineWidth = ancho;
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(a.x, a.y, p2.x, p2.y); ctx.stroke();
  }
  ctx.restore();
}

/** Recorta un canvas a lo dibujado (con margen) y devuelve un canvas nuevo con fondo transparente. */
export function recortar(canvas, margen = 12) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: hgt } = canvas;
  const px = ctx.getImageData(0, 0, w, hgt).data;
  let x0 = w, y0 = hgt, x1 = -1, y1 = -1;
  for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) {
    if (px[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - margen); y0 = Math.max(0, y0 - margen); x1 = Math.min(w - 1, x1 + margen); y1 = Math.min(hgt - 1, y1 + margen);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// ---------------------------------------------------------------- sello de caucho
/** Ruido suave (value noise) para el desgaste del sello. */
function ruido(rnd, celda) {
  const cache = new Map();
  const v = (i, j) => { const k = i * 73856093 ^ j * 19349663; if (!cache.has(k)) cache.set(k, rnd()); return cache.get(k); };
  const suave = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / celda, gy = y / celda, i = Math.floor(gx), j = Math.floor(gy), fx = suave(gx - i), fy = suave(gy - j);
    const a = v(i, j), b = v(i + 1, j), c = v(i, j + 1), d = v(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

/** Texto curvado a lo largo de una circunferencia (arriba o abajo). */
function textoCurvo(ctx, texto, cx, cy, r, arriba = true) {
  const letras = [...texto];
  const anchos = letras.map((l) => ctx.measureText(l).width);
  const total = anchos.reduce((a, b) => a + b, 0) + (letras.length - 1) * 2;
  let ang = (arriba ? -Math.PI / 2 : Math.PI / 2) + (arriba ? -1 : 1) * (total / r) / 2;
  for (let i = 0; i < letras.length; i++) {
    const paso = (anchos[i] + 2) / r;
    const a = ang + (arriba ? 1 : -1) * (anchos[i] / 2) / r;
    ctx.save();
    ctx.translate(cx + r * Math.cos(a), cy + r * Math.sin(a));
    ctx.rotate(a + (arriba ? Math.PI / 2 : -Math.PI / 2));
    ctx.fillText(letras[i], -anchos[i] / 2, 0);
    ctx.restore();
    ang += (arriba ? 1 : -1) * paso;
  }
}

/** Ajusta el tamaño de letra para que el texto quepa en el ancho dado. */
function ajustar(ctx, texto, max, base, peso = 'bold', familia = 'Arial, Helvetica, sans-serif') {
  let t = base;
  ctx.font = `${peso} ${t}px ${familia}`;
  while (t > 10 && ctx.measureText(texto).width > max) { t -= 1; ctx.font = `${peso} ${t}px ${familia}`; }
  return t;
}

/**
 * Sello de caucho muy usado, con los datos de la empresa.
 * @param e  datos de empresa (normalizarEmpresa)
 * @param {{forma?:'redondo'|'rectangular', tinta?:string, semilla?:number, desgaste?:number}} o
 * @returns HTMLCanvasElement con fondo transparente
 */
export function dibujarSello(e, { forma = 'redondo', tinta = TINTAS_SELLO.azul, semilla = 7, desgaste = 0.85 } = {}) {
  const em = e?.empresa || {}, tec = e?.tecnico || {};
  const nombre = (em.nombre || em.nombreComercial || 'EMPRESA').toUpperCase();
  const lugar = [em.localidad, em.provincia && em.provincia !== em.localidad ? em.provincia : ''].filter(Boolean).join(' · ').toUpperCase();
  const rnd = aleatorio(semilla);
  const W = forma === 'redondo' ? 900 : 1200, H = forma === 'redondo' ? 900 : 620;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = tinta; ctx.strokeStyle = tinta;
  ctx.textBaseline = 'middle';
  // Un sello real nunca sale recto
  ctx.translate(W / 2, H / 2); ctx.rotate((rnd() - 0.55) * 0.12); ctx.scale(0.93, 0.93); ctx.translate(-W / 2, -H / 2);

  if (forma === 'redondo') {
    const cx = W / 2, cy = H / 2;
    ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(cx, cy, 410, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, 378, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, 250, 0, Math.PI * 2); ctx.stroke();
    ctx.font = 'bold 62px Arial, Helvetica, sans-serif';
    let t = 62;
    while (t > 30 && ctx.measureText(nombre).width + nombre.length * 2 > Math.PI * 300 * 0.95) { t -= 2; ctx.font = `bold ${t}px Arial, Helvetica, sans-serif`; }
    textoCurvo(ctx, nombre, cx, cy, 316, true);
    if (lugar) { ctx.font = 'bold 46px Arial, Helvetica, sans-serif'; textoCurvo(ctx, lugar, cx, cy, 322, false); }
    // Estrellas separadoras
    ctx.font = 'bold 44px Arial'; ctx.textAlign = 'center';
    ctx.fillText('★', cx - 316, cy); ctx.fillText('★', cx + 316, cy);
    // Centro
    const centro = [em.nif && `C.I.F. ${em.nif}`, tec.numero && `Nº ${tec.numero}`, 'INSTALACIONES', 'ELÉCTRICAS'].filter(Boolean).slice(0, 3);
    const alturas = centro.length === 3 ? [-70, 5, 75] : [-38, 38];
    centro.forEach((l, i) => { ajustar(ctx, l, 430, i === 0 ? 54 : 48); ctx.fillText(l, cx, cy + alturas[i]); });
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx - 190, cy - 30); ctx.lineTo(cx + 190, cy - 30); ctx.stroke();
  } else {
    ctx.lineWidth = 14; ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.lineWidth = 5; ctx.strokeRect(50, 50, W - 100, H - 100);
    ctx.textAlign = 'center';
    const lineas = [
      [nombre, 92],
      [em.nif ? `C.I.F. ${em.nif}` : '', 58],
      [[em.direccion, em.cp].filter(Boolean).join(' · ').toUpperCase(), 48],
      [lugar, 48],
      [[em.telefono && `TEL. ${em.telefono}`, tec.numero && `Nº INST. ${tec.numero}`].filter(Boolean).join('   '), 44],
    ].filter(([l]) => l);
    const paso = (H - 160) / lineas.length;
    lineas.forEach(([l, tam], i) => { ajustar(ctx, l, W - 160, tam); ctx.fillText(l, W / 2, 80 + paso * (i + 0.5)); });
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  desgastar(ctx, W, H, rnd, desgaste);
  return cv;
}

/** Desgaste de sello de caucho: tinta irregular, zonas que no marcan, poros y presión desigual. */
export function desgastar(ctx, W, H, rnd, desgaste = 0.85) {
  const img = ctx.getImageData(0, 0, W, H);
  const px = img.data;
  const gruesa = ruido(rnd, 140), media = ruido(rnd, 38), fina = ruido(rnd, 7);
  const angP = rnd() * Math.PI * 2, dx = Math.cos(angP), dy = Math.sin(angP);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (!px[i + 3]) continue;
    const presion = 0.78 + 0.32 * (((x - W / 2) * dx + (y - H / 2) * dy) / (W / 2)); // un lado apretado más que otro
    const n = gruesa(x, y) * 0.55 + media(x, y) * 0.3 + fina(x, y) * 0.15;
    let a = presion * (0.45 + n * 0.85);
    if (n < 0.28 + desgaste * 0.12) a *= 0.25; // calvas donde el caucho ya no marca
    if (rnd() < 0.06 * desgaste) a *= 0.15; // poros
    px[i + 3] = Math.max(0, Math.min(255, px[i + 3] * Math.min(1, a)));
  }
  ctx.putImageData(img, 0, 0);
}


// ---------------------------------------------------------------- sello con el logo (modelo elegido: «B sin marco»)
/** Quita el fondo blanco de un logo (lo vuelve transparente) para que se vea como tinta. */
export function logoSinFondo(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    const m = Math.min(px[i], px[i + 1], px[i + 2]);
    if (m > 235) px[i + 3] = 0;
    else if (m > 180) px[i + 3] = Math.round(px[i + 3] * (235 - m) / 55);
  }
  g.putImageData(d, 0, 0);
  return c;
}

export const NEGRO_SELLO = '#1d1d1f', ROJO_SELLO = '#d42a1e';

/**
 * Sello con los colores de la empresa: logo arriba, línea roja y los datos en negro, sin marco.
 * @param e  datos de empresa
 * @param logo  imagen del logo (HTMLImageElement o canvas), o null
 */
export function dibujarSelloLogo(e, logo, { semilla = 23, desgaste = 0.85 } = {}) {
  const em = e?.empresa || {}, tec = e?.tecnico || {};
  const rnd = aleatorio(semilla);
  const W = 1200, H = 600;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.translate(W / 2, H / 2); ctx.rotate((rnd() - 0.55) * 0.1); ctx.scale(0.94, 0.94); ctx.translate(-W / 2, -H / 2);
  let y = 40;
  if (logo) {
    const lg = logoSinFondo(logo);
    const k = Math.min(520 / lg.width, 230 / lg.height);
    ctx.drawImage(lg, W / 2 - (lg.width * k) / 2, y, lg.width * k, lg.height * k);
    y += lg.height * k + 26;
  } else {
    ctx.fillStyle = NEGRO_SELLO; ajustar(ctx, (em.nombreComercial || em.nombre || 'EMPRESA').toUpperCase(), 900, 110, '900');
    ctx.fillText((em.nombreComercial || em.nombre || 'EMPRESA').toUpperCase(), W / 2, y + 60);
    y += 140;
  }
  ctx.fillStyle = ROJO_SELLO; ctx.fillRect(110, y, W - 220, 9);
  y += 46;
  ctx.fillStyle = NEGRO_SELLO;
  const lineas = [
    [[(em.nombre || em.nombreComercial || '').toUpperCase(), em.nif && `C.I.F. ${em.nif}`].filter(Boolean).join(' · '), 56],
    [[em.direccion, [em.cp, em.localidad].filter(Boolean).join(' ')].filter(Boolean).join(' · ').toUpperCase(), 46],
    [[em.telefono && `TEL. ${em.telefono}`, tec.numero && `Nº INST. ${tec.numero}`].filter(Boolean).join('   '), 46],
  ].filter(([l]) => l);
  for (const [l, tam] of lineas) { ajustar(ctx, l, W - 200, tam); ctx.fillText(l, W / 2, y); y += tam + 16; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  desgastar(ctx, W, H, rnd, desgaste);
  return recortar(cv, 10) || cv;
}
