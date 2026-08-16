'use strict';
/* 多标签写锁契约测试（Web Locks）：
 * - 有 navigator.locks 时：防抖落盘经 'sonder-writer' 锁排队；锁内做写前 meta 检查，
 *   另一标签已写更新快照 → 让位不覆盖（吸收新快照 + 广播全量重绘）。
 * - 无锁/锁异常：降级直接落盘（等价旧行为），数据不丢。
 * 注入手法同 persist-debounce（fake requestIdleCallback 手动触发 idle 回调），
 * 另注入 fake navigator.locks 驱动锁语义。 */
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

/* ---- fake requestIdleCallback：捕获回调手动触发（同 persist-debounce） ---- */
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
/* 让位吸收（_decryptParse.then）与锁降级（p.catch）均在微任务中完成，断言前先让微任务排空 */
function tick() { return new Promise(resolve => setImmediate(resolve)); }

/* ---- fake navigator.locks：可靠注入/恢复 ---- */
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

/* 可编程锁：默认立即放行回调；可退化为 reject（锁异常）。记录 request 名与回调执行 */
function makeLocks({ reject = false } = {}) {
  const requests = [];
  const locks = {
    requests,
    request(name, cb) {
      requests.push(name);
      if (reject) return Promise.reject(new Error('locks unavailable'));
      cb(); /* 立即回调（模拟锁到手）；真实实现为异步，本测试不依赖时序 */
      return Promise.resolve();
    }
  };
  return locks;
}

/* 假 SonderBus：记录广播路径（验证让位触发全量重绘 + 让位提示事件；正常写不误报） */
function installBus() {
  const seen = [];
  globalThis.SonderBus = { bus: { emit(path) { seen.push(path); } } };
  return seen;
}
after(() => { delete globalThis.SonderBus; });

test('写锁：有 navigator.locks 时防抖落盘经 sonder-writer 锁执行', () => {
  const locks = makeLocks();
  installLocks(locks);
  try {
    const storage = memStorage();
    const s = S.createStore(storage);
    s.addMemo('第一条');
    assert.equal(queued.filter(Boolean).length, 1, '调度一次 idle 落盘');
    runQueued();
    assert.deepEqual(locks.requests, ['sonder-writer'], '应请求 sonder-writer 锁');
    const raw = JSON.parse(storage.getItem(S.STORAGE_KEY));
    assert.equal(raw.memos.length, 1, '锁内正常落盘');
    assert.ok(storage.getItem(S.STORAGE_META_KEY), 'meta 一并写入');
  } finally { clearLocks(); }
});

test('写锁：单标签正常写后基线一致，不误判让位', () => {
  const locks = makeLocks();
  installLocks(locks);
  const seen = installBus();
  try {
    const storage = memStorage();
    const s = S.createStore(storage);
    s.addMemo('A');
    runQueued();
    s.addMemo('B');
    runQueued();
    const raw = JSON.parse(storage.getItem(S.STORAGE_KEY));
    assert.equal(raw.memos.length, 2, '连续两次写均正常落盘');
    assert.equal(raw.memos[0].text, 'B');
    assert.equal(storage.getItem(S.STORAGE_META_KEY), s._meta, '落盘 meta 与实例一致');
    assert.ok(!seen.includes('/store/yielded'), '基线一致时不误报让位');
  } finally { clearLocks(); }
});

test('写锁：另一标签已写更新（meta 不一致）→ 让位不覆盖 + 吸收新快照 + 广播 all', async () => {
  const locks = makeLocks();
  installLocks(locks);
  const seen = installBus();
  try {
    const storage = memStorage();
    const s = S.createStore(storage);
    s.addMemo('本标签旧数据'); /* 构造后本标签基于旧快照修改 */
    assert.equal(queued.filter(Boolean).length, 1);
    /* 模拟另一标签抢先写入：meta 变为其他值，data 为更新快照 */
    const otherState = JSON.parse(JSON.stringify(s.state));
    otherState.memos.unshift({ id: 'other-1', text: '另一标签新数据', time: '2026-08-16T00:00:00.000Z', archived: false });
    storage.setItem(S.STORAGE_META_KEY, 'META-OTHER');
    storage.setItem(S.STORAGE_KEY, JSON.stringify(otherState));
    runQueued();
    await tick(); /* 吸收/广播在微任务中完成 */
    /* 本标签旧快照未被覆盖：storage 仍为另一标签的更新数据 */
    const stored = JSON.parse(storage.getItem(S.STORAGE_KEY));
    assert.equal(stored.memos[0].text, '另一标签新数据', '让位：不得用旧快照覆盖更新数据');
    assert.equal(storage.getItem(S.STORAGE_META_KEY), 'META-OTHER', 'meta 不被回写');
    assert.equal(s.state.memos[0].text, '另一标签新数据', '内存同步为新快照');
    assert.ok(seen.includes('/data/all'), '让位触发全量重绘广播');
    assert.ok(seen.includes('/store/yielded'), '让位触发接管提示事件（UI 弹 toast）');
    assert.equal(s._rev, 2, '吸收新快照 rev 递增');
  } finally { clearLocks(); }
});

test('写锁：锁异常（request reject）→ 降级直接落盘，数据不丢', async () => {
  const locks = makeLocks({ reject: true });
  installLocks(locks);
  try {
    const storage = memStorage();
    const s = S.createStore(storage);
    s.addMemo('异常降级');
    runQueued();
    await tick(); /* p.catch(fallback) 在微任务中执行 */
    const raw = JSON.parse(storage.getItem(S.STORAGE_KEY));
    assert.equal(raw.memos.length, 1, '锁不可用时直接落盘（可用性优先）');
  } finally { clearLocks(); }
});

test('写锁：无 navigator.locks 环境 → 直接落盘（等价旧行为）', () => {
  clearLocks();
  const storage = memStorage();
  const s = S.createStore(storage);
  s.addMemo('无锁环境');
  runQueued();
  const raw = JSON.parse(storage.getItem(S.STORAGE_KEY));
  assert.equal(raw.memos.length, 1, '无锁直接落盘');
  assert.ok(storage.getItem(S.STORAGE_META_KEY), 'meta 一并写入');
});

/* ====== 加密态写锁（ADR-007 边界更新：_encSave 经 _lockedEncWrite 纳入让位协议） ======
 * 用真加密引擎（Node webcrypto）驱动：enableEncryption 派生密钥并落盘密文基线，
 * 另一标签的"更新快照"用同一盐+密码手工加密构造（闭环验证让位时不覆盖密文）。 */
const CRYPTO = require('../js/encryption.js');
const PWD = 'sonder-lock-2026';
const SALT_KEY = 'sonder_encsalt_v1';

function encRaw(storage) {
  const raw = storage.getItem(S.STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

/* 用存储中的盐 + 密码派生密钥，把 state 加密成可放回 STORAGE_KEY 的密文 payload（模拟另一标签落盘） */
async function encryptState(storage, state) {
  const salt = CRYPTO.b64ToBytes(storage.getItem(SALT_KEY));
  const key = await CRYPTO.deriveKey(PWD, salt);
  const bundle = await CRYPTO.encryptText(JSON.stringify(state), key);
  return JSON.stringify({ e: 1, v: bundle.v, iv: bundle.iv, data: bundle.data });
}

async function decryptState(storage) {
  const raw = encRaw(storage);
  const salt = CRYPTO.b64ToBytes(storage.getItem(SALT_KEY));
  const key = await CRYPTO.deriveKey(PWD, salt);
  return JSON.parse(await CRYPTO.decryptBundle(raw, key));
}

test('加密态写锁：锁内 meta 一致 → 正常加密落盘，不误报让位', async () => {
  const locks = makeLocks();
  installLocks(locks);
  const seen = installBus();
  try {
    const storage = memStorage();
    const s = S.createStore(storage);
    s.addMemo('明文基线'); /* 先以明文落盘建立基线 */
    runQueued();
    await s.enableEncryption(PWD); /* 加密切换：锁内检查通过 → 落盘密文（ADR-007 边界已纳入） */
    assert.equal(encRaw(storage).e, 1, '启用后为密文');

    s.addMemo('加密后新数据'); /* 加密态 save → _encSave → 锁内再次检查 */
    await s._encChain;
    await tick();

    assert.ok(!seen.includes('/store/yielded'), 'meta 一致不误报让位');
    const dec = await decryptState(storage);
    assert.ok(dec.memos.some(m => m.text === '加密后新数据'), '加密态新数据已落盘');
    assert.ok(dec.memos.some(m => m.text === '明文基线'), '旧数据保留');
    assert.equal(storage.getItem(S.STORAGE_META_KEY), s._meta, '落盘 meta 与实例一致');
    assert.equal(s._lastSeenMeta, s._meta, '基线同步为最新 meta');
  } finally { clearLocks(); }
});

test('加密态写锁：另一标签已写更新密文（meta 不一致）→ 让位不覆盖 + 吸收 + 广播', async () => {
  const locks = makeLocks();
  installLocks(locks);
  const seen = installBus();
  try {
    const storage = memStorage();
    const s = S.createStore(storage);
    s.addMemo('本标签旧数据');
    runQueued(); /* 明文基线 */
    await s.enableEncryption(PWD); /* 加密基线：_lastSeenMeta = 本标签加密 meta */
    const baselineMeta = storage.getItem(S.STORAGE_META_KEY);
    assert.ok(baselineMeta, '加密基线 meta 已写');

    /* 模拟另一标签使用同一密码写入更新密文快照 */
    const otherState = JSON.parse(JSON.stringify(s.state));
    otherState.memos.unshift({ id: 'other-1', text: '另一标签新数据', time: '2026-08-16T00:00:00.000Z', archived: false });
    storage.setItem(S.STORAGE_META_KEY, 'META-OTHER');
    storage.setItem(S.STORAGE_KEY, await encryptState(storage, otherState));

    s.addMemo('本标签新输入'); /* 触发加密 save：锁内检查发现外部已写 → 让位 */
    await s._encChain;
    await tick();

    assert.ok(seen.includes('/store/yielded'), '加密态让位触发接管提示事件');
    assert.ok(seen.includes('/data/all'), '吸收新快照触发全量重绘广播');
    assert.equal(storage.getItem(S.STORAGE_META_KEY), 'META-OTHER', 'meta 不被回写');
    const dec = await decryptState(storage);
    assert.equal(dec.memos[0].text, '另一标签新数据', '让位：密文快照未被本标签旧数据覆盖');
    assert.ok(!dec.memos.some(m => m.text === '本标签新输入'), '本次未落盘（让位放弃）');
    assert.equal(s.state.memos[0].text, '另一标签新数据', '内存同步为新密文快照（吸收解密）');
    assert.equal(s._rev, 4, '吸收新快照 rev 递增');
  } finally { clearLocks(); }
});

test('加密态写锁：无 navigator.locks → 降级直接落盘（等价旧行为）', async () => {
  clearLocks();
  const storage = memStorage();
  const s = S.createStore(storage);
  s.addMemo('无锁加密基线');
  runQueued();
  await s.enableEncryption(PWD);
  s.addMemo('无锁加密新数据');
  await s._encChain;
  await tick();
  const dec = await decryptState(storage);
  assert.equal(encRaw(storage).e, 1, '仍为密文');
  assert.ok(dec.memos.some(m => m.text === '无锁加密新数据'), '无锁环境加密态直接落盘');
});