@echo off
setlocal
cd /d "%~dp0"
title SOLTEC V2 - INSTALAR
set "PYOK="
where py >nul 2>nul && set "PYOK=1"
where python >nul 2>nul && set "PYOK=1"
if not defined PYOK (
  echo [ERROR] No se ha encontrado Python 3 en este PC.
  echo Instalalo desde python.org ^(marca "Add python.exe to PATH"^) y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)
if not exist "%~dp0app\index.html" (
  echo [ERROR] Ejecuta este archivo desde la carpeta descomprimida del paquete
  echo         ^(no desde dentro del ZIP^).
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalador\instalar.ps1"
if errorlevel 1 (
  echo.
  echo [ERROR] La instalacion no ha terminado. Manda una captura de esta ventana.
)
pause
endlocal
