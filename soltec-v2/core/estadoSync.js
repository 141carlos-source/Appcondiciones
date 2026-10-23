// SOLTEC V2 · ¿Hay riesgo de perder trabajo por no sincronizar con el PC CASA?
// Si la tablet se pierde o se rompe, lo que no se subió al PC se pierde. Inicio lo avisa con una banda.
// Función pura: recibe el estado y la fecha de referencia.

const HORA = 3600000, DIA = 24 * HORA;
const cuanto = (ms) => {
  const d = Math.floor(ms / DIA);
  if (d >= 1) return d === 1 ? '1 día' : `${d} días`;
  const h = Math.max(1, Math.floor(ms / HORA));
  return h === 1 ? '1 hora' : `${h} horas`;
};

/**
 * Aviso de sincronización para Inicio (o null si todo está bien).
 * @param e {configurado, registros (cuántos datos hay en el dispositivo), pendientes, archivos,
 *           masAntiguo (ISO del cambio sin subir más antiguo), ultima (ISO de la última sincronización)}
 * @param o {horasPendiente = 24, diasSinSync = 3}
 * @returns {{nivel: 'err'|'info', titulo: string, texto: string, accion: 'sincronizar'|'configurar'} | null}
 */
export function alertaSincronizacion(e = {}, ahora = new Date(), { horasPendiente = 24, diasSinSync = 3 } = {}) {
  const t = ahora.getTime();
  const sinSubir = (e.pendientes || 0) + (e.archivos || 0);
  if (!e.configurado) {
    if (!e.registros) return null; // dispositivo vacío: nada que perder
    return { nivel: 'err', accion: 'configurar', titulo: 'Este dispositivo no está conectado al PC CASA',
      texto: 'Todo lo que hay aquí solo está en este dispositivo: si se pierde o se rompe, se pierde. Conéctalo en Ajustes › Sincronización.' };
  }
  const cambios = sinSubir === 1 ? '1 cambio' : `${sinSubir} cambios`;
  if (sinSubir && e.masAntiguo && t - new Date(e.masAntiguo).getTime() >= horasPendiente * HORA) {
    return { nivel: 'err', accion: 'sincronizar', titulo: `${cambios} sin subir al PC desde hace ${cuanto(t - new Date(e.masAntiguo).getTime())}`,
      texto: 'Si el dispositivo se pierde o se rompe, se perderían. Sincroniza en cuanto tengas conexión con el PC CASA (Tailscale abierto).' };
  }
  const ult = e.ultima ? new Date(e.ultima).getTime() : null;
  if (!ult || t - ult >= diasSinSync * DIA) {
    return { nivel: sinSubir ? 'err' : 'info', accion: 'sincronizar',
      titulo: ult ? `Sin sincronizar con el PC desde hace ${cuanto(t - ult)}` : 'Todavía no se ha sincronizado con el PC',
      texto: sinSubir ? `Hay ${cambios} sin subir. Sincroniza para tenerlos a salvo en el PC.` : 'Sincroniza para recibir lo que se haya hecho en los demás dispositivos.' };
  }
  return null;
}
