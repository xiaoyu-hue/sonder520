'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');
const { boot } = require('./harness.js');
const S = require('../js/store.js');

const withIdb = (f, seed) => Object.assign({ idb: f, idbKeyRange: IDBKeyRange }, seed ? { seed } : {});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('IndexedDB：无 IDB 环境安全降级（loadIdb 返回 false，保存不报错）', async () => {
  const h = boot();
  assert.equal(await h.store.loadIdb(), false, '无 IDB 时 loadIdb 应为 false');
  h.store.addMemo('正常保存');
  assert.equal(h.store.state.memos.length, 1);
  assert.equal(typeof h.store.storageUsage(), 'number');
});

test('IndexedDB：保存双写落盘，换环境可从 IDB 完整恢复', async () => {
  const f = new IDBFactory();
  const h1 = boot(withIdb(f));
  h1.store.addMemo('第一条备忘');
  h1.store.addTask({ title: '任务甲', date: '2026-08-10' });
  await h1.store._idbPromise;

  const h2 = boot(withIdb(f)); // 全新 localStorage，仅靠 IDB
  const applied = await h2.hooks.idbReady;
  assert.equal(applied, true, '应采用 IDB 数据');
  assert.equal(h2.store.state.memos[0].text, '第一条备忘');
  assert.equal(h2.store.state.tasks[0].title, '任务甲');
  assert.ok(h2.store._storage.getItem(S.STORAGE_KEY), 'IDB 恢复后应回写 localStorage');
});

test('IndexedDB：localStorage 有数据而 IDB 为空时，自动回填 IDB', async () => {
  const f = new IDBFactory();
  const seed = S.defaultState();
  seed.memos = [{ id: 'm1', text: '旧数据', time: '', archived: false }];
  const h1 = boot(withIdb(f, seed));
  assert.equal(await h1.hooks.idbReady, false, 'IDB 空时不应采用 IDB 数据');
  assert.equal(h1.store.state.memos[0].text, '旧数据');
  await h1.store._idbPromise; // 回填完成

  const h2 = boot(withIdb(f));
  assert.equal(await h2.hooks.idbReady, true, '回填后应能从 IDB 恢复');
  assert.equal(h2.store.state.memos[0].text, '旧数据');
});

test('IndexedDB：localStorage 较新时不回退，且把 IDB 追平', async () => {
  const f = new IDBFactory();
  const seedA = S.defaultState();
  seedA.memos = [{ id: 'm1', text: 'IDB 旧数据', time: '', archived: false }];
  const h1 = boot(withIdb(f, seedA));
  await h1.hooks.idbReady;
  await h1.store._idbPromise;

  const seedB = S.defaultState();
  seedB.memos = [{ id: 'm2', text: 'localStorage 新数据', time: '', archived: false }];
  const h2 = boot({ seed: seedB }); // 不挂 IDB，避开启动自动加载
  h2.window.indexedDB = f;
  h2.window.IDBKeyRange = IDBKeyRange;
  h2.window.localStorage.setItem(S.STORAGE_META_KEY, '2999-01-01T00:00:00.000Z');
  assert.equal(h2.store.state.memos[0].text, 'localStorage 新数据');
  assert.equal(await h2.store.loadIdb(), false, 'localStorage 更新时不应回退');
  assert.equal(h2.store.state.memos[0].text, 'localStorage 新数据');
  await h2.store._idbPromise;

  const h3 = boot(withIdb(f));
  assert.equal(await h3.hooks.idbReady, true);
  assert.equal(h3.store.state.memos[0].text, 'localStorage 新数据', 'IDB 应被追平为新数据');
});

test('存储占用：storageUsage 反映真实体积，超 4.5MB 显示警示条并可持续关闭', () => {
  const seed = S.defaultState();
  seed.tasks = Array.from({ length: 56 }, (_, i) => ({
    id: 't' + i, title: '任务' + i + '，' + 'x'.repeat(88000), note: '', date: '2026-08-10',
    priority: '中', done: false, order: i
  }));
  const h = boot({ seed });
  const usage = h.store.storageUsage();
  assert.ok(usage > 4.5 * 1024 * 1024, '构造数据应超过软限（实际 ' + usage + ' 字节）');
  assert.ok(usage < 5 * 1024 * 1024, '构造数据不应超过浏览器 5MB 硬限（实际 ' + usage + ' 字节）');
  h.goto('home');
  const bar = h.$('#quotaBar');
  assert.ok(bar, '警示条元素应存在');
  assert.equal(bar.hidden, false, '超限时应显示警示条');
  const shown = bar.querySelector('.qb-usage').textContent;
  assert.ok(parseFloat(shown) > 4, '应显示实际占用 MB：' + shown);
  assert.ok(h.$$('#quotaBar a.qb-link').length >= 2, '应有导出备份与迁移两个动作');
  h.$('#qClose').click();
  assert.equal(bar.hidden, true, '关闭后应隐藏');
  assert.equal(h.store.state.settings.quotaNoticeDismissed, true, '应持久化关闭选择');
  const raw = JSON.parse(h.window.localStorage.getItem(S.STORAGE_KEY));
  assert.equal(raw.settings.quotaNoticeDismissed, true, '关闭状态应写入存储');
});

test('存储占用：已关闭提醒后重启不再显示', () => {
  const seed = S.defaultState();
  seed.settings.quotaNoticeDismissed = true;
  seed.tasks = Array.from({ length: 56 }, (_, i) => ({
    id: 't' + i, title: '任务' + i + '，' + 'y'.repeat(88000), note: '', date: '2026-08-10',
    priority: '中', done: false, order: i
  }));
  const h = boot({ seed });
  h.goto('home');
  assert.equal(h.$('#quotaBar').hidden, true, '已关闭提醒则不再显示');
});

test('IndexedDB：设置页提供手动迁移按钮，点击后数据进入 IDB', async () => {
  const f = new IDBFactory();
  const h1 = boot(withIdb(f));
  h1.store.addMemo('待迁移');
  h1.goto('settings');
  const btn = h1.$('#btnMigrateIdb');
  assert.ok(btn, '设置页应有迁移按钮');
  btn.click();
  await wait(60); // 等待 IDB 事务完成

  const h2 = boot(withIdb(f));
  assert.equal(await h2.hooks.idbReady, true, '迁移后的数据应能从 IDB 恢复');
  assert.equal(h2.store.state.memos[0].text, '待迁移');
});