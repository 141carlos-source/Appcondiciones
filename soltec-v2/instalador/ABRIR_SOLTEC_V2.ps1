# SOLTEC V2 - Abre la aplicacion en el PC (icono del escritorio).
# Si el servidor no esta en marcha lo arranca, y abre la app en una ventana propia
# de Chrome (o Edge si no hay Chrome), sin barra de direcciones.
$ErrorActionPreference = 'SilentlyContinue'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = 'http://localhost:8766/app/#/inicio'


# Cierra el servidor SOLTEC V2 que este en marcha (tambien versiones anteriores).
# Solo toca el programa que tiene el puerto 8766 (el de la V2; la V1.35 usa el 8765) y las
# ventanas cmd / py que lo lanzaron, para que su bucle no lo vuelva a abrir.
function Parar-ServidorSoltec {
  $procs = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
  $porId = @{}
  foreach ($p in $procs) { $porId[[int]$p.ProcessId] = $p }
  $matar = New-Object System.Collections.ArrayList
  foreach ($c in @(Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue)) {
    $actual = $porId[[int]$c.OwningProcess]
    for ($n = 0; $actual -and $n -lt 4; $n++) {
      if ($actual.Name -notmatch '^(cmd|py|pyw|python|pythonw)[\d.]*\.exe$') { break }
      [void]$matar.Insert(0, [int]$actual.ProcessId)   # de arriba (bucle) hacia abajo (python)
      $actual = $porId[[int]$actual.ParentProcessId]
    }
  }
  foreach ($id in $matar) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
  for ($i = 0; $i -lt 20; $i++) {
    if (-not (Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 250
  }
}

# Funciona = hay un servidor SOLTEC V2 que ademas sirve la app (version 1.4.1 o posterior)
function Funciona {
  try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri 'http://127.0.0.1:8766/app/index.html').StatusCode -eq 200 } catch { $false }
}

if (-not (Funciona)) {
  Parar-ServidorSoltec  # por si hay uno antiguo que no sirve la app
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
