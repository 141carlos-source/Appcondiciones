// SOLTEC V2 · Alta de un dispositivo nuevo con un enlace (o QR) que lleva dentro la dirección y la
// clave del PC CASA. Al abrirlo, la app solo pregunta el nombre del dispositivo y hace el resto.
// Los datos van tras «#»: el navegador no los envía a ningún servidor (tampoco a GitHub).

const aB64 = (s) => {
  const b = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const deB64 = (s) => {
  const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
};

/** Dirección del PC que deben usar los demás dispositivos (no vale 127.0.0.1 ni localhost). */
export const esDireccionLocal = (url) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(String(url || '').trim());

/** Código del enlace: dirección + clave (+ nombre del PC, para mostrarlo). */
export function codigoAlta({ url, clave, pc = '' }) {
  const u = String(url || '').trim().replace(/\/+$/, '');
  const k = String(clave || '').trim();
  if (!u || !k) throw new Error('Falta la dirección o la clave del PC.');
  if (esDireccionLocal(u)) throw new Error('La dirección 127.0.0.1 solo sirve en el propio PC. Pon la de Tailscale (https://…ts.net:8443).');
  return aB64(JSON.stringify({ v: 1, u, k, pc: String(pc || '').trim() }));
}

export const enlaceAlta = (base, codigo) => `${base.replace(/#.*$/, '')}#/alta/${codigo}`;

/** Lee el código de un enlace de alta (o null si no es válido). */
export function leerAlta(codigo) {
  try {
    const p = JSON.parse(deB64(String(codigo || '').replace(/^.*#\/alta\//, '')));
    return p && p.v === 1 && /^https?:\/\//.test(p.u) && p.k ? { url: p.u, clave: p.k, pc: p.pc || '' } : null;
  } catch { return null; }
}

/** Nombre que se propone para el dispositivo según el navegador. */
export function nombreSugerido(ua = '', tactil = 0) {
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && tactil > 1)) return 'TABLET';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'MÓVIL' : 'TABLET';
  if (/iPhone|iPod/.test(ua)) return 'MÓVIL';
  return 'PC';
}

/**
 * Instalador para otro PC con Windows (.bat): crea en el escritorio el icono «SOLTEC V2» que abre la app
 * en ventana propia (Chrome o Edge) y la abre una vez con el enlace de alta para poner el nombre.
 */
export function instaladorWindows(base, codigo) {
  const app = base.replace(/#.*$/, '');
  const alta = enlaceAlta(app, codigo);
  if (!/^[A-Za-z0-9_\-:/.#]+$/.test(alta)) throw new Error('Enlace con caracteres no válidos para el instalador.');
  return [
    '@echo off',
    'title Instalar SOLTEC V2 en este PC',
    'echo.',
    'echo   Instalando SOLTEC V2 en este PC...',
    'echo.',
    'set "APP=' + app + '"',
    'set "ALTA=' + alta + '"',
    'set "NAV="',
    'for %%P in ("%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe") do if not defined NAV if exist %%P set "NAV=%%~P"',
    'if not defined NAV (',
    '  echo   No encuentro Chrome ni Edge. Instala Google Chrome y vuelve a ejecutar este archivo.',
    '  pause',
    '  exit /b 1',
    ')',
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([IO.Path]::Combine([Environment]::GetFolderPath(\'Desktop\'),\'SOLTEC V2.lnk\')); $s.TargetPath=$env:NAV; $s.Arguments=\'--app=\'+$env:APP; $s.IconLocation=$env:NAV+\',0\'; $s.Description=\'SOLTEC Avisos V2\'; $s.Save()"',
    'echo   [OK] Icono "SOLTEC V2" creado en el escritorio.',
    'echo.',
    'echo   Ahora se abre la app: escribe el nombre de este PC y pulsa Conectar.',
    'echo   (Este PC tiene que tener Tailscale abierto con tu cuenta.)',
    'start "" "%NAV%" --app="%ALTA%"',
    'echo.',
    'timeout /t 8 >nul',
    '',
  ].join('\r\n');
}
