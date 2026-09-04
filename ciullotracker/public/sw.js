// sw.js - Service Worker per PWA
const CACHE_NAME = 'ciullotracker-v2';
const STATIC_ASSETS = [
  '/css/style.css',
  '/js/history-buttons.js',
  '/js/dashboard-charts.js',
  '/js/pwa.js',
  '/manifest.json'
];

// Installazione del service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Attivazione del service worker
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

// Intercettazione delle richieste
self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return; // niente cache su POST/PUT/DELETE

  const url = new URL(req.url);

  // Le pagine (navigazioni HTML: /, /history, /recurring, ecc.) contengono
  // dati dinamici (spese, saldi...): vanno SEMPRE prese dalla rete.
  // Solo se la rete non è disponibile si usa la cache come fallback offline.
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

  // Asset statici (css/js/manifest/icone): cache-first, con aggiornamento
  // della cache in background per le prossime visite.
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

// Gestione delle notifiche push (opzionale)
self.addEventListener('push', (event) => {
  const data = event.data.json();
  const options = {
    body: data.body || 'Nuova notifica',
    icon: '/icons/favicon-192x192.png',
    badge: '/icons/favicon-96x96.png',
    vibrate: [200, 100, 200]
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'CiulloTracker', options)
  );
});