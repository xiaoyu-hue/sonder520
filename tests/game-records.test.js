'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

function bodyTxt(h) { return h.window.document.body.textContent; }

test('猜数字胜局写入对局记录（solo 单人挑战）', () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="guessnum"]').click();
  h.window.__gamesDbg.setMiniTarget(50);
  const input = h.window.document.querySelector('#mgGuess');
  input.value = '50';
  h.window.document.querySelector('#mgGo').click();
  const recs = h.store.state.gameRecords;
  assert.strictEqual(recs.length, 1, '产生一条对局记录');
  const r = recs[0];
  assert.strictEqual(r.kind, 'guessnum');
  assert.strictEqual(r.mode, 'solo');
  assert.strictEqual(r.winner, 'player');
  assert.ok(r.note && r.note.includes('猜中'), 'note 记录猜中信息');
  const txt = bodyTxt(h);
  assert.ok(txt.includes('🎯 猜数字'), '渲染游戏名');
  assert.ok(txt.includes('单人挑战'), '渲染单人挑战模式');
  assert.ok(txt.includes('你胜'), '渲染胜负结果');
  assert.ok(txt.includes(r.note), '渲染备注');
});

test('猜数字败局与扫雷败局分别按负记录', () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="guessnum"]').click();
  h.window.__gamesDbg.setMiniTarget(99);
  const doc = h.window.document;
  ['1', '2', '3', '4', '5', '6', '7'].forEach((v) => {
    doc.querySelector('#mgGuess').value = v;
    doc.querySelector('#mgGo').click();
  });
  doc.querySelector('[data-mact="back"]').click();
  doc.querySelector('[data-pick="minesweeper"]').click();
  h.window.__gamesDbg.setMineField(9, 9, [[0, 0]]);
  doc.querySelector('.ms-cell[data-r="0"][data-c="0"]').click();
  const recs = h.store.state.gameRecords;
  assert.strictEqual(recs.length, 2, '两局各产生一条记录');
  assert.strictEqual(recs[0].kind, 'minesweeper');
  assert.strictEqual(recs[0].winner, 'opponent');
  assert.strictEqual(recs[0].difficulty, 'easy');
  assert.strictEqual(recs[1].kind, 'guessnum');
  assert.strictEqual(recs[1].winner, 'opponent');
});

test('猜成语未中与脑筋急转弯看答案各记一负', () => {
  const h = boot();
  h.goto('game');
  const doc = h.window.document;
  doc.querySelector('[data-pick="idiom"]').click();
  for (let i = 0; i < 3; i++) {
    doc.querySelector('#idmInput').value = '错误答案';
    doc.querySelector('#idmGo').click();
  }
  doc.querySelector('[data-mact="back"]').click();
  doc.querySelector('[data-pick="brainteaser"]').click();
  doc.querySelector('#brainGiveup').click();
  const recs = h.store.state.gameRecords;
  assert.strictEqual(recs.length, 2);
  assert.strictEqual(recs[0].kind, 'brainteaser');
  assert.strictEqual(recs[0].winner, 'opponent');
  assert.strictEqual(recs[1].kind, 'idiom');
  assert.strictEqual(recs[1].winner, 'opponent');
});

test('棋类对战记录行为不回归（AI 对局仍记 X/O 与难度）', () => {
  const h = boot();
  h.goto('game');
  const store = h.store;
  store.addGameRecord({ kind: 'tictactoe', mode: 'ai', player: 'X', winner: 'X', difficulty: 'easy' });
  store.addGameRecord({ kind: 'gomoku', mode: 'pvp', player: 'X', winner: 'draw' });
  store.addGameRecord({ kind: 'tictactoe', mode: 'ai', player: 'O', winner: 'O', difficulty: 'hard' });
  const recs = store.state.gameRecords;
  assert.strictEqual(recs[0].kind, 'tictactoe');
  assert.strictEqual(recs[0].mode, 'ai');
  assert.strictEqual(recs[0].winner, 'O');
  assert.strictEqual(recs[0].difficulty, 'hard');
  assert.strictEqual(recs[1].mode, 'pvp');
  assert.strictEqual(recs[1].winner, 'draw');
  assert.strictEqual(recs[1].difficulty, null);
  assert.strictEqual(recs[1].kind, 'gomoku');
  assert.ok(recs[0].date && recs[0].time, '记录含日期时间');
});

test('汇总统计包含单人游戏胜场', () => {
  const h = boot();
  const store = h.store;
  store.state.gameRecords = [];
  store.addGameRecord({ kind: 'guessnum', mode: 'solo', player: 'player', winner: 'player' });
  store.addGameRecord({ kind: 'minesweeper', mode: 'solo', player: 'player', winner: 'opponent', difficulty: 'hard' });
  const s = store.summarize();
  assert.strictEqual(s.game.total, 2);
  assert.strictEqual(s.game.wins, 1, '胜场统计包含单人游戏');
  assert.strictEqual(s.game.draws, 0);
});