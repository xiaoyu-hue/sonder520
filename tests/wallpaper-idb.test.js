'use strict';
/* 自定义壁纸 C-7：IndexedDB 独立 entry 为主存，localStorage 仅同步副本/降级/遗留迁移源 */
const { test } = require('node:test');
const assert = require('node:assert');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');
const { boot } = require('./harness.js');

const WP = 'sonder_wallpaper_v1';
const IMG = 'data:image/jpeg;base64,AAAA';
const withIdb = (f, seed) => Object.assign({ idb: f, idbKeyRange: IDBKeyRange }, seed ? { seed } : {});

/* 轮询等待条件成立（IDB 异步落盘后 LS 副本移除） */
function poll(fn, ms = 30, tries = 150) {
  return new Promise((resolve, reject) => {
    const t = setInterval(() => {
      if (fn()) { clearInterval(t); resolve(); }
      else if (--tries <= 0) { clearInterval(t); reject(new Error('poll 超时')); }
    }, ms);
  });
}

test('壁纸：setCustomWallpaper 双写——IDB 落盘成功后 LS 副本移除（不占 5MB 配额）', async () => {
  const f = new IDBFactory();
  const h = boot(withIdb(f));
  assert.equal(h.store.setCustomWallpaper(IMG), true, '设置成功返回 true');
  assert.equal(h.store.getCustomWallpaper(), IMG, '内存缓存立即可读');
  assert.equal(h.store._storage.getItem(WP), IMG, 'LS 同步副本先落盘（防设置后立即刷新丢失）');
  await poll(() => !h.store._storage.getItem(WP));
  assert.equal(h.store._storage.getItem(WP), null, 'IDB 落盘后 LS 副本应移除');
});

test('壁纸：IDB 为主存——重启后从 IDB 恢复，不依赖 LS', async () => {
  const f = new IDBFactory();
  const h1 = boot(withIdb(f));
  h1.store.setCustomWallpaper(IMG);
  await poll(() => !h1.store._storage.getItem(WP));

  const h2 = boot(withIdb(f)); /* 全新 localStorage，仅靠 IDB */
  await h2.hooks.idbReady;
  assert.equal(h2.store.getCustomWallpaper(), IMG, '重启后从 IDB 恢复壁纸');
});

test('壁纸：旧版 LS 遗留数据自动迁移到 IDB 并移除 LS', async () => {
  const f = new IDBFactory();
  const h = boot(withIdb(f));
  h.store._storage.setItem(WP, IMG); /* 模拟旧版本存的 LS 壁纸 */
  await h.hooks.idbReady; /* loadIdb 尾部触发 _restoreCustomWallpaper */
  assert.equal(h.store.getCustomWallpaper(), IMG, 'LS 遗留应被加载');
  await poll(() => !h.store._storage.getItem(WP));
  assert.equal(h.store._storage.getItem(WP), null, '迁移成功后 LS 遗留应移除');

  const h2 = boot(withIdb(f));
  await h2.hooks.idbReady;
  assert.equal(h2.store.getCustomWallpaper(), IMG, '迁入 IDB 后重启仍可恢复');
});

test('壁纸：clearCustomWallpaper 清除内存缓存、LS 与 IDB', async () => {
  const f = new IDBFactory();
  const h = boot(withIdb(f));
  h.store.setCustomWallpaper(IMG);
  await poll(() => !h.store._storage.getItem(WP));
  h.store.clearCustomWallpaper();
  assert.equal(h.store.getCustomWallpaper(), null, '内存缓存已清');
  assert.equal(h.store._storage.getItem(WP), null, 'LS 已清');

  const h2 = boot(withIdb(f));
  await h2.hooks.idbReady;
  assert.equal(h2.store.getCustomWallpaper(), null, 'IDB 已清，重启后无壁纸');
});

test('壁纸：无 IDB 环境降级为 LS 存储（旧行为兼容）', () => {
  const h = boot(); /* 不注入 idb */
  assert.equal(h.store.setCustomWallpaper(IMG), true);
  assert.equal(h.store.getCustomWallpaper(), IMG);
  assert.equal(h.store._storage.getItem(WP), IMG, '无 IDB 时 LS 副本保留');
  h.store.clearCustomWallpaper();
  assert.equal(h.store.getCustomWallpaper(), null, '降级模式下清除同样生效');
});
