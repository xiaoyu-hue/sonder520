/* Sonder Service Worker - Cache First（缓存优先）离线可用
 * 部署新版本时请递增 CACHE 版本号；sw 更新后会自动清理旧缓存。
 * ASSET_SIG 由 npm run sync-sw 写入：清单内任一文件内容变化的指纹（sha256 前 12 位），
 * 内容变了而版本没升说明部署流程漏跑 sync-sw。 */
'use strict';

var CACHE = 'sonder-v74';

var ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './css/desktop-pet.css',
  './js/encryption.js',
  './js/event-bus.js',
  './js/store-stats.js',
  './js/store.js',
  './js/framework/ModuleFactory.js',
  './js/store-report.js',
  './js/store-tasks.js',
  './js/store-media.js',
  './js/store-content.js',
  './js/store-settings.js',
  './js/ui.js',
  './js/motion.js',
  './js/error-guard.js',
  './js/search.js',
  './js/quotes.js',
  './js/markdown.js',
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
  './js/games-view.js',
  './js/games-shared.js',
  './js/games-mini.js',
  './js/games-battle.js',
  './js/games.js',
  './js/desktop-pet.js',
  './js/desktop-pet-page.js',
  './js/settings.js',
  './js/sw-register.js',
  './js/app.js',
  './manifest.json',
  './img/wallpaper.jpg',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png',
  './js/game-worker.js'
];
var ASSET_SIG = '3b8b0c3f2922';

/* install：预缓存全部资源，立即接管。
 * Request(cache:'reload') 绕过 HTTP 缓存直取网络——GH Pages max-age=600 下
 * 默认 fetch 会把陈旧副本固化进新 CACHE 版本（升版白升，混合新旧资源）。 */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS.map(function (u) { return new Request(u, { cache: 'reload' }); })); })
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

/* fetch：导航请求（页面）Network First —— 有网先拿新版并回写缓存，刷新即更新；
 * 静态资源 Cache First —— 命中缓存直接返回；未命中回源并写入缓存；
 * 离线时导航请求回退到首页缓存副本。 */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) {
          return hit || Response.error();
        });
      })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        if (res && res.ok && new URL(e.request.url).origin === self.location.origin) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
          return res;
        }
        /* 回源拿到非 ok（瞬时 5xx/404）：有缓存副本时兜底返回旧版而非直接透传错误 */
        if (res && !res.ok) {
          return caches.match('./index.html').then(function (fallback) { return fallback || res; });
        }
        return res;
      }).catch(function () {
        return Response.error();
      });
    })
  );
});