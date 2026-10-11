@echo off
rem SOLTEC V2 - Mantiene el servidor en marcha: si se para, vuelve a arrancar a los 10 s.
setlocal
cd /d "%~dp0"
title SOLTEC V2 - SERVIDOR - NO CERRAR
set "PYCMD="
where py >nul 2>nul && set "PYCMD=py -3"
if not defined PYCMD ( where python >nul 2>nul && set "PYCMD=python" )
if not defined PYCMD (
  echo [ERROR] No se ha encontrado Python 3. Instalalo desde python.org
  pause
  exit /b 1
)
set "LOG=%USERPROFILE%\SOLTEC_V2_DATOS\reinicios.log"
:bucle
%PYCMD% server.py
set "COD=%errorlevel%"
if "%COD%"=="3" (
  rem Ya hay otro servidor SOLTEC V2 funcionando: este no hace falta.
  timeout /t 5 /nobreak >nul
  exit /b 0
)
if "%COD%"=="2" (
  echo.
  echo [ERROR] Problema con la clave: revisa el mensaje de arriba. La clave NO se cambia sola.
  pause
  exit /b 2
)
if not exist "%USERPROFILE%\SOLTEC_V2_DATOS" mkdir "%USERPROFILE%\SOLTEC_V2_DATOS"
echo [%date% %time%] El servidor se paro (codigo %COD%). Se vuelve a arrancar. >> "%LOG%"
echo.
echo El servidor se ha parado (codigo %COD%). Se vuelve a arrancar en 10 segundos...
timeout /t 10 /nobreak >nul
goto bucle
