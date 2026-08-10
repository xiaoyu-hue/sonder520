'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { boot } = require('./harness.js');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

test('扫雷视觉：css 中格子使用实底色而非未定义变量', () => {
  assert.ok(CSS.includes('--ms-unopened:'), '浅色主题定义未翻开格底色');
  assert.ok(CSS.includes('--ms-opened:'), '浅色主题定义翻开格底色');
  assert.ok(CSS.includes('[data-theme="dark"]'), '存在深色主题块');
  const cellRule = CSS.split('.ms-cell')[1] || '';
  assert.ok(!/var\(--card\)/.test(cellRule + (CSS.split('.ms-cell')[2] || '')), '.ms-cell 不再引用未定义的 --card');
  assert.ok(/.ms-cell\s*\{[^}]*background:\s*var\(--ms-unopened\)/s.test(CSS), '.ms-cell 使用不透明实底');
  assert.ok(/.ms-board\s*\{[^}]*max-width:\s*min\(100%,\s*540px\)/s.test(CSS), '雷区最大宽度 540px 受控');
});

test('扫雷视觉：注入样式后格子 computed 为不透明实底，翻开更浅', () => {
  const h = boot();
  const doc = h.window.document;
  const style = doc.createElement('style');
  style.textContent = `
    :root { --ms-unopened: #f0ead9; --ms-opened: #e2dcc9; }
    .ms-cell { background: #f0ead9; }
    .ms-cell.open { background: #e2dcc9; }
    .ms-board { max-width: min(100%, 540px); }
  `;
  doc.head.appendChild(style);
  h.goto('game');
  doc.querySelector('[data-pick="minesweeper"]').click();
  const cell = doc.querySelector('.ms-cell');
  const bg = h.window.getComputedStyle(cell).backgroundColor;
  assert.ok(bg === 'rgb(240, 234, 217)', '未翻开格子实底：#f0ead9 got ' + bg);
  h.window.__gamesDbg.setMineField(9, 9, [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [8, 8]]);
  doc.querySelector('.ms-cell[data-r="8"][data-c="0"]').click();
  const open = doc.querySelector('.ms-cell.open');
  assert.ok(open, '翻开后出现开格');
  const openBg = h.window.getComputedStyle(open).backgroundColor;
  assert.ok(openBg === 'rgb(226, 220, 201)', '翻开格实底：#e2dcc9 got ' + openBg);
  assert.ok(openBg !== bg, '翻开格与未翻开格底色不同');
  const board = doc.querySelector('.ms-board');
  assert.ok(h.window.getComputedStyle(board).maxWidth !== 'none', '雷区有最大宽度约束');
});

test('扫雷视觉：深色主题同样给出不透明实底', () => {
  const h = boot({ matchMedia: true, systemDark: true });
  const doc = h.window.document;
  doc.documentElement.setAttribute('data-theme', 'dark');
  const style = doc.createElement('style');
  style.textContent = `
    [data-theme="dark"] { --ms-unopened: #3d3529; --ms-opened: #2a2419; }
    .ms-cell { background: #3d3529; }
    .ms-board { max-width: min(100%, 540px); }
  `;
  doc.head.appendChild(style);
  h.goto('game');
  doc.querySelector('[data-pick="minesweeper"]').click();
  const bg = h.window.getComputedStyle(doc.querySelector('.ms-cell')).backgroundColor;
  assert.ok(bg === 'rgb(61, 53, 41)', '深色下格子实底：#3d3529 got ' + bg);
  assert.ok(CSS.includes('[data-theme="dark"] .ms-cell.n1'), '深色主题有数字高对比配色');
});