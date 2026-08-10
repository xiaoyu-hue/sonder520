'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const G = require('../js/games-logic.js');

/* ================= 纯逻辑 ================= */

function boardFrom(map) {
  const rows = map.length, cols = map[0].length;
  const b = [];
  for (let r = 0; r < rows; r++) {
    b.push([]);
    for (let c = 0; c < cols; c++) {
      b[r].push({ mine: map[r][c] === '*', revealed: false, flagged: false, adj: 0 });
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (b[r][c].mine) continue;
      let a = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && b[rr][cc].mine) a++;
        }
      }
      b[r][c].adj = a;
    }
  }
  return b;
}

test('扫雷逻辑：首次点击布雷，首击位置及其邻域安全', () => {
  const s = G.mineStart(9, 9, 10);
  assert.equal(s.first, true);
  assert.equal(s.board, null, '未点击前不布雷');
  const r = G.mineReveal(s, 4, 4);
  assert.equal(r.ok, true);
  assert.ok(s.board, '首击后布雷');
  assert.equal(s.board[4][4].mine, false, '首击格安全');
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    assert.equal(s.board[4 + dr][4 + dc].mine, false, '首击 3x3 邻域内无雷');
  }
  let mineCount = 0;
  s.board.forEach(row => row.forEach(cell => { if (cell.mine) mineCount++; }));
  assert.equal(mineCount, 10, '雷数正确');
  assert.ok(s.revealed >= 1, '已翻开至少首击格');
});

test('扫雷逻辑：洪水展开 + 数字邻接 + 越界/重复翻开拒绝', () => {
  const s = G.mineStart(6, 6, 1);
  s.board = boardFrom([
    ['*', '.', '.', '.', '.', '.'],
    ['.', '.', '.', '.', '.', '.'],
    ['.', '.', '.', '.', '.', '.'],
    ['.', '.', '.', '.', '.', '.'],
    ['.', '.', '.', '.', '.', '.'],
    ['.', '.', '.', '.', '.', '.']
  ]);
  s.first = false;
  let r = G.mineReveal(s, 0, 5);
  /* (0,5) adj=1（邻 (0,4) 对角 (1,4)? 不，(0,0) 雷 → (0,1)=1；(0,5) 远离雷区 adj=0 → 洪泛展开 */
  assert.equal(r.ok, true);
  assert.equal(s.board[0][1].adj, 1, '(0,1) 邻接一颗雷');
  assert.equal(s.board[0][1].revealed, true, '雷的邻格被翻开');
  assert.ok(s.board[5][5].revealed, '洪泛展开到远端格子');
  assert.equal(G.mineReveal(s, 0, 5).ok, false, '重复翻开拒绝');
  assert.equal(G.mineReveal(s, -1, 0).ok, false, '越界拒绝');
});

test('扫雷逻辑：踩雷即结束；翻开全部非雷获胜', () => {
  const s = G.mineStart(3, 3, 1);
  s.board = boardFrom([
    ['*', '.', '.'],
    ['.', '.', '.'],
    ['.', '.', '.']
  ]);
  s.first = false;
  let r = G.mineReveal(s, 0, 0);
  assert.equal(r.mine, true);
  assert.equal(r.over, true);
  assert.equal(s.over, true);
  assert.equal(s.won, false);

  const w = G.mineStart(3, 3, 1);
  w.board = boardFrom([
    ['*', '.', '.'],
    ['.', '.', '.'],
    ['.', '.', '.']
  ]);
  w.first = false;
  const nonMines = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    if (!w.board[r][c].mine) nonMines.push([r, c]);
  }
  let last = null;
  for (let i = 0; i < nonMines.length; i++) {
    last = G.mineReveal(w, nonMines[i][0], nonMines[i][1]);
    if (last.won) break;
  }
  assert.ok(last && last.won, '翻开全部非雷获胜');
  assert.equal(w.over, true);
  assert.equal(w.won, true);
  assert.equal(w.revealed, 8);
  assert.equal(G.mineReveal(w, 2, 2).ok, false, '结束后拒绝操作');
});

test('扫雷逻辑：标记/取消标记，已标记格不可翻开', () => {
  const s = G.mineStart(3, 3, 1);
  s.board = boardFrom([
    ['*', '.', '.'],
    ['.', '.', '.'],
    ['.', '.', '.']
  ]);
  s.first = false;
  let r = G.mineToggleFlag(s, 0, 1);
  assert.equal(r.ok, true);
  assert.equal(r.flagged, true);
  assert.equal(s.flagged, 1);
  assert.equal(G.mineReveal(s, 0, 1).ok, false, '已标记格拒绝翻开');
  r = G.mineToggleFlag(s, 0, 1);
  assert.equal(r.flagged, false);
  assert.equal(s.flagged, 0);
  assert.equal(G.mineReveal(s, 0, 1).ok, true, '取消标记后可翻开');
  assert.equal(s.board[0][1].revealed, true, '单格翻开（adj=1 不洪泛）');
  assert.equal(G.mineToggleFlag(s, 0, 1).ok, false, '已翻开格不能标记');
  assert.equal(G.mineToggleFlag(s, 0, 0).ok, true, '雷格可标记');
  assert.equal(G.mineReveal(s, 0, 0).ok, false, '已标记雷格拒绝翻开');
});

/* ================= UI ================= */

test('扫雷 UI：进入视图，网格与难度齐全，剩余雷数显示', () => {
  const h = boot();
  h.goto('game');
  const pick = h.window.document.querySelector('[data-pick="minesweeper"]');
  assert.ok(pick, '选择页有扫雷卡片');
  pick.click();
  const doc = h.window.document;
  assert.ok(doc.querySelector('#msBoard'), '有雷区网格');
  assert.ok(doc.querySelector('#msDiff'), '有难度选择');
  assert.equal(doc.querySelectorAll('.ms-cell').length, 81, '简单 9x9 共 81 格');
  assert.ok(doc.body.textContent.includes('剩余 10 雷'), '显示剩余雷数');
  assert.equal(doc.querySelectorAll('#msDiff option').length, 3, '三档难度');
  assert.ok(doc.querySelector('#msFlagMode'), '有标记模式开关');
  const d = h.window.__gamesDbg();
  assert.equal(d.mini.kind, 'minesweeper');
});

test('扫雷 UI：翻格与插旗交互，踩雷结束并计入战绩', () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="minesweeper"]').click();
  h.window.__gamesDbg.setMineField(9, 9, [[0, 0], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4]]);
  const doc = h.window.document;
  function cellAt(r, c) {
    return doc.querySelector('.ms-cell[data-r="' + r + '"][data-c="' + c + '"]');
  }
  cellAt(8, 8).click();
  assert.ok(doc.querySelectorAll('.ms-cell.open').length > 3, '右侧洪泛翻开');
  assert.equal(cellAt(0, 0).textContent, '', '左侧雷格未翻开');
  doc.querySelector('#msFlagMode').click();
  cellAt(0, 0).click();
  assert.equal(cellAt(0, 0).textContent, '⚑', '标记模式插旗');
  assert.ok(doc.body.textContent.includes('剩余 9 雷'), '剩余雷数减少');
  doc.querySelector('#msFlagMode').click();
  cellAt(0, 4).click();
  assert.ok(doc.body.textContent.includes('踩到雷了'), '踩雷提示');
  assert.ok(doc.body.textContent.includes('负 1'), '战绩显示失败 1 次');
  assert.equal(JSON.parse(h.window.localStorage.getItem('sonder_games_minesweeper')).losses, 1, '失败计数持久化');
  doc.querySelector('[data-mact="again"]').click();
  assert.equal(doc.querySelectorAll('.ms-cell').length, 81, '再来一局重开');
  assert.equal(JSON.parse(h.window.localStorage.getItem('sonder_games_minesweeper')).wins, 0, '未胜局胜场为 0');
});

test('扫雷 UI：再来一局与难度切换持久化偏好', () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="minesweeper"]').click();
  const doc = h.window.document;
  doc.querySelector('[data-mact="again"]').click();
  assert.equal(doc.querySelectorAll('.ms-cell').length, 81, '再来一局仍是 9x9');
  const diff = doc.querySelector('#msDiff');
  diff.value = 'mid';
  diff.dispatchEvent(new h.window.Event('change', { bubbles: true }));
  assert.equal(doc.querySelectorAll('.ms-cell').length, 144, '切换中等难度重开 12x12');
  assert.equal(JSON.parse(h.window.localStorage.getItem('sonder_games_minesweeper')).diff, 'mid', '难度偏好持久化');
  doc.querySelector('[data-mact="back"]').click();
  assert.ok(doc.querySelector('[data-pick="tictactoe"]'), '返回游戏选择');
  h.window.document.querySelector('[data-pick="minesweeper"]').click();
  assert.equal(doc.querySelectorAll('.ms-cell').length, 144, '重进记住上次难度');
});