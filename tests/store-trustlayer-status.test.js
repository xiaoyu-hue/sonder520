'use strict';
/* TrustLayer 结构化存储状态契约（Phase 1）：
 * 新增 getStorageStatus()（同步）/ persistResult()（Promise）/ diagnostics() 三个公共 API，
 * 返回 { ok, backend, degraded, critical, reason } 结构化状态：
 * - ok=true：数据有可靠落点（localhost localStorage 主快照成功，或失败但 IDB 兜底在）
 * - degraded=true：主后端失败、靠兜底或待重试
 * - critical=true：数据仅存于内存（主失败且兜底不可用）—— 与 hasPersistIssue() 严格一致
 * - reason：quota / security / indexeddb_write_failed / encryption_failed / storage_error 归类
 * 现有 hasPersistIssue()/persistIssueDetail() 行为不变（旧 API 兼容）。 */
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

test('TrustLayer: 健康态 getStorageStatus = ok/localStorage/无降级/无危机/无原因', () => {
  const h = boot();
  const s = h.store.getStorageStatus();
  assert.deepEqual(s, { ok: true, backend: 'localStorage', degraded: false, critical: false, reason: null });
});

test('TrustLayer: getStorageStatus 返回全新对象（不外泄内部引用）', () => {
  const h = boot();
  const a = h.store.getStorageStatus();
  a.ok = false;
  assert.equal(h.store.getStorageStatus().ok, true, '修改返回值不得影响后续调用');
});

test('TrustLayer: LS 配额满且无 IDB → degraded+critical，reason=quota，与 hasPersistIssue 一致', async () => {
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

test('TrustLayer: LS 失败但 IDB 兜底可用 → ok/indexedDB/degraded，不触发危机', async () => {
  const f = new IDBFactory();
  const h = boot(withIdb(f));
  h.store._storage = flaky(h.window.localStorage, 999);
  h.store.addMemo('双写数据');
  await wait(80);
  const s = h.store.getStorageStatus();
  assert.equal(s.ok, true, 'IDB 兜底在，数据有落点');
  assert.equal(s.backend, 'indexedDB', '实际落点应为 IndexedDB');
  assert.equal(s.degraded, true, '主后端失败应标降级');
  assert.equal(s.critical, false, '不应报危机');
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
  assert.deepEqual(h.store.getStorageStatus(), { ok: true, backend: 'localStorage', degraded: false, critical: false, reason: null }, '写成功应完全恢复');
});

test('TrustLayer: 加密失败 → reason=encryption_failed（不触发危机，数据停留旧版）', async () => {
  const h = boot();
  h.store._encKey = {}; /* 无效 key：encryptText 必然 reject（WebCrypto 环境） */
  await h.store._encSave('"payload"');
  const d = h.store.diagnostics();
  assert.equal(d.statusReason, 'encryption_failed', '应记录加密失败原因');
  assert.equal(h.store.hasPersistIssue(), false, '加密失败不置持久化失败标记');
  assert.equal(h.store.getStorageStatus().ok, true, '存储本身仍健康');
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

test('TrustLayer: persistResult() 返回 Promise，健康时 ok=true', async () => {
  const h = boot();
  h.store.addMemo('落盘确认');
  const s = await h.store.persistResult();
  assert.deepEqual(s, { ok: true, backend: 'localStorage', degraded: false, critical: false, reason: null });
});

test('TrustLayer: persistResult() 在 LS 失败且无 IDB 时如实报写失败（不谎报成功）', async () => {
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