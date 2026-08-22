'use strict';
/* Phase ④（ADR-014）IndexedDB 真源反转契约测试：
 * ① 载入冲突消解：savedAt 同刻平局 → IDB 胜；LS 严格更新 → LS 接管（回归语义）
 * ② 物理写序：IDB 主快照先行，LS 副本随后
 * 构造法：rawLS 直接注入集合级状态 + 预置 GRANULAR_FLAG 跳过构造期 legacy 拆分，
 * 排除 splitLegacy 对两侧时间戳的干扰——纯冲突场景。 */
const { test } = require('node:test');
const assert = require('node:assert');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');
const { boot } = require('./harness.js');
const S = require('../js/store.js');

const META = 'sonder_meta_v1';
const FLAG = 'sonder_granular_v1';
const COL = id => 'sonder_col_' + id + '_v1';
const TIE = '2026-08-22T00:00:00.000Z';

function granularLS(cols, meta) {
  const o = { [FLAG]: '1', [META]: meta };
  Object.keys(cols).forEach(k => { o[COL(k)] = JSON.stringify(cols[k]); });
  /* 其余集合给空数组，避免缺 key 回退 */
  S.defaultState();
  return o;
}

test('真源反转：savedAt 同刻平局 → IDB 版本胜出', async () => {
  const f = new IDBFactory();
  /* h1：以 TIE 为基线把 IDB 版内容写入主快照 */
  const h1 = boot({ idb: f, idbKeyRange: IDBKeyRange });
  await h1.hooks.idbReady;
  const s1 = h1.store;
  s1.state.memos = [{ id: 'idb-1', text: 'IDB版', time: '', archived: false }];
  s1._meta = TIE;
  await s1._storeWrite({ memos: JSON.stringify(s1.state.memos) }, { ls: 'immediate', idb: 'write' });
  await s1._idbPromise;

  /* h2：rawLS 注入同 meta 的冲突 LS 内容 + 旗标跳过 split */
  const seed = S.defaultState();
  seed.memos = [{ id: 'ls-1', text: 'LS版', time: '', archived: false }];
  const lsMap = granularLS({ memos: seed.memos }, TIE);
  /* 补齐其余集合空串，防 _readLocalColsRaw 视角缺 key */
  ['settings', 'tasks', 'posts', 'devProjects', 'devNotes', 'devSnippets', 'clients',
    'books', 'excerpts', 'news', 'designs', 'gameRecords', 'miniRecords']
    .forEach(k => { if (!(COL(k) in lsMap)) lsMap[COL(k)] = k === 'settings' ? JSON.stringify({ version: 1, settings: {} }) : '[]'; });

  const h2 = boot({ idb: f, idbKeyRange: IDBKeyRange, rawLS: lsMap });
  assert.equal(await h2.hooks.idbReady, true, '应采用 IDB 数据并重绘');
  assert.equal(h2.store.state.memos[0].text, 'IDB版',
    '平局必须取 IDB 主快照版本（ADR-014 核心断言）');
});

test('真源反转：LS 严格较新仍由 LS 接管', async () => {
  const f = new IDBFactory();
  const h1 = boot({ idb: f, idbKeyRange: IDBKeyRange });
  await h1.hooks.idbReady;
  const s1 = h1.store;
  s1.state.memos = [{ id: 'idb-old', text: 'IDB旧', time: '', archived: false }];
  s1._meta = '2026-08-22T00:00:00.000Z';
  await s1._storeWrite({ memos: JSON.stringify(s1.state.memos) }, { ls: 'immediate', idb: 'write' });
  await s1._idbPromise;

  const seed = S.defaultState();
  seed.memos = [{ id: 'ls-new', text: 'LS新', time: '', archived: false }];
  const lsMap = granularLS({ memos: seed.memos }, '2999-01-01T00:00:00.000Z');
  ['settings', 'tasks', 'posts', 'devProjects', 'devNotes', 'devSnippets', 'clients',
    'books', 'excerpts', 'news', 'designs', 'gameRecords', 'miniRecords']
    .forEach(k => { if (!(COL(k) in lsMap)) lsMap[COL(k)] = k === 'settings' ? JSON.stringify({ version: 1, settings: {} }) : '[]'; });

  const h2 = boot({ idb: f, idbKeyRange: IDBKeyRange, rawLS: lsMap });
  assert.equal(await h2.hooks.idbReady, false, 'LS 严格更新不视为采用 IDB');
  assert.equal(h2.store.state.memos[0].text, 'LS新');
});

test('物理写序：_storeWrite 双相位下 IDB 先于 LS 落盘', async () => {
  if (globalThis.navigator && 'locks' in globalThis.navigator) delete globalThis.navigator.locks;
  /* 桩化 idle API：模拟浏览器防抖路径（无 idle 的旧环境同步直写属兼容行为，
   * 不在 ADR-014 写序承诺范围内） */
  const realRIC = globalThis.requestIdleCallback;
  const realCIC = globalThis.cancelIdleCallback;
  globalThis.requestIdleCallback = fn => { return 1; };
  globalThis.cancelIdleCallback = () => {};

  const order = [];
  const storage = {
    getItem() { return null; },
    setItem(k) { order.push('ls:' + k); },
    removeItem() {}
  };
  const s = S.createStore(storage);
  s._idbWriteCols = function (map, extra) {
    order.push('idb');
    return S.Store.prototype._idbWriteCols.call(this, map, extra);
  };
  const map = { memos: JSON.stringify([{ id: 'o1', text: 't', time: '', archived: false }]) };
  await s._storeWrite(map, { ls: 'immediate', idb: 'write' });
  if (realRIC) globalThis.requestIdleCallback = realRIC; else delete globalThis.requestIdleCallback;
  if (realCIC) globalThis.cancelIdleCallback = realCIC; else delete globalThis.cancelIdleCallback;

  const iIdb = order.indexOf('idb');
  const iLs = order.findIndex(o => o.startsWith('ls:'));
  assert.ok(iIdb >= 0 && iLs >= 0, '双相位均已执行');
  assert.ok(iIdb < iLs, 'IDB 主快照必须先于 LS 副本（ADR-014）');
});
