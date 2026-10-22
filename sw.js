// Noti 0.4.0 — el nombre del caché cambia en cada versión; al activarse borra los anteriores (noti-v2, noti-v3, noti-v3-2…).
const VERSION = '0.4.0';
const CACHE = `noti-${VERSION}`;
const ASSETS = ['./', './index.html', './styles.css', './noti-core.js', './app.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(u => new Request(u, { cache:'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero para los archivos de la app (nunca sirve versiones viejas con conexión); el caché solo es el respaldo sin conexión.
// Supabase y el SDK (otro origen) no pasan por aquí.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req, { cache:'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch:true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
