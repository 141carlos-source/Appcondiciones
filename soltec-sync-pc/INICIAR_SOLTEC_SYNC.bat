@echo off
setlocal
cd /d "%~dp0"
title SOLTEC SYNC V1.34

echo ==============================================================
echo  SOLTEC SYNC V1.34 - PC DE CASA
echo ==============================================================
echo.

set "PYCMD="
where py >nul 2>nul && set "PYCMD=py"
if not defined PYCMD (
  where python >nul 2>nul && set "PYCMD=python"
)
if not defined PYCMD (
  echo [ERROR] No se ha encontrado Python 3 en este PC.
  echo Instala Python 3 y vuelve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

echo [1/3] Iniciando servidor SOLTEC en segundo plano...
rem El servidor debe seguir activo para que el movil pueda verificar y sincronizar,
rem pero no necesita mantener una ventana CMD visible.
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '%PYCMD%' -ArgumentList 'server.py' -WorkingDirectory '%~dp0' -WindowStyle Hidden" >nul 2>nul
if errorlevel 1 (
  rem Respaldo: si PowerShell no puede ocultarlo, lo inicia minimizado.
  start "SOLTEC SYNC - NO CERRAR" /min cmd /c "cd /d ""%~dp0"" && %PYCMD% server.py"
)
timeout /t 2 /nobreak >nul

echo [2/3] Comprobando Tailscale...
where tailscale >nul 2>nul
if errorlevel 1 (
  echo.
  echo [AVISO] Tailscale no esta disponible en la linea de comandos.
  echo El servidor local esta iniciado, pero para sincronizar desde la
  echo V1.34 de forma segura debes instalar/iniciar Tailscale y ejecutar:
  echo.
  echo     tailscale serve --bg 8765
  echo.
  echo Despues usa la direccion HTTPS que muestre Tailscale en SOLTEC V1.34.
  echo.
  echo Esta ventana se cerrara automaticamente.
  timeout /t 5 /nobreak >nul
  exit /b 0
)

echo [3/3] Publicando SOLO dentro de tu red privada Tailscale...
tailscale serve --bg 8765
if errorlevel 1 (
  echo.
  echo No se pudo activar Tailscale Serve automaticamente.
  echo Ejecuta manualmente: tailscale serve --bg 8765
  echo.
) else (
  echo.
  tailscale serve status
)

echo.
echo ==============================================================
echo  SOLTEC SYNC QUEDA FUNCIONANDO EN SEGUNDO PLANO
if exist "soltec-sync-config.json" (
  echo  La CLAVE esta guardada en: %~dp0soltec-sync-config.json
) else (
  echo  La configuracion se creara automaticamente al iniciar el servidor.
)
echo  El movil puede verificar el PC y crear copias sin dejar esta ventana abierta.
echo ==============================================================
echo.
echo Cerrando esta ventana...
timeout /t 3 /nobreak >nul
endlocal
exit /b 0
