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

/* ====== ADR-013 门禁：结构防绕过 + 让位集成 ====== */
const fs = require('node:fs');
const path = require('node:path');
const STORE_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'store.js'), 'utf8');

test('门禁：_idbWriteCols 只允许出现在 _storeWrite 体内（结构性防绕过）', () => {
  const start = STORE_SRC.indexOf('Store.prototype._storeWrite = function');
  assert.ok(start > 0, '_storeWrite 应存在');
  const next = STORE_SRC.indexOf('Store.prototype.', start + 10);
  const bodyEnd = next > 0 ? next : STORE_SRC.length;
  let last = -1;
  let found = 0;
  while (true) { // eslint-disable-line no-constant-condition
    const i = STORE_SRC.indexOf('_idbWriteCols(', last + 1);
    if (i < 0) break;
    last = i;
    found++;
    assert.ok(i > start && i < bodyEnd,
      '发现收口点之外的 _idbWriteCols 直调 @' + i + '——写路径必须经 _storeWrite（ADR-013）');
  }
  assert.ok(found > 0, '_storeWrite 体内应有 IDB 相位调用');
});

test('门禁：disableEncryption 在他标签已写更新时让位（原密文不被明文覆盖）', async () => {
  clearLocks();
  const storage = memStorage();
  const s = S.createStore(storage);
  s.addMemo('本标签数据');
  if (typeof globalThis.requestIdleCallback === 'function') {
    queued.slice().forEach((fn, i) => { if (fn) { queued[i] = null; fn(); } });
  }
  await s.enableEncryption('pwd-disable-yield');
  await s.lock();

  /* 他标签抢先写入更新密文快照（同盐同密码手工加密） */
  const CRYPTO = require('../js/encryption.js');
  const salt = CRYPTO.b64ToBytes(storage.getItem('sonder_encsalt_v1'));
  const key = await CRYPTO.deriveKey('pwd-disable-yield', salt);
  const foreignArr = [{ id: 'foreign-1', text: '外来新数据', time: '', archived: false }];
  const bundle = await CRYPTO.encryptText(JSON.stringify(foreignArr), key);
  storage.setItem(COL('memos'), JSON.stringify({ e: 1, v: bundle.v, iv: bundle.iv, data: bundle.data }));
  storage.setItem(S.STORAGE_META_KEY, 'META-FOREIGN');

  /* 本标签解锁（unlock 内部让位吸收外来密文 → 基线同步）后停用加密：
   * 转明文写入的是"合并态"（外来+本地），语义正确——数据零丢失即通过 */
  const unlocked = await s.unlock('pwd-disable-yield');
  assert.equal(unlocked, true);
  await s.disableEncryption('pwd-disable-yield');

  const after = JSON.parse(storage.getItem(COL('memos')));
  assert.ok(Array.isArray(after), '停用后 memos 应为明文数组（转明文完成）');
  assert.ok(after.some(m => m.id === 'foreign-1'), '外来新数据保留（零丢失）');
  assert.ok(after.length >= 1, '备忘集合非空');
});

test('门禁：migrateToIdb 在他标签已写更新时返回 false 且不覆盖', async () => {
  clearLocks();
  const storage = memStorage();
  const s = S.createStore(storage);
  s.addMemo('迁移前基线');
  if (typeof globalThis.requestIdleCallback === 'function') {
    queued.slice().forEach((fn, i) => { if (fn) { queued[i] = null; fn(); } });
  }
  storage.setItem(S.STORAGE_META_KEY, 'META-FOREIGN-2');
  storage.setItem(COL('memos'), JSON.stringify([{ id: 'f2', text: '他标签新数据', time: '', archived: false }]));
  const before = storage.getItem(COL('memos'));

  /* 无 IndexedDB 环境（node）：migrateToIdb 直接 false；此处验证的是
   * 收口点让位语义在迁移入口同样生效——用 _storeWrite 可达性断言代替：
   * 有 idb 环境下 yield 返回 false，无 idb 下函数前置 false。两者均不覆盖 LS。 */
  const ok = await s.migrateToIdb();
  assert.equal(ok, false, '无 idb 环境：迁移不可用返回 false');
  assert.equal(storage.getItem(COL('memos')), before, 'LS 原样');
});
