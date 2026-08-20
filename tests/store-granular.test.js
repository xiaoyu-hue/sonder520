'use strict';
/* 集合级持久化契约（ADR-009 决策 7）：legacy 拆分、幂等、隔离、单集合写、加密、备份 */
const { test, after } = require('node:test');
const assert = require('node:assert');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');
const S = require('../js/store.js');

const COL = id => 'sonder_col_' + id + '_v1';
const FLAG = 'sonder_granular_v1';
const PWD = 'granular-2026-强密码';

function memStorage(initial) {
  const d = Object.assign({}, initial || {});
  return {
    _data: d,
    getItem: k => (k in d ? d[k] : null),
    setItem: (k, v) => { d[k] = String(v); },
    removeItem: k => { delete d[k]; }
  };
}

function withIdb() {
  globalThis.indexedDB = new IDBFactory();
  globalThis.IDBKeyRange = IDBKeyRange;
}
function noIdb() {
  delete globalThis.indexedDB;
  delete globalThis.IDBKeyRange;
}
after(() => { noIdb(); });

test('legacy 拆分：整份 seed 启动后集合 key 就位且旧 key 保留', async () => {
  withIdb();
  const st = memStorage();
  const whole = S.defaultState();
  whole.memos = [{ id: 'm1', text: '旧备忘', time: '', archived: false }];
  whole.tasks = [{ id: 't1', title: '旧任务', date: '2026-08-10', priority: 'p2', done: false, order: 0 }];
  st.setItem(S.STORAGE_KEY, JSON.stringify(whole));
  const s = S.createStore(st);
  assert.equal(s.state.memos[0].text, '旧备忘', '构造期仍可读 legacy 整份');
  await s.loadIdb();
  assert.equal(st.getItem(FLAG), '1', '应打集合化标记');
  assert.ok(st.getItem(S.STORAGE_KEY), '旧整份 key 保留不删');
  const memos = JSON.parse(st.getItem(COL('memos')));
  assert.equal(memos[0].text, '旧备忘');
  const tasks = JSON.parse(st.getItem(COL('tasks')));
  assert.equal(tasks[0].title, '旧任务');
  assert.ok(st.getItem(COL('settings')), 'settings 集合 key 应就位');
  assert.ok(st.getItem(COL('miniRecords')), 'miniRecords 集合 key 应就位');
});

test('legacy 拆分幂等：半成品重跑覆盖且标记后不再依赖整份', async () => {
  withIdb();
  const st = memStorage();
  const whole = S.defaultState();
  whole.memos = [{ id: 'm1', text: '一次', time: '', archived: false }];
  st.setItem(S.STORAGE_KEY, JSON.stringify(whole));
  const s1 = S.createStore(st);
  await s1.loadIdb();
  st.setItem(COL('memos'), JSON.stringify([{ id: 'm1', text: '半成品', time: '', archived: false }]));
  st.removeItem(FLAG);
  const s2 = S.createStore(st);
  await s2.loadIdb();
  assert.equal(s2.state.memos[0].text, '一次', '无标记时从整份重拆，覆盖半成品');
  assert.equal(st.getItem(FLAG), '1');
});

test('单集合损坏隔离：坏 JSON 不阻塞其余集合', () => {
  noIdb();
  const st = memStorage();
  st.setItem(COL('memos'), JSON.stringify([{ id: 'm1', text: '好', time: '', archived: false }]));
  st.setItem(COL('tasks'), '{not-json');
  st.setItem(COL('settings'), JSON.stringify({ version: 1, settings: { theme: 'dark', frameRate: 60, modules: {} } }));
  const s = S.createStore(st);
  assert.equal(s.state.memos[0].text, '好', '完好集合仍合并');
  assert.equal(s.state.tasks.length, 0, '坏集合保底空');
  assert.equal(s.state.settings.theme, 'dark', 'settings 不受邻集损坏影响');
});

test('单集合写入：只变更对应 LS key，其它集合原文不动', () => {
  noIdb();
  const st = memStorage();
  const s = S.createStore(st);
  s.addMemo('仅备忘');
  const beforeTasks = st.getItem(COL('tasks'));
  s.addTask({ title: '仅任务', date: '2026-08-19' });
  assert.equal(JSON.parse(st.getItem(COL('memos'))).length, 1);
  assert.equal(JSON.parse(st.getItem(COL('tasks')))[0].title, '仅任务');
  assert.notEqual(st.getItem(COL('tasks')), beforeTasks);
});

test('构造期直接读集合 key（不再误把 payload 当整份 state）', () => {
  noIdb();
  const st = memStorage();
  st.setItem(COL('memos'), JSON.stringify([{ id: 'm1', text: '集合直读', time: '', archived: false }]));
  st.setItem(COL('settings'), JSON.stringify({ version: 1, settings: { theme: 'light', frameRate: 60, modules: {} } }));
  const s = S.createStore(st);
  assert.equal(s.state.memos[0].text, '集合直读');
  assert.equal(s.state.settings.theme, 'light');
});

test('加密集合级：启用后各集合为密文，解锁合并正确', async () => {
  noIdb();
  const st = memStorage();
  const s = S.createStore(st);
  s.addMemo('机密G');
  s.addTask({ title: '密任', date: '2026-08-19' });
  await s.enableEncryption(PWD);
  const mRaw = JSON.parse(st.getItem(COL('memos')));
  const tRaw = JSON.parse(st.getItem(COL('tasks')));
  assert.equal(mRaw.e, 1);
  assert.equal(tRaw.e, 1);
  assert.ok(!st.getItem(COL('memos')).includes('机密G'));
  const s2 = S.createStore(st);
  assert.equal(s2.needsUnlock(), true);
  assert.equal(s2.state.memos.length, 0);
  assert.equal(await s2.unlock(PWD), true);
  assert.equal(s2.state.memos[0].text, '机密G');
  assert.equal(s2.state.tasks[0].title, '密任');
});

test('旧备份导入：整份 JSON → 集合级落盘 → 导出结构仍为整份 state', async () => {
  noIdb();
  const st = memStorage();
  const s = S.createStore(st);
  const backup = JSON.stringify(Object.assign(S.defaultState(), {
    memos: [{ id: 'm1', text: '备份备忘', time: '', archived: false }],
    version: 1
  }));
  const r = await s.importBackup(backup);
  assert.equal(r.ok, true);
  assert.equal(s.state.memos[0].text, '备份备忘');
  assert.equal(JSON.parse(st.getItem(COL('memos')))[0].text, '备份备忘');
  const exported = JSON.parse(s.exportBackup());
  assert.equal(exported.version, 1);
  assert.equal(exported.memos[0].text, '备份备忘');
  assert.ok(Array.isArray(exported.tasks), '导出仍为整份 state');
});

test('_commit 未知集合回落全量 save（防呆不丢数据）', () => {
  noIdb();
  const st = memStorage();
  const s = S.createStore(st);
  s.state.memos.push({ id: 'x', text: '漏网', time: '', archived: false });
  s._commit('not-a-collection');
  assert.ok(JSON.parse(st.getItem(COL('memos'))).some(m => m.text === '漏网'));
});
