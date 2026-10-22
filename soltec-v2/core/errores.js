// SOLTEC V2 · Registro de errores del dispositivo (para poder arreglar lo que falla en móvil, tablet o PC).
// Se guarda en «meta» (solo en este dispositivo, no se sincroniza): los 100 últimos, sin repetir el mismo
// error seguido (se cuenta cuántas veces ha pasado).

export const MAX_ERRORES = 100;
const CLAVE = 'errores';

/** Texto corto y seguro de un error cualquiera. */
export function describirError(e) {
  if (!e) return { mensaje: 'Error desconocido', pila: '' };
  if (typeof e === 'string') return { mensaje: e.slice(0, 500), pila: '' };
  const mensaje = String(e.message || e.reason?.message || e.reason || e).slice(0, 500);
  const pila = String(e.stack || e.error?.stack || e.reason?.stack || '').split('\n').slice(0, 8).join('\n').slice(0, 1500);
  return { mensaje, pila };
}

/** Añade un error a la lista (los más nuevos primero). Devuelve la lista. */
export function anotarError(lista, { mensaje, pila = '', origen = 'app', ruta = '', version = '', dispositivo = '' }, ahora = new Date()) {
  const l = Array.isArray(lista) ? [...lista] : [];
  const at = ahora.toISOString();
  const ult = l[0];
  if (ult && ult.mensaje === mensaje && ult.origen === origen && ahora - new Date(ult.ultimaVez || ult.at) < 10 * 60 * 1000) {
    l[0] = { ...ult, veces: (ult.veces || 1) + 1, ultimaVez: at };
    return l;
  }
  l.unshift({ at, mensaje, pila, origen, ruta, version, dispositivo, veces: 1 });
  return l.slice(0, MAX_ERRORES);
}

// Se anotan de uno en uno: dos errores a la vez no deben pisarse al leer y escribir la lista
let cola = Promise.resolve();
export function registrarError(storage, datos) {
  cola = cola.then(async () => {
    try {
      const l = anotarError(await storage.getMeta(CLAVE), datos);
      await storage.setMeta(CLAVE, l);
      return l;
    } catch { return null; } // registrar un error nunca debe provocar otro
  });
  return cola;
}

export const leerErrores = async (storage) => (await storage.getMeta(CLAVE)) || [];
export const borrarErrores = (storage) => storage.setMeta(CLAVE, []);

/** Informe en texto para copiar o mandar por correo. */
export function informeErrores(lista, { version = '', dispositivo = '', navegador = '' } = {}) {
  const cab = [`SOLTEC V2 · registro de errores`, `Versión: ${version}`, `Dispositivo: ${dispositivo}`, `Navegador: ${navegador}`, `Errores: ${lista.length}`, ''];
  return cab.concat(lista.map((e, i) => [`#${i + 1} · ${e.at}${e.veces > 1 ? ` (×${e.veces}, último ${e.ultimaVez})` : ''} · ${e.origen}${e.ruta ? ' · ' + e.ruta : ''} · ${e.version || ''}`,
    `   ${e.mensaje}`, e.pila ? e.pila.split('\n').map((l) => '   ' + l.trim()).join('\n') : ''].filter(Boolean).join('\n'))).join('\n');
}
