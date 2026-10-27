// SOLTEC V2 · Potencias eléctricas: la máxima que admite el IGA y las potencias normalizadas para contratar.
// Funciones puras (las usan la ficha del aviso, el PDF del cliente y el formulario web).

/** Calibres de IGA habituales (A). */
export const IGAS = [25, 40, 63, 80, 100, 125, 250];

/** Número de un texto con coma o punto («9,2» → 9.2). NaN si no es un número. */
export const numeroKw = (s) => {
  const t = String(s ?? '').trim().replace(/\s/g, '').replace(',', '.');
  return t && /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
};
const conComa = (kw, dec) => (Math.round(kw * 10 ** dec) / 10 ** dec).toString().replace('.', ',');

/** kW que da una intensidad: 230 V → I·230; 400 V → √3·400·I. */
const kwDe = (i, tension) => (String(tension) === '400' ? Math.sqrt(3) * 400 * i : 230 * i) / 1000;

/** Potencia máxima que admite el IGA con esa tensión (kW con coma, 2 decimales). '' si falta algo. */
export const potenciaDeIga = (iga, tension) => {
  const i = Number(iga), v = String(tension ?? '');
  if (!i || !['230', '400'].includes(v)) return '';
  return conComa(kwDe(i, v), 2);
};

// Intensidades de los interruptores de control de potencia (ICP) normalizados
const INTENSIDADES = {
  230: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 63],
  400: [5, 7.5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 63],
};

/**
 * Potencias normalizadas para contratar con esa tensión, sin pasar de la máxima del IGA si se da.
 * @returns {{kw:string, a:number}[]}  kW con coma (3 decimales en trifásico, como en las facturas)
 */
export function potenciasNormalizadas(tension, maxKw) {
  const v = String(tension ?? '');
  const lista = INTENSIDADES[v];
  if (!lista) return [];
  const max = numeroKw(maxKw);
  return lista.map((a) => ({ a, kw: conComa(kwDe(a, v), v === '400' ? 3 : 2), n: kwDe(a, v) }))
    .filter((p) => !(max > 0) || p.n <= max + 0.005)
    .map(({ a, kw }) => ({ a, kw }));
}

/** Problema de la potencia a contratar (null si está bien o vacía). */
export function problemaPotencia(valor, maxKw) {
  const t = String(valor ?? '').trim();
  if (!t) return null;
  const n = numeroKw(t);
  if (!(n > 0)) return 'Escriba los kW con números (por ejemplo 5,75)';
  const max = numeroKw(maxKw);
  if (max > 0 && n > max + 0.005) return `Es más de lo que admite el IGA (${String(maxKw).replace('.', ',')} kW)`;
  return null;
}

/** Textos para el cliente. */
export const TENSIONES = { 230: '230 V (monofásico)', 400: '400 V (trifásico)' };
export const USOS = { vivienda: 'Vivienda', local: 'Local comercial', comunes: 'Servicios comunes', garaje: 'Garaje / recarga', nave: 'Nave', otro: 'Otro' };
