const CACHE_NAME = 'cyclo-v1';
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
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
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
