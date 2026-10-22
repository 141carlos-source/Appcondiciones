// SOLTEC V2 · Capa 1 · Validación de formatos españoles.
// Comprueban formato y dígitos de control. No acreditan identidad ni que el suministro exista.
// Cada función devuelve null si es correcto, o un texto breve que explica el problema.

const clean = (v) => String(v ?? '').toUpperCase().replace(/[\s.\-_/]/g, '');

const DNI_LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE';

export function nifTipo(v) {
  const s = clean(v);
  if (/^\d{8}[A-Z]$/.test(s)) return 'DNI';
  if (/^[XYZ]\d{7}[A-Z]$/.test(s)) return 'NIE';
  if (/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/.test(s)) return 'CIF';
  return null;
}

export function validarNif(v) {
  const s = clean(v);
  if (!s) return 'Falta el DNI/NIF/CIF';
  const tipo = nifTipo(s);
  if (tipo === 'DNI') return DNI_LETRAS[+s.slice(0, 8) % 23] === s[8] ? null : 'Letra del DNI incorrecta';
  if (tipo === 'NIE') {
    const n = 'XYZ'.indexOf(s[0]) + s.slice(1, 8);
    return DNI_LETRAS[+n % 23] === s[8] ? null : 'Letra del NIE incorrecta';
  }
  if (tipo === 'CIF') {
    const d = s.slice(1, 8);
    let suma = 0;
    for (let i = 0; i < 7; i++) {
      let x = +d[i];
      if (i % 2 === 0) { x *= 2; x = Math.floor(x / 10) + (x % 10); }
      suma += x;
    }
    const c = (10 - (suma % 10)) % 10;
    const letra = 'JABCDEFGHI'[c];
    const ctrl = s[8];
    const soloLetra = 'NPQRSW'.includes(s[0]) || s.slice(1, 3) === '00';
    const soloNumero = 'ABEH'.includes(s[0]);
    const ok = soloLetra ? ctrl === letra : soloNumero ? ctrl === String(c) : ctrl === letra || ctrl === String(c);
    return ok ? null : 'Dígito de control del CIF incorrecto';
  }
  return 'Formato de DNI/NIE/CIF no reconocido';
}

export function validarCups(v) {
  const s = clean(v);
  if (!s) return 'Falta el CUPS';
  const m = /^ES(\d{16})([A-Z]{2})(\d[FPCRXYZ0-9])?$/.exec(s);
  if (!m) return 'El CUPS debe ser ES + 16 dígitos + 2 letras (20 o 22 caracteres)';
  const r = Number(BigInt(m[1]) % 529n);
  const esperado = DNI_LETRAS[Math.floor(r / 23)] + DNI_LETRAS[r % 23];
  return esperado === m[2] ? null : 'Letras de control del CUPS incorrectas';
}

/** CUPS sin el sufijo de punto frontera: sirve para comparar duplicados. */
export const cupsBase = (v) => clean(v).slice(0, 20);

export function validarIban(v) {
  const s = clean(v);
  if (!s) return 'Falta el IBAN';
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return 'Formato de IBAN no válido';
  if (s.startsWith('ES') && s.length !== 24) return 'Un IBAN español tiene 24 caracteres';
  const reord = s.slice(4) + s.slice(0, 4);
  const num = reord.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  return BigInt(num) % 97n === 1n ? null : 'Dígitos de control del IBAN incorrectos';
}

export const formatearIban = (v) => clean(v).replace(/(.{4})/g, '$1 ').trim();

export function validarTelefono(v) {
  let s = String(v ?? '').replace(/[\s.\-()]/g, '');
  if (!s) return 'Falta el teléfono';
  s = s.replace(/^(\+34|0034)/, '');
  return /^[6789]\d{8}$/.test(s) ? null : 'Teléfono español de 9 cifras (empieza por 6, 7, 8 o 9)';
}

/**
 * Teléfono con el prefijo del país: «600123123», «0034 600 12 31 23» o «34600123123» → «+34 600 123 123».
 * Un número de otro país que ya lleva su «+» se deja tal cual (sin espacios de más). Lo que no se reconoce, igual.
 */
export function formatearTelefono(v) {
  const t = String(v ?? '').trim();
  if (!t) return '';
  const d = t.replace(/[\s.\-()]/g, '');
  const m = /^(?:\+34|0034|34)?([6789]\d{8})$/.exec(d);
  if (m) return '+34 ' + m[1].replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');
  if (/^(\+|00)\d{6,15}$/.test(d)) return t.replace(/\s+/g, ' ');
  return t;
}

export function validarEmail(v) {
  const s = String(v ?? '').trim();
  if (!s) return 'Falta el correo';
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? null : 'Correo electrónico no válido';
}

export const PROVINCIAS = {
  '01': 'Araba/Álava', '02': 'Albacete', '03': 'Alicante', '04': 'Almería', '05': 'Ávila', '06': 'Badajoz',
  '07': 'Illes Balears', '08': 'Barcelona', '09': 'Burgos', '10': 'Cáceres', '11': 'Cádiz', '12': 'Castellón',
  '13': 'Ciudad Real', '14': 'Córdoba', '15': 'A Coruña', '16': 'Cuenca', '17': 'Girona', '18': 'Granada',
  '19': 'Guadalajara', '20': 'Gipuzkoa', '21': 'Huelva', '22': 'Huesca', '23': 'Jaén', '24': 'León',
  '25': 'Lleida', '26': 'La Rioja', '27': 'Lugo', '28': 'Madrid', '29': 'Málaga', '30': 'Murcia',
  '31': 'Navarra', '32': 'Ourense', '33': 'Asturias', '34': 'Palencia', '35': 'Las Palmas', '36': 'Pontevedra',
  '37': 'Salamanca', '38': 'Santa Cruz de Tenerife', '39': 'Cantabria', '40': 'Segovia', '41': 'Sevilla',
  '42': 'Soria', '43': 'Tarragona', '44': 'Teruel', '45': 'Toledo', '46': 'Valencia', '47': 'Valladolid',
  '48': 'Bizkaia', '49': 'Zamora', '50': 'Zaragoza', '51': 'Ceuta', '52': 'Melilla',
};

export function validarCp(v) {
  const s = String(v ?? '').trim();
  if (!s) return 'Falta el código postal';
  if (!/^\d{5}$/.test(s)) return 'El código postal tiene 5 cifras';
  return PROVINCIAS[s.slice(0, 2)] ? null : 'Código postal fuera de rango (01–52)';
}

export const provinciaDeCp = (cp) => (PROVINCIAS[String(cp ?? '').trim().slice(0, 2)] || '').toLocaleUpperCase('es-ES');

/** Referencia catastral de 20 caracteres con sus dos letras de control. */
export function validarRefCatastral(v) {
  const s = clean(v);
  if (!s) return 'Falta la referencia catastral';
  if (s.length === 14) return 'Faltan los 6 últimos caracteres de la referencia catastral (debe tener 20)';
  if (!/^[0-9A-Z]{18}[A-Z]{2}$/.test(s)) return 'La referencia catastral tiene 20 caracteres';
  return s.slice(18) === controlCatastral(s) ? null : 'Letras de control de la referencia catastral incorrectas';
}

function controlCatastral(s) {
  const pesos = [13, 15, 12, 5, 4, 17, 9, 21, 3, 7, 1];
  const letras = 'MQWERTYUIOPASDFGHJKLBZX';
  const val = (c) => (/\d/.test(c) ? +c : 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.indexOf(c) + 1);
  const calc = (cad) => letras[[...cad].reduce((a, c, i) => a + val(c) * pesos[i], 0) % 23];
  const p1 = s.slice(0, 7), p2 = s.slice(7, 14), cargo = s.slice(14, 18);
  return calc(p1 + cargo) + calc(p2 + cargo);
}

export function validarNumero(v, { min = 0, etiqueta = 'El valor' } = {}) {
  if (v === '' || v === null || v === undefined) return `Falta ${etiqueta.toLowerCase()}`;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) return `${etiqueta} debe ser un número`;
  return n > min ? null : `${etiqueta} debe ser mayor que ${min}`;
}
