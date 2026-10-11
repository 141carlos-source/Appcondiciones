@echo off
setlocal
title SOLTEC V2 - DESINSTALAR
echo Se quitan el icono, el arranque automatico y el programa de SOLTEC V2.
echo Tus datos y la clave NO se borran (%USERPROFILE%\SOLTEC_V2_DATOS).
choice /c SN /m "Continuar"
if errorlevel 2 exit /b 0
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PARAR_SERVIDOR.ps1"
powershell -NoProfile -Command "Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path ([Environment]::GetFolderPath('Desktop')) 'SOLTEC V2.lnk'), (Join-Path ([Environment]::GetFolderPath('Programs')) 'SOLTEC V2.lnk'), (Join-Path ([Environment]::GetFolderPath('Startup')) 'SOLTEC_V2_SERVIDOR.cmd')"
echo Hecho. Puedes borrar la carpeta %LOCALAPPDATA%\SOLTEC_V2
pause
endlocal
