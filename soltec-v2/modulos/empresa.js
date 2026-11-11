// SOLTEC V2 · Configuración de empresa: identidad, técnico, solicitante, correos, logo, firma y sello.
// También el envío automático del formulario (servicio en la cuenta de Google de la empresa).

import { h, toast, ir, lienzoFirma, confirmar } from '../ui.js';
import { AZUL_BIC, dibujarSelloLogo } from '../core/tinta.js';
import { ID_EMPRESA, empresaVacia, normalizarEmpresa, desdeV1, dataUrlAArchivo } from '../core/empresa.js';
import { provinciaDeCp } from '../core/validate.js';
import { idServicio, servicioListo, claveNueva, llamar } from '../core/servicioGoogle.js';
import { logoParaEnlace } from './comunicaciones.js';

export async function leerEmpresa(app) {
  const r = await app.storage.get(ID_EMPRESA);
  return r ? normalizarEmpresa(r.data) : empresaVacia();
}

/** URL temporal de una imagen guardada (para mostrarla en pantalla). */
export async function urlImagen(app, ficha) {
  if (!ficha) return null;
  const b = await app.storage.getFileBlob(ficha.hash);
  return b ? URL.createObjectURL(b) : null;
}

/** Datos de empresa que hay en la V1.35 de este mismo navegador (solo lectura). */
function leerV1Local() {
  try {
    return desdeV1({ main: localStorage.getItem('APP_AVISOS_WEB_DATOS_V116_PERSISTENTE'), cfg: localStorage.getItem('APP_AVISOS_CONFIG_V127') });
  } catch { return null; }
}

export async function aplicarImportacion(app, d, imp) {
  for (const [k, v] of Object.entries(imp.datos)) {
    if (k === 'logo' || k === 'firma' || k === 'sello') continue;
    // Solo rellena lo que está vacío: nunca pisa lo que ya escribiste en la V2
    for (const [campo, valor] of Object.entries(v || {})) if (valor && !d[k][campo]) d[k][campo] = valor;
  }
  for (const [k, dataUrl] of Object.entries(imp.imagenes)) {
    if (!d[k]) d[k] = await app.storage.putFile(dataUrlAArchivo(dataUrl, k));
  }
}

const SECCIONES = [
  ['empresa', 'Empresa', [['nombre', 'Razón social', 2], ['nombreComercial', 'Nombre comercial', 2], ['nif', 'NIF / CIF'], ['telefono', 'Teléfono'], ['email', 'Correo electrónico', 2], ['web', 'Página web', 2], ['direccion', 'Dirección', 2], ['cp', 'Código postal'], ['localidad', 'Localidad'], ['provincia', 'Provincia', 2]]],
  ['tecnico', 'Técnico', [['nombre', 'Nombre', 2], ['nif', 'NIF'], ['telefono', 'Teléfono'], ['email', 'Correo electrónico', 2], ['numero', 'Nº de instalador / empresa'], ['colegiado', 'Nº de colegiado']]],
  ['solicitante', 'Solicitante (para las solicitudes a la distribuidora)', [['nombre', 'Nombre', 2], ['nif', 'NIF'], ['telefono', 'Teléfono'], ['email', 'Correo electrónico', 2], ['direccion', 'Dirección', 2], ['cp', 'Código postal'], ['localidad', 'Localidad'], ['provincia', 'Provincia', 2]]],
  ['correos', 'Correos de las solicitudes', [['nuevosSuministros', 'Nuevos suministros (condiciones)', 2], ['solicitarCups', 'Solicitud de CUPS', 2], ['comercializadora', 'Comercializadora (contratos)', 2], ['inspeccion', 'Inspección', 2]]],
];

export async function vistaEmpresa(app) {
  const reg = await app.storage.get(ID_EMPRESA);
  const d = reg ? normalizarEmpresa(reg.data) : empresaVacia();
  let cambiado = false;
  app.guardia = () => cambiado;
  const v1 = leerV1Local();

  const imagen = (k, titulo, ayuda) => {
    const vista = h('div', { class: 'logo-caja' });
    const pintar = async () => {
      const url = await urlImagen(app, d[k]);
      vista.replaceChildren(url ? h('img', { src: url, alt: titulo, id: 'img-' + k }) : h('span', { class: 'muted' }, 'Sin ' + titulo.toLowerCase()));
    };
    const input = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml', style: 'display:none', id: 'file-' + k, onchange: async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (f.size > 3 * 1024 * 1024) { toast('La imagen pesa más de 3 MB: redúcela antes de subirla', true); return; }
      d[k] = await app.storage.putFile(f);
      cambiado = true;
      pintar();
    } });
    pintar();
    const extra = h('div');
    const guardarCanvas = async (cv, nombre) => {
      const bytes = new Uint8Array(await (await new Promise((ok) => cv.toBlob(ok, 'image/png'))).arrayBuffer());
      d[k] = await app.storage.putFile({ name: nombre, mime: 'image/png', bytes });
      cambiado = true; extra.replaceChildren(); pintar();
      toast(`${titulo} lista: pulsa «Guardar datos de empresa»`);
    };
    // Firma del técnico con el dedo, en azul de bolígrafo
    const firmar = () => {
      const lienzo = lienzoFirma('lienzo-firma-tecnico', { color: AZUL_BIC, boli: true, recortarPng: true });
      extra.replaceChildren(h('div', { class: 'card' },
        h('p', { class: 'muted' }, 'Firma con el dedo (o el ratón). Sale en azul, como un bolígrafo.'), lienzo.el,
        h('div', { class: 'fila' },
          h('button', { class: 'btn peq', type: 'button', onclick: () => lienzo.borrar() }, 'Borrar'),
          h('button', { class: 'btn peq prim', type: 'button', id: 'guardar-firma-tecnico', onclick: async () => {
            if (lienzo.vacio()) { toast('Falta la firma', true); return; }
            const bytes = await lienzo.png();
            d[k] = await app.storage.putFile({ name: 'FIRMA_TECNICO.png', mime: 'image/png', bytes });
            cambiado = true; extra.replaceChildren(); pintar();
            toast('Firma lista: pulsa «Guardar datos de empresa»');
          } }, 'Usar esta firma'),
          h('button', { class: 'btn peq', type: 'button', onclick: () => extra.replaceChildren() }, 'Cancelar'))));
    };
    // Sello de caucho gastado: logo de la empresa, línea roja y datos en negro (sin marco)
    const crearSello = async () => {
      const op = { semilla: 23 };
      const muestra = h('div', { class: 'logo-caja sello-muestra', id: 'muestra-sello' });
      let actual = null;
      let logoImg = null;
      const url = await urlImagen(app, d.logo);
      if (url) logoImg = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = url; });
      const dibujar = () => { actual = dibujarSelloLogo(d, logoImg, op); actual.style.maxWidth = '100%'; actual.style.maxHeight = '240px'; muestra.replaceChildren(actual); };
      extra.replaceChildren(h('div', { class: 'card' },
        h('p', { class: 'muted' }, 'Se hace con el logo, la razón social, el CIF, la dirección, el teléfono y el nº de instalador de esta pantalla. Rellénalos antes.'),
        logoImg ? null : h('div', { class: 'aviso info' }, 'No hay logo: el sello llevará el nombre de la empresa en grande. Sube el logo para que salga.'),
        muestra,
        h('div', { class: 'fila' },
          h('button', { class: 'btn peq', type: 'button', onclick: () => { op.semilla = Math.floor(Math.random() * 1e6) + 1; dibujar(); } }, 'Otro desgaste'),
          h('button', { class: 'btn peq prim', type: 'button', id: 'guardar-sello', onclick: () => guardarCanvas(actual, 'SELLO_EMPRESA.png') }, 'Usar este sello'),
          h('button', { class: 'btn peq', type: 'button', onclick: () => extra.replaceChildren() }, 'Cancelar'))));
      dibujar();
    };
    return h('div', { class: 'campo ancho' }, h('label', {}, titulo), vista, ayuda ? h('div', { class: 'muted' }, ayuda) : null,
      h('div', { class: 'fila' },
        k === 'firma' ? h('button', { class: 'btn peq prim', type: 'button', id: 'firmar-dedo', onclick: firmar }, 'Firmar con el dedo') : null,
        k === 'sello' ? h('button', { class: 'btn peq prim', type: 'button', id: 'crear-sello', onclick: crearSello }, 'Crear sello de caucho') : null,
        h('button', { class: 'btn peq', type: 'button', onclick: () => input.click() }, d[k] ? 'Cambiar' : 'Subir imagen'),
        h('button', { class: 'btn peq', type: 'button', onclick: () => { d[k] = null; cambiado = true; pintar(); } }, 'Quitar'), input),
      extra);
  };

  const campos = (sec, lista) => h('div', { class: 'grid2' }, ...lista.map(([c, etq, ancho]) => h('div', { class: 'campo' + (ancho === 2 ? ' ancho' : '') },
    h('label', { for: `e-${sec}-${c}` }, etq),
    h('input', { id: `e-${sec}-${c}`, type: sec === 'correos' || c === 'email' ? 'email' : c === 'telefono' ? 'tel' : 'text', value: d[sec][c] || '', autocomplete: 'off',
      oninput: (e) => {
        d[sec][c] = e.target.value; cambiado = true;
        if (c === 'cp' && /^\d{5}$/.test(e.target.value) && !d[sec].provincia) {
          d[sec].provincia = provinciaDeCp(e.target.value);
          const p = document.getElementById(`e-${sec}-provincia`); if (p) p.value = d[sec].provincia;
        }
      } }))));

  const importarArchivo = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const imp = desdeV1({ base: JSON.parse(await f.text()) });
      if (!imp) throw new Error('El archivo no es una «Base de empresa» de SOLTEC.');
      await aplicarImportacion(app, d, imp);
      cambiado = true;
      toast('Datos importados: revisa y pulsa Guardar');
      document.querySelector('main').replaceChildren(construir());
    } catch (err) { toast(err.message, true); }
  } });

  const guardar = async () => {
    await app.storage.save('config', d, { id: ID_EMPRESA });
    cambiado = false;
    toast('Datos de empresa guardados');
    ir('ajustes');
  };

  // --- Envío automático del formulario (servicio en la cuenta de Google de la empresa)
  const bloqueEnvio = () => {
    const res = h('div', { id: 'envio-resultado' });
    const url = h('input', { type: 'url', id: 'envio-url', value: d.envio.url || '', 'data-minusculas': '', placeholder: 'https://script.google.com/macros/s/…/exec', autocomplete: 'off',
      oninput: (e) => { d.envio.url = e.target.value.trim(); cambiado = true; } });
    // La clave NO se crea sola al abrir esta pantalla (en otro dispositivo pisaría la buena): se escribe o pega
    // la misma que hay en el código de Google, o se crea una nueva a propósito
    const clave = h('input', { type: 'text', id: 'envio-clave', value: d.envio.clave || '', 'data-minusculas': '', class: 'mono', autocomplete: 'off', placeholder: 'La misma que en «const CLAVE» del código de Google',
      oninput: (e) => { d.envio.clave = e.target.value.trim(); cambiado = true; } });
    const crearClave = h('button', { class: 'btn peq', type: 'button', id: 'crear-clave', onclick: async () => {
      if (d.envio.clave && !(await confirmar('Ya hay una clave. Si creas otra, tendrás que pegarla también en el código de Google. ¿Crear una nueva?', { si: 'Crear nueva' }))) return;
      d.envio.clave = claveNueva(); clave.value = d.envio.clave; cambiado = true;
    } }, 'Crear clave nueva');
    const probar = async (e) => {
      e.target.disabled = true;
      res.replaceChildren(h('div', { class: 'aviso info' }, 'Probando…'));
      try {
        if (!idServicio(d.envio.url)) throw new Error('La URL debe ser la de la aplicación web de Google y terminar en /exec');
        if ((d.envio.clave || '').length < 12) throw new Error('Falta la clave: pega la misma que pusiste en «const CLAVE» del código de Google');
        const j = await llamar(d.envio.url, { accion: 'prueba', clave: d.envio.clave });
        const logo = await logoParaEnlace(app, d.logo, 8500);
        if (logo) await llamar(d.envio.url, { accion: 'logo', clave: d.envio.clave, logo });
        // Funciona: la URL se guarda ya (sin tocar el resto de cambios pendientes de la pantalla)
        const r0 = await app.storage.get(ID_EMPRESA);
        const actual = r0 ? normalizarEmpresa(r0.data) : empresaVacia();
        await app.storage.save('config', { ...actual, envio: { url: d.envio.url, clave: d.envio.clave } }, { id: ID_EMPRESA });
        res.replaceChildren(h('div', { class: 'aviso ok', id: 'envio-ok' }, h('b', {}, 'Funciona y queda guardado. '), `Los correos saldrán de ${j.cuenta || 'tu cuenta de Google'}${j.correosHoy != null ? ` (te quedan ${j.correosHoy} correos hoy)` : ''}.${logo ? ' Logo enviado al servicio.' : ''}`));
      } catch (err) { res.replaceChildren(h('div', { class: 'aviso err' }, err.message)); } finally { e.target.disabled = false; }
    };
    return h('details', { class: 'card', id: 'bloque-envio', open: !servicioListo(d) || null }, h('summary', {}, 'Envío automático del formulario (Google)'),
      h('div', { class: 'cuerpo' },
        h('p', { class: 'muted' }, 'Con esto, el formulario del cliente se envía con un enlace corto (también por WhatsApp) y el correo sale solo desde tu Gmail, con el botón «ABRIR FORMULARIO AQUÍ» y tu logo. Los datos se guardan cifrados en tu cuenta de Google y se borran a los 90 días.'),
        h('ol', { class: 'pasos-envio' },
          h('li', {}, 'Descarga el código del servicio: ', h('a', { href: './servicio-google/SOLTEC_Formularios.gs', download: 'SOLTEC_Formularios.gs', id: 'descargar-servicio' }, 'SOLTEC_Formularios.gs'), '.'),
          h('li', {}, 'Entra en ', h('a', { href: 'https://script.google.com/home/projects/create', target: '_blank', rel: 'noopener' }, 'script.google.com'), ' con tu cuenta de Google › Nuevo proyecto. Pega todo el código.'),
          h('li', {}, 'Configuración del proyecto (ruedecita) › marca «Mostrar el archivo de manifiesto appsscript.json». En el editor, abre appsscript.json, borra lo que tiene y pega ', h('a', { href: './servicio-google/appsscript.json', download: 'appsscript.json', id: 'descargar-manifiesto' }, 'este archivo de permisos'), '.'),
          h('li', {}, 'En la línea ', h('code', {}, 'const CLAVE'), ' del código va la clave (entre las comillas). Es la misma que debe estar aquí: si ya la tienes en Google, pégala aquí; si empiezas de cero, crea una y cópiala a Google.', clave,
            h('div', { class: 'fila' },
              h('button', { class: 'btn peq', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(d.envio.clave || ''); toast('Clave copiada'); } catch { clave.select(); } } }, 'Copiar clave'), crearClave)),
          h('li', {}, 'Implementar › Nueva implementación › Aplicación web. Ejecutar como: Yo. Quién tiene acceso: Cualquier usuario. Autoriza el acceso (Configuración avanzada › Ir a SOLTEC Formularios).'),
          h('li', {}, 'Arriba, en la lista de funciones, elige «autorizar» y pulsa «Ejecutar». Acepta los permisos (enviar correos en tu nombre).'),
          h('li', {}, 'Copia la URL de la aplicación web (termina en /exec) y pégala aquí:')),
        servicioListo(d) ? h('div', { class: 'aviso ok' }, 'Activado. Si lo cambias, pulsa «Probar».') : null,
        h('label', { for: 'envio-url' }, 'URL del servicio'), url,
        h('div', { class: 'fila' }, h('button', { class: 'btn prim', type: 'button', id: 'probar-envio', onclick: probar }, 'Probar')),
        res));
  };

  const construir = () => h('form', { class: 'ficha', onsubmit: (e) => { e.preventDefault(); guardar(); } },
    h('div', { class: 'titulo-fila' }, h('h1', {}, 'Empresa'), h('a', { class: 'btn', href: '#/ajustes' }, 'Volver')),
    h('div', { class: 'card' },
      h('b', {}, 'Traer los datos de la V1.35'),
      h('p', { class: 'muted' }, v1 ? `En este navegador hay datos de empresa de la V1.35${v1.imagenes.logo ? ', con logo' : ''}. Se copian sin tocar la V1.35 y solo se rellenan los campos vacíos.` : 'En este navegador no hay datos de la V1.35. Puedes importar el archivo «Base de empresa» que descarga la V1.35 desde Configuración.'),
      h('div', { class: 'fila' },
        v1 ? h('button', { class: 'btn prim', type: 'button', id: 'importar-v1', onclick: async () => {
          await aplicarImportacion(app, d, v1); cambiado = true; toast('Datos de la V1.35 copiados: revisa y pulsa Guardar');
          document.querySelector('main').replaceChildren(construir());
        } }, 'Copiar de la V1.35') : null,
        h('button', { class: 'btn', type: 'button', onclick: () => importarArchivo.click() }, 'Importar archivo de la V1.35'), importarArchivo)),
    h('details', { class: 'card', open: true }, h('summary', {}, 'Logo, firma y sello'),
      h('div', { class: 'cuerpo' }, h('div', { class: 'grid2' },
        imagen('logo', 'Logo', 'Sale en el formulario del cliente y en los documentos.'),
        imagen('firma', 'Firma del técnico', 'Sale en certificados y en la memoria.'), imagen('sello', 'Sello', 'Puedes crearlo aquí con aspecto de sello de caucho usado.')))),
    ...SECCIONES.map(([sec, titulo, lista], i) => h('details', { class: 'card', open: i === 0 || null }, h('summary', {}, titulo), h('div', { class: 'cuerpo' }, campos(sec, lista)))),
    bloqueEnvio(),
    h('div', { class: 'barra-guardar' }, h('button', { class: 'btn prim ancho', type: 'submit', id: 'guardar-empresa' }, 'Guardar datos de empresa')));

  return construir();
}
