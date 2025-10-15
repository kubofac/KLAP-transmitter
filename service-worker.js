const CACHE_NAME = 'K-LAP transmitter';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/service-worker.js',
  '/icon-192t.png',
  '/icon-512t.png',
 
  '/app.js', // 設定ツールで使われるファイル
  // その他のCSSやJSファイルなど
];

// インストールイベント: キャッシュにファイルを保存
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// フェッチイベント: キャッシュからリソースを返す
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュにリソースがあればそれを返す
        if (response) {
          return response;
        }
        // なければネットワークから取得する
        return fetch(event.request);
      })
  );
});

// アクティベートイベント: 古いキャッシュを削除
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