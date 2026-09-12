const CACHE_NAME = 'ciullotracker-v7-softly';
const STATIC_ASSETS = [
  '/css/style.css',
  '/js/history-buttons.js',
  '/js/dashboard-charts.js',
  '/js/pwa.js',
  '/manifest.json',
  '/icons/favicon.svg',
  '/icons/icon-192-v2.svg',
  '/icons/icon-512-v2.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.pathname === '/manifest.json' || url.pathname === '/sw.js') {
    event.respondWith(fetch(req));
    return;
  }

  const isNavigation = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return response;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return response;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});

self.addEventListener('push', (event) => {
  const data = event.data.json();
  const options = {
    body: data.body || 'Nuova notifica',
    icon: '/icons/favicon.svg',
    badge: '/icons/favicon.svg',
    vibrate: [200, 100, 200]
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'CiulloTracker', options)
  );
});