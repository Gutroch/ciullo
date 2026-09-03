// sw.js - Service Worker per PWA

const CACHE_NAME = 'ciullotracker-v1';
const urlsToCache = [
  '/',
  '/history',
  '/recurring',
  '/promemoria',
  '/css/style.css',
  '/js/history-buttons.js',
  '/js/dashboard-charts.js',
  '/manifest.json'
];

// Installazione del service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aperta');
        return cache.addAll(urlsToCache);
      })
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
    })
  );
});

// Intercettazione delle richieste
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - restituisci la risposta dalla cache
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
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