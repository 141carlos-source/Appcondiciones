// SOLTEC V2 · Service worker: la app funciona sin conexión.
// Solo guarda los archivos de la aplicación. Los datos viven en IndexedDB y nunca se tocan aquí.
// Una versión nueva se instala en segundo plano y espera a que pulses «Actualizar».

const VERSION = 'V2-1.4.0';
const CACHE = 'SOLTEC-V2-' + VERSION;
const SHELL = [
  './', './index.html', './app.css', './app.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './core/db.js', './core/storage.js', './core/model.js', './core/validate.js', './core/search.js', './core/backup.js', './core/sync.js', './ui.js', './modulos/avisos.js', './modulos/agenda.js', './modulos/empresa.js', './modulos/comunicaciones.js', './core/empresa.js', './core/documentos.js', './core/memoria.js', './modulos/memoria.js', './core/geo.js', './modulos/ubicacion.js', './core/partes.js', './modulos/partes.js', './core/importarV1.js', './core/calendario.js', './modulos/importar.js', './vendor/pdf-lib.min.js', './vendor/fonts/archivo.woff2', './assets/logo_e-distribucion.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('SOLTEC-V2-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Al tocar un aviso de la agenda se abre (o se trae al frente) la app.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    const w = ws.find((c) => 'focus' in c);
    return w ? w.focus() : self.clients.openWindow(self.registration.scope + '#/agenda');
  }));
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.tipo === 'ACTIVAR') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // el PC de casa y otros servicios van directos
  // Navegación: index.html del caché, para abrir sin conexión.
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  // Archivos de la app: primero el caché de esta versión, si no, la red.
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
