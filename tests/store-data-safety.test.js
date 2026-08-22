'use strict';
/* 存储层数据安全契约测试（Commit 2 审计修复回归网）：
 * ① 明文 IDB 主快照写纳入让位协议（_lockedIdbWrite）——多标签并发时
 *    本标签基于旧内存的陈旧集合不再带着最新 savedAt 覆盖 IDB 主快照。
 * ② unlock 快照完整性预检——任一密文 bundle 损坏即整体拒绝解锁，
 *    绝不采纳"残缺 base"回写覆盖全部存储（防不可逆丢失）。
 * ③ enableEncryption 锁定态守卫 + 逐集合回读校验——堵死最后一个无守卫写路径。
 * 注入手法复用 store-write-lock.test.js（fake requestIdleCallback / fake navigator.locks）。 */
const { test, after } = require('node:test');
const assert = require('node:assert');
const S = require('../js/store.js');

const COL = id => 'sonder_col_' + id + '_v1';

function memStorage(initial = {}) {
  const m = { ...initial };
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem(k, v) { m[k] = String(v); },
    removeItem(k) { delete m[k]; }
  };
}

/* ---- fake requestIdleCallback（同 write-lock 测试） ---- */
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
function tick() { return new Promise(resolve => setImmediate(resolve)); }

/* ---- fake navigator.locks ---- */
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

function installBus() {
  const seen = [];
  globalThis.SonderBus = { bus: { emit(path) { seen.push(path); } } };
  return seen;
}
after(() => { delete globalThis.SonderBus; });

/* IDB 写探针：替换实例 _idbWriteCols 记录调用（node 环境 idbAvailable()=false，
 * 原实现本会静默跳过；探针让"是否尝试写主快照"可断言） */
function spyIdb(s) {
  const calls = [];
  const orig = s._idbWriteCols.bind(s);
  s._idbWriteCols = function (map, extra) { calls.push({ map, extra }); return orig(map, extra); };
  return calls;
}

/* ====== ① 明文 IDB 让位协议 ====== */

test('数据安全：明文 save 的 IDB 主快照写经让位检查——另一标签已写时不覆盖主快照', async () => {
  const locks = makeLocks();
  installLocks(locks);
  const seen = installBus();
  try {
    const storage = memStorage();
    const s = S.createStore(storage);
    const idbCalls = spyIdb(s);

    s.addMemo('基线数据'); /* 提交 → IDB 让位锁：curMeta=null（首写）→ 正常放行 */
    assert.equal(idbCalls.length, 1, '基线写正常落主快照');
    runQueued(); /* LS 防抖落盘：meta=M1，_lastSeenMeta=M1 */

    /* 另一标签抢先写入更新快照（meta 变化） */
    const otherState = JSON.parse(JSON.stringify(s.state));
    otherState.memos.unshift({ id: 'other-1', text: '另一标签新数据', time: '2026-08-16T00:00:00.000Z', archived: false });
    storage.setItem(S.STORAGE_META_KEY, 'META-OTHER');
    storage.setItem(COL('memos'), JSON.stringify(otherState.memos));

    /* 本标签基于旧内存继续编辑并保存 */
    s.addMemo('本标签陈旧编辑');
    await tick(); /* 让位吸收在微任务完成 */

    assert.equal(idbCalls.length, 1, '让位：陈旧数据不得写入 IDB 主快照（核心回归点）');
    const stored = JSON.parse(storage.getItem(COL('memos')));
    assert.equal(stored[0].text, '另一标签新数据', 'LS 同样不被旧快照覆盖');
    assert.equal(s.state.memos[0].text, '另一标签新数据', '内存吸收新快照');
    assert.ok(seen.includes('/store/yielded'), '让位提示事件照常广播');
  } finally { clearLocks(); }
});

test('数据安全：meta 一致时明文 IDB 主快照正常写入（不误伤正常路径）', () => {
  clearLocks(); /* 无锁环境：降级直写 */
  const storage = memStorage();
  const s = S.createStore(storage);
  const idbCalls = spyIdb(s);
  s.addMemo('正常路径');
  runQueued();
  assert.equal(idbCalls.length, 1, '正常写应尝试写主快照一次');
  assert.ok(idbCalls[0].map && idbCalls[0].map.memos, '携带 memos 集合串');
});

test('数据安全：锁异常时 IDB 让位封装降级直写（可用性优先，等价旧行为）', async () => {
  const locks = makeLocks({ reject: true });
  installLocks(locks);
  try {
    const storage = memStorage();
    const s = S.createStore(storage);
    const idbCalls = spyIdb(s);
    s.addMemo('降级直写');
    await tick(); /* p.catch(fallback) 微任务执行 */
    assert.equal(idbCalls.length, 1, '锁不可用时直接写（与 LS 落盘降级语义一致）');
  } finally { clearLocks(); }
});

/* ====== ② unlock 完整性预检 ====== */
const CRYPTO = require('../js/encryption.js');
const PWD = 'sonder-data-safety';
const SALT_KEY = 'sonder_encsalt_v1';

test('数据安全：unlock 前完整性预检——损坏 bundle 整体拒绝解锁且原密文一字不动', async () => {
  const storage = memStorage();
  const s = S.createStore(storage);
  s.addMemo('珍贵数据');
  runQueued();
  await s.enableEncryption(PWD);

  /* 破坏其中一个集合 bundle（tasks）：形状合法但密文无法通过 GCM 认证 */
  const broken = JSON.stringify({ e: 1, v: 1, iv: 'QUFBQUFBQUFBQUFBQQ==', data: 'ZmFrZQ==' });
  storage.setItem(COL('tasks'), broken);

  /* 快照全部原始串留档（验证解锁失败后一字不动） */
  const before = {};
  for (const id of ['settings', 'memos', 'tasks', 'books']) before[id] = storage.getItem(COL(id));
  const saltBefore = storage.getItem(SALT_KEY);

  await s.lock();
  const ok = await s.unlock(PWD); /* 密码正确，但存在损坏 bundle */

  assert.equal(ok, false, '存在损坏 bundle 时必须整体拒绝解锁');
  assert.equal(s._encKey, null, '拒绝后不得持有会话密钥');
  assert.equal(s._statusReason, 'snapshot_corrupted', '状态标记损坏原因（TrustLayer 可上报 UI）');
  for (const id of ['settings', 'memos', 'tasks', 'books']) {
    assert.equal(storage.getItem(COL(id)), before[id], '原密文原样保留：' + id);
  }
  assert.equal(storage.getItem(SALT_KEY), saltBefore, '盐不被改动');
  assert.ok(s.needsUnlock(), '仍处于锁定态（可换环境重试/引导导出其余数据）');
});

test('数据安全：完好密文快照 unlock 正常成功（预检不误伤）', async () => {
  const storage = memStorage();
  const s = S.createStore(storage);
  s.addMemo('完好数据一');
  s.addBook({ title: '书' });
  runQueued();
  await s.enableEncryption(PWD);
  await s.lock();

  const ok = await s.unlock(PWD);
  assert.equal(ok, true, '全部 bundle 可解密 → 解锁成功');
  assert.equal(s.encryptionMode(), 'unlocked', '进入解锁态');
  assert.ok(s.state.memos.some(m => m.text === '完好数据一'), '备忘数据完整回内存');
  assert.equal(s.state.books.length, 1, '书籍数据完整回内存');
});

/* ====== ③ enableEncryption 锁定态守卫 ====== */

test('数据安全：锁定态调用 enableEncryption 必须拒绝且真密文原样保留', async () => {
  const storage = memStorage();
  const s = S.createStore(storage);
  s.addMemo('真实数据');
  runQueued();
  await s.enableEncryption(PWD); /* 建立加密基线 */
  const encBefore = storage.getItem(COL('memos'));
  const saltBefore = storage.getItem(SALT_KEY);

  /* 真实攻击前提：加密状态下刷新页面——新实例从密文存储构造，
   * 密文未解锁不采纳 → 内存为空 defaultState（旧验证两侧同为 0 恒通过的陷阱场景） */
  const sReloaded = S.createStore(storage);
  await tick();
  assert.ok(sReloaded.needsUnlock(), '重载实例处于锁定态');
  assert.equal(sReloaded.state.memos.length, 0, '重载锁定态内存确为空（攻击前提成立）');

  let rejected = null;
  try { await sReloaded.enableEncryption('9999'); } catch (e) { rejected = e; }
  assert.ok(rejected, '锁定态 enableEncryption 必须 reject');
  assert.match(rejected.message, /锁定/, '错误信息说明锁定原因');
  assert.equal(storage.getItem(COL('memos')), encBefore, '真密文未被空数据密文覆盖');
  assert.equal(storage.getItem(SALT_KEY), saltBefore, '旧盐未被新盐替换');
});

test('数据安全：非锁定态 enableEncryption 行为不变（守卫不误伤正常启用）', async () => {
  clearLocks();
  const storage = memStorage();
  const s = S.createStore(storage);
  s.addMemo('正常启用前');
  runQueued();
  const ok = await s.enableEncryption('sonder-normal-enable');
  assert.equal(ok, true, '正常路径启用成功');
  const memosRaw = JSON.parse(storage.getItem(COL('memos')));
  assert.equal(memosRaw.e, 1, '落盘为密文');
  const key = await CRYPTO.deriveKey('sonder-normal-enable', CRYPTO.b64ToBytes(storage.getItem(SALT_KEY)));
  const plain = JSON.parse(await CRYPTO.decryptBundle(memosRaw, key));
  assert.ok(plain.some(m => m.text === '正常启用前'), '回读解密内容完整');
});
