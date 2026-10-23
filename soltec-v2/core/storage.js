// SOLTEC V2 · Capa 1 · Storage: única puerta de entrada a los datos.
// Ningún módulo debe escribir en IndexedDB ni en localStorage por su cuenta.
//
// Garantías:
//  - Cada cambio de registro, su evento de historial y su entrada en la cola de
//    sincronización se escriben en UNA transacción: o se guarda todo o nada.
//  - Borrar = papelera (deleted=true). No hay borrado físico de registros.
//  - Los archivos se guardan por su SHA-256: idénticos no se duplican y nunca se sobrescriben.

import { openDB, req, done } from './db.js';

const now = () => new Date().toISOString();
// Orden estable de eventos creados en el mismo milisegundo
let ultimoOrden = 0;
const siguienteOrden = () => { ultimoOrden = Math.max(Date.now() * 1000, ultimoOrden + 1); return ultimoOrden; };

/** Identificador ordenable por tiempo y único entre dispositivos. */
export function newId(prefix = '') {
  const t = Date.now().toString(36).padStart(9, '0');
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
  return (prefix ? prefix + '_' : '') + t + rnd;
}

export async function sha256Hex(bytes) {
  const h = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join('');
}

const clone = (o) => (o === undefined ? undefined : structuredClone(o));

export class Storage {
  /** @param {{name?:string, indexedDB?:IDBFactory}} opts */
  static async open(opts = {}) {
    const db = await openDB(opts.name, opts.indexedDB);
    const s = new Storage(db);
    s.deviceId = await s.getMeta('deviceId');
    if (!s.deviceId) {
      s.deviceId = newId('dev');
      await s.setMeta('deviceId', s.deviceId);
    }
    return s;
  }

  constructor(db) {
    this.db = db;
    this.deviceId = null;
    this._listeners = new Set();
  }

  close() { this.db.close(); }

  // ---------- Avisos de cambio (para refrescar pantallas) ----------
  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit(change) { for (const fn of this._listeners) { try { fn(change); } catch (e) { console.error(e); } } }

  // ---------- Meta (local al dispositivo, nunca se sincroniza) ----------
  async getMeta(key) {
    const tx = this.db.transaction('meta');
    const v = await req(tx.objectStore('meta').get(key));
    return v ? clone(v.value) : undefined;
  }
  async setMeta(key, value) {
    const tx = this.db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put({ key, value: clone(value) });
    await done(tx);
  }

  // ---------- Lectura ----------
  async get(id) {
    const tx = this.db.transaction('records');
    return (await req(tx.objectStore('records').get(id))) || null;
  }

  /** Registros de un tipo. Por defecto excluye la papelera. */
  async list(type, { includeDeleted = false, onlyDeleted = false } = {}) {
    const tx = this.db.transaction('records');
    const all = await req(tx.objectStore('records').index('type').getAll(type));
    return all.filter((r) => (onlyDeleted ? r.deleted : includeDeleted || !r.deleted));
  }

  /** Registros vinculados a otro (historial, citas de un aviso, partes...). */
  async listByRef(ref, type) {
    const tx = this.db.transaction('records');
    const all = await req(tx.objectStore('records').index('ref').getAll(ref));
    return type ? all.filter((r) => r.type === type) : all;
  }

  /** Fecha (ISO) del cambio pendiente de subir más antiguo (registros o archivos), o null si no hay. */
  async pendienteMasAntiguo() {
    const tx = this.db.transaction(['outbox', 'blobOutbox']);
    const [a, b] = await Promise.all([req(tx.objectStore('outbox').getAll()), req(tx.objectStore('blobOutbox').getAll())]);
    return a.concat(b).reduce((m, x) => (x.queuedAt && (!m || x.queuedAt < m) ? x.queuedAt : m), null);
  }

  /** Registros vinculados a varios (p. ej. el historial de los avisos abiertos), en una sola lectura. */
  async listByRefs(refs, type) {
    if (!refs.length) return [];
    const tx = this.db.transaction('records');
    const idx = tx.objectStore('records').index('ref');
    const partes = await Promise.all(refs.map((r) => req(idx.getAll(r))));
    const all = partes.flat();
    return type ? all.filter((r) => r.type === type) : all;
  }

  /** Historial cronológico de un registro. */
  async history(ref) {
    const ev = await this.listByRef(ref, 'evento');
    return ev.sort((a, b) => (a.data.at < b.data.at ? -1 : a.data.at > b.data.at ? 1 : (a.data.orden || 0) - (b.data.orden || 0)));
  }

  // ---------- Escritura ----------
  /**
   * Crea o actualiza un registro.
   * @param {string} type
   * @param {object} data  contenido completo del registro (sustituye al anterior)
   * @param {{id?:string, ref?:string|null, event?:{kind:string,text?:string,extra?:object}|null}} opts
   */
  async save(type, data, { id, ref, event } = {}) {
    return this._write(id || newId(type.slice(0, 3)), (prev) => {
      if (prev && prev.type !== type) throw new Error(`El registro ${prev.id} es de tipo ${prev.type}, no ${type}.`);
      if (prev && prev.type === 'evento') throw new Error('Los eventos del historial no se modifican.');
      return { type, ref: ref !== undefined ? ref : prev ? prev.ref : null, data: clone(data), deleted: prev ? prev.deleted : false, deletedAt: prev ? prev.deletedAt : null };
    }, event);
  }

  /** Modifica solo algunos campos de data. */
  async patch(id, fields, opts = {}) {
    return this._write(id, (prev) => {
      if (!prev) throw new Error(`No existe el registro ${id}.`);
      if (prev.type === 'evento') throw new Error('Los eventos del historial no se modifican.');
      return { ...prev, data: { ...prev.data, ...clone(fields) } };
    }, opts.event);
  }

  async trash(id, motivo = '') {
    return this._write(id, (prev) => {
      if (!prev) throw new Error(`No existe el registro ${id}.`);
      return { ...prev, deleted: true, deletedAt: now() };
    }, { kind: 'papelera', text: motivo ? `Enviado a la papelera: ${motivo}` : 'Enviado a la papelera' });
  }

  async restore(id) {
    return this._write(id, (prev) => {
      if (!prev) throw new Error(`No existe el registro ${id}.`);
      return { ...prev, deleted: false, deletedAt: null };
    }, { kind: 'restaurado', text: 'Recuperado de la papelera' });
  }

  /** Añade una entrada al historial de un registro. */
  async addEvent(ref, kind, text = '', extra = {}) {
    const tx = this.db.transaction(['records', 'outbox'], 'readwrite');
    const ev = this._makeEvent(ref, { kind, text, extra });
    this._queue(tx, ev);
    await done(tx);
    this._emit({ type: 'evento', id: ev.id, ref });
    return ev;
  }

  _makeEvent(ref, { kind, text = '', extra = {} }) {
    const t = now();
    return {
      id: newId('evt'), type: 'evento', ref,
      data: { at: t, orden: siguienteOrden(), kind, text, ...clone(extra) },
      rev: 1, serverRev: 0, createdAt: t, updatedAt: t, deviceId: this.deviceId, deleted: false, deletedAt: null,
    };
  }

  _queue(tx, rec, baseServerRev = rec.serverRev) {
    tx.objectStore('records').put(rec);
    tx.objectStore('outbox').put({ id: rec.id, baseServerRev, queuedAt: now() });
  }

  async _write(id, build, event) {
    const tx = this.db.transaction(['records', 'outbox'], 'readwrite');
    const store = tx.objectStore('records');
    const outbox = tx.objectStore('outbox');
    const prev = (await req(store.get(id))) || null;
    const pending = await req(outbox.get(id));
    const next = build(prev);
    const t = now();
    const rec = {
      id,
      type: next.type,
      ref: next.ref ?? null,
      data: next.data,
      rev: (prev ? prev.rev : 0) + 1,
      serverRev: prev ? prev.serverRev : 0,
      createdAt: prev ? prev.createdAt : t,
      updatedAt: t,
      deviceId: this.deviceId,
      deleted: !!next.deleted,
      deletedAt: next.deleted ? next.deletedAt || t : null,
    };
    // Si ya había un cambio pendiente, se conserva su revisión de partida:
    // es la que el servidor conoce, y así se agrupan varios cambios en uno.
    this._queue(tx, rec, pending ? pending.baseServerRev : rec.serverRev);
    let ev = null;
    if (event) {
      ev = this._makeEvent(id, event);
      this._queue(tx, ev);
    }
    await done(tx);
    this._emit({ type: rec.type, id, ref: rec.ref, created: !prev });
    return rec;
  }

  // ---------- Archivos (PDF, fotos, firmas) ----------
  /**
   * Guarda un archivo y devuelve su ficha {hash, name, mime, size, addedAt}.
   * Acepta un File/Blob o {name, mime, bytes:ArrayBuffer|Uint8Array}.
   */
  async putFile(file) {
    let bytes, name, mime;
    if (typeof Blob !== 'undefined' && file instanceof Blob) {
      bytes = await file.arrayBuffer();
      name = file.name || 'archivo';
      mime = file.type || 'application/octet-stream';
    } else {
      bytes = file.bytes instanceof Uint8Array ? file.bytes.slice().buffer : file.bytes;
      name = file.name || 'archivo';
      mime = file.mime || 'application/octet-stream';
    }
    const hash = await sha256Hex(bytes);
    const tx = this.db.transaction(['blobs', 'blobOutbox'], 'readwrite');
    const blobs = tx.objectStore('blobs');
    const exists = await req(blobs.count(hash));
    if (!exists) {
      blobs.put({ hash, mime, size: bytes.byteLength, bytes, storedAt: now() });
      tx.objectStore('blobOutbox').put({ hash, queuedAt: now() });
    }
    await done(tx);
    return { hash, name, mime, size: bytes.byteLength, addedAt: now() };
  }

  /** Devuelve {hash, mime, size, bytes} o null. */
  async getFile(hash) {
    const tx = this.db.transaction('blobs');
    return (await req(tx.objectStore('blobs').get(hash))) || null;
  }

  async getFileBlob(hash) {
    const f = await this.getFile(hash);
    return f ? new Blob([f.bytes], { type: f.mime }) : null;
  }

  // ---------- Estado de la cola de sincronización ----------
  async pendingCounts() {
    const tx = this.db.transaction(['outbox', 'blobOutbox']);
    const [records, files] = await Promise.all([req(tx.objectStore('outbox').count()), req(tx.objectStore('blobOutbox').count())]);
    return { records, files };
  }

  async listPending() {
    const tx = this.db.transaction(['outbox', 'records']);
    const items = await req(tx.objectStore('outbox').getAll());
    const recs = await Promise.all(items.map((o) => req(tx.objectStore('records').get(o.id))));
    return items.map((o, i) => ({ ...o, record: recs[i] }));
  }

  // ---------- Uso exclusivo de la sincronización (capa 4) ----------
  /** El PC aceptó el registro: anota su revisión. Si se editó mientras subía, sigue pendiente. */
  async _ackPushed(id, sentRev, serverRev) {
    const tx = this.db.transaction(['records', 'outbox'], 'readwrite');
    const recs = tx.objectStore('records');
    const rec = await req(recs.get(id));
    if (rec) {
      rec.serverRev = serverRev;
      recs.put(rec);
      if (rec.rev === sentRev) tx.objectStore('outbox').delete(id);
      else tx.objectStore('outbox').put({ id, baseServerRev: serverRev, queuedAt: now() });
    } else tx.objectStore('outbox').delete(id);
    await done(tx);
  }

  /** Cambia la revisión de partida de un pendiente (p. ej. el PC perdió el registro). */
  async _rebase(id, baseServerRev) {
    const tx = this.db.transaction('outbox', 'readwrite');
    const o = await req(tx.objectStore('outbox').get(id));
    if (o) tx.objectStore('outbox').put({ ...o, baseServerRev });
    await done(tx);
  }

  /** Guarda tal cual un registro que viene del PC, sin encolarlo. */
  async _applyRemote(remote, { dropPending = false } = {}) {
    const tx = this.db.transaction(['records', 'outbox'], 'readwrite');
    tx.objectStore('records').put(remote);
    if (dropPending) tx.objectStore('outbox').delete(remote.id);
    await done(tx);
  }

  async _hasPending(id) {
    const tx = this.db.transaction('outbox');
    return (await req(tx.objectStore('outbox').get(id))) || null;
  }

  async _listBlobOutbox() {
    const tx = this.db.transaction('blobOutbox');
    return (await req(tx.objectStore('blobOutbox').getAllKeys()));
  }

  async _dropBlobOutbox(hash) {
    const tx = this.db.transaction('blobOutbox', 'readwrite');
    tx.objectStore('blobOutbox').delete(hash);
    await done(tx);
  }

  /** Guarda un archivo bajado del PC (ya verificado), sin encolarlo. */
  async _putRemoteFile(hash, mime, bytes) {
    if ((await sha256Hex(bytes)) !== hash) throw new Error('Archivo recibido dañado');
    const tx = this.db.transaction('blobs', 'readwrite');
    tx.objectStore('blobs').put({ hash, mime, size: bytes.byteLength, bytes, storedAt: now() });
    await done(tx);
  }

  async _hasFile(hash) {
    const tx = this.db.transaction('blobs');
    return (await req(tx.objectStore('blobs').count(hash))) > 0;
  }

  /** Todos los registros (sin los archivos: no carga PDF ni fotos en memoria). */
  async listAllRecords() {
    const tx = this.db.transaction('records');
    return req(tx.objectStore('records').getAll());
  }

  /**
   * El PC ha perdido los datos o es otro servidor: se vuelve a subir todo.
   * Los registros pasan a revisión 0 del servidor y los archivos a la cola de subida.
   */
  async _requeueAll() {
    const tx = this.db.transaction(['records', 'outbox', 'blobs', 'blobOutbox'], 'readwrite');
    const recs = tx.objectStore('records');
    const all = await req(recs.getAll());
    for (const r of all) {
      r.serverRev = 0;
      recs.put(r);
      // «reenvio»: no es un cambio hecho aquí; si el PC tiene algo igual o más nuevo, gana el PC sin conflicto.
      if (!(await req(tx.objectStore('outbox').get(r.id)))) tx.objectStore('outbox').put({ id: r.id, baseServerRev: 0, reenvio: true, queuedAt: now() });
      else tx.objectStore('outbox').put({ id: r.id, baseServerRev: 0, queuedAt: now() });
    }
    const hashes = await req(tx.objectStore('blobs').getAllKeys());
    for (const h of hashes) tx.objectStore('blobOutbox').put({ hash: h, queuedAt: now() });
    await done(tx);
    return { registros: all.length, archivos: hashes.length };
  }

  // ---------- Espacio: archivos que ya no usa ningún registro ----------
  /**
   * Archivos guardados en este dispositivo y los que ningún registro (ni la papelera, ni un conflicto,
   * ni la cola de subida) usa ya. Borrarlos solo quita la copia de ESTE dispositivo: el PC los conserva.
   */
  async espacioArchivos() {
    const tx = this.db.transaction(['records', 'meta', 'blobs', 'blobOutbox']);
    // Los archivos se recorren de uno en uno (sin cargar todas las fotos a la vez en memoria)
    const blobs = await new Promise((ok, ko) => {
      const out = [];
      const c = tx.objectStore('blobs').openCursor();
      c.onsuccess = () => { const cur = c.result; if (!cur) return ok(out); out.push({ hash: cur.value.hash, size: cur.value.size || cur.value.bytes?.byteLength || 0 }); cur.continue(); };
      c.onerror = () => ko(c.error);
    });
    const [recs, metas, pend] = await Promise.all([
      req(tx.objectStore('records').getAll()), req(tx.objectStore('meta').getAll()), req(tx.objectStore('blobOutbox').getAllKeys())]);
    const usados = new Set(pend);
    const buscar = (o) => { for (const m of JSON.stringify(o).matchAll(/[0-9a-f]{64}/g)) usados.add(m[0]); };
    recs.forEach(buscar); metas.forEach(buscar);
    const sinUso = blobs.filter((b) => !usados.has(b.hash));
    const suma = (l) => l.reduce((n, b) => n + b.size, 0);
    return { archivos: blobs.length, bytes: suma(blobs), sinUso: sinUso.map((b) => b.hash), bytesSinUso: suma(sinUso) };
  }

  /** Borra de este dispositivo los archivos indicados (solo si siguen sin usarse). */
  async borrarArchivosSinUso() {
    const { sinUso, bytesSinUso } = await this.espacioArchivos();
    if (!sinUso.length) return { borrados: 0, bytes: 0 };
    const tx = this.db.transaction('blobs', 'readwrite');
    for (const h of sinUso) tx.objectStore('blobs').delete(h);
    await done(tx);
    return { borrados: sinUso.length, bytes: bytesSinUso };
  }

  // ---------- Volcado completo (base de la copia de seguridad, capa 2) ----------
  async dumpAll() {
    const tx = this.db.transaction(['records', 'blobs']);
    const [records, blobs] = await Promise.all([req(tx.objectStore('records').getAll()), req(tx.objectStore('blobs').getAll())]);
    return { records, blobs };
  }
}
