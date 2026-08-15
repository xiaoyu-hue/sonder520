'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const S = require('../js/store.js');

const KEY = 'sonder_data_v1';
const SALT_KEY = 'sonder_encsalt_v1';
const PWD = 'sonder-2026-强密码';

function memStorage(initial) {
  const d = Object.assign({}, initial);
  return {
    _data: d,
    getItem: k => (k in d ? d[k] : null),
    setItem: (k, v) => { d[k] = String(v); },
    removeItem: k => { delete d[k]; }
  };
}

function seeded(tasks) {
  const st = memStorage();
  const s = S.createStore(st);
  (tasks || ['任务甲', '任务乙']).forEach(t => s.addTask({ title: t, priority: '高' }));
  s.addMemo('机密备忘内容');
  return { st, s };
}

test('启用加密：主存储变为密文，盐独立存放，快照不含明文', async () => {
  const { st, s } = seeded();
  await assert.doesNotReject(() => s.enableEncryption(PWD));
  const raw = JSON.parse(st._data[KEY]);
  assert.equal(raw.e, 1, '应存为密文格式');
  assert.equal(raw.v, 'sonder-enc-v1');
  assert.ok(raw.iv && raw.data, '应含 IV 与密文');
  assert.ok(!st._data[KEY].includes('任务甲'), '密文不得包含明文');
  assert.ok(st._data[SALT_KEY], '盐应独立明文存储');
  const salt = atob(st._data[SALT_KEY]);
  assert.equal(salt.length, 16, '盐应为 16 字节');
});

test('启用后新实例需解锁，解锁前数据不可见', () => {
  const { st } = seeded();
  const s1 = S.createStore(st);
  return s1.enableEncryption(PWD).then(() => {
    const s2 = S.createStore(st);
    assert.equal(s2.needsUnlock(), true, '应判定需解锁');
    assert.equal(s2.encryptionMode(), 'locked');
    assert.equal(s2.state.tasks.length, 0, '锁定态不得暴露数据');
    return s2.unlock(PWD);
  }).then(ok => {
    assert.equal(ok, true, '正确密码应解锁');
  });
});

test('解锁：错误密码失败且快照完好，正确密码数据一致', async () => {
  const { st, s } = seeded(['A1', 'B2']);
  await s.enableEncryption(PWD);
  const before = st._data[KEY];
  const s2 = S.createStore(st);
  assert.equal(await s2.unlock('错误密码'), false, '错密码应失败');
  assert.equal(st._data[KEY], before, '错密码不得破坏快照');
  assert.equal(s2.state.tasks.length, 0, '解锁失败后仍不可见数据');
  assert.equal(await s2.unlock(PWD), true);
  assert.deepEqual(s2.state.tasks.map(t => t.title), ['A1', 'B2'], '解锁后数据完整');
  assert.ok(s2.state.memos[0].text.includes('机密'), '备忘完整');
});

test('解锁后修改数据：落盘仍为密文，且新实例可解锁读取', async () => {
  const { st, s } = seeded();
  await s.enableEncryption(PWD);
  await s.unlock(PWD);
  s.addTask({ title: '新任务C', priority: '低' });
  await new Promise(r => setTimeout(r, 50));
  const raw = JSON.parse(st._data[KEY]);
  assert.equal(raw.e, 1, '修改后仍为密文');
  assert.ok(!st._data[KEY].includes('新任务C'), '密文不含新增明文');
  const s2 = S.createStore(st);
  assert.equal(s2.needsUnlock(), true);
  await s2.unlock(PWD);
  assert.ok(s2.state.tasks.some(t => t.title === '新任务C'), '新增数据可解锁读取');
});

test('停用加密：密码正确转回明文并清盐，数据完好', async () => {
  const { st, s } = seeded(['甲', '乙']);
  await s.enableEncryption(PWD);
  await assert.rejects(() => s.disableEncryption('错误密码'), '错密码应拒绝停用');
  assert.ok(JSON.parse(st._data[KEY]).e === 1, '错密码后仍为密文');
  await assert.doesNotReject(() => s.disableEncryption(PWD));
  assert.equal(JSON.parse(st._data[KEY]).e, undefined, '停用后应为明文');
  assert.equal(st._data[SALT_KEY], undefined, '盐应清除');
  assert.ok(st._data[KEY].includes('甲'), '明文可读');
  const s2 = S.createStore(st);
  assert.equal(s2.needsUnlock(), false, '停用后无需解锁');
  assert.equal(s2.state.tasks.length, 2);
});

test('启用加密：自检前置校验，弱密码被拒绝且明文快照保留', async () => {
  const { st, s } = seeded(['原数据']);
  await assert.rejects(() => s.enableEncryption('ab'), /至少 4 位/);
  assert.ok(st._data[KEY].includes('原数据'), '明文快照应原样保留');
  assert.equal(st._data[SALT_KEY], undefined, '不应残留盐');
  assert.equal(s.needsUnlock(), false);
});

test('导出/导入：加密备份导出为密文包，密码导入成功、错密码拒绝且原数据不动', async () => {
  const { s } = seeded(['甲', '乙']);
  await s.enableEncryption(PWD);
  await s.unlock(PWD);
  const pkgText = await s.exportBackup();
  assert.equal(typeof pkgText, 'string');
  const pkg = JSON.parse(pkgText);
  assert.equal(pkg.format, 'sonder-enc-backup-v1');
  assert.ok(pkg.salt && pkg.iv && pkg.data, '备份包应含盐/IV/密文');
  assert.ok(!pkgText.includes('甲'), '备份包不得含明文');

  const st2 = memStorage();
  const s2 = S.createStore(st2);
  s2.addTask({ title: '本地原数据', priority: '中' });
  const bad = await s2.importBackup(pkgText, '错的密码');
  assert.equal(bad.ok, false, '错密码应拒绝');
  assert.ok(st2._data[KEY].includes('本地原数据'), '导入失败不得动原数据');
  const good = await s2.importBackup(pkgText, PWD);
  assert.equal(good.ok, true, '正确密码应导入');
  assert.deepEqual(s2.state.tasks.map(t => t.title), ['甲', '乙']);
  assert.equal(await s2.importBackup(JSON.stringify({ format: 'sonder-enc-backup-v1', salt: '!!!', iv: 'x', data: 'y' }), PWD).then(r => r.ok), false, '损坏备份应被拒绝');
  assert.equal(await s2.importBackup(pkgText).then(r => r.ok), false, '缺密码应被拒绝');
});

test('IndexedDB 兜底：localStorage 被清后仍可从 IDB 密文与冗余盐恢复', async () => {
  const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');
  const f = new IDBFactory();
  globalThis.indexedDB = f;
  globalThis.IDBKeyRange = IDBKeyRange;
  try {
    const st = memStorage();
    const s1 = S.createStore(st);
    s1.addTask({ title: 'IDB恢复任务', priority: '高' });
    await s1.enableEncryption(PWD);
    await s1._idbPromise;
    /* 模拟 localStorage 被完全清空：全新 localStorage + 同一 IDB */
    const st2 = memStorage();
    const s2 = S.createStore(st2);
    assert.equal(s2.needsUnlock(), false, 'localStorage 空时先不判定锁定');
    assert.equal(await s2.loadIdb(), false, '未解锁时不应采用 IDB 数据');
    assert.equal(s2.needsUnlock(), true, '探测到 IDB 密文后应判定需解锁');
    assert.equal(await s2.unlock(PWD), true, '应能从 IDB 恢复');
    assert.deepEqual(s2.state.tasks.map(t => t.title), ['IDB恢复任务']);
    assert.ok(st2._data[KEY], '恢复后应回写 localStorage 密文');
  } finally {
    delete globalThis.indexedDB;
    delete globalThis.IDBKeyRange;
  }
});

test('锁定态守卫：lock 后残留 save 不得明文覆盖密文', async () => {
  const { st, s } = seeded(['A1', 'B2']);
  await s.enableEncryption(PWD);
  s.lock();
  /* 模拟锁定后残留定时器/异步回调触发保存（内部 save 应被守卫拦截） */
  s.addTask({ title: '锁定后新增', priority: '高' });
  const raw = JSON.parse(st._data[KEY]);
  assert.equal(raw.e, 1, '落盘仍为密文');
  assert.ok(!st._data[KEY].includes('锁定后新增'), '明文不得落盘');
  const s2 = S.createStore(st);
  assert.equal(s2.needsUnlock(), true, '加密未被静默解除');
  assert.equal(await s2.unlock(PWD), true, '应可解锁');
  assert.equal(s2.state.tasks.length, 2, '落盘数据未被锁定态写入污染');
});

test('锁定态导入明文备份被拒绝，原密文完好', async () => {
  const { st } = seeded(['A1']);
  const s1 = S.createStore(st);
  await s1.enableEncryption(PWD);
  const before = st._data[KEY];
  const s2 = S.createStore(st);
  assert.equal(s2.needsUnlock(), true, '新实例应为锁定态');
  const r = await s2.importBackup(JSON.stringify(S.defaultState()));
  assert.equal(r.ok, false, '锁定态导入应被拒绝');
  assert.equal(st._data[KEY], before, '密文快照原样保留');
});

test('加密解锁态导入明文备份：落盘保持密文不变量', async () => {
  const { st, s } = seeded(['A1']);
  await s.enableEncryption(PWD);
  const st2 = S.defaultState();
  st2.memos = [{ id: 'x1', text: '导入的新数据', time: '', archived: false }];
  const r = await s.importBackup(JSON.stringify(st2));
  assert.equal(r.ok, true, '解锁态应允许导入');
  await s._encChain;
  const raw = JSON.parse(st._data[KEY]);
  assert.equal(raw.e, 1, '导入后落盘仍为密文');
  assert.ok(!st._data[KEY].includes('导入的新数据'), '明文不得出现在落盘');
  const s2 = S.createStore(st);
  assert.equal(await s2.unlock(PWD), true);
  assert.equal(s2.state.memos[0].text, '导入的新数据', '数据已导入且保持加密');
});

test('加密态 migrateToIdb：IDB 兜底必须为密文（新实例恢复后处于锁定态）', async () => {
  const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');
  const f = new IDBFactory();
  globalThis.indexedDB = f;
  globalThis.IDBKeyRange = IDBKeyRange;
  try {
    const st = memStorage();
    const s1 = S.createStore(st);
    s1.addTask({ title: '机密迁移任务', priority: '高' });
    await s1.enableEncryption(PWD);
    assert.equal(await s1.migrateToIdb(), true, '迁移应成功');
    await s1._encChain;
    await s1._idbPromise;
    const st2 = memStorage();
    const s2 = S.createStore(st2);
    assert.equal(await s2.loadIdb(), false, '未解锁时不应采用 IDB 数据');
    assert.equal(s2.needsUnlock(), true, 'IDB 兜底为密文 → 新实例应处于锁定态');
    assert.equal(await s2.unlock(PWD), true, '应能解锁恢复');
    assert.deepEqual(s2.state.tasks.map(t => t.title), ['机密迁移任务'], '迁移数据完整');
  } finally {
    delete globalThis.indexedDB;
    delete globalThis.IDBKeyRange;
  }
});

test('加密格式韧性：未来版本密文（v2）不按明文解析、不落盘，数据原样保留', async () => {
  const { st, s } = seeded(['A1', 'B2']);
  await s.enableEncryption(PWD);
  /* 篡改为未来版本格式（模拟升级后旧客户端遇到新格式） */
  const raw = JSON.parse(st._data[KEY]);
  raw.v = 'sonder-enc-v2';
  const rawV2 = JSON.stringify(raw);
  st._data[KEY] = rawV2;
  const s3 = S.createStore(st);
  assert.equal(s3.needsUnlock(), true, 'v2 密文应判定需解锁而非解析成空明文');
  s3.addTask({ title: '锁定后新增', priority: '高' });
  assert.ok(st._data[KEY].includes('sonder-enc-v2'), '锁定态写入不得落盘（未破坏 v2 密文）');
  assert.ok(!st._data[KEY].includes('锁定后新增'), '明文不得落盘');
});

test('_idbWrite 空参守卫：拒绝 undefined/null，绝不回退内存序列化', async () => {
  const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');
  const f = new IDBFactory();
  globalThis.indexedDB = f;
  globalThis.IDBKeyRange = IDBKeyRange;
  try {
    const st = memStorage();
    const s = S.createStore(st);
    s.state.memos.push({ id: 'x1', text: '内存明文', time: '', archived: false });
    s._idbWrite(undefined);
    s._idbWrite(null);
    s._idbWrite('');
    await s._idbPromise;
    const s2 = S.createStore(st);
    assert.equal(await s2.loadIdb(), false, '空参不应写入任何 IDB 数据');
    assert.equal(s2.state.memos.length, 0, '内存明文不得借道 IDB 进入存储');
  } finally {
    delete globalThis.indexedDB;
    delete globalThis.IDBKeyRange;
  }
});

test('锁定态 migrateToIdb 被拒绝：不得以明文空数据覆盖 IDB 密文兜底', async () => {
  const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');
  const f = new IDBFactory();
  globalThis.indexedDB = f;
  globalThis.IDBKeyRange = IDBKeyRange;
  try {
    const st = memStorage();
    const s1 = S.createStore(st);
    s1.addTask({ title: '机密迁移任务', priority: '高' });
    await s1.enableEncryption(PWD);
    await s1._idbPromise;
    s1.lock();
    assert.equal(await s1.migrateToIdb(), false, '锁定态迁移应被拒绝');
    assert.equal(await s1.unlock(PWD), true, '密文兜底未被覆盖，仍可解锁');
    assert.deepEqual(s1.state.tasks.map(t => t.title), ['机密迁移任务'], '数据完整');
    assert.equal(await s1.migrateToIdb(), true, '解锁后迁移恢复正常');
  } finally {
    delete globalThis.indexedDB;
    delete globalThis.IDBKeyRange;
  }
});

test('加密态导入：importBackup 完成即落盘，不依赖调用方再等待 _encChain', async () => {
  const { st, s } = seeded(['A1']);
  await s.enableEncryption(PWD);
  const before = st._data[KEY];
  const st2 = S.defaultState();
  st2.memos = [{ id: 'x1', text: '导入即落盘', time: '', archived: false }];
  const r = await s.importBackup(JSON.stringify(st2));
  assert.equal(r.ok, true, '导入应成功');
  assert.notEqual(st._data[KEY], before, 'resolve 时落盘必须已更新（不许 fire-and-forget）');
  const raw = JSON.parse(st._data[KEY]);
  assert.equal(raw.e, 1, '落盘为密文格式');
  assert.ok(!st._data[KEY].includes('导入即落盘'), '明文不得出现在落盘');
  const s3 = S.createStore(st);
  assert.equal(await s3.unlock(PWD), true, '新实例可解锁');
  assert.equal(s3.state.memos[0].text, '导入即落盘', '导入数据已可恢复');
});

test('轻量密文探测：needsUnlock 语义与 JSON.parse 一致（save 热路径优化不回归）', () => {
  /* 本站密文 payload 固定格式 {"e":1,...}，探测用正则免全量 parse。以下覆盖判定边界 */
  const st = memStorage();
  st.setItem(KEY, JSON.stringify({ memos: [{ id: 'a', text: '明文', time: '', archived: false }], tasks: [] }));
  let s = S.createStore(st);
  assert.equal(s.needsUnlock(), false, '普通明文快照不应判定锁定');
  /* 密文标准格式 */
  st.setItem(KEY, '{"e":1,"v":"sonder-enc-v1","iv":"abc","data":"xyz"}');
  s = S.createStore(st);
  assert.equal(s.needsUnlock(), true, '密文快照应判定锁定');
  /* 未来版本密文：v 不同但 e:1 仍在 → 同样判定锁定（韧性不回归） */
  st.setItem(KEY, '{"e":1,"v":"sonder-enc-v2","iv":"abc","data":"xyz"}');
  s = S.createStore(st);
  assert.equal(s.needsUnlock(), true, 'v2 密文应判定锁定');
  /* 空白容忍（防御手写/压缩工具产生的空格） */
  st.setItem(KEY, '{ "e" : 1 , "v" : "sonder-enc-v1" , "iv" : "a" , "data" : "b" }');
  s = S.createStore(st);
  assert.equal(s.needsUnlock(), true, '带空白密文应判定锁定');
  /* 顶层 e 非 1（明文数据防御：绝不误判） */
  st.setItem(KEY, JSON.stringify({ e: 0, memos: [] }));
  s = S.createStore(st);
  assert.equal(s.needsUnlock(), false, 'e 非 1 不应判定锁定');
  /* 顶层首个键是 e 值非数字字符串（如普通数据键恰好以 e 开头——实际键集无 e，防御性验证正则不误伤） */
  st.setItem(KEY, JSON.stringify({ email: 'a@b.c', memos: [] }));
  s = S.createStore(st);
  assert.equal(s.needsUnlock(), false, 'email 键不得误判为密文');
});