#!/bin/sh
# Crea SOLTEC_V2_INSTALADOR.zip (uso: sh instalador/empaquetar.sh DESTINO)
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "${1:-.}"; OUT=$(cd "${1:-.}" && pwd)
T=$(mktemp -d); P="$T/SOLTEC_V2"
mkdir -p "$P/app" "$P/servidor-pc" "$P/instalador"
(cd "$R" && tar cf - --exclude=node_modules --exclude=tests --exclude=servidor-pc --exclude=instalador --exclude='package*.json' --exclude='*.md' .) | tar xf - -C "$P/app"
cp "$R"/servidor-pc/server.py "$R"/servidor-pc/LEEME.txt "$R"/servidor-pc/*.bat "$R"/servidor-pc/*.cmd "$P/servidor-pc/"
cp "$R"/instalador/soltec.ico "$R"/instalador/*.ps1 "$R"/instalador/DESINSTALAR_SOLTEC_V2.bat "$P/instalador/"
cp "$R"/instalador/INSTALAR_SOLTEC_V2.bat "$R"/instalador/LEEME.txt "$P/"
rm -f "$OUT/SOLTEC_V2_INSTALADOR.zip"
(cd "$T" && zip -qr "$OUT/SOLTEC_V2_INSTALADOR.zip" SOLTEC_V2)
rm -rf "$T"
