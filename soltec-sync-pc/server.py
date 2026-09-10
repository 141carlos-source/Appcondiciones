#!/usr/bin/env python3
import json
import os
import secrets
import shutil
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
PORT = int(os.environ.get("SOLTEC_SYNC_PORT", "8765"))
ROOT = Path(__file__).resolve().parent
DATA = ROOT / "datos"
BACKUPS = ROOT / "backups"
CONFIG_FILE = ROOT / "soltec-sync-config.json"
STATE_FILE = DATA / "soltec-central.json"
MAX_BODY = 400 * 1024 * 1024
LOCK = threading.Lock()

DATA.mkdir(exist_ok=True)
BACKUPS.mkdir(exist_ok=True)


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_config():
    if CONFIG_FILE.exists():
        try:
            c = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
            if c.get("key"):
                return c
        except Exception:
            pass
    c = {"key": secrets.token_urlsafe(24), "port": PORT, "createdAt": now_iso()}
    CONFIG_FILE.write_text(json.dumps(c, ensure_ascii=False, indent=2), encoding="utf-8")
    return c


CONFIG = load_config()
SYNC_KEY = str(CONFIG["key"])


def empty_state():
    return {"revision": 0, "updatedAt": None, "deviceId": None, "deviceName": None, "snapshot": None}


def load_state():
    if not STATE_FILE.exists():
        return empty_state()
    try:
        x = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        if not isinstance(x, dict):
            return empty_state()
        return x
    except Exception:
        return empty_state()


def atomic_save(state):
    DATA.mkdir(exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, STATE_FILE)


def backup_current(state):
    if not state.get("snapshot") or not STATE_FILE.exists():
        return
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    name = f"soltec_rev_{int(state.get('revision') or 0):06d}_{stamp}.json"
    shutil.copy2(STATE_FILE, BACKUPS / name)


class Handler(BaseHTTPRequestHandler):
    server_version = "SOLTECSync/1.34"

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Soltec-Key")
        self.send_header("Access-Control-Max-Age", "86400")
        self.send_header("Cache-Control", "no-store")

    def json_response(self, code, payload):
        raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(code)
        self.cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def authorized(self):
        supplied = self.headers.get("X-Soltec-Key", "")
        return bool(supplied) and secrets.compare_digest(supplied, SYNC_KEY)

    def require_auth(self):
        if self.authorized():
            return True
        self.json_response(401, {"ok": False, "error": "Clave de sincronización incorrecta."})
        return False

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if path == "/":
            body = ("<!doctype html><meta charset='utf-8'><title>SOLTEC Sync</title>"
                    "<style>body{font-family:Arial;margin:40px;max-width:700px}b{color:#15803d}</style>"
                    "<h1>SOLTEC SYNC V1.34</h1><p><b>Servidor en funcionamiento.</b></p>"
                    "<p>La sincronización se realiza desde SOLTEC Avisos.</p>").encode("utf-8")
            self.send_response(200)
            self.cors()
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path not in ("/api/status", "/api/snapshot"):
            self.json_response(404, {"ok": False, "error": "Ruta no encontrada."})
            return
        if not self.require_auth():
            return
        with LOCK:
            state = load_state()
        if path == "/api/status":
            self.json_response(200, {
                "ok": True,
                "server": "SOLTEC-PC",
                "version": 134,
                "revision": int(state.get("revision") or 0),
                "hasSnapshot": bool(state.get("snapshot")),
                "updatedAt": state.get("updatedAt")
            })
            return
        self.json_response(200, {
            "ok": True,
            "revision": int(state.get("revision") or 0),
            "updatedAt": state.get("updatedAt"),
            "deviceId": state.get("deviceId"),
            "deviceName": state.get("deviceName"),
            "snapshot": state.get("snapshot")
        })

    def do_POST(self):
        path = self.path.split("?", 1)[0].rstrip("/")
        if path != "/api/snapshot":
            self.json_response(404, {"ok": False, "error": "Ruta no encontrada."})
            return
        if not self.require_auth():
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0:
            self.json_response(400, {"ok": False, "error": "Petición vacía."})
            return
        if length > MAX_BODY:
            self.json_response(413, {"ok": False, "error": "La copia supera el límite de 400 MB de esta versión."})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            self.json_response(400, {"ok": False, "error": "JSON de sincronización no válido."})
            return
        snap = payload.get("snapshot") if isinstance(payload, dict) else None
        if not isinstance(snap, dict) or snap.get("schema") != "SOLTEC_SYNC_SNAPSHOT_V134":
            self.json_response(400, {"ok": False, "error": "Formato de copia SOLTEC V1.34 no válido."})
            return
        try:
            requested = int(payload.get("ifRevision") or 0)
        except Exception:
            requested = -1
        with LOCK:
            current = load_state()
            current_rev = int(current.get("revision") or 0)
            if requested != current_rev:
                self.json_response(409, {
                    "ok": False,
                    "error": "La copia del PC cambió durante la sincronización. Vuelve a pulsar SINCRONIZAR.",
                    "revision": current_rev
                })
                return
            try:
                backup_current(current)
                new_state = {
                    "revision": current_rev + 1,
                    "updatedAt": now_iso(),
                    "deviceId": str(payload.get("deviceId") or ""),
                    "deviceName": str(payload.get("deviceName") or "DISPOSITIVO SOLTEC"),
                    "snapshot": snap
                }
                atomic_save(new_state)
            except Exception as exc:
                self.json_response(500, {"ok": False, "error": "No se pudo guardar la copia central: " + str(exc)})
                return
        self.json_response(200, {
            "ok": True,
            "revision": new_state["revision"],
            "updatedAt": new_state["updatedAt"],
            "backupCreated": current_rev > 0
        })


if __name__ == "__main__":
    print("=" * 62)
    print(" SOLTEC SYNC V1.34")
    print("=" * 62)
    print(f" Servidor local: http://{HOST}:{PORT}")
    print(f" CLAVE DE SINCRONIZACIÓN: {SYNC_KEY}")
    print(f" Datos: {STATE_FILE}")
    print(f" Copias previas: {BACKUPS}")
    print("\n Mantén esta ventana abierta mientras sincronizas.")
    print(" Para acceso seguro desde móvil/tablet, usa Tailscale Serve.")
    print("=" * 62)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        print("Servidor SOLTEC detenido.")
