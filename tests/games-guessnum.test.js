'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const G = require('../js/games-logic.js');

/* ================= 纯逻辑 ================= */

test('猜数字逻辑：开局 1~100 随机数，7 次机会', () => {
  const g = G.guessNumStart();
  assert.ok(g.target >= 1 && g.target <= 100, 'target 在 1~100');
  assert.equal(g.max, 7);
  assert.equal(g.attempts.length, 0);
  assert.equal(g.over, false);
  assert.equal(g.won, false);
});

test('猜数字逻辑：非法输入被拒绝', () => {
  const g = G.guessNumStart();
  for (const bad of ['abc', '', '0', '101', '1.5', '-3', '  ']) {
    const r = G.guessNumTry(g, bad);
    assert.equal(r.ok, false, `输入 ${JSON.stringify(bad)} 应拒绝`);
  }
  assert.equal(g.attempts.length, 0, '非法输入不计次数');
});

test('猜数字逻辑：大了/小了提示', () => {
  const g = G.guessNumStart();
  g.target = 42;
  let r = G.guessNumTry(g, 50);
  assert.equal(r.ok, true);
  assert.equal(r.hint, 'high');
  r = G.guessNumTry(g, 10);
  assert.equal(r.hint, 'low');
  assert.equal(g.over, false);
  assert.equal(g.attempts.length, 2);
});

test('猜数字逻辑：猜中获胜，7 次未中判负并揭示答案', () => {
  const g = G.guessNumStart();
  g.target = 42;
  G.guessNumTry(g, 1); G.guessNumTry(g, 2); G.guessNumTry(g, 3);
  let r = G.guessNumTry(g, 42);
  assert.equal(r.win, true);
  assert.equal(r.used, 4);
  assert.equal(g.over, true);
  assert.equal(g.won, true);
  assert.equal(G.guessNumTry(g, 42).ok, false, '结束后不能继续');

  const g2 = G.guessNumStart();
  g2.target = 77;
  for (let i = 0; i < 6; i++) G.guessNumTry(g2, 10 + i);
  r = G.guessNumTry(g2, 90);
  assert.equal(r.lose, true);
  assert.equal(r.target, 77);
  assert.equal(g2.over, true);
  assert.equal(g2.won, false);
});

/* ================= UI ================= */

test('猜数字 UI：选择卡片进入，视图元素齐全，aria 标注', () => {
  const h = boot();
  h.goto('game');
  const pick = h.window.document.querySelector('[data-pick="guessnum"]');
  assert.ok(pick, '选择页有猜数字卡片');
  pick.click();
  assert.ok(h.window.document.body.textContent.includes('猜数字'), '进入猜数字视图');
  assert.ok(h.window.document.querySelector('#mgGuess'), '有数字输入框');
  assert.ok(h.window.document.querySelector('#mgGo'), '有猜按钮');
  assert.ok(h.window.document.querySelector('#mgHist[role="status"]'), '历史区有 aria-live');
  assert.ok(h.window.document.body.textContent.includes('剩余机会'), '显示剩余机会');
  assert.equal(h.window.document.querySelector('#mgLeft').textContent, '7', '初始 7 次机会');
  const d = h.window.__gamesDbg();
  assert.equal(d.mini.kind, 'guessnum');
});

test('猜数字 UI：大了/小了/猜中全流程，最佳纪录写入 localStorage', () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="guessnum"]').click();
  h.window.__gamesDbg.setMiniTarget(42);
  const doc = h.window.document;
  function guess(n) {
    doc.querySelector('#mgGuess').value = String(n);
    doc.querySelector('#mgGo').click();
  }
  guess(50);
  assert.ok(doc.body.textContent.includes('大了'), '提示大了');
  assert.ok(doc.body.textContent.includes('50'), '历史出现猜测数字');
  guess(10);
  assert.ok(doc.body.textContent.includes('小了'), '提示小了');
  assert.equal(doc.querySelector('#mgLeft').textContent, '5', '剩余次数减少');
  guess(42);
  assert.ok(doc.body.textContent.includes('猜中了'), '显示猜中结果');
  assert.ok(doc.body.textContent.includes('新纪录'), '首次即新纪录');
  assert.ok(doc.body.textContent.includes('🔄 再来一局'), '有再来一局按钮');
  const rec = JSON.parse(h.window.localStorage.getItem('sonder_games_guessnum'));
  assert.equal(rec.best, 3, '最佳纪录持久化');
});

test('猜数字 UI：再来一局重置，失败展示答案', () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="guessnum"]').click();
  h.window.__gamesDbg.setMiniTarget(42);
  const doc = h.window.document;
  function guess(n) {
    doc.querySelector('#mgGuess').value = String(n);
    doc.querySelector('#mgGo').click();
  }
  [10, 20, 30, 40, 50, 60, 70].forEach((n, i) => {
    guess(n);
    if (i < 6) assert.equal(doc.querySelector('#mgLeft').textContent, String(7 - i - 1));
  });
  assert.ok(doc.body.textContent.includes('答案是'), '失败揭示答案');
  assert.ok(doc.body.textContent.includes('42'), '答案 42 出现');
  doc.querySelector('[data-mact="again"]').click();
  assert.equal(doc.querySelector('#mgLeft').textContent, '7', '再来一局剩余机会恢复');
  assert.ok(!doc.body.textContent.includes('答案是'), '历史与结果清空');
  h.window.__gamesDbg.setMiniTarget(42);
  guess(42);
  const rec = JSON.parse(h.window.localStorage.getItem('sonder_games_guessnum'));
  assert.equal(rec.best, 1, '更优纪录覆盖');
  doc.querySelector('[data-mact="back"]').click();
  assert.ok(doc.querySelector('[data-pick="tictactoe"]'), '返回游戏选择');
});