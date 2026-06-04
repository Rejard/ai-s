const CACHE_NAME = 'ai-s-pwa-cache-v2';

// 🌟 캐시 꼬임으로 인한 화이트스크린(먹통) 현상을 영구 방어하기 위해 리소스 캐싱을 하지 않습니다.
// 단지 PWA 설치 자격 조건만 충족하면서 모든 요청을 항상 실시간 네트워크로 bypass 시킵니다.
const urlsToCache = [];

self.addEventListener('install', (event) => {
  // 새로운 서비스 워커가 대기 없이 즉시 활성화되도록 유도
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 이전 버전의 캐시가 존재하면 전부 지워서 브라우저 락인 현상을 즉시 완전 해제
          console.log('[PWA SW] Clearing old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // 캐시 매칭 없이 항상 네트워크에서 진짜 최신 데이터를 받아오도록 직결 (White Screen 완벽 방어)
  event.respondWith(fetch(event.request));
});
