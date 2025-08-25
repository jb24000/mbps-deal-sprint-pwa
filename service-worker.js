/* eslint-disable no-restricted-globals */
const VERSION = 'v1.0.1';
const CACHE = `pds-${VERSION}`;
const ASSETS = [
  'index.html','style.css','app.js','pwa.js','manifest.json',
  'icons/icon-192.png','icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(a => new URL(a, self.registration.scope)))).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('pds-') && k !== CACHE).map(k => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Only handle GET and same-origin
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Try cache first, then network; fall back to index.html for navigations
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
        if (req.mode === 'navigate' || (req.headers.get('accept')||'').includes('text/html')) {
          return caches.match(new URL('index.html', self.registration.scope));
        }
        return new Response('', {status: 504});
      });
    })
  );
});
