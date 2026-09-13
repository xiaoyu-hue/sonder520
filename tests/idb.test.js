'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');
const { boot, waitFor } = require('./harness.js');
const S = require('../js/store.js');

/* 集合级持久化：LS 回填/写入按集合 key 断言（旧整份 STORAGE_KEY 仅 legacy 迁移源） */
const COL = id => 'sonder_col_' + id + '_v1';

const withIdb = (f, seed) => Object.assign({ idb: f, idbKeyRange: IDBKeyRange }, seed ? { seed } : {});

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
  assert.ok(h2.store._storage.getItem(COL('memos')), 'IDB 恢复后应回写 localStorage');
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
  const raw = JSON.parse(h.window.localStorage.getItem(COL('settings')));
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
  await waitFor(() => {
    const t = h1.window.document.querySelector('#toastWrap');
    return !!t && /已迁移至 IndexedDB/.test(t.textContent || '');
  }, 'IDB 迁移完成');

  const h2 = boot(withIdb(f));
  assert.equal(await h2.hooks.idbReady, true, '迁移后的数据应能从 IDB 恢复');
  assert.equal(h2.store.state.memos[0].text, '待迁移');
});

/* F-8 回归：浏览器回收 IDB 连接（onclose）后，壁纸写入（走 idbReady 单例连接）
 * 必须自动重开连接，不能静默失败直到用户刷新。通过包装 f.open 收集连接并主动 close 模拟回收。 */
test('IndexedDB：连接被回收（onclose）后壁纸写入自动重开连接（F-8）', async () => {
  const f = new IDBFactory();
  const opened = [];
  const origOpen = f.open.bind(f);
  f.open = function (name, ver) {
    const req = origOpen(name, ver);
    req.addEventListener('success', () => opened.push(req.result));
    return req;
  };
  const h1 = boot(withIdb(f));
  await h1.hooks.idbReady;
  h1.store.setCustomWallpaper('data:image/png;base64,AAAA');
  /* 等壁纸连接真正建立（loadIdb 的 open + idbReady 的 open），
   * 确保 close 前缓存连接已就绪——否则 close 发生在连接建立前会掩盖 bug */
  await waitFor(() => opened.length >= 2, '壁纸连接应建立（loadIdb + idbReady），实际 ' + opened.length);
  assert.equal(h1.store.getCustomWallpaper(), 'data:image/png;base64,AAAA');

  /* 模拟浏览器回收：关闭连接使其实质失效（关闭连接上开事务抛 InvalidStateError），
   * 再 fire onclose——fake-indexeddb 的 close() 不自动派发该事件，
   * 真实浏览器会在连接被回收（内存压力）时派发，测试手动驱动修复逻辑 */
  const closedCount = opened.length; /* close 前基线：后续必须出现新连接 */
  opened.slice().forEach(db => {
    try { db.close(); } catch (e) { /* 已关闭忽略 */ }
    if (typeof db.onclose === 'function') db.onclose(); /* F-8：触发单例重置 */
  });

  h1.store.setCustomWallpaper('data:image/png;base64,BBBB');
  await waitFor(() => opened.length > closedCount,
    '回收后应重新打开连接（基线 ' + closedCount + '，实际 ' + opened.length + '）');

  const h2 = boot(withIdb(f));
  await waitFor(() => h2.store.getCustomWallpaper() === 'data:image/png;base64,BBBB',
    '回收后的壁纸写入应落盘并被新实例恢复（修复前旧连接写入静默失败，此处仍是 AAAA）');
});

/* F-4 回归：导入必须等"本次" IDB 写链真正完成（真实 Web Locks 回调异步，
 * save() 同步返回时新链尚未挂到 _idbPromise——旧实现 await 到旧链，resolve 后
 * 立即刷新会丢刚导入的数据）。用异步回调的 locks mock 复现该时序。 */
test('导入：resolve 时本次 IDB 写入必须已真正完成（异步写锁时序，F-4）', async () => {
  const f = new IDBFactory();
  const h1 = boot(withIdb(f));
  h1.store.addTask({ title: '导入目标-F4', date: '2026-09-13' });
  await h1.store._idbPromise; /* 让 h1 数据落盘 */

  const json = h1.store.exportBackup();
  const h2 = boot(withIdb(f));
  await h2.hooks.idbReady;

  /* store.js 在 window 上下文读取 window.navigator.locks；装异步回调锁复现真实时序 */
  let lockCalls = 0;
  const locks = {
    request(name, cb) {
      /* 模拟真实 Web Locks：回调在后续任务执行（与同步 mock 的关键差异） */
      return new Promise(resolve => setImmediate(() => { lockCalls++; cb(); resolve(); }));
    }
  };
  Object.defineProperty(h2.window.navigator, 'locks', { value: locks, configurable: true });
  try {
    const r = await h2.store.importBackup(json);
    assert.equal(r.ok, true);
    /* 关键断言（微任务级，无宏任务间隙）：resolve 时本次写锁回调必须已执行。
     * 旧实现只 await 旧链，resolve 时 save() 的锁回调尚未运行（此处 lockCalls=0）。 */
    assert.ok(lockCalls >= 2, 'resolve 时写锁回调应已执行（save 落盘 + 确认写），实际 ' + lockCalls);
    /* 端到端：IDB 主快照立即可见导入数据（readSnapshot 的 open 会排空宏任务，
     * 此时写早已完成；真正被上面的 lockCalls 断言拦截的是"过早 resolve"） */
    const snap = await h2.store.readSnapshot('idb');
    assert.ok(snap && Array.isArray(snap.tasks) && snap.tasks.some(t => t.title === '导入目标-F4'),
      '导入 resolve 后 IDB 主快照应立即可见导入数据（snap.tasks=' + JSON.stringify(snap && snap.tasks) + '）');
  } finally {
    delete h2.window.navigator.locks;
  }
});