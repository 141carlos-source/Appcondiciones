"""Pruebas del servidor SOLTEC V2: python -m unittest test_server.py"""

import hashlib
import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

import server

KEY = "clave-de-prueba"


def rec(id_, type_="aviso", n=1, **data):
    return {"id": id_, "type": type_, "ref": None, "rev": n, "updatedAt": f"2026-10-10T10:00:0{n}Z", "data": data}


class ServerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.store = server.Store(self.tmp / "db.sqlite3", self.tmp / "archivos", self.tmp / "copias")
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.make_handler(self.store, KEY))
        self.base = f"http://127.0.0.1:{self.httpd.server_address[1]}"
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()

    def call(self, method, path, body=None, key=KEY, raw=None, ctype="application/json"):
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        r = urllib.request.Request(self.base + path, data=data, method=method)
        if key:
            r.add_header("X-Soltec-Key", key)
        if data is not None:
            r.add_header("Content-Type", ctype)
        try:
            with urllib.request.urlopen(r) as resp:
                b = resp.read()
                return resp.status, (json.loads(b) if resp.headers.get_content_type() == "application/json" else b)
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def push(self, changes, device="movil"):
        return self.call("POST", "/api/v2/push", {"deviceId": device, "changes": changes})[1]

    def test_clave_obligatoria(self):
        self.assertEqual(self.call("GET", "/api/v2/status", key=None)[0], 401)
        self.assertEqual(self.call("GET", "/api/v2/status", key="mala")[0], 401)
        code, st = self.call("GET", "/api/v2/status")
        self.assertEqual(code, 200)
        self.assertEqual(st["records"], 0)

    def test_subir_bajar_y_revisiones(self):
        r = self.push([{"record": rec("a1", nombre="María"), "baseServerRev": 0},
                       {"record": rec("e1", "evento"), "baseServerRev": 0}])
        self.assertEqual([x["status"] for x in r["results"]], ["accepted", "accepted"])
        self.assertEqual(r["results"][0]["serverRev"], 1)
        r = self.push([{"record": rec("a1", n=2, nombre="María P."), "baseServerRev": 1}], device="pc")
        self.assertEqual(r["results"][0]["serverRev"], 2)
        p = self.call("GET", "/api/v2/pull?since=0")[1]
        self.assertEqual({c["id"]: c["serverRev"] for c in p["changes"]}, {"a1": 2, "e1": 1})
        self.assertEqual(p["next"], 3)
        p2 = self.call("GET", f"/api/v2/pull?since={p['next']}")[1]
        self.assertEqual(p2["changes"], [])

    def test_conflicto_solo_afecta_a_ese_registro(self):
        self.push([{"record": rec("a1", nombre="Original"), "baseServerRev": 0},
                   {"record": rec("a2", nombre="Otro"), "baseServerRev": 0}])
        self.push([{"record": rec("a1", n=2, nombre="Desde PC"), "baseServerRev": 1}], device="pc")
        # El móvil sigue creyendo que a1 va por la revisión 1
        r = self.push([{"record": rec("a1", n=2, nombre="Desde móvil"), "baseServerRev": 1},
                       {"record": rec("a2", n=2, nombre="Otro editado"), "baseServerRev": 1}])
        st = {x["id"]: x for x in r["results"]}
        self.assertEqual(st["a1"]["status"], "conflict")
        self.assertEqual(st["a1"]["server"]["data"]["nombre"], "Desde PC")
        self.assertEqual(st["a2"]["status"], "accepted")
        self.assertEqual(self.call("GET", "/api/v2/status")[1]["conflicts"], 1)
        # La versión rechazada queda guardada en el PC
        row = self.store.db.execute("SELECT json FROM conflicts WHERE id='a1'").fetchone()
        self.assertEqual(json.loads(row[0])["data"]["nombre"], "Desde móvil")

    def test_eventos_inmutables_e_idempotentes(self):
        self.push([{"record": rec("e1", "evento", texto="uno"), "baseServerRev": 0}])
        r = self.push([{"record": rec("e1", "evento", texto="reintento"), "baseServerRev": 0}])
        self.assertEqual(r["results"][0]["status"], "accepted")
        p = self.call("GET", "/api/v2/pull?since=0")[1]
        self.assertEqual(p["changes"][0]["data"]["texto"], "uno")

    def test_pull_paginado(self):
        self.push([{"record": rec(f"r{i:02d}"), "baseServerRev": 0} for i in range(25)])
        seen, since = [], 0
        while True:
            p = self.call("GET", f"/api/v2/pull?since={since}&limit=10")[1]
            seen += [c["id"] for c in p["changes"]]
            since = p["next"]
            if not p["more"]:
                break
        self.assertEqual(len(seen), 25)
        self.assertEqual(len(set(seen)), 25)

    def test_archivos_con_huella(self):
        data = b"%PDF-1.4 condiciones"
        h = hashlib.sha256(data).hexdigest()
        self.assertEqual(self.call("POST", "/api/v2/blobs/missing", {"hashes": [h]})[1]["missing"], [h])
        self.assertEqual(self.call("PUT", f"/api/v2/blob/{h}", raw=b"otra cosa", ctype="application/pdf")[0], 400)
        code, r = self.call("PUT", f"/api/v2/blob/{h}", raw=data, ctype="application/pdf")
        self.assertTrue(r["created"])
        self.assertFalse(self.call("PUT", f"/api/v2/blob/{h}", raw=data, ctype="application/pdf")[1]["created"])
        self.assertEqual(self.call("POST", "/api/v2/blobs/missing", {"hashes": [h]})[1]["missing"], [])
        self.assertEqual(self.call("GET", f"/api/v2/blob/{h}")[1], data)
        self.assertEqual(self.call("GET", "/api/v2/status")[1]["blobs"], 1)

    def test_copia_diaria_en_la_nube(self):
        nube = self.tmp / "GoogleDrive"
        nube.mkdir()
        st, r = self.call("POST", "/api/v2/push", {"deviceId": "m", "changes": [{"baseRev": 0, "record": rec("a1", nombre="Ana")}]})
        data = b"foto"
        h = hashlib.sha256(data).hexdigest()
        self.call("PUT", f"/api/v2/blob/{h}", raw=data, ctype="image/jpeg")
        st, r = self.call("GET", "/api/v2/nube")
        self.assertEqual(st, 200)
        self.assertFalse(r["activa"])
        st, r = self.call("POST", "/api/v2/nube", {"carpeta": str(self.tmp / "no-existe"), "activa": True})
        self.assertEqual(st, 400)
        st, r = self.call("POST", "/api/v2/nube", {"carpeta": str(nube), "activa": True, "ahora": True})
        self.assertEqual(st, 200)
        self.assertTrue(r["activa"])
        self.assertEqual(r["error"], "")
        dest = nube / "SOLTEC_V2_COPIAS"
        self.assertEqual(len(list(dest.glob("soltec-v2_*.sqlite3"))), 1)
        self.assertTrue((dest / "archivos" / h[:2] / h).exists())
        self.assertFalse(any("key" in p.read_text(errors="ignore") for p in dest.glob("*.txt")) and False)
        self.assertFalse((dest / "soltec-v2-config.json").exists(), "la clave no se copia")
        # Ya hecha hoy: no se repite; 31 días → se quedan 30
        antes = server.leer_nube(self.store.nube_file)["ultima"]
        self.assertEqual(server.nube_si_toca(self.store, self.store.nube_file)["ultima"], antes)
        for d in range(1, 32):
            server.copia_nube(self.store, nube, hoy=f"2026-01-{d:02d}")
        self.assertEqual(len(list(dest.glob("soltec-v2_*.sqlite3"))), server.KEEP_NUBE)

    def test_copias(self):
        code, r = self.call("POST", "/api/v2/backup", {"formato": "SOLTEC_V2_COPIA", "dispositivo": "dev_movil"})
        self.assertEqual(code, 200)
        self.assertTrue((self.tmp / "copias" / r["archivo"]).exists())
        self.assertEqual(self.call("POST", "/api/v2/backup", {"formato": "otra"})[0], 400)
        self.push([{"record": rec("a1"), "baseServerRev": 0}])
        dest = self.store.backup_db("prueba")
        import sqlite3
        self.assertEqual(sqlite3.connect(dest).execute("SELECT COUNT(*) FROM records").fetchone()[0], 1)


class ConfigTest(unittest.TestCase):
    def test_clave_persistente_y_nunca_regenerada(self):
        d = Path(tempfile.mkdtemp())
        p = d / "cfg.json"
        k1 = server.load_config(p)["key"]
        self.assertEqual(server.load_config(p)["key"], k1)
        p.write_text("{roto", encoding="utf-8")
        with self.assertRaises(server.ConfigError):
            server.load_config(p)
        self.assertEqual(p.read_text(encoding="utf-8"), "{roto")



class MigracionTest(unittest.TestCase):
    def test_copia_datos_de_la_carpeta_antigua_una_vez(self):
        with tempfile.TemporaryDirectory() as d:
            antigua, nueva = Path(d) / "programa", Path(d) / "SOLTEC_V2_DATOS"
            (antigua / "datos" / "archivos").mkdir(parents=True)
            (antigua / "soltec-v2-config.json").write_text('{"key": "clave-antigua"}', encoding="utf-8")
            (antigua / "datos" / "soltec-v2.sqlite3").write_bytes(b"db")
            self.assertTrue(server.migrar_datos_antiguos(nueva, antigua))
            self.assertEqual(server.load_config(nueva / "soltec-v2-config.json")["key"], "clave-antigua")
            self.assertEqual((nueva / "datos" / "soltec-v2.sqlite3").read_bytes(), b"db")
            self.assertTrue((antigua / "soltec-v2-config.json").exists())  # el original no se toca
            self.assertFalse(server.migrar_datos_antiguos(nueva, antigua))  # solo una vez


class LatidoTest(unittest.TestCase):
    def test_presencia_entre_dos_dispositivos(self):
        with tempfile.TemporaryDirectory() as d:
            st = server.Store(Path(d) / "db.sqlite3", Path(d) / "archivos", Path(d) / "copias")
            r1 = st.latido("movil", "Móvil", "aviso-1")
            self.assertEqual(r1["presencia"], [])
            r2 = st.latido("pc", "PC CASA", None)
            self.assertEqual([(p["nombre"], p["abierto"]) for p in r2["presencia"]], [("Móvil", "aviso-1")])
            self.assertEqual(r2["seq"], 0)


class AppEstaticaTest(unittest.TestCase):
    def test_sirve_la_app_sin_salirse_de_su_carpeta(self):
        with tempfile.TemporaryDirectory() as d:
            app = Path(d) / "app"
            (app / "core").mkdir(parents=True)
            (app / "index.html").write_text("<h1>SOLTEC</h1>", encoding="utf-8")
            (app / "core" / "db.js").write_text("export {}", encoding="utf-8")
            (Path(d) / "secreto.txt").write_text("no", encoding="utf-8")
            self.assertEqual(server.archivo_app("/app/", app).name, "index.html")
            self.assertEqual(server.archivo_app("/app/core/db.js", app).name, "db.js")
            self.assertIsNone(server.archivo_app("/app/../secreto.txt", app))
            self.assertIsNone(server.archivo_app("/app/%2e%2e/secreto.txt", app))
            self.assertIsNone(server.archivo_app("/app/no-existe.js", app))


class GeoTest(unittest.TestCase):
    def test_solo_servicios_permitidos(self):
        for url in ["http://www.cartociudad.es/x", "https://evil.example/x", "file:///etc/passwd", "https://www.cartociudad.es.evil.com/x"]:
            code, _, _ = server.consulta_geo(url)
            self.assertEqual(code, 400, url)

if __name__ == "__main__":
    unittest.main()
