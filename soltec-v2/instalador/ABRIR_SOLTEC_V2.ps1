# SOLTEC V2 - Abre la aplicacion en el PC (icono del escritorio).
# Si el servidor no esta en marcha lo arranca, y abre la app en una ventana propia
# de Chrome (o Edge si no hay Chrome), sin barra de direcciones.
$ErrorActionPreference = 'SilentlyContinue'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = 'http://localhost:8766/app/#/inicio'

function Funciona {
  try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri 'http://127.0.0.1:8766/').Content -match 'SOLTEC V2' } catch { $false }
}

if (-not (Funciona)) {
  $arranque = Join-Path $raiz 'servidor\ARRANQUE_SERVIDOR.cmd'
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', ('"' + $arranque + '"') -WindowStyle Minimized
  for ($i = 0; $i -lt 40 -and -not (Funciona); $i++) { Start-Sleep -Milliseconds 500 }
}

$navegadores = @(
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
)
$nav = $navegadores | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if ($nav) { Start-Process -FilePath $nav -ArgumentList ('--app=' + $url) }
else { Start-Process $url }
