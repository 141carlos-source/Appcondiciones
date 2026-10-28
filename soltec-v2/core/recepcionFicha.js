// SOLTEC V2 · Recepción automática de la ficha que devuelve el cliente (PDF o mensaje con SOLTEC-DATOS).
// Funciones puras: averiguan de qué aviso es y qué datos se aplican solos y cuáles hay que revisar.

import { cambiosFicha, aplicarCambios } from './fichaCliente.js';

const limpio = (v) => String(v ?? '').trim().toUpperCase();

/**
 * Aviso al que pertenece la ficha devuelta.
 * Por orden: la marca del aviso (id), el número de aviso y, si no, el CUPS (si solo hay un aviso con él).
 * @param {object[]} avisos  registros de aviso (los de la papelera no cuentan)
 * @returns {{registro, por:'id'|'numero'|'cups'} | null}
 */
export function avisoDeFicha(avisos, r) {
  const vivos = (avisos || []).filter((x) => !x.deleted);
  if (r?.id) { const x = vivos.find((a) => a.id === r.id); if (x) return { registro: x, por: 'id' }; }
  if (r?.n) {
    const xs = vivos.filter((a) => limpio(a.data?.numero) === limpio(r.n));
    if (xs.length === 1) return { registro: xs[0], por: 'numero' };
  }
  const cups = limpio(r?.d?.['suministro.cups']);
  if (cups) {
    const xs = vivos.filter((a) => limpio(a.data?.suministro?.cups) === cups);
    if (xs.length === 1) return { registro: xs[0], por: 'cups' };
  }
  return null;
}

/** ¿Viene firmada? Firma dibujada en el formulario web o en el propio PDF (la casilla sola es conformidad). */
export const fichaFirmada = (r) => !!r?.firma && (r.origen === 'formulario' || !!r.firma.dibujada);

export function textoFirma(r) {
  if (!r?.firma) return 'Sin firma ni casilla de conformidad.';
  if (fichaFirmada(r)) return `Firmada${r.firma.nombre ? ' por ' + r.firma.nombre : ''}${r.firma.fecha ? ' el ' + r.firma.fecha : ''}${r.firma.conforme === false ? ' (sin marcar la casilla de conformidad)' : ''}.`;
  return `Casilla de conformidad marcada${r.firma.nombre ? ' (' + r.firma.nombre + ')' : ''}, sin firma dibujada.`;
}

/**
 * Qué se aplica solo: todo dato correcto (rellena lo vacío y cambia lo distinto).
 * Lo que no pasa la comprobación (DNI, IBAN, CUPS mal escritos…) no se aplica: queda para revisar.
 * @returns {{aplicados, revisar, nuevo, firmada}}
 */
export function planRecepcion(aviso, r, { archivo, ahora = new Date().toISOString() } = {}) {
  const cambios = cambiosFicha(aviso, r?.d || {});
  const aplicados = cambios.filter((c) => !c.problema);
  const revisar = cambios.filter((c) => c.problema);
  const nuevo = aplicarCambios(aviso, aplicados);
  const firmada = fichaFirmada(r);
  if (archivo?.hash) {
    nuevo.archivos = Array.isArray(nuevo.archivos) ? nuevo.archivos : [];
    if (!nuevo.archivos.some((x) => x.hash === archivo.hash)) nuevo.archivos.push({ tipo: 'ficha_cliente', hash: archivo.hash, name: archivo.name, mime: 'application/pdf', size: archivo.size, addedAt: ahora });
    if (firmada) nuevo.docs = { ...(nuevo.docs || {}), firmado: 'recibido' };
  }
  return { aplicados, revisar, nuevo, firmada };
}

/** Texto del historial. */
export function textoEventoRecepcion({ aplicados, revisar, firmada }, r, conPdf) {
  return [
    `Ficha del cliente recibida: ${aplicados.length ? `${aplicados.length} dato(s) aplicados (${aplicados.map((c) => c.etiqueta.replace(/ \(.*\)$/, '')).join(', ')})` : 'sin datos nuevos'}`,
    revisar.length ? `${revisar.length} para revisar` : '',
    firmada ? `firmada${r.firma?.nombre ? ' por ' + r.firma.nombre : ''}` : r.firma ? 'casilla de conformidad marcada' : '',
    conPdf ? 'PDF guardado' : '',
  ].filter(Boolean).join(' · ');
}

/** Deshacer: vuelve a poner los valores de antes en los campos que se cambiaron (y quita el PDF y la firma si los puso). */
export function deshacerRecepcion(avisoActual, avisoAntes, { aplicados, archivoHash }) {
  const a = structuredClone(avisoActual);
  for (const c of aplicados) {
    const [g, k] = c.ruta.split('.');
    a[g] = { ...(a[g] || {}), [k]: avisoAntes?.[g]?.[k] ?? '' };
  }
  if (archivoHash) {
    a.archivos = (a.archivos || []).filter((x) => x.hash !== archivoHash || (avisoAntes.archivos || []).some((y) => y.hash === archivoHash));
    a.docs = { ...(a.docs || {}), firmado: avisoAntes?.docs?.firmado ?? a.docs?.firmado };
  }
  return a;
}
