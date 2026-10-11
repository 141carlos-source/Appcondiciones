@echo off
setlocal
cd /d "%~dp0"
title SOLTEC V2 - ARRANQUE AUTOMATICO
echo ==============================================================
echo  SOLTEC V2 - ARRANCAR EL SERVIDOR SOLO AL ENCENDER EL PC
echo ==============================================================
echo.
echo Esto hace tres cosas:
echo  1. El servidor arranca solo cada vez que entras en Windows
echo     (ventana minimizada "SOLTEC V2 - SERVIDOR - NO CERRAR").
echo     Si se parase, vuelve a arrancar solo a los 10 segundos.
echo  2. Lo publica para el movil por Tailscale (puerto 8443).
echo  3. Opcional: que el PC no se suspenda mientras este enchufado.
echo.
echo IMPORTANTE: deja esta carpeta donde esta. Si la mueves, vuelve a
echo ejecutar este archivo desde el sitio nuevo.
echo.
set "INICIO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LANZADOR=%INICIO%\SOLTEC_V2_SERVIDOR.cmd"
(
  echo @echo off
  echo rem Creado por INSTALAR_ARRANQUE_AUTOMATICO.bat de SOLTEC V2
  echo start "SOLTEC V2 - SERVIDOR - NO CERRAR" /min cmd /c ""%~dp0ARRANQUE_SERVIDOR.cmd""
) > "%LANZADOR%"
if not exist "%LANZADOR%" (
  echo [ERROR] No se pudo crear el arranque automatico en:
  echo         %INICIO%
  pause
  exit /b 1
)
echo [1/3] Arranque automatico instalado:
echo       %LANZADOR%
echo.
echo [2/3] Publicando para el movil por Tailscale...
where tailscale >nul 2>nul
if errorlevel 1 (
  echo [AVISO] Tailscale no esta disponible. Cuando lo este, ejecuta:
  echo         tailscale serve --bg --https=8443 http://127.0.0.1:8766
) else (
  tailscale serve --bg --https=8443 http://127.0.0.1:8766
  echo       Tailscale recuerda esta publicacion aunque reinicies el PC.
)
echo.
echo [3/3] Quieres que el PC NO se suspenda mientras este enchufado?
echo       (si se suspende, el movil no puede sincronizar; la pantalla
echo        si se puede apagar)
choice /c SN /m "      Pulsa S para si, N para no"
if errorlevel 2 (
  echo       No se cambia la suspension.
) else (
  powercfg /change standby-timeout-ac 0
  powercfg /change hibernate-timeout-ac 0
  echo       Hecho: el PC no se suspende enchufado.
)
echo.
echo Arrancando el servidor ahora...
call "%LANZADOR%"
echo.
echo ==============================================================
echo  Listo. A partir de ahora no tienes que abrir nada en el PC.
echo  La CLAVE esta en la ventana minimizada "SOLTEC V2 - SERVIDOR"
echo  y en %USERPROFILE%\SOLTEC_V2_DATOS\soltec-v2-config.json
echo  Para quitarlo: QUITAR_ARRANQUE_AUTOMATICO.bat
echo ==============================================================
pause
endlocal
