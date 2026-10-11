@echo off
setlocal
title SOLTEC V2 - QUITAR ARRANQUE AUTOMATICO
set "LANZADOR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\SOLTEC_V2_SERVIDOR.cmd"
if exist "%LANZADOR%" (
  del "%LANZADOR%"
  echo Quitado: el servidor ya no arrancara solo al encender el PC.
) else (
  echo No estaba instalado el arranque automatico.
)
echo Los datos y la clave NO se tocan (%USERPROFILE%\SOLTEC_V2_DATOS).
echo Si el servidor esta abierto ahora, cierra la ventana "SOLTEC V2 - SERVIDOR".
pause
endlocal
