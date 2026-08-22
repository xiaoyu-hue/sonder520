'use strict';
/* 写路径统一收口契约测试（ADR-013 前置，Commit A 部分）：
 * _storeWrite 是 TrustLayer 唯一落盘收口点——锁内固定序列：
 *   ① meta 让位检查（他标签已写 → 吸收 + resolve(false)）
 *   ② LS 相位（ls:'immediate' 时写集合并刷基线）
 *   ③ IDB 相位（idb:'write' 时写主快照，锁内执行）
 * 注入手腕复用 store-write-lock.test.js（fake requestIdleCallback / fake navigator.locks）。 */
const { test, after } = require('node:test');
const assert = require('node:assert');
const S = require('../js/store.js');

const COL = id => 'sonder_col_' + id + '_v1';

function memStorage() {
  const m = {};
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem(k, v) { m[k] = String(v); },
    removeItem(k) { delete m[k]; }
  };
}

const queued = [];
const realRIC = globalThis.requestIdleCallback;
const realCIC = globalThis.cancelIdleCallback;
globalThis.requestIdleCallback = fn => { queued.push(fn); return queued.length; };
globalThis.cancelIdleCallback = handle => { queued[handle - 1] = null; };
after(() => {
  if (realRIC) globalThis.requestIdleCallback = realRIC; else delete globalThis.requestIdleCallback;
  if (realCIC) globalThis.cancelIdleCallback = realCIC; else delete globalThis.cancelIdleCallback;
});
function tick() { return new Promise(resolve => setImmediate(resolve)); }

let realNav = null;
function installLocks(mock) {
  realNav = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    value: Object.assign(Object.create(null), realNav ? { userAgent: realNav.userAgent } : {}, { locks: mock }),
    configurable: true,
    writable: true
  });
}
function clearLocks() {
  if (globalThis.navigator && 'locks' in globalThis.navigator) delete globalThis.navigator.locks;
}
after(() => {
  if (realNav !== null && !Object.prototype.hasOwnProperty.call(globalThis, 'navigator')) {
    Object.defineProperty(globalThis, 'navigator', { value: realNav, configurable: true, writable: true });
  }
});

function makeLocks({ reject = false } = {}) {
  const requests = [];
  return {
    requests,
    request(name, cb) {
      requests.push(name);
      if (reject) return Promise.reject(new Error('locks unavailable'));
      cb();
      return Promise.resolve();
    }
  };
}

function spyIdb(s) {
  const calls = [];
  const orig = s._idbWriteCols.bind(s);
  s._idbWriteCols = function (map, extra) { calls.push({ map, extra }); return orig(map, extra); };
  return calls;
}

test('收口点：meta 一致 → 双相位落盘返回 true', async () => {
  const locks = makeLocks();
  installLocks(locks);
  try {
    const storage = memStorage();
    const s = S.createStore(storage);
    const idbCalls = spyIdb(s);
    const map = { memos: JSON.stringify([{ id: 'x1', text: 't', time: '', archived: false }]) };
    const written = await s._storeWrite(map, { ls: 'immediate', idb: 'write' });
    assert.equal(written, true, '正常落盘');
    const raw = JSON.parse(storage.getItem(COL('memos')));
    assert.equal(raw[0].id, 'x1', 'LS 相位已写');
    assert.equal(idbCalls.length, 1, 'IDB 相位已写');
    assert.ok(locks.requests.every(r => r === 'sonder-writer'), '经统一锁');
    assert.equal(storage.getItem(S.STORAGE_META_KEY), s._meta, 'LS 相位刷新 meta 基线');
    assert.equal(s._lastSeenMeta, s._meta, '基线同步');
  } finally { clearLocks(); }
});

test('收口点：他标签已写更新 meta → 让位吸收、双相位全跳过、返回 false', async () => {
  const locks = makeLocks();
  installLocks(locks);
  try {
    const storage = memStorage();
    const s = S.createStore(storage);
    s.addMemo('基线');
    if (typeof globalThis.requestIdleCallback === 'function') {
      // 手动触发一次 idle 使基线建立（queued 由本文件全局 fake 管理）
      queued.slice().forEach((fn, i) => { if (fn) { queued[i] = null; fn(); } });
    }
    const baseline = s._lastSeenMeta;
    assert.ok(baseline, '基线已建立');

    storage.setItem(S.STORAGE_META_KEY, 'META-FOREIGN');
    storage.setItem(COL('memos'), JSON.stringify([{ id: 'f1', text: '外来新数据', time: '', archived: false }]));

    const idbCalls = spyIdb(s);
    const before = storage.getItem(COL('memos'));
    const written = await s._storeWrite(
      { memos: JSON.stringify([{ id: 'stale', text: '旧编辑', time: '', archived: false }]) },
      { ls: 'immediate', idb: 'write' }
    );
    await tick(); /* 吸收微任务 */

    assert.equal(written, false, '让位');
    assert.equal(idbCalls.length, 0, 'IDB 相位被跳过');
    assert.equal(storage.getItem(COL('memos')), before, 'LS 未被覆盖');
    assert.equal(s.state.memos[0].text, '外来新数据', '内存吸收外来快照');
  } finally { clearLocks(); }
});

test('收口点：相位开关——ls skip 不碰 LS、idb skip 不碰 IDB', async () => {
  const locks = makeLocks();
  installLocks(locks);
  try {
    const storage = memStorage();
    const s = S.createStore(storage);
    const idbCalls = spyIdb(s);
    const map = { memos: JSON.stringify([{ id: 'y1', text: 't', time: '', archived: false }]) };

    const r1 = await s._storeWrite(map, { ls: 'skip', idb: 'write' });
    assert.equal(r1, true);
    assert.equal(idbCalls.length, 1, 'idb write 生效');
    assert.equal(storage.getItem(COL('memos')), null, 'ls skip：LS 未动');

    const r2 = await s._storeWrite(map, { ls: 'immediate', idb: 'skip' });
    assert.equal(r2, true);
    assert.equal(idbCalls.length, 1, 'idb skip：不再写');
    assert.ok(storage.getItem(COL('memos')), 'ls immediate：LS 已写');
  } finally { clearLocks(); }
});

test('收口点：无锁环境降级顺序直执行（等价旧行为）', async () => {
  clearLocks();
  const storage = memStorage();
  const s = S.createStore(storage);
  const idbCalls = spyIdb(s);
  const map = { memos: JSON.stringify([{ id: 'z1', text: 't', time: '', archived: false }]) };
  const written = await s._storeWrite(map, { ls: 'immediate', idb: 'write' });
  assert.equal(written, true, '无锁视为落盘成功');
  assert.equal(idbCalls.length, 1);
  assert.ok(storage.getItem(COL('memos')));
});
