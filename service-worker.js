const VERSION = 'v1.1.1';
const CACHE = `mbps-ds-${VERSION}`;
const ASSETS = [
  'index.html',
  'style.css',
  'app.js',
  'pwa.js',
  'manifest.json',
  'icons/icon-72.png',
  'icons/icon-96.png',
  'icons/icon-128.png',
  'icons/icon-144.png',
  'icons/icon-152.png',
  'icons/icon-192.png',
  'icons/icon-192-maskable.png',
  'icons/icon-384.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png'
];


// keep the rest of your SW the same:
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(ASSETS.map(a => new URL(a, self.registration.scope))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k.startsWith('mbps-ds-') && k !== CACHE)
        .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => {
        const accept = req.headers.get('accept') || '';
        if (req.mode === 'navigate' || accept.includes('text/html')) {
          return caches.match(new URL('index.html', self.registration.scope));
        }
        return new Response('', { status: 504 });
      });
    })
  );
});
