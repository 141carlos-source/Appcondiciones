/**
 * SOLTEC V2 · Servicio de formularios (Google Apps Script, en tu propia cuenta de Google).
 *
 * Hace dos cosas para la app SOLTEC V2:
 *   1. Guarda los datos del formulario del cliente CIFRADOS y da un código corto, para que el enlace
 *      que se envía por WhatsApp o correo sea corto. La clave para leerlos solo va en el enlace:
 *      aquí se guarda un texto ilegible. Se borran solos a los 90 días.
 *   2. Envía el correo al cliente desde tu Gmail, con el botón «ABRIR FORMULARIO AQUÍ» y tu logo.
 *
 * INSTALACIÓN (una vez):
 *   1. Entra en https://script.google.com con tu cuenta de Google › «Nuevo proyecto».
 *   2. Borra lo que haya y pega TODO este archivo. Ponle de nombre «SOLTEC Formularios».
 *      Configuración del proyecto (ruedecita) › marca «Mostrar el archivo de manifiesto appsscript.json»,
 *      y en appsscript.json pega el archivo appsscript.json que va junto a este (permisos de enviar correo).
 *   3. En la línea CLAVE de abajo, pega la clave que te da la app (Empresa › Envío automático).
 *   4. Guarda (icono del disquete). Pulsa «Implementar» › «Nueva implementación» › tipo «Aplicación web».
 *        Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier usuario
 *      Pulsa «Implementar» y «Autorizar acceso» (Google avisa de que la app no está verificada:
 *      «Configuración avanzada» › «Ir a SOLTEC Formularios»; es tu propio código).
 *   5. Arriba, en la lista de funciones, elige «autorizar» y pulsa «Ejecutar»: acepta los permisos
 *      (enviar correos en tu nombre). Si no lo haces, «Probar» dice «No tienes permiso…».
 *   6. Copia la «URL de la aplicación web» (termina en /exec) y pégala en la app. Pulsa «Probar».
 *
 * Si cambias este código: «Implementar» › «Gestionar implementaciones» › editar › versión «Nueva».
 */

const CLAVE = 'PEGA-AQUI-LA-CLAVE-DE-LA-APP';
const DIAS = 90;            // los formularios se borran solos pasado este tiempo
const MAX_DATOS = 8500;     // tamaño máximo de unos datos (límite de Google: 9 KB por valor)

/** Ejecútala una vez desde el editor (botón «Ejecutar») para dar los permisos de enviar correos. */
function autorizar() {
  Logger.log('Permisos correctos. Correos que puedes enviar hoy: ' + MailApp.getRemainingDailyQuota());
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const props = PropertiesService.getScriptProperties();
  if (p.id) {
    const v = props.getProperty('f_' + limpiarId(p.id));
    if (!v) return json({ ok: false, error: 'caducado' });
    return json({ ok: true, datos: JSON.parse(v).d });
  }
  if (p.logo) return json({ ok: true, logo: props.getProperty('logo') || '' });
  return json({ ok: true, servicio: 'SOLTEC Formularios', version: 1 });
}

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'datos' }); }
  if (!CLAVE || CLAVE.indexOf('PEGA-AQUI') === 0 || b.clave !== CLAVE) return json({ ok: false, error: 'clave' });
  const props = PropertiesService.getScriptProperties();
  try {
    if (b.accion === 'prueba') {
      return json({ ok: true, cuenta: Session.getEffectiveUser().getEmail(), correosHoy: MailApp.getRemainingDailyQuota(), version: 1 });
    }
    if (b.accion === 'logo') {
      if (String(b.logo || '').length > MAX_DATOS) return json({ ok: false, error: 'logo grande' });
      props.setProperty('logo', String(b.logo || ''));
      return json({ ok: true });
    }
    if (b.accion === 'guardar') {
      const datos = String(b.datos || '');
      if (!datos || datos.length > MAX_DATOS) return json({ ok: false, error: 'tamaño' });
      limpiarCaducados(props);
      let id;
      do { id = nuevoId(); } while (props.getProperty('f_' + id));
      props.setProperty('f_' + id, JSON.stringify({ d: datos, t: Date.now() }));
      return json({ ok: true, id: id });
    }
    if (b.accion === 'correo') {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.para || ''))) return json({ ok: false, error: 'destinatario' });
      const op = { htmlBody: String(b.html || ''), name: String(b.nombre || 'SOLTEC') };
      if (b.responder) op.replyTo = String(b.responder);
      const logo = props.getProperty('logo');
      if (logo && op.htmlBody.indexOf('cid:logo') >= 0) {
        const m = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(logo);
        if (m) op.inlineImages = { logo: Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'logo') };
      }
      MailApp.sendEmail(String(b.para), String(b.asunto || ''), String(b.texto || ''), op);
      return json({ ok: true });
    }
    return json({ ok: false, error: 'accion' });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function limpiarId(s) { return String(s).replace(/[^A-Za-z0-9]/g, '').slice(0, 16); }
function nuevoId() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += a.charAt(Math.floor(Math.random() * a.length));
  return s;
}
function limpiarCaducados(props) {
  const limite = Date.now() - DIAS * 86400000, todo = props.getProperties();
  Object.keys(todo).forEach(function (k) {
    if (k.indexOf('f_') !== 0) return;
    try { if (JSON.parse(todo[k]).t < limite) props.deleteProperty(k); } catch (err) { props.deleteProperty(k); }
  });
}
