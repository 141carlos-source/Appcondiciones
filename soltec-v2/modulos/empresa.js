// SOLTEC V2 · Configuración de empresa: identidad, técnico, solicitante, correos, logo, firma y sello.

import { h, toast, ir } from '../ui.js';
import { ID_EMPRESA, empresaVacia, normalizarEmpresa, desdeV1, dataUrlAArchivo } from '../core/empresa.js';
import { provinciaDeCp } from '../core/validate.js';

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

async function aplicarImportacion(app, d, imp) {
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
    return h('div', { class: 'campo ancho' }, h('label', {}, titulo), vista, ayuda ? h('div', { class: 'muted' }, ayuda) : null,
      h('div', { class: 'fila' }, h('button', { class: 'btn peq', type: 'button', onclick: () => input.click() }, d[k] ? 'Cambiar' : 'Subir imagen'),
        h('button', { class: 'btn peq', type: 'button', onclick: () => { d[k] = null; cambiado = true; pintar(); } }, 'Quitar'), input));
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
        imagen('firma', 'Firma del técnico'), imagen('sello', 'Sello')))),
    ...SECCIONES.map(([sec, titulo, lista], i) => h('details', { class: 'card', open: i === 0 || null }, h('summary', {}, titulo), h('div', { class: 'cuerpo' }, campos(sec, lista)))),
    h('div', { class: 'barra-guardar' }, h('button', { class: 'btn prim ancho', type: 'submit', id: 'guardar-empresa' }, 'Guardar datos de empresa')));

  return construir();
}
