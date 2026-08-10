/* Sonder Service Worker - Cache First（缓存优先）离线可用
 * 部署新版本时请递增 CACHE 版本号；sw 更新后会自动清理旧缓存。 */
'use strict';

var CACHE = 'sonder-v7';

var ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './assets/icon.svg',
  './img/wallpaper.jpg',
  './js/store.js',
  './js/ui.js',
  './js/search.js',
  './js/quotes.js',
  './js/home.js',
  './js/today.js',
  './js/memo.js',
  './js/selfmedia.js',
  './js/dev.js',
  './js/consulting.js',
  './js/reading.js',
  './js/news.js',
  './js/design.js',
  './js/games-logic.js',
  './js/games.js',
  './js/settings.js',
  './js/app.js'
];

/* install：预缓存全部资源，立即接管 */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

/* activate：清掉旧版本缓存 */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

/* fetch：Cache First —— 命中缓存直接返回；
 * 未命中回源并写入缓存；离线时导航请求回退到首页缓存副本。 */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        if (res && res.ok && new URL(e.request.url).origin === self.location.origin) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});