// SOLTEC V2 · Capa 1 · Apertura de IndexedDB y utilidades de bajo nivel.
// Único punto que conoce el esquema físico de la base de datos.

export const DB_NAME = 'SOLTEC_V2';
export const DB_VERSION = 1;

export function openDB(name = DB_NAME, idb = globalThis.indexedDB) {
  if (!idb) return Promise.reject(new Error('Este navegador no dispone de IndexedDB.'));
  return new Promise((resolve, reject) => {
    const r = idb.open(name, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('records')) {
        const rec = db.createObjectStore('records', { keyPath: 'id' });
        rec.createIndex('type', 'type');
        rec.createIndex('ref', 'ref');
        rec.createIndex('updatedAt', 'updatedAt');
      }
      for (const [name, key] of [['outbox', 'id'], ['blobs', 'hash'], ['blobOutbox', 'hash'], ['meta', 'key']]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: key });
      }
    };
    r.onsuccess = () => {
      const db = r.result;
      // Si otra pestaña actualiza el esquema, cerramos para no bloquearla.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('La base de datos está abierta en otra pestaña con una versión anterior. Cierra las demás pestañas de SOLTEC.'));
  });
}

/** Convierte una petición IDB en promesa. */
export const req = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

/** Promesa que se resuelve cuando la transacción se confirma en disco. */
export const done = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error || new Error('Transacción cancelada'));
});
