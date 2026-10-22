// SOLTEC V2 · Autorrelleno de la ficha del aviso con lo que ya se ha trabajado.
//   · Clientes conocidos: al escribir nombre, NIF/CIF, teléfono o correo se proponen; al elegir uno se rellenan
//     todos sus datos (y la facturación si era distinta).
//   · Suministros conocidos: por calle, CUPS o referencia catastral (o los del cliente elegido); al elegir uno se
//     rellena la dirección completa y los datos eléctricos que tenía.
//   · Resto de campos: valores ya usados, los más frecuentes primero (población, provincia, CP, concepto…),
//     y población ⇄ CP ⇄ provincia según lo ya escrito otras veces.
// Nunca se pisa un dato ya escrito, salvo el campo en el que se está tecleando.
// Funciones puras: reciben la lista de avisos (registros) y no tocan la base de datos.

const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Texto para comparar: sin acentos, en mayúsculas y sin espacios de más. */
export const normal = (s) => sinAcentos(s).toUpperCase().replace(/\s+/g, ' ').trim();
const soloNif = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const soloTel = (s) => { const d = String(s ?? '').replace(/\D/g, ''); return d.length > 9 ? d.replace(/^(0034|34)(?=\d{9}$)/, '') : d; };
const soloMail = (s) => String(s ?? '').trim().toLowerCase();
const lleno = (v) => String(v ?? '').trim() !== '';

export const CAMPOS_CLIENTE_AUTO = ['nombre', 'contacto', 'nif', 'telefono', 'email', 'iban'];
export const CAMPOS_FACTURACION_AUTO = ['mismoCliente', 'nombre', 'nif', 'direccion', 'cp', 'poblacion', 'provincia'];
export const CAMPOS_SUMINISTRO_AUTO = ['direccion', 'numero', 'piso', 'puerta', 'cp', 'poblacion', 'provincia', 'refCatastral', 'cups', 'lat', 'lon'];
export const CAMPOS_ELECTRICO_AUTO = ['tension', 'iga', 'potenciaCalculada', 'potenciaKw', 'contador', 'contadorCercano', 'uso'];

const ordenar = (avisos) => [...avisos].filter((r) => r && r.data && !r.deleted)
  .sort((a, b) => String(a.updatedAt || a.data.fecha || '').localeCompare(String(b.updatedAt || b.data.fecha || '')));

/** Copia los campos con valor de «de» sobre «a» (el más reciente gana). */
const mezclar = (a, de, campos) => { for (const k of campos) if (lleno(de?.[k]) || typeof de?.[k] === 'boolean') a[k] = de[k]; return a; };

const claveSuministro = (s) => (soloNif(s.cups).slice(0, 20) || [normal(s.direccion), normal(s.numero), normal(s.piso), normal(s.puerta), normal(s.cp || s.poblacion)].join('|'));

/**
 * Clientes ya trabajados, uno por persona/empresa (se juntan los avisos que comparten NIF, teléfono o correo;
 * sin ninguno de los tres, por el nombre).
 * @returns {Array<{id, cliente, facturacion, suministros, avisos, ultimo, numeros}>}
 */
export function clientesConocidos(avisos, { excluir = null } = {}) {
  const lista = ordenar(avisos).filter((r) => r.id !== excluir && lleno(r.data.cliente?.nombre));
  // Unión de avisos que comparten algún identificador
  const padre = lista.map((_, i) => i);
  const raiz = (i) => (padre[i] === i ? i : (padre[i] = raiz(padre[i])));
  const visto = new Map();
  lista.forEach((r, i) => {
    const c = r.data.cliente || {};
    const ids = [soloNif(c.nif) && 'N' + soloNif(c.nif), soloTel(c.telefono).length >= 9 && 'T' + soloTel(c.telefono), soloMail(c.email).includes('@') && 'E' + soloMail(c.email)].filter(Boolean);
    if (!ids.length) ids.push('R' + normal(c.nombre));
    for (const id of ids) {
      if (visto.has(id)) padre[raiz(i)] = raiz(visto.get(id));
      else visto.set(id, i);
    }
  });
  const grupos = new Map();
  lista.forEach((r, i) => { const g = raiz(i); if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(r); });
  const out = [];
  for (const rs of grupos.values()) {
    const cliente = {}, facturacion = {}, sums = new Map();
    for (const r of rs) { // del más antiguo al más reciente
      mezclar(cliente, r.data.cliente, CAMPOS_CLIENTE_AUTO);
      if (r.data.facturacion && r.data.facturacion.mismoCliente === false) mezclar(facturacion, r.data.facturacion, CAMPOS_FACTURACION_AUTO);
      const s = r.data.suministro || {};
      if (lleno(s.direccion) || lleno(s.cups)) {
        const k = claveSuministro(s);
        const prev = sums.get(k) || { suministro: {}, electrico: {}, numero: '' };
        sums.delete(k); // al final: el más reciente
        sums.set(k, { suministro: mezclar(prev.suministro, s, CAMPOS_SUMINISTRO_AUTO), electrico: mezclar(prev.electrico, r.data.electrico, CAMPOS_ELECTRICO_AUTO), numero: r.data.numero || '' });
      }
    }
    const ult = rs[rs.length - 1];
    out.push({
      id: 'cli:' + ult.id, cliente, facturacion: Object.keys(facturacion).length ? facturacion : null,
      suministros: [...sums.values()].reverse(), avisos: rs.length, ultimo: ult.updatedAt || ult.data.fecha || '', numeros: rs.map((r) => r.data.numero).filter(Boolean).reverse(),
    });
  }
  return out;
}

/** Suministros ya trabajados (de todos los clientes), el más reciente primero. */
export function suministrosConocidos(avisos, { excluir = null } = {}) {
  const sums = new Map();
  for (const r of ordenar(avisos)) {
    if (r.id === excluir) continue;
    const s = r.data.suministro || {};
    if (!lleno(s.direccion) && !lleno(s.cups)) continue;
    const k = claveSuministro(s);
    const prev = sums.get(k) || { suministro: {}, electrico: {}, cliente: '', numero: '', avisos: 0 };
    sums.delete(k);
    sums.set(k, { suministro: mezclar(prev.suministro, s, CAMPOS_SUMINISTRO_AUTO), electrico: mezclar(prev.electrico, r.data.electrico, CAMPOS_ELECTRICO_AUTO), cliente: r.data.cliente?.nombre || prev.cliente, numero: r.data.numero || '', avisos: prev.avisos + 1 });
  }
  return [...sums.values()].reverse();
}

/** Cuánto encaja un texto: 2 = empieza igual (o una palabra empieza igual), 1 = lo contiene, 0 = nada. */
function encaje(valor, texto) {
  if (!valor || !texto) return 0;
  if (valor.startsWith(texto)) return 3;
  if ((' ' + valor).includes(' ' + texto)) return 2;
  return valor.includes(texto) ? 1 : 0;
}

/**
 * Clientes que encajan con lo que se está escribiendo.
 * @param campo 'nombre' | 'contacto' | 'nif' | 'telefono' | 'email'
 */
export function buscarClientes(clientes, campo, texto, max = 6) {
  const t = campo === 'nif' ? soloNif(texto) : campo === 'telefono' ? soloTel(texto) : campo === 'email' ? soloMail(texto) : normal(texto);
  const minimo = campo === 'telefono' ? 3 : 2;
  if (t.length < minimo) return [];
  const valor = (c) => (campo === 'nif' ? soloNif(c.cliente.nif) : campo === 'telefono' ? soloTel(c.cliente.telefono) : campo === 'email' ? soloMail(c.cliente.email) : normal(c.cliente[campo]));
  return clientes
    .map((c) => {
      let e = encaje(valor(c), t);
      if (!e && campo === 'contacto') e = encaje(normal(c.cliente.nombre), t); // el contacto también busca por nombre
      if (campo === 'nif' || campo === 'telefono' || campo === 'email') e = valor(c).startsWith(t) ? 3 : valor(c).includes(t) && t.length >= 4 ? 1 : 0;
      return { c, e };
    })
    .filter((x) => x.e && valor(x.c) !== t) // si ya está escrito entero, no se propone
    .sort((a, b) => b.e - a.e || b.c.avisos - a.c.avisos || String(b.c.ultimo).localeCompare(String(a.c.ultimo)))
    .slice(0, max).map((x) => x.c);
}

/** Suministros que encajan por calle, CUPS o referencia catastral. */
export function buscarSuministros(sums, campo, texto, max = 6) {
  const t = campo === 'direccion' ? normal(texto) : soloNif(texto);
  if (t.length < (campo === 'direccion' ? 3 : 4)) return [];
  const valor = (s) => (campo === 'direccion' ? normal(s.suministro.direccion) : soloNif(s.suministro[campo]));
  return sums.map((s) => ({ s, e: encaje(valor(s), t) })).filter((x) => x.e && valor(x.s) !== t)
    .sort((a, b) => b.e - a.e || b.s.avisos - a.s.avisos).slice(0, max).map((x) => x.s);
}

/**
 * Cambios para rellenar el aviso con un cliente: {ruta: valor}. Solo campos vacíos, salvo «campo» (el que se teclea).
 * Si el cliente facturaba a otro nombre, también la facturación.
 */
export function rellenoCliente(aviso, cli, campo = '') {
  const out = {};
  for (const k of CAMPOS_CLIENTE_AUTO) {
    const v = cli.cliente[k];
    if (lleno(v) && (k === campo || !lleno(aviso.cliente?.[k]))) out['cliente.' + k] = v;
  }
  const f = aviso.facturacion || {};
  const facturacionVacia = f.mismoCliente !== false && !['nombre', 'nif', 'direccion'].some((k) => lleno(f[k]));
  if (cli.facturacion && facturacionVacia) for (const k of CAMPOS_FACTURACION_AUTO) if (lleno(cli.facturacion[k]) || k === 'mismoCliente') out['facturacion.' + k] = cli.facturacion[k];
  return out;
}

/** Cambios para rellenar el suministro (y los datos eléctricos vacíos) con uno ya trabajado. */
export function rellenoSuministro(aviso, sum, campo = '') {
  const out = {};
  const vacio = !CAMPOS_SUMINISTRO_AUTO.some((k) => k !== campo && lleno(aviso.suministro?.[k]));
  for (const k of CAMPOS_SUMINISTRO_AUTO) {
    const v = sum.suministro[k];
    // Dirección: si el suministro estaba vacío se pone entero; si no, solo lo que falta
    if (lleno(v) && (k === campo || vacio || !lleno(aviso.suministro?.[k]))) out['suministro.' + k] = v;
  }
  for (const k of CAMPOS_ELECTRICO_AUTO) {
    const v = sum.electrico?.[k];
    if (lleno(v) && !lleno(aviso.electrico?.[k])) out['electrico.' + k] = v;
  }
  return out;
}

const leerRuta = (o, ruta) => ruta.split('.').reduce((x, k) => (x == null ? x : x[k]), o);

/**
 * Valores ya usados en un campo, los más frecuentes primero (para la lista de sugerencias).
 * Se agrupan sin distinguir acentos ni mayúsculas y se muestra la forma más usada.
 */
export function valoresUsados(avisos, ruta, max = 40) {
  const cuenta = new Map();
  for (const r of avisos) {
    if (!r || r.deleted || !r.data) continue;
    const v = String(leerRuta(r.data, ruta) ?? '').trim();
    if (!v) continue;
    const k = normal(v);
    const e = cuenta.get(k) || { n: 0, formas: new Map() };
    e.n++; e.formas.set(v, (e.formas.get(v) || 0) + 1);
    cuenta.set(k, e);
  }
  return [...cuenta.values()].sort((a, b) => b.n - a.n)
    .slice(0, max).map((e) => [...e.formas.entries()].sort((a, b) => b[1] - a[1])[0][0]);
}

/** Lo más usado junto a una población (CP y provincia) o a un CP (población y provincia). */
export function datosDeLocalidad(avisos, { poblacion = '', cp = '' } = {}) {
  const p = normal(poblacion), c = String(cp || '').trim();
  if (!p && !/^\d{5}$/.test(c)) return {};
  const votos = { cp: new Map(), poblacion: new Map(), provincia: new Map() };
  for (const r of avisos) {
    const s = r?.data?.suministro;
    if (!s || r.deleted) continue;
    if (p ? normal(s.poblacion) !== p : String(s.cp || '').trim() !== c) continue;
    for (const k of ['cp', 'poblacion', 'provincia']) { const v = String(s[k] || '').trim(); if (v) votos[k].set(v, (votos[k].get(v) || 0) + 1); }
  }
  const mejor = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const out = {};
  if (p) { if (mejor(votos.cp)) out.cp = mejor(votos.cp); } else if (mejor(votos.poblacion)) out.poblacion = mejor(votos.poblacion);
  if (mejor(votos.provincia)) out.provincia = mejor(votos.provincia);
  return out;
}

/** Texto corto de un suministro para la lista: «C/ Mayor 1, 2º B · Zaragoza». */
export function textoSuministro(s) {
  const x = s.suministro || s;
  const calle = [x.direccion, x.numero].filter(lleno).join(' ');
  const pp = [x.piso, x.puerta].filter(lleno).join(' ');
  return [calle + (pp ? ', ' + pp : ''), x.poblacion].filter(lleno).join(' · ');
}
