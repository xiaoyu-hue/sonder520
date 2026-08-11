'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const G = require('../js/games-logic.js');

/* ================= 纯逻辑 ================= */

test('猜成语逻辑：题库完整，答案均为四字', () => {
  assert.ok(G.IDIOM_POOL.length >= 8, '题库不少于 8 条');
  G.IDIOM_POOL.forEach(item => {
    assert.equal(item.a.length, 4, `「${item.q}」的答案「${item.a}」应为四字`);
    assert.ok(item.q && item.hint, '谜面与提示字齐全');
  });
});

test('猜成语逻辑：开局随机出题，答对即结束', () => {
  const s = G.idiomStart();
  assert.ok(s.q && s.hint && s.answer);
  assert.equal(s.tries, 0);
  assert.equal(s.max, 3);
  const r = G.idiomTry(s, ' ' + s.answer + ' ', '');
  assert.equal(r.correct, true);
  assert.equal(s.over, true);
  assert.equal(s.correct, true);
  assert.equal(G.idiomTry(s, s.answer).ok, false, '结束后拒绝输入');
});

test('猜成语逻辑：答错累计次数并给提示字，3 次未中揭示答案', () => {
  const s = G.idiomStart();
  s.answer = '一字千金';
  s.hint = '字';
  let r = G.idiomTry(s, '乱七八糟');
  assert.equal(r.correct, false);
  assert.equal(r.tries, 1);
  assert.equal(r.hint, '字', '第一次答错给提示字');
  r = G.idiomTry(s, '乱七八糟');
  assert.equal(r.tries, 2);
  assert.equal(r.hint, '字');
  r = G.idiomTry(s, '乱七八糟');
  assert.equal(r.tries, 3);
  assert.equal(r.answer, '一字千金', '第三次答错揭示答案');
  assert.equal(s.over, true);
  assert.equal(s.correct, false);
  const empty = G.idiomStart();
  assert.equal(G.idiomTry(empty, '   ').ok, false, '空输入拒绝');
  assert.equal(empty.tries, 0, '空输入不消耗机会');
});

/* ================= UI ================= */

test('猜成语 UI：进入视图，谜面/输入/机会齐全', () => {
  const h = boot();
  h.goto('game');
  const pick = h.window.document.querySelector('[data-pick="idiom"]');
  assert.ok(pick, '选择页有猜成语卡片');
  pick.click();
  const doc = h.window.document;
  assert.ok(doc.querySelector('.idm-q'), '显示谜面板');
  assert.ok(doc.querySelector('#idmInput'), '有输入框');
  assert.ok(doc.querySelector('#idmGo'), '有提交按钮');
  assert.ok(doc.body.textContent.includes('机会 3/3'), '显示机会');
  assert.ok(doc.querySelector('#idmInput[aria-label]'), '输入框有 aria 标注');
  const d = h.window.__gamesDbg();
  assert.equal(d.mini.kind, 'idiom');
});

test('猜成语 UI：答对/答错全流程，提示字与战绩持久化', () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="idiom"]').click();
  const doc = h.window.document;
  h.window.__gamesDbg.setIdiomAnswer('一字千金');
  function answer(text) {
    doc.querySelector('#idmInput').value = text;
    doc.querySelector('#idmGo').click();
  }
  answer('乱七八糟');
  assert.ok(doc.body.textContent.includes('提示'), '答错给提示字');
  assert.ok(doc.body.textContent.includes('机会 2/3'), '机会减少');
  answer('一字千金');
  assert.ok(doc.body.textContent.includes('答对了'), '答对提示');
  assert.ok(doc.body.textContent.includes('🎉'), '成功表情');
  assert.equal(h.store.state.miniRecords.idiom.right, 1, '答对计数');
  doc.querySelector('[data-mact="again"]').click();
  h.window.__gamesDbg.setIdiomAnswer('一步登天');
  answer('乱七八糟'); answer('乱七八糟'); answer('乱七八糟');
  assert.ok(doc.body.textContent.includes('答案是'), '三次未中揭示答案');
  assert.equal(h.store.state.miniRecords.idiom.wrong, 1, '答错计数');
  doc.querySelector('[data-mact="back"]').click();
  assert.ok(doc.querySelector('[data-pick="tictactoe"]'), '返回游戏选择');
});