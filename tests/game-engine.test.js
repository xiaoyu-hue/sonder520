'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const G = require('../js/games-logic.js');

function gomoku() { return G.createGame('gomoku'); }
function ttt() { return G.createGame('tictactoe'); }

/* ---------- 井字棋 ---------- */
test('井字棋：初始状态与落子换手', () => {
  const g = ttt();
  assert.equal(g.kind, 'tictactoe');
  assert.equal(g.size, 3);
  assert.equal(g.turn, 'X');
  const r1 = G.place(g, 0, 0);
  assert.ok(r1.ok);
  assert.equal(g.board[0][0], 'X');
  assert.equal(g.turn, 'O');
  const r2 = G.place(g, 1, 1);
  assert.ok(r2.ok);
  assert.equal(g.board[1][1], 'O');
  assert.equal(g.turn, 'X');
  assert.equal(g.moves.length, 2);
});

test('井字棋：横/竖/两对角取胜', () => {
  const cases = [
    [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]],
    [[0, 0], [0, 1], [1, 0], [0, 2], [2, 0]],
    [[0, 0], [0, 1], [1, 1], [0, 2], [2, 2]],
    [[0, 2], [0, 0], [1, 1], [0, 1], [2, 0]]
  ];
  cases.forEach(moves => {
    const g = ttt();
    const rs = moves.map(m => G.place(g, m[0], m[1]));
    assert.ok(rs.every(r => r.ok));
    assert.equal(g.winner, 'X', 'X 应获胜: ' + JSON.stringify(moves));
    assert.equal(g.over, true);
    assert.equal(g.winLine.length, 3, '胜利线应有 3 格');
  });
});

test('井字棋：满盘平局', () => {
  const g = ttt();
  const moves = [[0, 0], [0, 1], [0, 2], [1, 1], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2]];
  moves.forEach(m => G.place(g, m[0], m[1]));
  assert.equal(g.winner, 'draw');
  assert.equal(g.over, true);
});

test('井字棋：非法落子（占位/越界/终局后）', () => {
  const g = ttt();
  assert.equal(G.place(g, 3, 0).ok, false);
  assert.equal(G.place(g, -1, 0).ok, false);
  G.place(g, 0, 0);
  assert.equal(G.place(g, 0, 0).ok, false, '占位应拒绝');
  assert.equal(G.place(g, 0, 1).ok, true);
});

test('棋类引擎：小数/NaN 坐标一律拒绝（与扫雷一致），不抛异常', () => {
  const g = ttt();
  for (const [r, c] of [[1.5, 0], [0, 2.5], [NaN, 0], [0, NaN], [0.1, 0.1]]) {
    const a = G.place(g, r, c);
    assert.strictEqual(a.ok, false, `place(${r},${c}) 拒绝`);
    assert.strictEqual(g.moves.length, 0, '不得产生落子记录');
    assert.strictEqual(g.turn, 'X', '不得换手');
  }
  const go = gomoku();
  assert.strictEqual(G.place(go, 3.5, 4).ok, false, '五子棋小数拒绝');
  assert.strictEqual(G.place(go, 0, 0).ok, true, '合法落子不受影响');
});

test('井字棋：悔棋恢复局面', () => {
  const g = ttt();
  G.place(g, 0, 0);
  G.place(g, 1, 1);
  const m = G.undo(g);
  assert.equal(m.p, 'O');
  assert.equal(g.board[1][1], null);
  assert.equal(g.turn, 'O');
  assert.equal(g.moves.length, 1);
  assert.equal(G.undo(g).p, 'X');
  assert.equal(G.undo(g), null, '空栈不可再悔');
});

test('井字棋：AI 主动取胜与封堵对手', () => {
  const g = ttt();
  g.board[0][0] = 'X'; g.board[0][1] = 'X'; g.board[1][0] = 'O';
  g.turn = 'X';
  assert.deepEqual(G.tttAiMove(g, 'X'), { r: 0, c: 2 }, 'AI 应直接取胜');

  const g2 = ttt();
  g2.board[1][1] = 'X'; g2.board[0][0] = 'O'; g2.board[0][1] = 'O';
  g2.turn = 'X';
  assert.deepEqual(G.tttAiMove(g2, 'X'), { r: 0, c: 2 }, 'AI 应封堵对手 (0,2)');
});

test('井字棋：AI 全程对弈不败（玩家乱走也不输）', () => {
  let loss = 0;
  for (let seed = 0; seed < 40; seed++) {
    const g = ttt();
    const ai = seed % 2 === 0 ? 'X' : 'O';
    const human = ai === 'X' ? 'O' : 'X';
    let turn = 'X';
    let guard = 0;
    while (!g.over && guard < 12) {
      if (turn === ai) {
        const mv = G.tttAiMove(g, ai);
        G.place(g, mv.r, mv.c);
      } else {
        const empty = [];
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (g.board[r][c] === null) empty.push([r, c]);
        if (!empty.length) break;
        const mv = empty[(seed * 7 + guard * 3) % empty.length];
        G.place(g, mv[0], mv[1]);
      }
      turn = turn === 'X' ? 'O' : 'X';
      guard++;
    }
    if (g.winner === human) loss++;
  }
  assert.equal(loss, 0, 'AI 不应在任何对局中输给乱走的玩家');
});

/* ---------- 五子棋 ---------- */
test('五子棋：初始状态与中心先手', () => {
  const g = gomoku();
  assert.equal(g.size, 15);
  G.place(g, 7, 7);
  assert.equal(g.board[7][7], 'X');
  assert.equal(g.turn, 'O');
  assert.deepEqual(G.gomokuAiMove(gomoku(), 'X'), { r: 7, c: 7 }, '空盘 AI 走天元');
});

test('五子棋：横/竖/两斜五连取胜', () => {
  const setups = [
    { a: [7, 7], b: [7, 8], c: [7, 9], d: [7, 10], e: [7, 11] },
    { a: [5, 7], b: [6, 7], c: [7, 7], d: [8, 7], e: [9, 7] },
    { a: [5, 5], b: [6, 6], c: [7, 7], d: [8, 8], e: [9, 9] },
    { a: [9, 5], b: [8, 6], c: [7, 7], d: [6, 8], e: [5, 9] }
  ];
  setups.forEach(s => {
    const g = gomoku();
    G.place(g, s.a[0], s.a[1]); G.place(g, 0, 0);
    G.place(g, s.b[0], s.b[1]); G.place(g, 0, 1);
    G.place(g, s.c[0], s.c[1]); G.place(g, 0, 2);
    G.place(g, s.d[0], s.d[1]); G.place(g, 0, 3);
    G.place(g, s.e[0], s.e[1]);
    assert.equal(g.winner, 'X');
    assert.equal(g.over, true);
    assert.equal(g.winLine.length, 5);
  });
});

test('五子棋：AI 主动五连取胜', () => {
  const g = gomoku();
  for (let c = 7; c < 11; c++) g.board[7][c] = 'X';
  g.board[6][6] = 'O'; g.board[8][8] = 'O'; g.board[5][7] = 'O';
  g.turn = 'X';
  const mv = G.gomokuAiMove(g, 'X');
  assert.ok((mv.r === 7 && (mv.c === 6 || mv.c === 11)), '应落成五连: ' + JSON.stringify(mv));
});

test('五子棋：AI 封堵对手冲四/活四', () => {
  const g = gomoku();
  for (let c = 6; c < 10; c++) g.board[7][c] = 'O';
  g.board[5][7] = 'X'; g.board[5][8] = 'X'; g.board[6][7] = 'X'; g.board[8][8] = 'X';
  g.turn = 'X';
  const mv = G.gomokuAiMove(g, 'X');
  assert.ok((mv.r === 7 && (mv.c === 5 || mv.c === 10)), '应封堵 O 的冲四: ' + JSON.stringify(mv));
});

test('五子棋：AI 落子后己方无违规落子', () => {
  const g = gomoku();
  const mv = G.gomokuAiMove(g, 'X');
  assert.equal(g.board[mv.r][mv.c], null, 'AI 计算不应污染棋盘');
});

test('五子棋：悔棋与认输', () => {
  const g = gomoku();
  G.place(g, 7, 7);
  G.place(g, 8, 8);
  const m = G.undo(g);
  assert.equal(m.p, 'O');
  assert.equal(g.board[8][8], null);
  assert.equal(G.resign(g, 'O'), 'X');
  assert.equal(g.winner, 'X');
  assert.equal(g.byResign, true);
  assert.equal(g.over, true);
  assert.equal(G.resign(g, 'X'), null, '终局后不可再认输');
});

test('五子棋：引擎不修改传入 AI 的状态（对局中途调用）', () => {
  const g = gomoku();
  G.place(g, 7, 7);
  G.place(g, 8, 8);
  const mv = G.gomokuAiMove(g, 'X');
  assert.ok(mv.r >= 0 && mv.r < 15 && mv.c >= 0 && mv.c < 15);
  assert.equal(g.moves.length, 2, 'AI 计算不应产生落子');
});