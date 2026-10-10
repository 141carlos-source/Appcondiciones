@echo off
setlocal
cd /d "%~dp0"
title SOLTEC V2 - SERVIDOR DEL PC

echo ==============================================================
echo  SOLTEC V2 - SERVIDOR DEL PC DE CASA
echo  Funciona junto al de la V1.35 sin interferir:
echo   V1.35 = puerto 8765 (HTTPS 443)   V2 = puerto 8766 (HTTPS 8443)
echo ==============================================================
echo.

set "PYCMD="
where py >nul 2>nul && set "PYCMD=py -3"
if not defined PYCMD (
  where python >nul 2>nul && set "PYCMD=python"
)
if not defined PYCMD (
  echo [ERROR] No se ha encontrado Python 3 en este PC.
  echo Instala Python 3 desde python.org y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

echo [1/2] Iniciando el servidor SOLTEC V2...
start "SOLTEC V2 - NO CERRAR" cmd /k "cd /d ""%~dp0"" && %PYCMD% server.py"
timeout /t 2 /nobreak >nul

echo [2/2] Publicando SOLO dentro de tu red privada Tailscale...
where tailscale >nul 2>nul
if errorlevel 1 (
  echo.
  echo [AVISO] Tailscale no esta disponible en la linea de comandos.
  echo Cuando lo tengas, ejecuta:
  echo     tailscale serve --bg --https=8443 http://127.0.0.1:8766
  pause
  exit /b 0
)
tailscale serve --bg --https=8443 http://127.0.0.1:8766
if errorlevel 1 (
  echo No se pudo activar Tailscale Serve. Ejecuta a mano:
  echo     tailscale serve --bg --https=8443 http://127.0.0.1:8766
) else (
  tailscale serve status
)

echo.
echo ==============================================================
echo  En SOLTEC V2 ^> Configuracion ^> Sincronizacion escribe:
echo   - Direccion: la HTTPS de Tailscale terminada en :8443
echo     (por ejemplo https://carlos25.tail970b93.ts.net:8443)
echo   - Clave: la que muestra la ventana "SOLTEC V2 - NO CERRAR"
echo     o el archivo soltec-v2-config.json de esta carpeta.
echo ==============================================================
pause
endlocal
