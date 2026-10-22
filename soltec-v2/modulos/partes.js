// SOLTEC V2 · Partes de trabajo: listado, ficha, firma del cliente, cierre y PDF.

import { h, toast, irORepintar, abrirBlob, compartir, descargar, lienzoFirma, confirmar } from '../ui.js';
import { nuevoParte, normalizarParte, siguienteNumeroParte, faltaParaCerrar, generarPartePdf, nombrePartePdf, RESULTADOS, CONCEPTOS, horasNumero } from '../core/partes.js';
import { normalizarAviso, direccionCompleta, hoyLocal } from '../core/model.js';
import { norm } from '../core/search.js';
import { leerEmpresa } from './empresa.js';
import { cargarPdfLib } from './comunicaciones.js';
import { bloqueFotos } from './ubicacion.js';

const tarjeta = (r) => {
  const p = r.data;
  return h('a', { class: 'tarjeta', href: `#/parte/${r.id}` },
    h('div', { class: 'tarjeta-cab' }, h('span', { class: 'mono' }, `${p.numero || 'Sin número'} · ${(p.fecha || '').split('-').reverse().join('/')}`), h('span', { class: 'etiqueta' }, p.cerrado ? 'Cerrado' : 'Abierto')),
    h('b', {}, p.cliente?.nombre || '(sin cliente)'),
    h('div', { class: 'muted' }, [direccionCompleta(p.cliente), p.avisoNumero && `Aviso ${p.avisoNumero}`].filter(Boolean).join(' · ')),
    h('div', { class: 'insignias' }, p.resultado ? h('span', { class: 'insignia' + (p.resultado === 'Resuelto' ? ' ok' : '') }, p.resultado) : null, p.tecnico ? h('span', { class: 'insignia' }, p.tecnico) : null));
};

export async function vistaPartes(app) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const cerrados = params.get('ver') === 'cerrados';
  const todos = (await app.storage.list('parte')).filter((r) => !!r.data.cerrado === cerrados)
    .sort((a, b) => (b.data.numero || '').localeCompare(a.data.numero || ''));
  const lista = h('div', { class: 'lista' });
  const pintar = (q) => {
    const n = norm(q);
    const sel = n ? todos.filter((r) => n.split(' ').every((w) => norm([r.data.numero, r.data.avisoNumero, r.data.cliente?.nombre, r.data.cliente?.direccion, r.data.tecnico, r.data.resultado].join(' ')).includes(w))) : todos;
    lista.replaceChildren(...(sel.length ? sel.map(tarjeta) : [h('div', { class: 'card muted' }, n ? 'Sin resultados.' : cerrados ? 'No hay partes cerrados.' : 'No hay partes abiertos. Crea uno desde aquí o desde un aviso.')]));
  };
  pintar('');
  return h('div', {},
    h('div', { class: 'titulo-fila' }, h('h1', {}, 'Partes de trabajo'), h('a', { class: 'btn prim', href: '#/parte/nuevo' }, '+ Nuevo parte')),
    h('input', { type: 'search', class: 'buscador', placeholder: 'Buscar: nº de parte o aviso, cliente, dirección, técnico…', oninput: (e) => pintar(e.target.value) }),
    h('div', { class: 'chips' },
      h('a', { class: 'chip' + (cerrados ? '' : ' activo'), href: '#/partes' }, 'Abiertos'),
      h('a', { class: 'chip' + (cerrados ? ' activo' : ''), href: '#/partes?ver=cerrados' }, 'Cerrados')),
    lista);
}

/** Partes de un aviso (dentro de su ficha). */
export async function bloquePartes(app, avisoId) {
  const partes = (await app.storage.listByRef(avisoId, 'parte')).filter((r) => !r.deleted).sort((a, b) => (b.data.numero || '').localeCompare(a.data.numero || ''));
  return h('div', {},
    partes.length ? h('div', { class: 'lista' }, ...partes.map(tarjeta)) : h('p', { class: 'muted' }, 'Sin partes de trabajo.'),
    h('div', { class: 'fila' }, h('a', { class: 'btn', href: `#/parte/nuevo?aviso=${avisoId}` }, '+ Nuevo parte de este aviso')));
}

async function crearPdf(app, p) {
  const [PDFLib, empresa] = await Promise.all([cargarPdfLib(), leerEmpresa(app)]);
  const img = async (ficha) => {
    if (!ficha) return null;
    const f = await app.storage.getFile(ficha.hash);
    if (!f) return null;
    if (/png|jpe?g/.test(f.mime)) return { bytes: new Uint8Array(f.bytes), mime: f.mime };
    const bmp = await createImageBitmap(new Blob([f.bytes], { type: f.mime }));
    const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0);
    return { bytes: new Uint8Array(await (await new Promise((ok) => cv.toBlob(ok, 'image/png'))).arrayBuffer()), mime: 'image/png' };
  };
  const fotos = [];
  for (const f of p.fotos) { const i = await img(f); if (i) fotos.push({ ...i, nombre: f.nombre }); }
  const bytes = await generarPartePdf(PDFLib, { parte: p, empresa, logo: await img(empresa.logo), firmaCliente: await img(p.firma), firmaTecnico: await img(empresa.firma), fotos });
  return new Blob([bytes], { type: 'application/pdf' });
}

export async function vistaParte(app, id) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const nuevo = id === 'nuevo';
  let reg = nuevo ? null : await app.storage.get(id);
  if (!nuevo && !reg) return h('div', {}, h('h1', {}, 'Parte no encontrado'), h('a', { class: 'btn', href: '#/partes' }, 'Volver'));
  const empresa = await leerEmpresa(app);
  let avisoId = reg ? reg.ref : params.get('aviso');
  const aviso = avisoId ? await app.storage.get(avisoId) : null;
  const p = reg ? normalizarParte(structuredClone(reg.data)) : nuevoParte(aviso && normalizarAviso(aviso.data), empresa);
  const bloqueado = !!p.cerrado;
  let cambiado = false;
  app.guardia = () => cambiado;
  const marca = () => { cambiado = true; };

  const inp = (obj, k, etq, { id = `p-${k}`, ancho, tipo = 'text', modo } = {}) => h('div', { class: 'campo' + (ancho ? ' ancho' : '') }, h('label', { for: id }, etq),
    h('input', { id, type: tipo, value: obj[k] || '', inputmode: modo, disabled: bloqueado || null, oninput: (e) => { obj[k] = e.target.value; marca(); } }));
  const area = (k, etq, filas = 4) => h('div', { class: 'campo ancho' }, h('label', { for: 'p-' + k }, etq),
    h('textarea', { id: 'p-' + k, rows: filas, value: p[k] || '', disabled: bloqueado || null, oninput: (e) => { p[k] = e.target.value; marca(); } }));
  const det = (titulo, abierto, ...c) => h('details', { class: 'card', open: abierto || null }, h('summary', {}, titulo), h('div', { class: 'cuerpo' }, ...c));

  // Materiales
  const mats = h('div');
  const pintarMats = () => mats.replaceChildren(...p.materiales.map((m, i) => h('div', { class: 'material' },
    h('input', { type: 'text', placeholder: 'Referencia', value: m.ref || '', 'aria-label': 'Referencia', disabled: bloqueado || null, oninput: (e) => { m.ref = e.target.value; marca(); } }),
    h('input', { type: 'text', class: 'm-desc', placeholder: 'Descripción', value: m.desc || '', 'aria-label': 'Descripción', disabled: bloqueado || null, oninput: (e) => { m.desc = e.target.value; marca(); } }),
    h('input', { type: 'text', placeholder: 'Cant.', value: m.cantidad || '', 'aria-label': 'Cantidad', inputmode: 'decimal', disabled: bloqueado || null, oninput: (e) => { m.cantidad = e.target.value; marca(); } }),
    bloqueado ? null : h('button', { class: 'btn peq', type: 'button', 'aria-label': 'Quitar material', onclick: () => { p.materiales.splice(i, 1); marca(); pintarMats(); } }, '✕'))));
  pintarMats();

  // Firma del cliente
  const firmaCaja = h('div');
  const pintarFirma = async () => {
    if (p.firma) {
      const b = await app.storage.getFileBlob(p.firma.hash);
      firmaCaja.replaceChildren(h('div', { class: 'logo-caja' }, b ? h('img', { src: URL.createObjectURL(b), alt: 'Firma del cliente', id: 'img-firma-parte' }) : 'Firma guardada'),
        h('p', { class: 'muted' }, `${p.firma.nombre}${p.firma.nif ? ' · ' + p.firma.nif : ''} · ${p.firma.fecha}`),
        bloqueado ? null : h('button', { class: 'btn peq', type: 'button', onclick: () => { p.firma = null; marca(); pintarFirma(); } }, 'Repetir firma'));
      return;
    }
    const lienzo = lienzoFirma('lienzo-parte');
    const nombre = h('input', { type: 'text', id: 'p-firmante', value: p.cliente.contacto || p.cliente.nombre || '' });
    const nif = h('input', { type: 'text', id: 'p-firmante-nif', value: '' });
    firmaCaja.replaceChildren(lienzo.el,
      h('div', { class: 'grid2' }, h('div', { class: 'campo' }, h('label', { for: 'p-firmante' }, 'Nombre de quien firma'), nombre), h('div', { class: 'campo' }, h('label', { for: 'p-firmante-nif' }, 'DNI / NIF (opcional)'), nif)),
      h('div', { class: 'fila' },
        h('button', { class: 'btn peq', type: 'button', onclick: () => lienzo.borrar() }, 'Borrar'),
        h('button', { class: 'btn peq prim', type: 'button', id: 'p-guardar-firma', onclick: async () => {
          if (lienzo.vacio()) { toast('Falta la firma', true); return; }
          if (!nombre.value.trim()) { toast('Escribe quién firma', true); return; }
          const f = await app.storage.putFile({ name: 'firma-cliente.png', mime: 'image/png', bytes: await lienzo.png() });
          p.firma = { ...f, nombre: nombre.value.trim(), nif: nif.value.trim().toUpperCase(), fecha: hoyLocal().split('-').reverse().join('/') };
          marca(); pintarFirma();
        } }, 'Usar esta firma')));
  };
  if (!bloqueado || p.firma) pintarFirma();

  const resultadoPdf = h('div');
  const guardar = async ({ cerrar = false, reabrir = false } = {}) => {
    const nuevoReg = !reg;
    if (nuevoReg) p.numero = siguienteNumeroParte(await app.storage.list('parte', { includeDeleted: true }));
    if (cerrar) {
      const falta = faltaParaCerrar(p);
      if (falta.length) { toast('Para cerrar falta: ' + falta.join(', '), true); return false; }
      p.cerrado = true; p.cerradoAt = new Date().toISOString();
    }
    if (reabrir) { p.cerrado = false; p.cerradoAt = null; }
    reg = await app.storage.save('parte', p, { id: reg?.id, ref: avisoId || null, event: nuevoReg ? { kind: 'parte_creado', text: p.numero } : null });
    if (avisoId) {
      if (nuevoReg) await app.storage.addEvent(avisoId, 'parte_creado', `Parte ${p.numero}`);
      if (cerrar) await app.storage.addEvent(avisoId, 'parte_cerrado', `Parte ${p.numero} · ${p.resultado}`);
      if (reabrir) await app.storage.addEvent(avisoId, 'parte_reabierto', `Parte ${p.numero}`);
    }
    cambiado = false;
    toast(cerrar ? `Parte ${p.numero} cerrado` : reabrir ? 'Parte reabierto' : nuevoReg ? `Parte ${p.numero} creado` : 'Guardado');
    if (nuevoReg || cerrar || reabrir) irORepintar('parte/' + reg.id);
    return true;
  };

  const pdf = async () => {
    if (cambiado) { toast('Guarda primero los cambios', true); return; }
    try {
      const blob = await crearPdf(app, p);
      const nombre = nombrePartePdf(p);
      resultadoPdf.replaceChildren(h('div', { class: 'aviso ok' }, h('b', {}, 'PDF del parte: '), nombre,
        h('div', { class: 'fila' },
          h('button', { class: 'btn peq', type: 'button', onclick: () => abrirBlob(blob) }, 'Ver'),
          h('button', { class: 'btn peq', type: 'button', onclick: () => compartir(blob, nombre) }, 'Compartir'),
          h('button', { class: 'btn peq', type: 'button', id: 'p-descargar', onclick: () => descargar(blob, nombre) }, 'Descargar'),
          avisoId ? h('button', { class: 'btn peq prim', type: 'button', onclick: async (e) => {
            const ficha = await app.storage.putFile({ name: nombre, mime: 'application/pdf', bytes: new Uint8Array(await blob.arrayBuffer()) });
            const a = normalizarAviso((await app.storage.get(avisoId)).data);
            if (!a.archivos.some((x) => x.hash === ficha.hash)) a.archivos.push({ tipo: 'parte', ...ficha });
            await app.storage.save('aviso', a, { id: avisoId, event: { kind: 'doc_preparada', text: `PDF del parte ${p.numero} guardado en el aviso` } });
            e.target.disabled = true; e.target.textContent = 'Guardado en el aviso';
          } }, 'Guardar en el aviso') : null)));
    } catch (e) { toast(e.message, true); }
  };

  return h('form', { class: 'ficha', onsubmit: (e) => { e.preventDefault(); guardar(); } },
    h('div', { class: 'titulo-fila' },
      h('h1', {}, reg ? `Parte ${p.numero}` : 'Nuevo parte'),
      h('a', { class: 'btn', href: avisoId && !reg ? `#/aviso/${avisoId}` : '#/partes' }, 'Volver')),
    bloqueado ? h('div', { class: 'aviso ok' }, `Parte cerrado${p.cerradoAt ? ' el ' + new Date(p.cerradoAt).toLocaleDateString('es-ES') : ''}. Para cambiarlo, reábrelo.`) : null,
    aviso ? h('div', { class: 'card' }, h('a', { href: `#/aviso/${avisoId}` }, `Aviso ${aviso.data.numero} · ${aviso.data.cliente?.nombre || ''}`)) : null,
    det('Datos del parte', !reg, h('div', { class: 'grid2' },
      inp(p, 'fecha', 'Fecha', { tipo: 'date' }), inp(p, 'tecnico', 'Técnico'))),
    det('Cliente', !reg && !aviso, h('div', { class: 'grid2' },
      inp(p.cliente, 'nombre', 'Cliente', { id: 'p-cliente', ancho: true }), inp(p.cliente, 'nif', 'NIF / CIF', { id: 'p-nif' }), inp(p.cliente, 'telefono', 'Teléfono', { id: 'p-telefono', tipo: 'tel' }),
      inp(p.cliente, 'contacto', 'Contacto', { id: 'p-contacto' }), inp(p.cliente, 'email', 'Correo', { id: 'p-email', tipo: 'email' }),
      inp(p.cliente, 'direccion', 'Calle / vía', { id: 'p-direccion', ancho: true }), inp(p.cliente, 'numero', 'Número', { id: 'p-numero' }), inp(p.cliente, 'piso', 'Piso', { id: 'p-piso' }), inp(p.cliente, 'puerta', 'Puerta', { id: 'p-puerta' }),
      inp(p.cliente, 'cp', 'Código postal', { id: 'p-cp', modo: 'numeric' }), inp(p.cliente, 'localidad', 'Localidad', { id: 'p-localidad' }))),
    det('Trabajo realizado', true,
      area('trabajos', 'Trabajos realizados', 5),
      h('label', {}, 'Conceptos'),
      h('div', { class: 'fila' }, ...CONCEPTOS.map(([k, l]) => h('label', { class: 'check-linea' }, h('input', { type: 'checkbox', id: 'p-c-' + k, checked: p.conceptos[k] || null, disabled: bloqueado || null, onchange: (e) => { p.conceptos[k] = e.target.checked; marca(); } }), ' ', l))),
      h('div', { class: 'grid2' }, inp(p, 'horas', 'Mano de obra (horas, ej.: 1,5)', { modo: 'decimal' }),
        h('div', { class: 'campo' }, h('label', { for: 'p-resultado' }, 'Resultado'),
          h('select', { id: 'p-resultado', disabled: bloqueado || null, onchange: (e) => { p.resultado = e.target.value; marca(); } },
            h('option', { value: '' }, 'Seleccionar…'), ...RESULTADOS.map((r) => h('option', { value: r, selected: p.resultado === r || null }, r))))),
      h('label', {}, 'Material empleado (opcional)'), mats,
      bloqueado ? null : h('div', { class: 'fila' }, h('button', { class: 'btn peq', type: 'button', id: 'p-anadir-material', onclick: () => { p.materiales.push({ ref: '', desc: '', cantidad: '' }); marca(); pintarMats(); } }, '+ Añadir material')),
      area('observaciones', 'Observaciones', 3)),
    det('Fotografías', false, bloqueado ? h('p', { class: 'muted' }, `${p.fotos.length} foto(s).`) : bloqueFotos(app, p, marca, { cgp: false })),
    det('Firma del cliente', !p.firma && !bloqueado, firmaCaja),
    reg ? det('PDF del parte', bloqueado, h('div', { class: 'fila' }, h('button', { class: 'btn prim', type: 'button', id: 'p-pdf', onclick: pdf }, 'Generar PDF del parte')), resultadoPdf) : null,
    h('div', { class: 'barra-guardar' },
      bloqueado
        ? h('button', { class: 'btn ancho', type: 'button', id: 'p-reabrir', onclick: async () => { if (await confirmar('¿Reabrir el parte para modificarlo? Quedará anotado.', { si: 'Reabrir' })) guardar({ reabrir: true }); } }, 'Reabrir parte')
        : h('div', { class: 'fila', style: 'margin:0' },
          h('button', { class: 'btn prim', type: 'submit', id: 'p-guardar', style: 'flex:1' }, reg ? 'Guardar' : 'Crear parte'),
          h('button', { class: 'btn rojo', type: 'button', id: 'p-cerrar', style: 'flex:1', onclick: () => guardar({ cerrar: true }) }, 'Cerrar parte'))));
}

export { horasNumero };
