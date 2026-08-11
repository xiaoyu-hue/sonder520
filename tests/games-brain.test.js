'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const G = require('../js/games-logic.js');

/* ================= 纯逻辑 ================= */

test('脑筋急转弯逻辑：题库完整，每题至少一个答案', () => {
  assert.ok(G.BRAIN_POOL.length >= 8, '题库不少于 8 条');
  G.BRAIN_POOL.forEach(item => {
    assert.ok(item.q && item.a.length >= 1, `「${item.q}」答案非空`);
  });
});

test('脑筋急转弯逻辑：答对任一可接受答案即结束', () => {
  const s = G.brainStart();
  s.accepted = ['鞋底破了个洞', '鞋底破洞'];
  let r = G.brainTry(s, '鞋底破洞');
  assert.equal(r.correct, true, '变体答案也算对');
  assert.equal(s.over, true);
  assert.equal(G.brainTry(s, '随便').ok, false, '结束后拒绝');
  const s2 = G.brainStart();
  r = G.brainTry(s2, '完全无关的回答');
  assert.equal(r.correct, false);
  assert.equal(s2.over, false, '答错可继续');
  assert.equal(G.brainTry(s2, '  ').ok, false, '空输入拒绝');
  assert.equal(s2.over, false, '空输入不结束');
});

/* ================= UI ================= */

test('脑筋急转弯 UI：进入视图、答对答错与看答案流程、战绩持久化', () => {
  const h = boot();
  h.goto('game');
  const pick = h.window.document.querySelector('[data-pick="brainteaser"]');
  assert.ok(pick, '选择页有脑筋急转弯卡片');
  pick.click();
  const doc = h.window.document;
  assert.ok(doc.querySelector('.idm-q'), '显示问题');
  assert.ok(doc.querySelector('#brainInput'), '有输入框');
  assert.ok(doc.querySelector('#brainGo'), '有提交按钮');
  assert.ok(doc.querySelector('#brainGiveup'), '有看答案按钮');
  const d = h.window.__gamesDbg();
  assert.equal(d.mini.kind, 'brainteaser');

  function answer(text) {
    doc.querySelector('#brainInput').value = text;
    doc.querySelector('#brainGo').click();
    if (doc.querySelector('#brainInput')) doc.querySelector('#brainInput').value = '';
  }
  function rec() {
    return JSON.parse(h.window.localStorage.getItem('sonder_games_brainteaser') || '{}');
  }
  /* 先固定一道答案不含「风车」的题，避免随机题库抽中导致「风车」成正确答案 */
  h.window.__gamesDbg.setBrainQ('什么东西越洗越脏？', ['水']);
  answer('风车');
  assert.equal(rec().right, undefined, '错误答案不计胜');
  doc.querySelector('#brainGiveup').click();
  assert.ok(doc.body.textContent.includes('答案：「'), '看答案揭示');
  assert.equal(rec().wrong, 1, '放弃计数');
  doc.querySelector('[data-mact="again"]').click();
  assert.ok(doc.querySelector('#brainInput'), '换一题重新可答');

  /* 注入确定题目后答对 */
  h.window.__gamesDbg.setBrainQ('什么车开不了', ['风车', '玩具车']);
  answer('风车');
  assert.ok(doc.body.textContent.includes('答对了'), '答对展示');
  assert.equal(rec().right, 1, '答对计数');
  doc.querySelector('[data-mact="back"]').click();
  assert.ok(doc.querySelector('[data-pick="tictactoe"]'), '返回游戏选择');
});