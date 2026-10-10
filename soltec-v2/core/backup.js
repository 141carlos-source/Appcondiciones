// SOLTEC V2 · Capa 2 · Copia de seguridad completa: exportar e importar.
//
// Formato (JSON): { formato, version, creada, dispositivo, huella, registros:[...], archivos:[{hash,mime,size,b64}] }
// La «huella» es el SHA-256 del contenido: si el archivo se corta o se altera, la importación se niega.
//
// Importar NUNCA borra nada y nunca pisa un cambio local pendiente de sincronizar:
//  - registro que no existe            → se añade
//  - mismo registro y misma revisión   → se ignora
//  - el local tiene cambios pendientes → se conserva el local (se informa como conflicto)
//  - la copia es más reciente          → se actualiza
//  - el local es más reciente          → se conserva el local

import { req, done } from './db.js';
import { sha256Hex } from './storage.js';

export const FORMATO = 'SOLTEC_V2_COPIA';
export const VERSION = 1;

const enc = new TextEncoder();

function toB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out.buffer;
}

/** JSON con claves ordenadas: el mismo contenido da siempre la misma huella. */
export function canonico(v) {
  if (Array.isArray(v)) return '[' + v.map(canonico).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonico(v[k])).join(',') + '}';
  return JSON.stringify(v ?? null);
}

async function huella(registros, archivos) {
  const ordenados = [...registros].sort((a, b) => (a.id < b.id ? -1 : 1));
  const hashes = archivos.map((f) => f.hash).sort();
  return sha256Hex(enc.encode(canonico({ registros: ordenados, archivos: hashes })));
}

/** Genera el objeto de copia completo. */
export async function exportar(storage) {
  const { records, blobs } = await storage.dumpAll();
  const archivos = blobs.map((b) => ({ hash: b.hash, mime: b.mime, size: b.size, b64: toB64(b.bytes) }));
  const copia = {
    formato: FORMATO,
    version: VERSION,
    creada: new Date().toISOString(),
    dispositivo: storage.deviceId,
    huella: await huella(records, archivos),
    totales: { registros: records.length, archivos: archivos.length },
    registros: records,
    archivos,
  };
  await storage.setMeta('ultimaCopia', { creada: copia.creada, ...copia.totales });
  return copia;
}

/** Nombre de archivo: SOLTEC_V2_COPIA_2026-10-10_1530.json */
export function nombreCopia(fecha = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `SOLTEC_V2_COPIA_${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}_${p(fecha.getHours())}${p(fecha.getMinutes())}.json`;
}

export async function exportarBlob(storage) {
  const copia = await exportar(storage);
  return { blob: new Blob([JSON.stringify(copia)], { type: 'application/json' }), nombre: nombreCopia(), totales: copia.totales };
}

/** Comprueba formato, huella y archivos sin tocar la base de datos. */
export async function verificar(copia) {
  if (!copia || copia.formato !== FORMATO) throw new Error('El archivo no es una copia de SOLTEC V2.');
  if (copia.version > VERSION) throw new Error('La copia es de una versión más nueva de SOLTEC. Actualiza la aplicación.');
  if (!Array.isArray(copia.registros) || !Array.isArray(copia.archivos)) throw new Error('La copia está incompleta.');
  if ((await huella(copia.registros, copia.archivos)) !== copia.huella) throw new Error('La copia está dañada o modificada: la huella no coincide.');
  for (const f of copia.archivos) {
    if ((await sha256Hex(fromB64(f.b64))) !== f.hash) throw new Error(`Un archivo de la copia está dañado (${f.hash.slice(0, 12)}…).`);
  }
  return { registros: copia.registros.length, archivos: copia.archivos.length, creada: copia.creada };
}

/**
 * Importa una copia fusionándola con lo que hay. Todo en una transacción.
 * @returns informe {nuevos, actualizados, iguales, conservados, conflictos:[id], archivos}
 */
export async function importar(storage, copia) {
  await verificar(copia);
  const informe = { nuevos: 0, actualizados: 0, iguales: 0, conservados: 0, conflictos: [], archivos: 0 };
  const tx = storage.db.transaction(['records', 'outbox', 'blobs', 'blobOutbox'], 'readwrite');
  const recs = tx.objectStore('records');
  const outbox = tx.objectStore('outbox');
  const blobs = tx.objectStore('blobs');

  for (const r of copia.registros) {
    const local = await req(recs.get(r.id));
    if (!local) {
      recs.put(r);
      // Lo que nunca llegó al PC se encola para subirlo.
      if (!r.serverRev) outbox.put({ id: r.id, baseServerRev: 0, queuedAt: new Date().toISOString() });
      informe.nuevos++;
      continue;
    }
    if (local.rev === r.rev && local.updatedAt === r.updatedAt) { informe.iguales++; continue; }
    if (await req(outbox.count(r.id))) { informe.conservados++; informe.conflictos.push(r.id); continue; }
    if (r.updatedAt > local.updatedAt) { recs.put(r); informe.actualizados++; } else informe.conservados++;
  }

  for (const f of copia.archivos) {
    if (await req(blobs.count(f.hash))) continue;
    blobs.put({ hash: f.hash, mime: f.mime, size: f.size, bytes: fromB64(f.b64), storedAt: new Date().toISOString() });
    tx.objectStore('blobOutbox').put({ hash: f.hash, queuedAt: new Date().toISOString() });
    informe.archivos++;
  }
  await done(tx);
  storage._emit({ type: '*', importado: true });
  return informe;
}
