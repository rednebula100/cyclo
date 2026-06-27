const CACHE_NAME = 'cyclo-v2';
const ASSETS = ['./', './index.html', './app.js', './style.css', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { pathname } = new URL(e.request.url);
  const isDoc = /\.(html|css|js)$/.test(pathname) || pathname.endsWith('/');

  if (isDoc) {
    // 네트워크 우선: 새 배포 즉시 반영, 오프라인 시 캐시 폴백
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // 이미지 등 정적 에셋은 캐시 우선
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});

// 알림 클릭 시 앱 열기 + 교체 처리
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const itemId = e.notification.data?.itemId;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const target = clientList.find(c => c.visibilityState === 'visible') || clientList[0];
      if (target) {
        target.focus();
        if (itemId) target.postMessage({ type: 'RESET_ITEM', itemId });
      } else {
        clients.openWindow('./');
      }
    })
  );
});
