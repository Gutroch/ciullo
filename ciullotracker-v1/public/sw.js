const CACHE_NAME = 'ciullotracker-v11';
const AVATAR_CDN_CACHE = 'ciullotracker-avatar-cdn-v1';

const STATIC_ASSETS = [
  '/css/style.css',
  '/css/avatar.css',
  '/css/jonny.css',
  '/js/history-buttons.js',
  '/js/dashboard-charts.js',
  '/js/pwa.js',
  '/js/ui-effects.js',
  '/js/calc-input.js',
  '/js/avatar-controller.js',
  '/js/jonny-chat.js',
  '/manifest.json',
  '/icons/favicon-v3.svg',
  '/icons/glyph-v3.svg',
  '/icons/icon-192-v3.svg',
  '/icons/icon-512-v3.svg'
];

async function precache(cache) {
  const results = await Promise.allSettled(
    STATIC_ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' })))
  );
  results.forEach((res, i) => {
    if (res.status === 'rejected') {
      console.warn('[sw] asset non precaricato:', STATIC_ASSETS[i], res.reason);
    }
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(precache));
});

self.addEventListener('activate', (event) => {
  const keep = [CACHE_NAME, AVATAR_CDN_CACHE];
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => keep.indexOf(n) === -1).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data.type === 'GET_VERSION' && event.source) {
    event.source.postMessage({ type: 'VERSION', version: CACHE_NAME });
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Sempre dalla rete: sono i due file che decidono se c'è un aggiornamento
  if (url.pathname === '/manifest.json' || url.pathname === '/sw.js') {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
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
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Modulo avatar da CDN: cache-first con aggiornamento in background
  if (url.hostname === 'esm.sh') {
    event.respondWith(
      caches.open(AVATAR_CDN_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req)
            .then((response) => { cache.put(req, response.clone()); return response; })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }

  event.waitUntil(
    self.registration.showNotification(data.title || 'CiulloTracker', {
      body: data.body || 'Nuova notifica',
      icon: '/icons/icon-192-v3.svg',
      badge: '/icons/icon-192-v3.svg',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow(target);
    })
  );
});
