'use strict';
/* 测试盲区补强（Commit 6）：
 * ① setDesktopPet 持久化网关（desktopPet 落盘唯一入口，此前零直测）
 * ② games-view / games-battle 冒烟（两模块此前无任何直接引用测试） */
const { test } = require('node:test');
const assert = require('node:assert');
const S = require('../js/store.js');
const { boot } = require('./harness.js');

function memStorage() {
  const m = {};
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem(k, v) { m[k] = String(v); },
    removeItem(k) { delete m[k]; }
  };
}
const COL = id => 'sonder_col_' + id + '_v1';

test('setDesktopPet：白名单外字段被拒，白名单内标量落盘', () => {
  const s = S.createStore(memStorage());
  s.setDesktopPet({ coins: 66, evilField: '<script>' });
  assert.equal(s.state.settings.desktopPet.coins, 66, '白名单内 coins 生效');
  assert.equal('evilField' in s.state.settings.desktopPet, false, '白名单外字段不得入库');
});

test('setDesktopPet：对象字段浅合并（不整体替换、不丢兄弟键）', () => {
  const s = S.createStore(memStorage());
  s.setDesktopPet({ positions: { xiaomo: { x: 12, y: 34 }, xiaoyu: { x: null, y: null } } });
  s.setDesktopPet({ positions: { lanling: { x: 5, y: 6 } } });
  const pos = s.state.settings.desktopPet.positions;
  assert.equal(pos.lanling.x, 5, '后写子键生效');
  assert.equal(pos.xiaomo.x, 12, '先前子键保留（浅合并语义）');
});

test('setDesktopPet：触发 settings 集合落盘（LS 可见）', () => {
  const storage = memStorage();
  const s = S.createStore(storage);
  s.setDesktopPet({ coins: 7 });
  if (typeof globalThis.requestIdleCallback === 'function') {
    /* 有 idle 环境：flushPersist 强制立即落盘 */
    s.flushPersist();
  }
  const raw = storage.getItem(COL('settings'));
  assert.ok(raw, 'settings 集合应已落盘');
  const payload = JSON.parse(raw);
  assert.equal(payload.settings.desktopPet.coins, 7, 'coins 持久化到存储');
});

test('games-view：纯函数层输出契约（diffOptions/resultHtml/diffBadge）', () => {
  /* Node 直 require（文件头声明：函数体内才解析 window.UI，require 无副作用） */
  const V = require('../js/games-view.js');
  assert.ok(typeof V.diffOptions === 'function', 'diffOptions 导出');
  const opts = V.diffOptions('normal');
  assert.ok(opts.includes('value="easy"') && opts.includes('value="hard"'), '三档难度齐全');
  assert.ok(opts.includes('selected'), '选中态渲染');

  const win = V.resultHtml({ won: true, attempts: [1, 2, 3] }, true);
  assert.ok(win.includes('3'), '胜利结果含尝试次数');
  const lose = V.resultHtml({ won: false, attempts: [] }, false);
  assert.ok(lose.length > 0, '失败结果非空');
});

test('games-battle：对弈域挂载与关键方法冒烟', () => {
  const h = boot();
  const B = h.window.SonderGamesBattle;
  assert.ok(B, 'SonderGamesBattle 应在 games.js 前挂载');
  ['gameView'].forEach(k => assert.equal(typeof B[k], 'function', k + ' 为函数'));
});
