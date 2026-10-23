// SOLTEC V2 · Prueba en real guiada: lo que hay que comprobar en la tablet, el móvil o el PC con lo nuevo.
// Cada paso dice qué hacer y qué debe pasar; se marca «Funciona» o «Falla» con una nota.
// El informe final se copia y se pega en el chat. Funciones puras (sin pantalla).

/**
 * Pasos. `accion`: botón que ofrece la pantalla (ir a una ruta, probar algo); `solo`: dispositivos donde tiene sentido
 * ('tactil' = tablet/móvil, 'pc' = ordenador). `auto`: comprobación que hace la app sola (ver comprobaciones()).
 */
export const PASOS = [
  { id: 'teclado', grupo: 'Escribir', titulo: 'El teclado no se cierra al escribir', solo: 'tactil',
    como: 'En un aviso nuevo, abre «Datos eléctricos» y escribe una palabra larga en «Contador». Después toca otro campo.',
    espera: 'El teclado sigue abierto mientras escribes y, al salir, el texto queda en MAYÚSCULAS.', accion: { ruta: 'aviso/nuevo', texto: 'Abrir aviso nuevo' } },
  { id: 'telefono', grupo: 'Escribir', titulo: 'Teléfono con +34',
    como: 'En el aviso nuevo, escribe 600123123 en «Teléfono» y toca otro campo.',
    espera: 'Queda «+34 600 123 123».', accion: { ruta: 'aviso/nuevo', texto: 'Abrir aviso nuevo' } },
  { id: 'autorrelleno', grupo: 'Escribir', titulo: 'Autorrelleno del cliente',
    como: 'En el aviso nuevo, escribe 3 letras del nombre de un cliente que ya tengas y toca la sugerencia.',
    espera: 'Sale la lista debajo del campo, el teclado no se cierra y se rellenan NIF, teléfono, correo… y sus direcciones como botones encima de «Calle».',
    accion: { ruta: 'aviso/nuevo', texto: 'Abrir aviso nuevo' }, nota: 'Si aún no hay avisos en este dispositivo, sáltalo. No guardes el aviso de prueba: sal con «Salir sin guardar».' },
  { id: 'ventanas', grupo: 'Ventanas', titulo: 'Ventanas de SOLTEC',
    como: 'Pulsa «Probar ventana».', espera: 'Sale una ventana blanca con botones grandes; «Cancelar» la cierra sin hacer nada.', accion: { probar: 'ventana', texto: 'Probar ventana' } },
  { id: 'recordatorios', grupo: 'Recordatorios', titulo: 'Recordatorios en Inicio',
    como: 'Abre Inicio.', espera: 'Si algún aviso lleva días sin respuesta (condiciones, autorización o documentación), sale el bloque «Recordatorios» con «Reclamado hoy» y «Ya está».',
    accion: { ruta: 'inicio', texto: 'Ir a Inicio' }, nota: 'Si no hay ninguno pendiente, es normal que no salga: márcalo como funciona.' },
  { id: 'notif', grupo: 'Recordatorios', titulo: 'Notificación de prueba',
    como: 'Pulsa «Probar notificación» (la primera vez el navegador pide permiso: acéptalo).', espera: 'Llega «SOLTEC · Prueba» como las notificaciones del móvil.', accion: { probar: 'notificacion', texto: 'Probar notificación' } },
  { id: 'notifCerrada', grupo: 'Recordatorios', titulo: 'Notificación con la app cerrada', solo: 'tactil',
    como: 'Con las notificaciones activadas y algún recordatorio pendiente, cierra la app del todo (deslizarla fuera de recientes) y espera hasta el día siguiente entre 8:00 y 21:00.',
    espera: 'Llega «SOLTEC · Recordatorio» sin abrir la app.', nota: 'Solo Chrome en Android con la app instalada; el sistema decide cuándo (puede tardar horas). En iPad no llega con la app cerrada.' },
  { id: 'frontal', grupo: 'Cuadros', titulo: 'Frontal de CuadroLab con el dibujo nuevo',
    como: 'Pulsa «Abrir CuadroLab de prueba», pon un diferencial y dos magnetotérmicos desde los desplegables y mueve uno con el dedo varias veces: mantenlo pulsado un momento (se levanta) y arrástralo a otro hueco, también a la otra fila.',
    espera: 'Los aparatos salen como en la caja (blancos, palancas azul oscuro abajo; el diferencial con el botón naranja) y se mueven con el dedo todas las veces que quieras; cerca del panel de abajo la pantalla se desplaza sola.',
    accion: { probar: 'cuadrolab', texto: 'Abrir CuadroLab de prueba' }, nota: 'Es un CuadroLab suelto: no toca ningún aviso.' },
  { id: 'autorizacion', grupo: 'Autorización', titulo: 'Autorización: sugerencias y correo',
    como: 'Abre un aviso que ya tengas › «Autorización de representatividad» › Abrir. Borra el nombre del solicitante y escribe 3 letras de otro cliente.',
    espera: 'Sale la lista de clientes y autorizaciones anteriores; al tocar uno se rellenan sus datos. «✉ Correo» prepara el PDF.', accion: { ruta: 'avisos', texto: 'Ir a Avisos' },
    nota: 'Al terminar, vuelve con «← Volver al aviso» y no guardes si era solo prueba.' },
  { id: 'partes', grupo: 'Partes', titulo: 'Parte: cliente y materiales',
    como: 'Crea un parte nuevo, escribe 3 letras de un cliente y elige; añade un material escribiendo parte de una referencia o descripción ya usada.',
    espera: 'Se rellenan cliente y dirección; el material pone referencia y descripción.', accion: { ruta: 'parte/nuevo', texto: 'Abrir parte nuevo' }, nota: 'Sal sin guardar si era solo prueba.' },
  { id: 'fotos', grupo: 'Fotos y PDF', titulo: 'Foto con la cámara', solo: 'tactil',
    como: 'En un aviso, «Plano de situación y fotografías» › añadir foto › hacer una con la cámara.', espera: 'La foto aparece en el aviso al momento.', accion: { ruta: 'avisos', texto: 'Ir a Avisos' } },
  { id: 'pdf', grupo: 'Fotos y PDF', titulo: 'PDF y compartir',
    como: 'En un aviso, «Solicitudes y comunicaciones» › ficha PDF del cliente › Compartir (por ejemplo por WhatsApp a ti mismo).', espera: 'Se abre el menú de compartir con el PDF y llega bien.', accion: { ruta: 'avisos', texto: 'Ir a Avisos' } },
  { id: 'sinConexion', grupo: 'Sin conexión', titulo: 'Funciona sin internet',
    como: 'Pon el modo avión, cierra la app y ábrela. Mira un aviso y cambia una observación. Quita el modo avión.',
    espera: 'Abre y muestra los avisos sin conexión; al volver la conexión, el cambio se sube al PC (Inicio › Sincronización).' },
  { id: 'instalador', grupo: 'Otro PC', titulo: 'Instalador .bat en otro PC con Windows', solo: 'pc',
    como: 'En el PC CASA: Ajustes › «Conectar otro dispositivo» › descargar el instalador para Windows. Llévalo a otro PC con Tailscale y ejecútalo.',
    espera: 'Crea el icono «SOLTEC V2» en el escritorio, abre la app, pide solo el nombre del dispositivo y conecta con el PC CASA.' },
];

/** ¿Tiene sentido el paso en este dispositivo? */
export const pasoAplica = (p, tactil) => !p.solo || (p.solo === 'tactil' ? tactil : !tactil);

/**
 * Comprobaciones automáticas a partir de lo que la pantalla averigua del dispositivo.
 * @param d {instalada, sw, persistente, permisoNotif, periodico, pc: {ok, version, error}, errores}
 * @returns {Array<{id, titulo, ok: boolean|null, texto}>}  ok null = no aplica / no se sabe
 */
export function comprobaciones(d = {}) {
  const c = [];
  c.push({ id: 'instalada', titulo: 'Instalada como app', ok: !!d.instalada, texto: d.instalada ? 'Se abre a pantalla completa desde su icono.' : 'Se está usando en el navegador. Instálala con «⬇ Instalar» para las notificaciones con la app cerrada.' });
  c.push({ id: 'sw', titulo: 'Funciona sin conexión', ok: !!d.sw, texto: d.sw ? 'La app está guardada en el dispositivo.' : 'Aún no: recarga una vez con conexión.' });
  c.push({ id: 'persistente', titulo: 'Datos protegidos', ok: d.persistente === undefined ? null : !!d.persistente, texto: d.persistente ? 'El navegador no borrará los datos por falta de espacio.' : 'Sin protección: Ajustes › Almacenamiento › «Proteger datos».' });
  const pn = d.permisoNotif || 'no';
  c.push({ id: 'notificaciones', titulo: 'Notificaciones', ok: pn === 'granted' ? true : pn === 'denied' ? false : null, texto: pn === 'granted' ? 'Permitidas.' : pn === 'denied' ? 'Bloqueadas en el navegador (candado › Notificaciones).' : pn === 'no' ? 'Este navegador no las permite.' : 'Sin activar todavía.' });
  c.push({ id: 'periodico', titulo: 'Aviso con la app cerrada', ok: d.periodico === 'si' ? true : d.periodico === 'denegado' ? false : null, texto: d.periodico === 'si' ? 'Registrado: el sistema despertará la app de vez en cuando.' : d.periodico === 'denegado' ? 'El navegador no lo permite (instala la app en Chrome).' : d.periodico === 'permitido' ? 'Disponible: se registra al activar las notificaciones.' : 'No disponible en este navegador: avisa al abrir la app.' });
  if (d.pc) c.push({ id: 'pc', titulo: 'Conexión con el PC CASA', ok: d.pc.sinConfigurar ? null : !!d.pc.ok, texto: d.pc.sinConfigurar ? 'Este dispositivo aún no está conectado al PC.' : d.pc.ok ? `Responde (servidor ${d.pc.version || ''}).` : `No responde: ${d.pc.error || 'sin conexión'}.` });
  c.push({ id: 'errores', titulo: 'Registro de errores', ok: !d.errores, texto: d.errores ? `${d.errores} error(es) anotados: van en el informe.` : 'Sin errores.' });
  return c;
}

/** Cuántos pasos funcionan, fallan o faltan (solo los que aplican). */
export function resumenPruebas(resultados = {}, tactil = true) {
  const aplican = PASOS.filter((p) => pasoAplica(p, tactil));
  const r = { total: aplican.length, ok: 0, falla: 0, falta: 0 };
  for (const p of aplican) { const e = resultados[p.id]?.estado; if (e === 'ok') r.ok++; else if (e === 'falla') r.falla++; else r.falta++; }
  return r;
}

/** Informe de texto para pegar en el chat. */
export function informePruebas(resultados = {}, { version = '', dispositivo = '', navegador = '', pantalla = '', tactil = true, auto = [], errores = [] } = {}, ahora = new Date()) {
  const r = resumenPruebas(resultados, tactil);
  const marca = (e) => (e === 'ok' ? '✅' : e === 'falla' ? '❌' : '⏳');
  const l = [
    'INFORME DE PRUEBA EN REAL · SOLTEC V2',
    `Versión: ${version}`, `Dispositivo: ${dispositivo || '(sin nombre)'}${pantalla ? ' · pantalla ' + pantalla : ''} · ${tactil ? 'táctil' : 'ratón'}`,
    `Navegador: ${navegador}`, `Fecha: ${ahora.toLocaleString('es-ES')}`,
    `Resultado: ${r.ok} funcionan, ${r.falla} fallan, ${r.falta} sin probar (de ${r.total})`, '',
    'COMPROBACIONES AUTOMÁTICAS',
    ...auto.map((c) => `${c.ok === true ? '✅' : c.ok === false ? '❌' : '·'} ${c.titulo}: ${c.texto}`), '',
    'PASOS',
  ];
  let grupo = '';
  for (const p of PASOS) {
    if (!pasoAplica(p, tactil)) continue;
    if (p.grupo !== grupo) { grupo = p.grupo; l.push(`— ${grupo}`); }
    const x = resultados[p.id] || {};
    l.push(`${marca(x.estado)} ${p.titulo}${x.nota ? ' — ' + String(x.nota).trim() : ''}`);
  }
  if (errores.length) {
    l.push('', `ÚLTIMOS ERRORES (${errores.length})`);
    for (const e of errores.slice(0, 5)) l.push(`· ${e.at ? new Date(e.at).toLocaleString('es-ES') + ' · ' : ''}${e.origen || 'app'} · ${e.mensaje}${e.veces > 1 ? ` (×${e.veces})` : ''}`);
  }
  return l.join('\n');
}
