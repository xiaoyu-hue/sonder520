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
  assert.ok(/touch-action:\s*manipulation/.test(CSS), '格子禁用双击缩放');
  assert.ok(/\.ms-cell\.long-pressing\s*\{/.test(CSS), '长按高亮态样式');
});

test('扫雷移动端：大棋盘不被 max-width 钳制，保留 26px 触控尺寸并可横向滚动', () => {
  const mq = /@media \(max-width:\s*720px\)\s*\{[^@]*?\.ms-board\s*\{[^}]*\}/s.exec(CSS);
  assert.ok(mq, '存在 720px 移动端断点');
  assert.ok(/width:\s*max\(100%,\s*calc\(var\(--cols\)\s*\*\s*26px\)\)/.test(mq[0]), '棋盘按列数撑开 >26px×列数');
  assert.ok(/max-width:\s*none/.test(mq[0]), '移动端必须清除 max-width 钳制（基础规则的 min(100%,540px) 会压扁困难棋盘）');
  assert.ok(!/overflow:\s*hidden/.test(mq[0]) || /overflow-x:\s*auto/.test(CSS), '基础规则的 overflow:hidden 不得裁切大棋盘（由滚动容器接管）');
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

function touchEvent(win, type, opts) {
  const e = new win.MouseEvent(type, Object.assign({
    bubbles: true, cancelable: true, clientX: 10, clientY: 10
  }, opts));
  Object.defineProperty(e, 'pointerType', { value: 'touch' });
  return e;
}

test('扫雷移动端：长按 350ms 插旗且不误翻开', async () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="minesweeper"]').click();
  h.window.__gamesDbg.setMineField(9, 9, [[0, 0], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4]]);
  const doc = h.window.document;
  const cell = doc.querySelector('.ms-cell[data-r="0"][data-c="0"]');
  cell.dispatchEvent(touchEvent(h.window, 'pointerdown'));
  assert.ok(cell.classList.contains('long-pressing'), '长按进行中有高亮态');
  await new Promise(r => setTimeout(r, 450));
  const fresh = doc.querySelector('.ms-cell[data-r="0"][data-c="0"]');
  fresh.dispatchEvent(touchEvent(h.window, 'pointerup'));
  fresh.dispatchEvent(touchEvent(h.window, 'click'));
  assert.equal(fresh.textContent, '⚑', '长按插旗');
  assert.ok(!fresh.classList.contains('open'), '插旗不误翻开');
  assert.ok(doc.body.textContent.includes('剩余 9 雷'), '剩余雷数减少');
});

test('扫雷移动端：长按后抬手产生的 click 被抑制，不误翻开', async () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="minesweeper"]').click();
  h.window.__gamesDbg.setMineField(9, 9, [[2, 2], [5, 5], [7, 7]]);
  const doc = h.window.document;
  const cell = doc.querySelector('.ms-cell[data-r="1"][data-c="1"]');
  cell.dispatchEvent(touchEvent(h.window, 'pointerdown'));
  await new Promise(r => setTimeout(r, 450));
  const fresh = doc.querySelector('.ms-cell[data-r="1"][data-c="1"]');
  fresh.dispatchEvent(touchEvent(h.window, 'pointerup'));
  fresh.dispatchEvent(touchEvent(h.window, 'click'));
  assert.equal(fresh.textContent, '⚑', '长按插旗');
  assert.equal(h.window.__gamesDbg().mini.revealed, 0, '未翻开任何格');
});

test('扫雷移动端：鼠标 pointerType 不启用长按', async () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="minesweeper"]').click();
  const doc = h.window.document;
  const cell = doc.querySelector('.ms-cell[data-r="8"][data-c="8"]');
  const ev = new h.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 });
  Object.defineProperty(ev, 'pointerType', { value: 'mouse' });
  cell.dispatchEvent(ev);
  await new Promise(r => setTimeout(r, 450));
  cell.click();
  const fresh = doc.querySelector('.ms-cell[data-r="8"][data-c="8"]');
  assert.ok(fresh.classList.contains('open'), '鼠标点击直接翻开，不受长按影响');
});