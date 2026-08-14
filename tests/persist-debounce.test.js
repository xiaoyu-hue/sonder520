'use strict';
/* 主快照 setItem 批量防抖测试：requestIdleCallback 一次周期内多次 save
 * 只写一次 localStorage（最新快照）；无 idle API 环境（Node/测试）同步落盘。 */
const { test, after } = require('node:test');
const assert = require('node:assert');
const S = require('../js/store.js');

function memStorage(initial = {}) {
  const m = { ...initial };
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem(k, v) { m[k] = String(v); },
    removeItem(k) { delete m[k]; }
  };
}

/* 注入假 requestIdleCallback：捕获回调手动触发，模拟浏览器 idle 调度 */
const queued = [];
const realRIC = globalThis.requestIdleCallback;
const realCIC = globalThis.cancelIdleCallback;
globalThis.requestIdleCallback = fn => { queued.push(fn); return queued.length; };
globalThis.cancelIdleCallback = handle => { queued[handle - 1] = null; };
after(() => {
  if (realRIC) globalThis.requestIdleCallback = realRIC; else delete globalThis.requestIdleCallback;
  if (realCIC) globalThis.cancelIdleCallback = realCIC; else delete globalThis.cancelIdleCallback;
});

function runQueued() {
  queued.slice().forEach((fn, i) => { if (fn) { queued[i] = null; fn(); } });
}

test('持久化防抖：连续多次 save 合并为一次 idle 写入，且只写最新快照', () => {
  const storage = memStorage();
  const s = S.createStore(storage);
  s.addMemo('第一条');
  s.addMemo('第二条');
  s.addMemo('第三条');
  assert.equal(queued.filter(Boolean).length, 1, '多次保存只调度一次 idle 写入');
  assert.equal(storage.getItem(S.STORAGE_KEY), null, 'idle 未执行前不得落盘');
  runQueued();
  const raw = JSON.parse(storage.getItem(S.STORAGE_KEY));
  assert.equal(raw.memos.length, 3, '写的是最新完整快照');
  assert.equal(raw.memos[0].text, '第三条', '最新数据优先');
  assert.ok(storage.getItem(S.STORAGE_META_KEY), 'meta 一并写入');
});

test('持久化防抖：flushPersist 立即落盘并取消待调度写入', () => {
  const storage = memStorage();
  const s = S.createStore(storage);
  s.addMemo('待冲刷');
  assert.equal(storage.getItem(S.STORAGE_KEY), null, 'idle 前未落盘');
  s.flushPersist();
  assert.equal(s._localFlushHandle, null, 'flush 应作废待调度任务');
  assert.equal(queued.filter(Boolean).length, 0, 'flush 后不应再有排队写入');
  const raw = JSON.parse(storage.getItem(S.STORAGE_KEY));
  assert.equal(raw.memos.length, 1, 'flush 后立即持久化');
  assert.equal(raw.memos[0].text, '待冲刷');
});

test('持久化防抖：无 requestIdleCallback 环境同步落盘（Node/测试兼容）', () => {
  const savedRIC = globalThis.requestIdleCallback;
  delete globalThis.requestIdleCallback;
  try {
    const storage = memStorage();
    const s = S.createStore(storage);
    s.addMemo('同步落盘');
    assert.ok(storage.getItem(S.STORAGE_KEY), '无 idle API 时应同步落盘');
    assert.equal(s._localFlushHandle, null, '同步路径不残留调度句柄');
  } finally {
    if (savedRIC) globalThis.requestIdleCallback = savedRIC;
  }
});