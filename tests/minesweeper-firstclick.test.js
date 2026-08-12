'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const G = require('../js/games-logic.js');

test('扫雷逻辑防御：NaN/小数/越界坐标一律拒绝，不抛异常', () => {
  const s = G.mineStart(9, 9, 10);
  for (const [r, c] of [[NaN, NaN], [NaN, 0], [0, NaN], [1.5, 3], [3, 1.5], [-1, 0], [0, 9], [9, 0]]) {
    const a = G.mineReveal(s, r, c);
    assert.strictEqual(a.ok, false, `mineReveal(${r},${c}) 拒绝`);
    assert.strictEqual(a.error, '越界', '回越界错误');
    assert.strictEqual(s.board, null, '拒绝时不得布雷');
  }
  const f = G.mineToggleFlag(s, NaN, NaN);
  assert.strictEqual(f.ok, false, 'mineToggleFlag NaN 拒绝');
  assert.strictEqual(s.board, null, '插旗拒绝时不得布雷');
});

test('扫雷 UI：真实首击（不注入布雷）→ 点击即有反馈并正常布雷', () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="minesweeper"]').click();
  const doc = h.window.document;
  const cells = doc.querySelectorAll('.ms-cell');
  assert.ok(cells.length === 81, '简单 9x9 共 81 格');
  let noData = 0;
  cells.forEach((cell) => {
    if (cell.dataset.r === undefined || cell.dataset.c === undefined) noData++;
  });
  assert.strictEqual(noData, 0, '空白阶段每个格子都带坐标，点击不会传 NaN');
  const first = cells[0];
  first.click();
  const snap = h.window.__gamesDbg().mini;
  assert.strictEqual(snap.boardReady, true, '首击后布雷');
  assert.ok(snap.revealed >= 1, '首击格已翻开');
  const opened = doc.querySelectorAll('.ms-cell.open, .ms-cell.n1, .ms-cell.n2, .ms-cell.n3, .ms-cell.n4, .ms-cell.n5, .ms-cell.n6, .ms-cell.n7, .ms-cell.n8').length;
  assert.ok(opened >= 1, 'DOM 出现已翻开或数字格');
  assert.ok(!doc.body.textContent.includes('踩到雷了'), '首击不应踩雷');
  const again = doc.querySelectorAll('.ms-cell');
  const rnd = again[again.length - 1];
  rnd.click();
  const snap2 = h.window.__gamesDbg().mini;
  assert.strictEqual(snap2.boardReady, true, '后续点击正常无崩溃');
});

test('扫雷 UI：空白阶段右键插旗不布雷，旗位暂存并显示，首击翻开仍必安全', () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="minesweeper"]').click();
  const doc = h.window.document;
  const cell = doc.querySelector('.ms-cell');
  const ev = new h.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  cell.dispatchEvent(ev);
  const snap = h.window.__gamesDbg().mini;
  assert.strictEqual(snap.boardReady, false, '首击插旗不布雷（布雷推迟到首次翻开）');
  assert.strictEqual(snap.flagged, 1, '旗位计数及时生效');
  assert.strictEqual(doc.querySelector('.ms-cell').textContent, '⚑', '暂存旗位渲染到棋盘');
  const reveal = doc.querySelector('.ms-cell[data-r="8"][data-c="8"]');
  reveal.click();
  const snap2 = h.window.__gamesDbg().mini;
  assert.strictEqual(snap2.boardReady, true, '首次翻开时布雷');
  assert.ok(!doc.body.textContent.includes('踩到雷了'), '首次翻开必安全（即使先插过旗）');
  const flaggedCell = doc.querySelector('.ms-cell[data-r="0"][data-c="0"]');
  assert.strictEqual(flaggedCell.textContent, '⚑', '先插的旗在布雷后保留');
});

test('扫雷 UI：完整一局确定性胜利（注入雷位布局）', () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="minesweeper"]').click();
  const doc = h.window.document;
  h.window.__gamesDbg.setMineField(9, 9, [[0, 0]]); /* 单雷：其余 80 格全安全 */
  const snap0 = h.window.__gamesDbg().mini;
  assert.strictEqual(snap0.boardReady, true, '注入布局后进入实盘');
  assert.strictEqual(snap0.mines, 1, '雷数以注入为准');
  doc.querySelector('[data-r="0"][data-c="1"]').click(); /* 安全格：邻雷数字格 */
  assert.ok(!doc.body.textContent.includes('踩到雷了'), '安全格不得引爆');
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (r === 0 && c === 0) continue; /* 唯一雷位不点 */
      const el = doc.querySelector('.ms-cell[data-r="' + r + '"][data-c="' + c + '"]');
      assert.ok(el, '每格应有对应 DOM 元素');
      if (!el.classList.contains('open')) el.click();
    }
  }
  const end = h.window.__gamesDbg().mini;
  assert.strictEqual(end.over, true, '翻完全部安全格应结束对局');
  assert.strictEqual(end.won, true, '单雷局必赢（原随机胜利断言可被静默跳过，现为确定路径）');
  const rec = h.store.state.gameRecords[0];
  assert.ok(rec && rec.kind === 'minesweeper' && rec.winner === 'player', '胜利写入对局记录');
});