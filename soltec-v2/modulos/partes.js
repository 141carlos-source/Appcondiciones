// SOLTEC V2 · Partes de trabajo: listado, ficha, firma del cliente, cierre y PDF.

import { h, toast, irORepintar, abrirBlob, compartir, descargar, lienzoFirma, confirmar, sugerencias, accionesContacto } from '../ui.js';
import { clientesConocidos, suministrosConocidos, buscarClientes, buscarSuministros, valoresUsados, datosDeLocalidad, textoSuministro, normal, comoAvisoDeParte, catalogoMateriales, buscarMateriales } from '../core/autorrelleno.js';
import { formatearTelefono } from '../core/validate.js';
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

  // --- autorrelleno con clientes, direcciones, técnicos y materiales ya trabajados (avisos y otros partes)
  const [avisosTodos, partesTodos] = bloqueado ? [[], []] : await Promise.all([app.storage.list('aviso'), app.storage.list('parte')]);
  const otrosPartes = partesTodos.filter((r) => r.id !== reg?.id);
  const fuentes = [...avisosTodos, ...otrosPartes.map(comoAvisoDeParte)];
  const conocidos = clientesConocidos(fuentes);
  const sumsConocidos = suministrosConocidos(fuentes);
  const materiales = catalogoMateriales(otrosPartes);
  let clienteElegido = null;
  const lleno = (v) => String(v ?? '').trim() !== '';
  const ID_CLIENTE = { nombre: 'p-cliente', nif: 'p-nif', telefono: 'p-telefono', contacto: 'p-contacto', email: 'p-email', direccion: 'p-direccion', numero: 'p-numero', piso: 'p-piso', puerta: 'p-puerta', cp: 'p-cp', localidad: 'p-localidad' };
  /** Pone datos del cliente del parte (en el parte y en sus campos). */
  const ponerCliente = (cambios) => {
    for (let [k, v] of Object.entries(cambios)) {
      if (k === 'telefono') v = formatearTelefono(v);
      p.cliente[k] = v;
      const el = document.getElementById(ID_CLIENTE[k]); if (el) { el.value = v; el.dispatchEvent(new Event('soltec:valor')); }
    }
    marca();
  };
  const direccionDe = (x, campo = '') => {
    const c = {}, s = x.suministro, vacia = !['direccion', 'numero', 'piso', 'puerta', 'cp', 'localidad'].some((k) => k !== campo && lleno(p.cliente[k]));
    for (const [k, de] of [['direccion', 'direccion'], ['numero', 'numero'], ['piso', 'piso'], ['puerta', 'puerta'], ['cp', 'cp'], ['localidad', 'poblacion']]) if (lleno(s[de]) && (k === campo || vacia || !lleno(p.cliente[k]))) c[k] = s[de];
    return c;
  };
  const opcionDir = (x) => ({ titulo: textoSuministro(x), sub: [x.cliente, x.numero && 'aviso ' + x.numero].filter(Boolean).join(' · '), x });
  const sugerenciasParte = (k, input) => {
    if (['nombre', 'nif', 'telefono', 'contacto', 'email'].includes(k)) {
      return sugerencias(input, {
        buscar: (t) => buscarClientes(conocidos, k, t).map((c) => ({ titulo: c.cliente.nombre, sub: [c.cliente.nif, c.cliente.telefono, textoSuministro(c.suministros[0] || {})].filter(Boolean).join(' · '), c })),
        elegir: (it) => {
          const c = {};
          for (const f of ['nombre', 'nif', 'telefono', 'contacto', 'email']) if (lleno(it.c.cliente[f]) && (f === k || !lleno(p.cliente[f]))) c[f] = it.c.cliente[f];
          // Dirección: la última del cliente si aún no hay ninguna (las demás, al tocar «Calle»)
          if (it.c.suministros[0] && !lleno(p.cliente.direccion)) Object.assign(c, direccionDe(it.c.suministros[0]));
          clienteElegido = it.c;
          ponerCliente(c);
          toast(`Datos de ${it.c.cliente.nombre} rellenados`);
        },
      });
    }
    if (k === 'direccion') {
      return sugerencias(input, {
        alEnfocar: true,
        buscar: (t) => (t.trim() ? buscarSuministros(sumsConocidos, 'direccion', t) : (clienteElegido?.suministros || []).slice(1).map((x) => ({ ...x, cliente: clienteElegido.cliente.nombre }))).map(opcionDir),
        elegir: (it) => ponerCliente(direccionDe(it.x, 'direccion')),
      });
    }
    if (k === 'localidad' || k === 'cp') {
      let usados = null;
      const ruta = k === 'cp' ? 'suministro.cp' : 'suministro.poblacion';
      return sugerencias(input, {
        buscar: (t) => { usados ??= valoresUsados(fuentes, ruta); const q = normal(t); return usados.filter((v) => normal(v) !== q && (normal(v).startsWith(q) || normal(v).includes(' ' + q))).slice(0, 6).map((v) => ({ titulo: v, v })); },
        elegir: (it) => {
          const c = { [k]: it.v }, loc = datosDeLocalidad(fuentes, k === 'cp' ? { cp: it.v } : { poblacion: it.v });
          if (k === 'localidad' && loc.cp && !lleno(p.cliente.cp)) c.cp = loc.cp;
          if (k === 'cp' && loc.poblacion && !lleno(p.cliente.localidad)) c.localidad = loc.poblacion;
          ponerCliente(c);
        },
      });
    }
    return null;
  };
  const inp = (obj, k, etq, { id = `p-${k}`, ancho, tipo = 'text', modo } = {}) => {
    const input = h('input', { id, type: tipo, value: obj[k] || '', inputmode: modo, autocomplete: 'off', disabled: bloqueado || null, oninput: (e) => { obj[k] = e.target.value; marca(); },
      onblur: obj === p.cliente && k === 'telefono' ? (e) => { const f = formatearTelefono(e.target.value); if (f !== e.target.value) { e.target.value = f; obj[k] = f; marca(); } } : null });
    let sug = null;
    if (!bloqueado && obj === p.cliente) sug = sugerenciasParte(k, input);
    if (!bloqueado && obj === p && k === 'tecnico') {
      const usados = valoresUsados(otrosPartes, 'tecnico');
      sug = sugerencias(input, { alEnfocar: true, buscar: (t) => usados.filter((v) => normal(v) !== normal(t) && normal(v).includes(normal(t))).slice(0, 6).map((v) => ({ titulo: v, v })), elegir: (it) => { input.value = it.v; p.tecnico = it.v; marca(); } });
    }
    const contacto = obj === p.cliente && k === 'telefono' ? accionesContacto(input, 'telefono') : obj === p.cliente && k === 'email' ? accionesContacto(input, 'correo', { asunto: () => `Parte ${p.numero || ''}`.trim() }) : null;
    return h('div', { class: 'campo' + (ancho ? ' ancho' : '') }, h('label', { for: id }, etq), input, sug, contacto);
  };
  const area = (k, etq, filas = 4) => h('div', { class: 'campo ancho' }, h('label', { for: 'p-' + k }, etq),
    h('textarea', { id: 'p-' + k, rows: filas, value: p[k] || '', disabled: bloqueado || null, oninput: (e) => { p[k] = e.target.value; marca(); } }));
  const det = (titulo, abierto, ...c) => h('details', { class: 'card', open: abierto || null }, h('summary', {}, titulo), h('div', { class: 'cuerpo' }, ...c));

  // Materiales (referencia ⇄ descripción de los ya usados en otros partes)
  const campoMaterial = (m, k, i) => {
    const input = h('input', { type: 'text', class: k === 'desc' ? 'm-desc' : null, id: `p-mat-${k}-${i}`, placeholder: k === 'ref' ? 'Referencia' : 'Descripción', value: m[k] || '', 'aria-label': k === 'ref' ? 'Referencia' : 'Descripción', autocomplete: 'off', disabled: bloqueado || null, oninput: (e) => { m[k] = e.target.value; marca(); } });
    if (bloqueado || !materiales.length) return [input];
    const lista = sugerencias(input, {
      buscar: (t) => buscarMateriales(materiales, t).map((x) => ({ titulo: [x.ref, x.desc].filter(Boolean).join(' · '), sub: `${x.usos} ${x.usos === 1 ? 'vez' : 'veces'}`, x })),
      elegir: (it) => {
        m.ref = it.x.ref || m.ref; m.desc = it.x.desc || m.desc; marca();
        const fila = input.closest('.material');
        fila.querySelector(`#p-mat-ref-${i}`).value = m.ref || ''; fila.querySelector(`#p-mat-desc-${i}`).value = m.desc || '';
        fila.querySelector('[aria-label="Cantidad"]')?.focus();
      },
    });
    return [input, lista];
  };
  const mats = h('div');
  const pintarMats = () => mats.replaceChildren(...p.materiales.map((m, i) => h('div', { class: 'material' },
    ...campoMaterial(m, 'ref', i), ...campoMaterial(m, 'desc', i),
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
