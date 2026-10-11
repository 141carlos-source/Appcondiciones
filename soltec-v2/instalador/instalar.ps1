# SOLTEC V2 - Instalacion en el PC (la ejecuta INSTALAR_SOLTEC_V2.bat)
# Programa en  %LOCALAPPDATA%\SOLTEC_V2   (se reemplaza en cada actualizacion)
# Datos/clave  %USERPROFILE%\SOLTEC_V2_DATOS  (NO se tocan)
$ErrorActionPreference = 'Stop'
$origen = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$dest = Join-Path $env:LOCALAPPDATA 'SOLTEC_V2'
$version = (Select-String -Path (Join-Path $origen 'app\sw.js') -Pattern "VERSION = '([^']+)'").Matches[0].Groups[1].Value

function Paso($t) { Write-Host ''; Write-Host $t -ForegroundColor Cyan }

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


Write-Host '=============================================================='
Write-Host (' SOLTEC V2 - INSTALACION EN ESTE PC  (' + $version + ')')
Write-Host '=============================================================='

Paso '[1/6] Parando el servidor anterior (si estaba abierto)...'
Parar-ServidorSoltec
if (Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue) {
  Write-Host 'AVISO: sigue abierto un servidor en el puerto 8766. Cierra las ventanas "SOLTEC V2" y vuelve a instalar.' -ForegroundColor Yellow
}

Paso ('[2/6] Copiando el programa a ' + $dest)
New-Item -ItemType Directory -Force -Path $dest | Out-Null
foreach ($par in @(@('app', 'app'), @('servidor-pc', 'servidor'))) {
  & robocopy.exe (Join-Path $origen $par[0]) (Join-Path $dest $par[1]) /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw ('No se pudo copiar ' + $par[0]) }
}
Copy-Item -Force (Join-Path $origen 'instalador\soltec.ico') $dest
Copy-Item -Force (Join-Path $origen 'instalador\ABRIR_SOLTEC_V2.ps1') $dest
Copy-Item -Force (Join-Path $origen 'instalador\DESINSTALAR_SOLTEC_V2.bat') $dest
Copy-Item -Force (Join-Path $origen 'instalador\PARAR_SERVIDOR.ps1') $dest

Paso '[3/6] Arranque automatico del servidor al entrar en Windows...'
$inicio = [Environment]::GetFolderPath('Startup')
$arranque = Join-Path $dest 'servidor\ARRANQUE_SERVIDOR.cmd'
$lineas = @('@echo off', 'rem Creado por el instalador de SOLTEC V2',
  ('start "SOLTEC V2 - SERVIDOR - NO CERRAR" /min cmd /c ""' + $arranque + '""'))
Set-Content -Path (Join-Path $inicio 'SOLTEC_V2_SERVIDOR.cmd') -Value $lineas -Encoding Default

Paso '[4/6] Icono "SOLTEC V2" en el escritorio y en el menu Inicio...'
$shell = New-Object -ComObject WScript.Shell
$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$carpetas = @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))
foreach ($c in $carpetas) {
  $l = $shell.CreateShortcut((Join-Path $c 'SOLTEC V2.lnk'))
  $l.TargetPath = $ps
  $l.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $dest 'ABRIR_SOLTEC_V2.ps1') + '"'
  $l.IconLocation = (Join-Path $dest 'soltec.ico') + ',0'
  $l.WorkingDirectory = $dest
  $l.Description = 'SOLTEC V2 - Avisos y expedientes'
  $l.WindowStyle = 7
  $l.Save()
}

Paso '[5/6] Publicando el servidor para el movil por Tailscale (puerto 8443)...'
if (Get-Command tailscale -ErrorAction SilentlyContinue) {
  cmd.exe /c 'tailscale serve --bg --https=8443 http://127.0.0.1:8766 2>&1'
  if ($LASTEXITCODE -ne 0) { Write-Host 'AVISO: no se pudo publicar. Abre Tailscale y vuelve a instalar.' -ForegroundColor Yellow }
} else {
  Write-Host 'AVISO: Tailscale no esta disponible; el movil no podra sincronizar.' -ForegroundColor Yellow
}

Paso '[6/6] Que el PC no se suspenda mientras este enchufado?'
Write-Host '      (si se suspende, el movil no puede sincronizar; la pantalla si puede apagarse)'
$r = Read-Host '      Escribe S para si o N para no'
if ($r -match '^[sS]') {
  cmd.exe /c 'powercfg /change standby-timeout-ac 0 >nul 2>nul'
  cmd.exe /c 'powercfg /change hibernate-timeout-ac 0 >nul 2>nul'
  Write-Host '      Hecho.'
}

Write-Host ''
Write-Host 'Abriendo SOLTEC V2...' -ForegroundColor Green
& $ps -NoProfile -ExecutionPolicy Bypass -File (Join-Path $dest 'ABRIR_SOLTEC_V2.ps1')
Start-Sleep -Seconds 2
$cfg = Join-Path $env:USERPROFILE 'SOLTEC_V2_DATOS\soltec-v2-config.json'
$clave = ''
if (Test-Path $cfg) { $clave = (Get-Content $cfg -Raw | ConvertFrom-Json).key }

Write-Host ''
Write-Host '=============================================================='
Write-Host ' LISTO. Desde ahora abre SOLTEC V2 con el icono del escritorio.'
Write-Host ''
Write-Host ' En la app del PC:  Ajustes > Sincronizacion'
Write-Host '    Direccion: http://127.0.0.1:8766'
Write-Host ('    Clave:     ' + $clave)
Write-Host ' En el movil la direccion es https://carlos25.tail970b93.ts.net:8443'
Write-Host '    (con la misma clave).'
Write-Host ''
Write-Host ' Tus datos y la clave estan en ' (Join-Path $env:USERPROFILE 'SOLTEC_V2_DATOS')
Write-Host ' Para actualizar: descomprime el paquete nuevo y vuelve a ejecutar'
Write-Host ' INSTALAR_SOLTEC_V2.bat. Para quitarlo: DESINSTALAR_SOLTEC_V2.bat'
Write-Host ' (en ' $dest ').'
Write-Host '=============================================================='
