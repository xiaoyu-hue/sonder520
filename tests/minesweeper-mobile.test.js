'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { boot } = require('./harness.js');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

test('扫雷移动端：棋盘容器可横向滚动，格子保持触控尺寸', () => {
  assert.ok(/\.ms-board-wrap\s*\{[^}]*overflow-x:\s*auto/s.test(CSS), '棋盘外层滚动容器');
  assert.ok(/@media \(max-width:\s*720px\)\s*\{[^@]*?\.ms-board\s*\{[^}]*width:\s*max\(100%,\s*calc\(var\(--cols\)\s*\*\s*26px\)\)/s.test(CSS), '手机端棋盘按列数自适应宽度');
  assert.ok(/@media \(max-width:\s*720px\)\s*\{[^@]*?\.ms-board\s*\{[^}]*min-width:\s*100%/s.test(CSS), '手机端棋盘不窄于视口');
  assert.ok(/@media \(max-width:\s*720px\)\s*\{[^@]*?\.ms-cell\s*\{\s*min-height:\s*26px/s.test(CSS), '手机端格子最小 26px 触控尺寸');
});

test('扫雷移动端：棋盘携带 --cols 变量供宽度计算', () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="minesweeper"]').click();
  const board = h.window.document.querySelector('#msBoard');
  assert.ok(board, '棋盘存在');
  assert.strictEqual(board.style.getPropertyValue('--cols'), '9', '--cols=9 与网格列数一致');
  assert.ok(h.window.document.querySelector('.ms-board-wrap'), '存在滚动容器');
  const wrap = h.window.document.querySelector('.ms-board-wrap');
  assert.strictEqual(wrap.contains(board), true, '棋盘位于滚动容器内');
  h.window.document.querySelector('#msDiff').value = 'mid';
  h.window.document.querySelector('#msDiff').dispatchEvent(new h.window.Event('change', { bubbles: true }));
  assert.strictEqual(h.window.document.querySelector('#msBoard').style.getPropertyValue('--cols'), '12', '切难度后 --cols 同步');
});

test('扫雷移动端：滚动容器内点击翻格正常', () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="minesweeper"]').click();
  const doc = h.window.document;
  doc.querySelector('.ms-cell').click();
  const snap = h.window.__gamesDbg().mini;
  assert.strictEqual(snap.boardReady, true, '容器内首击正常布雷');
  assert.ok(snap.revealed >= 1, '首击翻开');
});