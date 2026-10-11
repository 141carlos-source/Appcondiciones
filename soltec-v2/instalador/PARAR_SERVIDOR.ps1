# SOLTEC V2 - Para el servidor del PC (lo usa el desinstalador)
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

Parar-ServidorSoltec
