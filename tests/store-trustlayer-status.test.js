'use strict';
/* TrustLayer 结构化存储状态契约（Phase 2：IndexedDB 主快照优先）：
 * 主快照 = IndexedDB（真源，容量大）；localStorage = 副本（降级后备镜像）。
 * getStorageStatus()（同步）/ persistResult()（Promise）/ diagnostics() 返回
 * { ok, backend, degraded, critical, reason } 结构化状态：
 * - ok=true：数据有可靠落点（IDB 主快照成功，或主不可用但 LS 副本在）
 * - degraded=true：存在存储层异常但不构成危机（主失败靠副本兜底，或副本停更）
 * - critical=true：数据仅存于内存（主失败且副本不可用）—— 与 hasPersistIssue() 严格一致
 * - reason：quota / security / indexeddb_write_failed / indexeddb_unavailable /
 *           encryption_failed / storage_error 归类
 * 现有 hasPersistIssue()/persistIssueDetail() 行为不变（旧 API 兼容，公式对称）。 */
const { test } = require('node:test');
const assert = require('node:assert');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');
const { boot } = require('./harness.js');

const withIdb = f => ({ idb: f, idbKeyRange: IDBKeyRange });
const wait = ms => new Promise(r => setTimeout(r, ms));

function quotaErr(name, msg) {
  const e = new Error(msg || name);
  e.name = name;
  return e;
}

/* 前 times 次 setItem 抛配额错误，之后委托真实 storage（模拟"存储写满 → 清理/扩容后恢复"） */
function flaky(real, times) {
  let left = times;
  return {
    getItem: k => real.getItem(k),
    setItem: (k, v) => {
      if (left > 0) { left--; throw quotaErr('QuotaExceededError'); }
      real.setItem(k, v);
    },
    removeItem: k => real.removeItem(k)
  };
}

test('TrustLayer: 无 IDB 环境 → 主后端缺失、LS 副本兜底：ok/降级/非危机，reason=indexeddb_unavailable', () => {
  const h = boot();
  const s = h.store.getStorageStatus();
  assert.deepEqual(s, { ok: true, backend: 'localStorage', degraded: true, critical: false, reason: 'indexeddb_unavailable' });
});

test('TrustLayer: IDB 可用健康态 → ok/indexedDB/无降级/无危机/无原因', async () => {
  const f = new IDBFactory();
  const h = boot(withIdb(f));
  h.store.addMemo('健康数据');
  await wait(80);
  assert.deepEqual(h.store.getStorageStatus(), { ok: true, backend: 'indexedDB', degraded: false, critical: false, reason: null });
});

test('TrustLayer: getStorageStatus 返回全新对象（不外泄内部引用）', () => {
  const h = boot();
  const a = h.store.getStorageStatus();
  a.ok = false;
  assert.equal(h.store.getStorageStatus().ok, true, '修改返回值不得影响后续调用');
});

test('TrustLayer: LS 副本与 IDB 主快照均不可用 → degraded+critical，reason=quota，与 hasPersistIssue 一致', async () => {
  const h = boot();
  h.store._storage = flaky(h.window.localStorage, 999);
  h.store.addMemo('危机数据');
  await wait(60);
  const s = h.store.getStorageStatus();
  assert.equal(s.ok, false, '无落点不应报 ok');
  assert.equal(s.degraded, true);
  assert.equal(s.critical, true, 'critical 应与 hasPersistIssue 一致');
  assert.equal(s.reason, 'quota', 'QuotaExceededError 应归类 quota');
  assert.equal(h.store.hasPersistIssue(), true, '旧 API 行为不变');
});

test('TrustLayer: LS 副本停更但 IDB 主快照正常 → ok/indexedDB/降级，不触发危机（5MB 写满不再危险）', async () => {
  const f = new IDBFactory();
  const h = boot(withIdb(f));
  h.store._storage = flaky(h.window.localStorage, 999);
  h.store.addMemo('双写数据');
  await wait(80);
  const s = h.store.getStorageStatus();
  assert.equal(s.ok, true, 'IDB 主快照在，数据有落点');
  assert.equal(s.backend, 'indexedDB', '实际落点应为 IndexedDB');
  assert.equal(s.degraded, true, '副本停更应标降级');
  assert.equal(s.critical, false, '不应报危机');
  assert.equal(s.reason, 'quota', '副本停更原因应归类 quota');
  assert.equal(h.store.hasPersistIssue(), false, '旧 API 行为不变');
});

test('TrustLayer: IDB 主写失败但 LS 副本正常 → LS 兜底降级，不触发危机', () => {
  const f = new IDBFactory();
  const h = boot(withIdb(f));
  h.store._idbFailed = true; /* 模拟 IDB 主快照进入失败（存储分区/配额） */
  const s = h.store.getStorageStatus();
  assert.equal(s.ok, true, 'LS 副本在，数据有落点');
  assert.equal(s.backend, 'localStorage', '实际落点应为 localStorage 副本');
  assert.equal(s.degraded, true, '主后端失败应标降级');
  assert.equal(s.critical, false, '副本在不应报危机');
  assert.equal(s.reason, 'indexeddb_write_failed', '主失败原因应归类 indexeddb_write_failed');
  assert.equal(h.store.hasPersistIssue(), false, '旧 API 行为不变');
});

test('TrustLayer: 双失败 → critical=true 且 backend=null，与 hasPersistIssue 一致', async () => {
  const f = new IDBFactory();
  const h = boot(withIdb(f));
  h.store._storage = flaky(h.window.localStorage, 999);
  h.store.addMemo('危险数据');
  await wait(60);
  h.store._idbFailed = true; /* 模拟 IDB 侧失败 */
  const s = h.store.getStorageStatus();
  assert.equal(s.ok, false);
  assert.equal(s.backend, null, '双失败无任何可靠落点');
  assert.equal(s.degraded, true);
  assert.equal(s.critical, true);
  assert.equal(h.store.hasPersistIssue(), true, '旧 API 行为不变');
});

test('TrustLayer: 恢复后状态自动回到健康（reason 清空）', async () => {
  const h = boot();
  h.store._storage = flaky(h.window.localStorage, 1);
  h.store.addMemo('一次失败');
  await wait(60);
  assert.equal(h.store.getStorageStatus().critical, true);

  h.store._storage = h.window.localStorage;
  h.store.addMemo('恢复');
  await wait(60);
  assert.deepEqual(h.store.getStorageStatus(), { ok: true, backend: 'localStorage', degraded: true, critical: false, reason: 'indexeddb_unavailable' }, '无 IDB 环境恢复后应为副本兜底降级态');
});

test('TrustLayer: 副本停更后恢复（IDB 环境）→ 回到 indexedDB 全健康', async () => {
  const f = new IDBFactory();
  const h = boot(withIdb(f));
  h.store._storage = flaky(h.window.localStorage, 1);
  h.store.addMemo('副本失败一次');
  await wait(80);
  assert.equal(h.store.getStorageStatus().degraded, true, '副本停更应降级');

  h.store._storage = h.window.localStorage;
  h.store.addMemo('副本恢复');
  await wait(80);
  assert.deepEqual(h.store.getStorageStatus(), { ok: true, backend: 'indexedDB', degraded: false, critical: false, reason: null }, '副本恢复后应回到全健康');
});

test('TrustLayer: 加密失败 → reason=encryption_failed（不触发危机，数据停留旧版）', async () => {
  const h = boot();
  h.store._encKey = {}; /* 无效 key：encryptText 必然 reject（WebCrypto 环境） */
  await h.store._encSave('"payload"');
  const d = h.store.diagnostics();
  assert.equal(d.statusReason, 'encryption_failed', '应记录加密失败原因');
  assert.equal(h.store.hasPersistIssue(), false, '加密失败不置持久化失败标记');
  assert.equal(h.store.getStorageStatus().ok, true, '存储本身仍有可靠落点');
});

test('TrustLayer: Firefox 配额错误同样归类 quota', async () => {
  const h = boot();
  h.store._storage = {
    getItem: k => h.window.localStorage.getItem(k),
    setItem: () => { throw quotaErr('NS_ERROR_DOM_QUOTA_REACHED'); },
    removeItem: k => h.window.localStorage.removeItem(k)
  };
  h.store.addMemo('x');
  await wait(60);
  assert.equal(h.store.getStorageStatus().reason, 'quota', 'Firefox 配额错误应归类 quota');
});

test('TrustLayer: persistResult() 返回 Promise，无 IDB 环境健康时 ok=true（副本兜底降级）', async () => {
  const h = boot();
  h.store.addMemo('落盘确认');
  const s = await h.store.persistResult();
  assert.deepEqual(s, { ok: true, backend: 'localStorage', degraded: true, critical: false, reason: 'indexeddb_unavailable' });
});

test('TrustLayer: persistResult() 在 LS 副本失败且无 IDB 时如实报写失败（不谎报成功）', async () => {
  const h = boot();
  h.store._storage = flaky(h.window.localStorage, 999);
  h.store.addMemo('失败确认');
  const s = await h.store.persistResult();
  assert.equal(s.ok, false, '持久化失败不得谎报成功');
  assert.equal(s.critical, true);
  assert.equal(s.reason, 'quota');
});

test('TrustLayer: diagnostics() 聚合字段齐全', async () => {
  const h = boot();
  h.store.addMemo('x');
  await wait(60);
  const d = h.store.diagnostics();
  assert.equal(typeof d.storageReady, 'boolean');
  assert.equal(typeof d.idbAvailable, 'boolean');
  assert.equal(typeof d.idbFailed, 'boolean');
  assert.equal(typeof d.persistFailed, 'boolean');
  assert.equal(typeof d.usageBytes, 'number');
  assert.equal(typeof d.nearQuota, 'boolean');
  assert.equal(d.status.ok, true, 'diagnostics 内嵌 status');
  assert.equal(d.lastError, null, '无失败时 lastError 为 null');
});
