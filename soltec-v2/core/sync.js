// SOLTEC V2 · Capa 4 · Sincronización registro a registro con el PC de casa.
// ÚNICO módulo que habla con el servidor. Las pantallas solo llaman a sincronizar().
//
// Orden de una sincronización:
//   1. Subir archivos que el PC no tenga (por huella).
//   2. Subir registros pendientes. Cada uno se acepta o se rechaza por separado.
//   3. Bajar lo que cambió en el PC desde la última vez (cursor).
//   4. Bajar los archivos que falten y que usen los registros.
// Cada paso queda guardado al terminar: si se corta la conexión, lo hecho no se repite.
//
// Conflicto: el mismo registro cambió aquí y en el PC. Se muestra la versión del PC y la
// de este dispositivo queda guardada en «conflictos» hasta que elijas (resolverConflicto).

const HASH_RE = /^[0-9a-f]{64}$/;
const LOTE = 200;

export class SyncError extends Error {}

const canon = (v) => {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v ?? null);
};
/** ¿Dos versiones de un registro dicen lo mismo? (aunque se guardaran en dispositivos u horas distintas) */
export function mismoContenido(a, b) {
  if (!a || !b) return false;
  const f = (r) => canon({ type: r.type, ref: r.ref ?? null, deleted: !!r.deleted, data: r.data });
  return f(a) === f(b);
}

const esLocal = (host) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);

/**
 * Problemas de configuración que se pueden detectar sin conectar.
 * @param url   dirección configurada
 * @param pagina  location de la app (para saber si estamos en el móvil o en el propio PC)
 */
export function problemaDireccion(url, pagina = globalThis.location) {
  let u;
  try { u = new URL(url); } catch { return 'La dirección no es válida. Ejemplo: https://carlos25.tail970b93.ts.net:8443'; }
  const appLocal = pagina && esLocal(pagina.hostname);
  if (esLocal(u.hostname) && pagina && !appLocal) {
    return 'Esa dirección (127.0.0.1) solo sirve en el propio PC. En el móvil usa la de Tailscale terminada en :8443, por ejemplo https://carlos25.tail970b93.ts.net:8443';
  }
  if (pagina?.protocol === 'https:' && u.protocol === 'http:' && !esLocal(u.hostname)) {
    return 'Desde la app publicada hay que usar https://. Usa la dirección de Tailscale: https://carlos25.tail970b93.ts.net:8443';
  }
  if (u.hostname.endsWith('.ts.net') && u.hostname.split('.').length < 4) {
    return `Falta el nombre del PC delante: debe ser https://carlos25.${u.hostname}:8443 (el nombre lo ves en Tailscale, en la lista de equipos).`;
  }
  if (u.hostname.endsWith('.ts.net') && u.port !== '8443') {
    return 'Falta «:8443» al final de la dirección. Sin él se conecta con el servidor de la V1.35, no con el de la V2.';
  }
  return null;
}

/** Huellas de archivo referenciadas en cualquier parte de un registro. */
export function huellasDe(obj, out = new Set()) {
  if (Array.isArray(obj)) obj.forEach((x) => huellasDe(x, out));
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'hash' && typeof v === 'string' && HASH_RE.test(v)) out.add(v);
      else huellasDe(v, out);
    }
  }
  return out;
}

export class SyncManager {
  constructor(storage, { fetch: f = globalThis.fetch?.bind(globalThis), timeoutMs = 30000 } = {}) {
    this.s = storage;
    this.fetch = f;
    this.timeoutMs = timeoutMs;
    this._running = null;
  }

  // ---------- Configuración (local al dispositivo) ----------
  async config() { return (await this.s.getMeta('sync')) || { url: '', clave: '', nombre: '' }; }
  async guardarConfig({ url, clave, nombre }) {
    const limpia = String(url || '').trim().replace(/\/+$/, '');
    if (limpia && !/^https?:\/\//.test(limpia)) throw new SyncError('La dirección debe empezar por https://');
    const problema = limpia && problemaDireccion(limpia);
    if (problema) throw new SyncError(problema);
    const antes = await this.config();
    if (antes.url && limpia && antes.url !== limpia) {
      // Otro servidor: hay que bajarlo todo y subirle todo lo de este dispositivo.
      await this.s.setMeta('cursor', 0);
      await this.s._requeueAll();
    }
    await this.s.setMeta('sync', { url: limpia, clave: String(clave || '').trim(), nombre: String(nombre || '').trim() });
  }

  async _call(method, path, { json, body, headers = {}, raw = false } = {}) {
    const cfg = await this.config();
    if (!cfg.url || !cfg.clave) throw new SyncError('Falta configurar la dirección y la clave del PC.');
    const problema = problemaDireccion(cfg.url);
    if (problema) throw new SyncError(problema);
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctrl && setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res;
    try {
      res = await this.fetch(cfg.url + path, {
        method,
        headers: { 'X-Soltec-Key': cfg.clave, 'X-Soltec-Device': this.s.deviceId, ...(json ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: json ? JSON.stringify(json) : body,
        signal: ctrl?.signal,
      });
    } catch (e) {
      throw new SyncError(e?.name === 'AbortError'
        ? 'El PC no responde (tiempo agotado). Comprueba que el PC está encendido y la ventana «SOLTEC V2 - SERVIDOR» abierta.'
        : `No se puede conectar con el PC. Comprueba: 1) el PC está encendido y con la ventana «SOLTEC V2 - SERVIDOR» abierta (con el arranque automático instalado se abre sola); 2) Tailscale está conectado en el PC y en este dispositivo; 3) abre ${cfg.url}/ en el navegador: debe salir «SOLTEC V2».`);
    } finally {
      if (t) clearTimeout(t);
    }
    if (res.status === 401) throw new SyncError('La clave de sincronización no es correcta. Cópiala de la ventana «SOLTEC V2 - SERVIDOR» del PC (o del archivo SOLTEC_V2_DATOS\\soltec-v2-config.json de tu carpeta de usuario).');
    if (res.status === 404) throw new SyncError('En esa dirección responde un servidor que no es el de la V2 (¿el de la V1.35?). Revisa que termine en :8443 y que el PC se arrancó con INICIAR_SOLTEC_V2.bat.');
    if (raw) {
      if (!res.ok) throw new SyncError(`El PC respondió ${res.status}.`);
      return res;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new SyncError(data.error || `El PC respondió ${res.status}.`);
    return data;
  }

  async probar() {
    const st = await this._call('GET', '/api/v2/status');
    return { ok: true, version: st.version, registros: st.records, archivos: st.blobs };
  }

  /**
   * Latido ligero (cada ~25 s con la app abierta): dice si en el PC hay algo nuevo y qué
   * otros dispositivos están conectados y con qué aviso abierto. No sube ni baja registros.
   */
  async latido(abierto = null) {
    const cfg = await this.config();
    const r = await this._call('POST', '/api/v2/latido', { json: { deviceId: this.s.deviceId, nombre: cfg.nombre || '', abierto } });
    const cursor = (await this.s.getMeta('cursor')) || 0;
    await this.s.setMeta('ultimoContactoPC', new Date().toISOString());
    return { hayCambios: r.seq !== cursor, otros: r.presencia || [] };
  }

  // ---------- Conflictos ----------
  async conflictos() {
    const c = (await this.s.getMeta('conflictos')) || {};
    // Los que en realidad dicen lo mismo en los dos lados no son conflictos: se quitan solos.
    const iguales = Object.keys(c).filter((id) => mismoContenido(c[id].local, c[id].servidor));
    if (iguales.length) {
      for (const id of iguales) delete c[id];
      await this.s.setMeta('conflictos', c);
    }
    return c;
  }

  /** Resolver todos a la vez: 'servidor' (lo del PC) o 'local' (lo de este dispositivo). */
  async resolverTodos(eleccion) {
    const ids = Object.keys(await this.conflictos());
    for (const id of ids) await this.resolverConflicto(id, eleccion);
    return ids.length;
  }

  async _anotarConflicto(local, servidor) {
    const c = await this.conflictos();
    c[local.id] = { local, servidor, at: new Date().toISOString() };
    await this.s.setMeta('conflictos', c);
  }

  /**
   * @param {'local'|'servidor'} eleccion  'local' recupera la versión de este dispositivo
   *        como un cambio nuevo (se subirá en la próxima sincronización).
   */
  async resolverConflicto(id, eleccion) {
    const c = await this.conflictos();
    const item = c[id];
    if (!item) return;
    if (eleccion === 'local') {
      const l = item.local;
      if (l.type !== 'evento') {
        await this.s.save(l.type, l.data, { id, ref: l.ref, event: { kind: 'nota', text: 'Conflicto resuelto: se conserva la versión de este dispositivo' } });
        if (l.deleted) await this.s.trash(id);
      }
    }
    delete c[id];
    await this.s.setMeta('conflictos', c);
  }

  // ---------- Sincronizar ----------
  sincronizar() {
    if (!this._running) this._running = this._sync().finally(() => { this._running = null; });
    return this._running;
  }

  async _sync() {
    const inf = { subidos: 0, bajados: 0, conflictos: 0, archivosSubidos: 0, archivosBajados: 0, inicio: new Date().toISOString() };
    await this._subirArchivos(inf);
    await this._subirRegistros(inf);
    await this._bajarRegistros(inf);
    if (inf.servidorReiniciado || inf.reintentar) {
      // El PC empezó de cero: se le vuelve a subir todo lo que hay aquí.
      await this._subirArchivos(inf);
      await this._subirRegistros(inf);
    }
    await this._bajarArchivos(inf);
    inf.fin = new Date().toISOString();
    await this.s.setMeta('ultimaSync', inf);
    await this.s.setMeta('ultimoContactoPC', inf.fin);
    this.s._emit({ type: '*', sync: inf });
    return inf;
  }

  async _subirArchivos(inf) {
    const pend = await this.s._listBlobOutbox();
    for (let i = 0; i < pend.length; i += LOTE) {
      const lote = pend.slice(i, i + LOTE);
      const { missing } = await this._call('POST', '/api/v2/blobs/missing', { json: { hashes: lote } });
      const faltan = new Set(missing);
      for (const h of lote) {
        if (faltan.has(h)) {
          const f = await this.s.getFile(h);
          if (f) {
            await this._call('PUT', '/api/v2/blob/' + h, { body: f.bytes, headers: { 'Content-Type': f.mime } });
            inf.archivosSubidos++;
          }
        }
        await this.s._dropBlobOutbox(h);
      }
    }
  }

  async _subirRegistros(inf) {
    const pend = (await this.s.listPending()).filter((p) => p.record);
    // Eventos al final no hace falta: el orden no importa, cada registro es independiente.
    for (let i = 0; i < pend.length; i += LOTE) {
      const lote = pend.slice(i, i + LOTE);
      const enviados = new Map(lote.map((p) => [p.id, p]));
      const res = await this._call('POST', '/api/v2/push', {
        json: { deviceId: this.s.deviceId, changes: lote.map((p) => ({ record: p.record, baseServerRev: p.baseServerRev })) },
      });
      for (const r of res.results) {
        const p = enviados.get(r.id);
        if (!p) continue;
        if (r.status === 'accepted') {
          await this.s._ackPushed(r.id, p.record.rev, r.serverRev);
          inf.subidos++;
        } else if (r.status === 'conflict') {
          if (r.server && r.server.rev === p.record.rev && r.server.updatedAt === p.record.updatedAt && r.server.deviceId === p.record.deviceId) {
            // El PC ya tenía exactamente esta versión (p. ej. tras volver a subirlo todo): no es un conflicto.
            await this.s._ackPushed(r.id, p.record.rev, r.serverRev);
          } else if (r.server && mismoContenido(r.server, p.record)) {
            // Lo mismo en los dos lados (p. ej. importado de la V1.35 en el PC y en el móvil): se toma el del PC sin preguntar.
            await this.s._applyRemote(r.server, { dropPending: true });
          } else if (r.server && p.reenvio && r.server.updatedAt >= p.record.updatedAt) {
            // Reenvío tras cambiar de servidor: el PC tiene una versión igual o más nueva y aquí no se tocó.
            await this.s._applyRemote(r.server, { dropPending: true });
          } else if (r.server) {
            await this._anotarConflicto(p.record, r.server);
            await this.s._applyRemote(r.server, { dropPending: true });
            inf.conflictos++;
          } else {
            // El PC no tiene el registro (base de datos nueva o restaurada): se sube como nuevo en la siguiente vuelta.
            await this.s._rebase(r.id, 0);
            inf.reintentar = true;
          }
        }
      }
    }
  }

  async _bajarRegistros(inf) {
    let since = (await this.s.getMeta('cursor')) || 0;
    for (;;) {
      const res = await this._call('GET', `/api/v2/pull?since=${since}&limit=500`);
      if (res.seq < since) {
        // El PC tiene menos cambios de los que ya habíamos visto: su base de datos es nueva o se restauró.
        inf.servidorReiniciado = true;
        await this.s._requeueAll();
        since = 0;
        await this.s.setMeta('cursor', 0);
        continue;
      }
      for (const remoto of res.changes) {
        const local = await this.s.get(remoto.id);
        const pendiente = await this.s._hasPending(remoto.id);
        if (pendiente) {
          if (local && remoto.rev === local.rev && remoto.updatedAt === local.updatedAt && remoto.deviceId === local.deviceId) {
            // Es la misma versión que tenemos (p. ej. al volver a un servidor que ya la tenía): solo se anota.
            await this.s._ackPushed(remoto.id, local.rev, remoto.serverRev);
            continue;
          }
          if (pendiente.reenvio && local && remoto.updatedAt >= local.updatedAt) {
            await this.s._applyRemote(remoto, { dropPending: true });
            inf.bajados++;
            continue;
          }
          // Cambiado aquí después de la subida. Si el PC tiene algo más nuevo que nuestra base, es conflicto.
          if (remoto.serverRev > pendiente.baseServerRev && local) {
            await this._anotarConflicto(local, remoto);
            await this.s._applyRemote(remoto, { dropPending: true });
            inf.conflictos++;
          }
          continue;
        }
        if (!local || remoto.serverRev > (local.serverRev || 0) || (remoto.serverRev === local.serverRev && remoto.rev !== local.rev)) {
          await this.s._applyRemote(remoto);
          inf.bajados++;
        }
      }
      since = res.next;
      await this.s.setMeta('cursor', since);
      if (!res.more) break;
    }
  }

  async _bajarArchivos(inf) {
    const todas = new Set();
    for (const r of await this.s.listAllRecords()) huellasDe(r.data, todas);
    for (const h of todas) {
      if (await this.s._hasFile(h)) continue;
      try {
        const res = await this._call('GET', '/api/v2/blob/' + h, { raw: true });
        const bytes = await res.arrayBuffer();
        await this.s._putRemoteFile(h, res.headers.get('Content-Type') || 'application/octet-stream', bytes);
        inf.archivosBajados++;
      } catch (e) {
        // Un archivo que aún no está en el PC no detiene la sincronización: se reintenta la próxima vez.
        if (!(e instanceof SyncError)) throw e;
      }
    }
  }

  /** Envía una copia completa al PC (se guarda en su carpeta «copias»). */
  async enviarCopia(copia) {
    return this._call('POST', '/api/v2/backup', { json: copia });
  }
}
