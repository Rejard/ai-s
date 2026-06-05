const CACHE_NAME = 'ai-s-pwa-cache-v2';

// 🌟 Disable resource caching to permanently prevent white screen freezing caused by cache mismatch.
// Simply meeting PWA installation eligibility, all requests are always bypassed to the real-time network.
const urlsToCache = [];

self.addEventListener('install', (event) => {
  // Induce new service worker to activate immediately without waiting
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // If a previous version's cache exists, delete all of it to immediately and completely release the browser lock-in phenomenon.
          console.log('[PWA SW] Clearing old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Always directly fetch the real latest data from the network without cache matching (Perfect White Screen Defense)
  event.respondWith(fetch(event.request));
});
