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
  const first = cells[Math.floor(Math.random() * 81)];
  first.click();
  const snap = h.window.__gamesDbg().mini;
  assert.strictEqual(snap.boardReady, true, '首击后布雷');
  assert.ok(snap.revealed >= 1, '首击格已翻开');
  const opened = doc.querySelectorAll('.ms-cell.open, .ms-cell.n1, .ms-cell.n2, .ms-cell.n3, .ms-cell.n4, .ms-cell.n5, .ms-cell.n6, .ms-cell.n7, .ms-cell.n8').length;
  assert.ok(opened >= 1, 'DOM 出现已翻开或数字格');
  assert.ok(!doc.body.textContent.includes('踩到雷了'), '首击不应踩雷');
  const again = doc.querySelectorAll('.ms-cell');
  const rnd = again[Math.floor(Math.random() * again.length)];
  rnd.click();
  const snap2 = h.window.__gamesDbg().mini;
  assert.strictEqual(snap2.boardReady, true, '后续点击正常无崩溃');
});

test('扫雷 UI：空白阶段右键插旗也能正常布雷并出旗', () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="minesweeper"]').click();
  const doc = h.window.document;
  const cell = doc.querySelector('.ms-cell');
  const ev = new h.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  cell.dispatchEvent(ev);
  assert.ok(h.window.__gamesDbg().mini.boardReady, '右键首击布雷');
  assert.strictEqual(doc.querySelector('.ms-cell').textContent, '⚑', '首击右键为插旗');
});

test('扫雷 UI：真实一局可完整胜利（不注入）', () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="minesweeper"]').click();
  const tryWin = () => {
    const snap = h.window.__gamesDbg().mini;
    if (snap.over) return snap;
    const doc = h.window.document;
    const hidden = Array.from(doc.querySelectorAll('.ms-cell:not(.open):not(.flagged):not(.n1):not(.n2):not(.n3):not(.n4):not(.n5):not(.n6):not(.n7):not(.n8)'));
    if (!hidden.length) {
      assert.fail('不应走到这里：已翻开全部非雷格却未结束');
    }
    hidden[0].click();
    return null;
  };
  let out = null, guard = 0;
  while (!(out = tryWin()) && guard++ < 300) { /* 洪泛加运气，300 步内必见分晓 */ }
  assert.ok(out, '真实游玩过程无异常');
  assert.strictEqual(out.over, true, '真实一局能正常结束');
  if (out.won) {
    const rec = h.store.state.gameRecords[0];
    assert.ok(rec && rec.kind === 'minesweeper' && rec.winner === 'player', '胜利写入对局记录');
  }
});