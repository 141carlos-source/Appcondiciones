# SOLTEC V2 — Arquitectura

Reconstrucción de SOLTEC desde cero en `soltec-v2/`. La V1.35 (`avisos-v134/`) sigue funcionando intacta y en paralelo. La V2 arranca vacía.

## Principios

1. **Un solo almacenamiento.** Todo dato vive en una base IndexedDB (`SOLTEC_V2`). `localStorage` no guarda datos de negocio.
2. **Un solo motor de sincronización.** Ningún módulo sincroniza ni persiste por su cuenta: todos llaman a `Storage`.
3. **Nada se pierde.** Borrar = papelera. Los archivos nunca se sustituyen: cada versión queda guardada.
4. **Sin parches encima de parches.** Cada pantalla tiene un único render. Sin `MutationObserver` ni `setInterval` para corregir lo que pinta otro módulo.
5. **Sin compilación.** Módulos ES nativos, publicables tal cual en GitHub Pages.

## Capas

| # | Capa | Archivos | Estado |
|---|------|----------|--------|
| 1 | Datos y almacenamiento | `core/db.js`, `core/storage.js`, `core/model.js`, `core/validate.js`, `core/search.js` | Hecha |
| 2 | Copia de seguridad (exportar/importar, huella) | `core/backup.js` | Hecha |
| 3 | Servidor del PC (SQLite, puerto 8766, HTTPS 8443) | `servidor-pc/server.py` | Hecha |
| 4 | Sincronización | `core/sync.js` | Hecha (probada contra el servidor real) |
| 5 | Carcasa PWA (navegación, salida segura, actualización) | `index.html`, `sw.js`, `app.js` | Hecha (probada en Chromium móvil) |
| 6 | Módulos de pantalla | `modulos/*.js` | En curso: Avisos, Expedientes, buscador y bandeja hechos; falta Agenda, documentos PDF y Partes |

## Modelo de datos

Una única tabla `records`. Cada registro:

```
{ id, type, ref, data, rev, serverRev, createdAt, updatedAt, deviceId, deleted, deletedAt }
```

| type | Qué es | ref |
|------|--------|-----|
| `aviso` | Cliente, suministro, actuación, docs, trámite, condiciones | — |
| `cita` | Cita de Agenda o seguimiento de un aviso | id del aviso (si es seguimiento) |
| `evento` | Entrada del historial. Inmutable | id del registro al que pertenece |
| `parte` | Parte de trabajo | id del aviso (opcional) |
| `config` | Empresa (`id = empresa`) | — |

- **Expediente** no es un tipo: es un aviso con referencia de condiciones o con algún PDF de condiciones (`isExpediente`). Así no se mueve ni duplica nada.
- **Seguimientos y citas** son lo mismo (`cita`), por lo que la Agenda y la bandeja «Qué toca hoy» leen de un único sitio.
- **Estado del trámite** y **estado general** son campos separados del aviso.
- **Historial**: cada cambio relevante crea un `evento` en la misma transacción que el cambio.

Otras tablas:

- `blobs`: archivos (PDF, fotos, firmas) identificados por su SHA-256. El aviso guarda la lista de versiones `{hash, nombre, mime, tamaño, fecha}`; añadir una versión nunca borra las anteriores.
- `outbox`: cambios pendientes de subir. Uno por registro (varios cambios seguidos se agrupan).
- `blobOutbox`: archivos pendientes de subir.
- `meta`: datos del dispositivo (id, dirección y clave del PC, cursor de sync). No se sincroniza.

## Sincronización (capa 4, diseño)

La V1 sube y baja el **snapshot entero** con una sola revisión. Si dos dispositivos cambian cosas distintas, uno pisa al otro o salta un conflicto global. Es la causa más probable de los fallos móvil–PC.

La V2 sincroniza **registro a registro**:

1. **Subir**: se envía cada cambio pendiente con su `serverRev` de partida. Si en el PC sigue igual, se acepta y recibe nueva revisión. Si alguien lo cambió antes, el servidor lo rechaza **solo para ese registro**.
2. **Conflicto**: se guardan las dos versiones y el aviso queda marcado para que elijas. Nunca se resuelve en silencio.
3. **Bajar**: «dame lo cambiado desde mi cursor». Solo viajan los registros cambiados.
4. **Archivos**: se suben y bajan aparte por su huella. Si el PC ya lo tiene, no se vuelve a enviar.
5. **Eventos** (historial): son inmutables y nunca entran en conflicto.

Servidor: nuevo `server.py` en el puerto **8766**, con su propia carpeta y clave, para no interferir con el de la V1.35 (8765). Clave persistente: nunca se regenera si ya existe.

## Decisiones abiertas

- **Número de aviso**: correlativo por año (`2026-0001`). Si dos dispositivos crean avisos sin conexión a la vez podría repetirse; la sincronización lo detectará y propondrá renumerar.
- **Partes**: se rehace en la V2 como módulo nuevo; la V1.35 se mantiene sin tocar.
