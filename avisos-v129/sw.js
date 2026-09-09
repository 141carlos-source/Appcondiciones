const CACHE='APP-AVISOS-V129-SHELL-3';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon.svg','./install.js','./home.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith('APP-AVISOS-V129-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).then(r=>{if(r&&r.ok&&new URL(event.request.url).origin===location.origin){const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{})}return r}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))))});
