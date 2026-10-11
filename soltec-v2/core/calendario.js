// SOLTEC V2 · Citas en el calendario del teléfono y cálculo de alarmas.
// Una app web no puede sonar con el móvil bloqueado y la app cerrada; el calendario del teléfono sí.
// Por eso cada cita se puede pasar a Google Calendar (Android) o como archivo .ics (iPhone, Outlook),
// con su aviso incluido.

export const ANTELACIONES = [
  { min: 0, texto: 'A la hora' },
  { min: 5, texto: '5 min antes' },
  { min: 10, texto: '10 min antes' },
  { min: 15, texto: '15 min antes' },
  { min: 30, texto: '30 min antes' },
  { min: 60, texto: '1 hora antes' },
  { min: 120, texto: '2 horas antes' },
  { min: 1440, texto: '1 día antes' },
];
const DURACION_MIN = 30;
const HORA_SIN_HORA = '09:00'; // citas sin hora: avisar a las 9 de ese día

const dos = (n) => String(n).padStart(2, '0');

/** Fecha y hora de la cita (hora local del dispositivo). */
export function inicioCita(cita) {
  if (!cita?.fecha) return null;
  const d = new Date(`${cita.fecha}T${cita.hora || HORA_SIN_HORA}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Momento en que debe sonar la alarma (inicio menos la antelación). */
export function momentoAlarma(cita) {
  const ini = inicioCita(cita);
  if (!ini) return null;
  return new Date(ini.getTime() - (Number(cita.antelacion) || 0) * 60000);
}

/** ¿Toca avisar ahora? Solo dentro de las 12 h siguientes al momento (no avisa de lo muy antiguo). */
export function debeSonar(cita, ahora = new Date()) {
  if (!cita?.alarma || cita.hecho) return false;
  const m = momentoAlarma(cita);
  return !!m && m <= ahora && ahora - m < 12 * 3600 * 1000;
}

const utc = (d) => `${d.getUTCFullYear()}${dos(d.getUTCMonth() + 1)}${dos(d.getUTCDate())}T${dos(d.getUTCHours())}${dos(d.getUTCMinutes())}00Z`;
const diaIcs = (iso) => iso.replace(/-/g, '');
const diaSiguiente = (iso) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 1); return `${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}`; };

/** Texto de detalle: aviso, cliente, teléfono, dirección y notas. */
export function detalleCita(cita, aviso = null) {
  const a = aviso?.data || aviso;
  return [
    a ? `Aviso ${a.numero || ''}${a.cliente?.nombre ? ' · ' + a.cliente.nombre : ''}` : '',
    a?.cliente?.telefono ? `Tel. ${a.cliente.telefono}` : '',
    cita.responsable ? `Responsable: ${cita.responsable}` : '',
    cita.notas || '',
  ].filter(Boolean).join('\n');
}

/** Enlace que abre Google Calendar con la cita rellenada (el usuario solo pulsa Guardar). */
export function enlaceGoogle(cita, { aviso = null, lugar = '' } = {}) {
  const ini = inicioCita(cita);
  if (!ini) return null;
  const fechas = cita.hora
    ? `${utc(ini)}/${utc(new Date(ini.getTime() + DURACION_MIN * 60000))}`
    : `${diaIcs(cita.fecha)}/${diaSiguiente(cita.fecha)}`;
  const p = new URLSearchParams({ action: 'TEMPLATE', text: `SOLTEC · ${cita.titulo || 'Cita'}`, dates: fechas, details: detalleCita(cita, aviso) });
  if (lugar) p.set('location', lugar);
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}

const escIcs = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** Líneas de más de 75 octetos se parten (RFC 5545). */
const plegar = (linea) => {
  const out = [];
  let resto = linea;
  const enc = new TextEncoder();
  while (enc.encode(resto).length > 75) {
    let n = 75;
    while (enc.encode(resto.slice(0, n)).length > 75) n--;
    out.push(resto.slice(0, n));
    resto = ' ' + resto.slice(n);
  }
  out.push(resto);
  return out.join('\r\n');
};

/** Archivo .ics con la cita y su alarma (sonido del propio teléfono). */
export function icsCita(cita, { id = 'cita', aviso = null, lugar = '', ahora = new Date() } = {}) {
  const ini = inicioCita(cita);
  if (!ini) return null;
  const ant = Number(cita.antelacion) || 0;
  const lineas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//M. A. SOLTEC//SOLTEC V2//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${id}@soltec-v2`,
    `DTSTAMP:${utc(ahora)}`,
    ...(cita.hora
      ? [`DTSTART:${utc(ini)}`, `DTEND:${utc(new Date(ini.getTime() + DURACION_MIN * 60000))}`]
      : [`DTSTART;VALUE=DATE:${diaIcs(cita.fecha)}`, `DTEND;VALUE=DATE:${diaSiguiente(cita.fecha)}`]),
    `SUMMARY:${escIcs('SOLTEC · ' + (cita.titulo || 'Cita'))}`,
    `DESCRIPTION:${escIcs(detalleCita(cita, aviso))}`,
    ...(lugar ? [`LOCATION:${escIcs(lugar)}`] : []),
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escIcs(cita.titulo || 'Cita')}`,
    // Sin hora: aviso a las 9:00 del día (9 h después del inicio del día), menos la antelación
    `TRIGGER:${cita.hora ? (ant ? `-PT${ant}M` : 'PT0M') : `PT${9 * 60 - ant}M`}`.replace('PT-', '-PT'),
    'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lineas.map(plegar).join('\r\n') + '\r\n';
}

/** Nombre de archivo .ics legible. */
export function nombreIcs(cita) {
  const t = String(cita.titulo || 'cita').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  return `SOLTEC_${cita.fecha || ''}_${t || 'cita'}.ics`;
}
