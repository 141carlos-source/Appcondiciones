#!/usr/bin/env python3
"""SOLTEC V2 · Capa 3 · Servidor central del PC de casa.

Sincronización registro a registro. Sin dependencias: solo Python 3.8+.

  GET  /api/v2/status                    estado y contadores
  POST /api/v2/push                      subir cambios {deviceId, changes:[{record, baseServerRev}]}
  GET  /api/v2/pull?since=N&limit=M      bajar cambios posteriores al cursor N
  POST /api/v2/blobs/missing             {hashes:[...]} -> {missing:[...]}
  PUT  /api/v2/blob/<sha256>             subir un archivo (se verifica la huella)
  GET  /api/v2/blob/<sha256>             bajar un archivo
  POST /api/v2/backup                    guardar una copia completa enviada por un dispositivo

Reglas:
  - Un cambio se acepta solo si parte de la revisión que tiene el PC (baseServerRev).
    Si no, se rechaza SOLO ese registro y se guarda la versión rechazada en «conflictos».
  - Los eventos del historial son inmutables: se aceptan una vez y nunca entran en conflicto.
  - Nada se borra: la papelera es un campo del registro.
  - La clave se crea una sola vez. Si el archivo de configuración existe pero no se puede
    leer, el servidor NO arranca (nunca regenera la clave en silencio).
"""

import hashlib
import json
import os
import re
import secrets
import shutil
import sqlite3
import sys
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

VERSION = "V2-SERVIDOR-1"
ROOT = Path(os.environ.get("SOLTEC_V2_DIR", Path(__file__).resolve().parent))
DATA = ROOT / "datos"
BLOBS = DATA / "archivos"
BACKUPS = ROOT / "copias"
CONFIG_FILE = ROOT / "soltec-v2-config.json"
DB_FILE = DATA / "soltec-v2.sqlite3"
DEFAULT_PORT = 8766
MAX_BODY = 60 * 1024 * 1024  # 60 MB por petición
KEEP_DB_BACKUPS = 30
HASH_RE = re.compile(r"^[0-9a-f]{64}$")


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class ConfigError(Exception):
    pass


def load_config(path=None):
    path = path or CONFIG_FILE
    if path.exists():
        try:
            c = json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            raise ConfigError(f"No se puede leer {path.name}: {e}. Revisa el archivo; la clave NO se regenera.")
        if not c.get("key"):
            raise ConfigError(f"{path.name} no contiene la clave. Revisa el archivo; la clave NO se regenera.")
        return c
    path.parent.mkdir(parents=True, exist_ok=True)
    c = {"key": secrets.token_urlsafe(24), "port": DEFAULT_PORT, "createdAt": now_iso()}
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(c, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)
    return c


# ---------------------------------------------------------------- almacén
class Store:
    def __init__(self, db_file=None, blobs_dir=None, backups_dir=None):
        self.db_file = Path(db_file or DB_FILE)
        self.blobs = Path(blobs_dir or BLOBS)
        self.backups = Path(backups_dir or BACKUPS)
        for d in (self.db_file.parent, self.blobs, self.backups):
            d.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.db = sqlite3.connect(str(self.db_file), check_same_thread=False, isolation_level=None)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA synchronous=FULL")
        self.db.executescript(
            """
            CREATE TABLE IF NOT EXISTS records(
              id TEXT PRIMARY KEY, type TEXT NOT NULL, server_rev INTEGER NOT NULL,
              seq INTEGER NOT NULL, device_id TEXT, updated_at TEXT, json TEXT NOT NULL);
            CREATE INDEX IF NOT EXISTS records_seq ON records(seq);
            CREATE TABLE IF NOT EXISTS conflicts(
              n INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT, device_id TEXT, at TEXT,
              base_rev INTEGER, server_rev INTEGER, json TEXT);
            CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
            """
        )

    def _seq(self):
        row = self.db.execute("SELECT v FROM meta WHERE k='seq'").fetchone()
        return int(row[0]) if row else 0

    def status(self):
        with self.lock:
            n = self.db.execute("SELECT COUNT(*) FROM records").fetchone()[0]
            c = self.db.execute("SELECT COUNT(*) FROM conflicts").fetchone()[0]
            return {"seq": self._seq(), "records": n, "conflicts": c,
                    "blobs": sum(1 for p in self.blobs.glob("*/*") if HASH_RE.match(p.name)), "dbBackups": len(list(self.backups.glob("soltec-v2_*.sqlite3")))}

    def push(self, device_id, changes):
        results = []
        with self.lock:
            self.db.execute("BEGIN IMMEDIATE")
            try:
                seq = self._seq()
                for ch in changes:
                    rec = ch.get("record") or {}
                    rid, rtype = rec.get("id"), rec.get("type")
                    if not isinstance(rid, str) or not rid or not isinstance(rtype, str) or not rtype:
                        results.append({"id": rid, "status": "invalid", "error": "Registro sin id o sin tipo"})
                        continue
                    base = int(ch.get("baseServerRev") or 0)
                    row = self.db.execute("SELECT server_rev, json FROM records WHERE id=?", (rid,)).fetchone()
                    cur = row[0] if row else 0
                    if rtype == "evento" and row:
                        results.append({"id": rid, "status": "accepted", "serverRev": cur})
                        continue
                    if cur != base:
                        self.db.execute(
                            "INSERT INTO conflicts(id, device_id, at, base_rev, server_rev, json) VALUES(?,?,?,?,?,?)",
                            (rid, device_id, now_iso(), base, cur, json.dumps(rec, ensure_ascii=False)))
                        server_rec = json.loads(row[1]) if row else None
                        if server_rec is not None:
                            server_rec["serverRev"] = cur
                        results.append({"id": rid, "status": "conflict", "serverRev": cur, "server": server_rec})
                        continue
                    seq += 1
                    new_rev = cur + 1
                    rec = dict(rec, serverRev=new_rev)
                    self.db.execute(
                        "INSERT OR REPLACE INTO records(id, type, server_rev, seq, device_id, updated_at, json) VALUES(?,?,?,?,?,?,?)",
                        (rid, rtype, new_rev, seq, device_id, rec.get("updatedAt"), json.dumps(rec, ensure_ascii=False)))
                    results.append({"id": rid, "status": "accepted", "serverRev": new_rev})
                self.db.execute("INSERT OR REPLACE INTO meta(k, v) VALUES('seq', ?)", (str(seq),))
                self.db.execute("COMMIT")
            except Exception:
                self.db.execute("ROLLBACK")
                raise
            return {"results": results, "seq": seq}

    def pull(self, since, limit):
        with self.lock:
            rows = self.db.execute(
                "SELECT json, server_rev, seq FROM records WHERE seq > ? ORDER BY seq LIMIT ?", (since, limit + 1)).fetchall()
            more = len(rows) > limit
            rows = rows[:limit]
            out = []
            for js, rev, _ in rows:
                r = json.loads(js)
                r["serverRev"] = rev
                out.append(r)
            nxt = rows[-1][2] if rows else max(since, 0)
            return {"changes": out, "next": nxt, "more": more, "seq": self._seq()}

    # --- archivos
    def blob_path(self, h):
        return self.blobs / h[:2] / h

    def has_blob(self, h):
        return self.blob_path(h).exists()

    def put_blob(self, h, data, mime):
        if hashlib.sha256(data).hexdigest() != h:
            raise ValueError("La huella del archivo no coincide con su contenido")
        p = self.blob_path(h)
        if p.exists():
            return False
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_suffix(".tmp")
        tmp.write_bytes(data)
        os.replace(tmp, p)
        (p.parent / (h + ".mime")).write_text(mime or "application/octet-stream", encoding="utf-8")
        return True

    def get_blob(self, h):
        p = self.blob_path(h)
        if not p.exists():
            return None, None
        m = p.parent / (h + ".mime")
        return p.read_bytes(), (m.read_text(encoding="utf-8") if m.exists() else "application/octet-stream")

    # --- copias
    def backup_db(self, reason="auto"):
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        dest = self.backups / f"soltec-v2_{stamp}_{reason}.sqlite3"
        with self.lock:
            target = sqlite3.connect(str(dest))
            self.db.backup(target)
            target.close()
        olds = sorted(self.backups.glob("soltec-v2_*.sqlite3"))
        for old in olds[:-KEEP_DB_BACKUPS]:
            old.unlink()
        return dest

    def save_device_backup(self, raw, device):
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe = re.sub(r"[^A-Za-z0-9_-]", "_", device or "dispositivo")[:40]
        dest = self.backups / f"copia_{safe}_{stamp}.json"
        tmp = dest.with_suffix(".tmp")
        tmp.write_bytes(raw)
        os.replace(tmp, dest)
        return dest


# ---------------------------------------------------------------- HTTP
def make_handler(store, key):
    class Handler(BaseHTTPRequestHandler):
        server_version = "SoltecV2"

        def log_message(self, fmt, *args):
            sys.stdout.write("%s %s\n" % (now_iso(), fmt % args))

        def cors(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Soltec-Key, X-Soltec-Device")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Access-Control-Max-Age", "86400")
            self.send_header("Cache-Control", "no-store")

        def send_json(self, code, payload):
            raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            self.send_response(code)
            self.cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def auth(self):
            given = self.headers.get("X-Soltec-Key", "")
            if given and secrets.compare_digest(given, key):
                return True
            self.send_json(401, {"ok": False, "error": "Clave de sincronización incorrecta."})
            return False

        def body(self):
            n = int(self.headers.get("Content-Length") or 0)
            if n > MAX_BODY:
                raise ValueError("Petición demasiado grande")
            return self.rfile.read(n) if n else b""

        def do_OPTIONS(self):
            self.send_response(204)
            self.cors()
            self.end_headers()

        def do_GET(self):
            u = urlparse(self.path)
            if u.path == "/":
                return self.send_json(200, {"ok": True, "app": "SOLTEC V2", "version": VERSION})
            if not self.auth():
                return
            try:
                if u.path == "/api/v2/status":
                    return self.send_json(200, {"ok": True, "version": VERSION, "serverTime": now_iso(), **store.status()})
                if u.path == "/api/v2/pull":
                    q = parse_qs(u.query)
                    since = int(q.get("since", ["0"])[0])
                    limit = max(1, min(int(q.get("limit", ["500"])[0]), 2000))
                    return self.send_json(200, {"ok": True, **store.pull(since, limit)})
                if u.path.startswith("/api/v2/blob/"):
                    h = u.path.rsplit("/", 1)[-1]
                    if not HASH_RE.match(h):
                        return self.send_json(400, {"ok": False, "error": "Huella no válida"})
                    data, mime = store.get_blob(h)
                    if data is None:
                        return self.send_json(404, {"ok": False, "error": "Archivo no encontrado"})
                    self.send_response(200)
                    self.cors()
                    self.send_header("Content-Type", mime)
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                    return
                return self.send_json(404, {"ok": False, "error": "Ruta no encontrada"})
            except ValueError as e:
                return self.send_json(400, {"ok": False, "error": str(e)})

        def do_POST(self):
            u = urlparse(self.path)
            if not self.auth():
                return
            try:
                raw = self.body()
                if u.path == "/api/v2/backup":
                    copia = json.loads(raw.decode("utf-8"))
                    if copia.get("formato") != "SOLTEC_V2_COPIA":
                        return self.send_json(400, {"ok": False, "error": "No es una copia de SOLTEC V2"})
                    dest = store.save_device_backup(raw, copia.get("dispositivo"))
                    return self.send_json(200, {"ok": True, "archivo": dest.name})
                payload = json.loads(raw.decode("utf-8") or "{}")
                if u.path == "/api/v2/push":
                    changes = payload.get("changes")
                    if not isinstance(changes, list):
                        return self.send_json(400, {"ok": False, "error": "Falta la lista de cambios"})
                    res = store.push(str(payload.get("deviceId") or ""), changes)
                    return self.send_json(200, {"ok": True, **res})
                if u.path == "/api/v2/blobs/missing":
                    hashes = [h for h in payload.get("hashes", []) if isinstance(h, str) and HASH_RE.match(h)]
                    return self.send_json(200, {"ok": True, "missing": [h for h in hashes if not store.has_blob(h)]})
                return self.send_json(404, {"ok": False, "error": "Ruta no encontrada"})
            except (ValueError, json.JSONDecodeError) as e:
                return self.send_json(400, {"ok": False, "error": str(e)})

        def do_PUT(self):
            u = urlparse(self.path)
            if not self.auth():
                return
            if not u.path.startswith("/api/v2/blob/"):
                return self.send_json(404, {"ok": False, "error": "Ruta no encontrada"})
            h = u.path.rsplit("/", 1)[-1]
            if not HASH_RE.match(h):
                return self.send_json(400, {"ok": False, "error": "Huella no válida"})
            try:
                created = store.put_blob(h, self.body(), self.headers.get("Content-Type"))
            except ValueError as e:
                return self.send_json(400, {"ok": False, "error": str(e)})
            return self.send_json(200, {"ok": True, "created": created})

    return Handler


def backup_loop(store, stop, hours=6):
    while not stop.wait(hours * 3600):
        try:
            store.backup_db("auto")
        except Exception as e:  # noqa: BLE001
            print("[AVISO] No se pudo hacer la copia automática:", e)


def main():
    try:
        cfg = load_config()
    except ConfigError as e:
        print("[ERROR]", e)
        sys.exit(2)
    port = int(os.environ.get("SOLTEC_V2_PORT", cfg.get("port") or DEFAULT_PORT))
    store = Store()
    dest = store.backup_db("inicio")
    stop = threading.Event()
    threading.Thread(target=backup_loop, args=(store, stop), daemon=True).start()
    httpd = ThreadingHTTPServer(("127.0.0.1", port), make_handler(store, cfg["key"]))
    print("=" * 62)
    print(f" SOLTEC V2 · servidor del PC ({VERSION})")
    print(f" Escuchando en http://127.0.0.1:{port} (solo este PC)")
    print(f" Datos:  {DATA}")
    print(f" Copias: {BACKUPS}  (última: {dest.name})")
    print(f" CLAVE:  {cfg['key']}")
    print("=" * 62)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        httpd.server_close()


if __name__ == "__main__":
    main()
