const CACHE_NAME = 'ai-s-pwa-cache-v2';

// 🌟 Disable resource caching to permanently prevent white screen freezing caused by cache mismatch.
// Simply meeting PWA installation eligibility, all requests are always bypassed to the real-time network.
const urlsToCache = [];

self.addEventListener('install', (event) => {

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {

          console.log('[PWA SW] Clearing old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {

  event.respondWith(fetch(event.request));
});
