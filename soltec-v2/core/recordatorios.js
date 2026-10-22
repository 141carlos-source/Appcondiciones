// SOLTEC V2 · Recordatorios automáticos (módulo para la app). Las reglas están en recordatorios-reglas.js,
// que también usa el service worker para avisar con la app cerrada.
import './recordatorios-reglas.js';

export const {
  PLAZOS_RECORDATORIO, TIPOS_RECORDATORIO, plazosDe, diasDesde, fechaEnvio, recordatorios,
  HORARIO_AVISOS, pendientesDeAvisar, contenidoNotificacion,
} = globalThis.SoltecRecordatorios;
