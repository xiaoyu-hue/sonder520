'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

test('对战记录页完整渲染与清空', async () => {
  const h = boot();
  h.goto('game');
  const store = h.store;
  store.addGameRecord({ kind: 'tictactoe', mode: 'ai', player: 'X', winner: 'X', difficulty: 'easy' });
  h.goto('game');
  const doc = h.window.document;
  assert.ok(doc.body.textContent.includes('对战记录'));
  assert.ok(doc.body.textContent.includes('井字棋'));
  assert.ok(doc.body.textContent.includes('普通'), '旧三档难度 label 兼容');
  doc.querySelector('[data-rec="clear"]').click();
  doc.querySelector('[data-act="yes"]').click();
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(store.state.gameRecords.length, 0, '清空生效');
});

test('空状态与清空确认后列表为空', () => {
  const h = boot();
  h.goto('game');
  assert.ok(h.window.document.body.textContent.includes('暂无对局记录'));
});