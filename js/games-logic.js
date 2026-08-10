/* games-logic.js - 井字棋 & 五子棋纯逻辑引擎（无 DOM，浏览器/Node 通用，供 game 模块与测试使用） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SonderGames = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

  function boardOf(size) {
    var b = [];
    for (var r = 0; r < size; r++) b.push(new Array(size).fill(null));
    return b;
  }

  /* ---------- 对局创建与还原 ---------- */
  function createGame(kind) {
    var isGo = kind === 'gomoku';
    return {
      kind: isGo ? 'gomoku' : 'tictactoe',
      size: isGo ? 15 : 3,
      board: boardOf(isGo ? 15 : 3),
      turn: 'X',
      moves: [],
      winner: null,
      over: false,
      byResign: false,
      winLine: null
    };
  }
  function cloneGame(g) {
    return JSON.parse(JSON.stringify(g));
  }

  /* ---------- 胜负判定 ---------- */
  function tttWins(board, r, c, p) {
    var i, ok;
    for (ok = true, i = 0; i < 3; i++) if (board[r][i] !== p) ok = false;
    if (ok) return true;
    for (ok = true, i = 0; i < 3; i++) if (board[i][c] !== p) ok = false;
    if (ok) return true;
    if (r === c) {
      for (ok = true, i = 0; i < 3; i++) if (board[i][i] !== p) ok = false;
      if (ok) return true;
    }
    if (r + c === 2) {
      for (ok = true, i = 0; i < 3; i++) if (board[i][2 - i] !== p) ok = false;
      if (ok) return true;
    }
    return false;
  }
  function gomokuWins(board, r, c, p) {
    for (var i = 0; i < DIRS.length; i++) {
      var d = DIRS[i], n = 1, s, rr, cc;
      for (s = -1; s <= 1; s += 2) {
        rr = r + d[0] * s; cc = c + d[1] * s;
        while (rr >= 0 && rr < 15 && cc >= 0 && cc < 15 && board[rr][cc] === p) {
          n++; rr += d[0] * s; cc += d[1] * s;
        }
      }
      if (n >= 5) return true;
    }
    return false;
  }
  function tttStateWinner(board) {
    var i, j, p;
    for (i = 0; i < 3; i++) {
      p = board[i][0];
      if (p && board[i][1] === p && board[i][2] === p) return p;
      p = board[0][i];
      if (p && board[1][i] === p && board[2][i] === p) return p;
    }
    p = board[1][1];
    if (p && board[0][0] === p && board[2][2] === p) return p;
    if (p && board[0][2] === p && board[2][0] === p) return p;
    for (i = 0; i < 3; i++) if (board[i][0] === null || board[i][1] === null || board[i][2] === null) return null;
    return 'draw';
  }
  function winSegment(board, size, r, c, p) {
    for (var i = 0; i < DIRS.length; i++) {
      var d = DIRS[i], cells = [[r, c]];
      for (var s = -1; s <= 1; s += 2) {
        var rr = r + d[0] * s, cc = c + d[1] * s;
        while (rr >= 0 && rr < size && cc >= 0 && cc < size && board[rr][cc] === p) {
          cells.unshift([rr, cc]);
          rr += d[0] * s; cc += d[1] * s;
        }
      }
      if (cells.length >= 5) return cells;
    }
    return null;
  }
  function tttSegment(board, r, c, p) {
    var line = null, i;
    if (board[r][0] === p && board[r][1] === p && board[r][2] === p) line = [[r, 0], [r, 1], [r, 2]];
    else if (board[0][c] === p && board[1][c] === p && board[2][c] === p) line = [[0, c], [1, c], [2, c]];
    else if (r === c && board[0][0] === p && board[1][1] === p && board[2][2] === p) line = [[0, 0], [1, 1], [2, 2]];
    else if (r + c === 2 && board[0][2] === p && board[1][1] === p && board[2][0] === p) line = [[0, 2], [1, 1], [2, 0]];
    if (line) {
      for (i = 0; i < line.length; i++) if (line[i][0] === r && line[i][1] === c) return line;
    }
    return null;
  }

  /* ---------- 操作 ---------- */
  function place(game, r, c) {
    var g = game, size = g.size, p;
    if (g.over) return { ok: false, error: '本局已结束' };
    if (r < 0 || c < 0 || r >= size || c >= size) return { ok: false, error: '位置超出棋盘' };
    if (g.board[r][c] !== null) return { ok: false, error: '该位置已有棋子' };
    p = g.turn;
    g.board[r][c] = p;
    g.moves.push({ r: r, c: c, p: p });
    var win = g.kind === 'tictactoe' ? tttWins(g.board, r, c, p) : gomokuWins(g.board, r, c, p);
    if (win) {
      g.winner = p;
      g.over = true;
      g.winLine = g.kind === 'tictactoe' ? tttSegment(g.board, r, c, p) : winSegment(g.board, g.size, r, c, p);
      return { ok: true, winner: p };
    }
    if (g.moves.length === size * size) {
      g.winner = 'draw';
      g.over = true;
      return { ok: true, draw: true };
    }
    g.turn = p === 'X' ? 'O' : 'X';
    return { ok: true };
  }
  function undo(game) {
    if (!game.moves.length) return null;
    var m = game.moves.pop();
    game.board[m.r][m.c] = null;
    game.winner = null;
    game.over = false;
    game.byResign = false;
    game.winLine = null;
    game.turn = m.p;
    return m;
  }
  function resign(game, loser) {
    if (game.over) return null;
    game.winner = loser === 'X' ? 'O' : 'X';
    game.over = true;
    game.byResign = true;
    return game.winner;
  }

  /* ---------- 井字棋 AI（Minimax 完全搜索，必不输）
   * 难度：easy=随机落子；normal=完全搜索但 25% 失手；hard=完全搜索从不失误 ---------- */
  function emptyCells(game) {
    var out = [], i, j;
    for (i = 0; i < game.size; i++) for (j = 0; j < game.size; j++) {
      if (game.board[i][j] === null) out.push({ r: i, c: j });
    }
    return out;
  }
  function randOf(list) {
    return list[Math.floor(Math.random() * list.length)] || null;
  }
  function tttMinimax(board, player, aiStone) {
    var w = tttStateWinner(board);
    if (w === 'draw') return 0;
    if (w) return w === aiStone ? 1 : -1;
    var best = player === aiStone ? -Infinity : Infinity;
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
      if (board[i][j] !== null) continue;
      board[i][j] = player;
      var sc = tttMinimax(board, player === 'X' ? 'O' : 'X', aiStone);
      board[i][j] = null;
      if (player === aiStone) best = Math.max(best, sc);
      else best = Math.min(best, sc);
    }
    return best;
  }
  function tttAiMove(game, aiStone, diff) {
    var board = game.board, best = null, bestScore = -Infinity, i, j, sc;
    var empties = emptyCells(game);
    if (diff === 'easy') return randOf(empties);
    if (diff === 'normal' && Math.random() < 0.25) return randOf(empties);
    for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) {
      if (board[i][j] !== null) continue;
      board[i][j] = aiStone;
      sc = tttMinimax(board, aiStone === 'X' ? 'O' : 'X', aiStone);
      board[i][j] = null;
      if (sc > bestScore) { bestScore = sc; best = { r: i, c: j }; }
    }
    return best;
  }

  /* ---------- 五子棋 AI（评分启发式）
   * easy=随机空位（新手）；normal=进攻 1.2 / 防守 1.0 加权；hard=进攻 1.35 + 一层前瞻（评估对手最佳应对） ---------- */
  function gomokuPattern(seg, open) {
    if (seg >= 5) return 1000000;
    if (seg === 4) return open === 2 ? 100000 : open === 1 ? 10000 : 0;
    if (seg === 3) return open === 2 ? 8000 : open === 1 ? 400 : 0;
    if (seg === 2) return open === 2 ? 200 : open === 1 ? 20 : 0;
    return open === 2 ? 10 : 0;
  }
  function lineScore(board, size, r, c, p) {
    var total = 0;
    for (var i = 0; i < DIRS.length; i++) {
      var d = DIRS[i], seg = 1, open = 0, s, rr, cc;
      for (s = -1; s <= 1; s += 2) {
        rr = r + d[0] * s; cc = c + d[1] * s;
        while (rr >= 0 && rr < size && cc >= 0 && cc < size && board[rr][cc] === p) {
          seg++; rr += d[0] * s; cc += d[1] * s;
        }
        if (rr >= 0 && rr < size && cc >= 0 && cc < size && board[rr][cc] === null) open++;
      }
      total += gomokuPattern(seg, open);
    }
    return total;
  }
  function evalCell(board, size, r, c, p) {
    board[r][c] = p;
    var s = lineScore(board, size, r, c, p);
    board[r][c] = null;
    return s;
  }
  function findWinCell(board, size, p) {
    for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) {
      if (board[r][c] !== null) continue;
      board[r][c] = p;
      var w = gomokuWins(board, r, c, p);
      board[r][c] = null;
      if (w) return { r: r, c: c };
    }
    return null;
  }
  function candidates(board, size) {
    var out = [], seen = {};
    for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) {
      if (board[r][c] === null) continue;
      for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) {
        var nr = r + dr, nc = c + dc, k;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size || board[nr][nc] !== null) continue;
        k = nr * size + nc;
        if (seen[k]) continue;
        seen[k] = 1;
        out.push({ r: nr, c: nc });
      }
    }
    return out;
  }
  /* 常规最佳应手（win → block → 加权评分），供 normal 与 hard 的前瞻复用 */
  function gomokuBestMove(board, size, p) {
    var opp = p === 'X' ? 'O' : 'X';
    var winCell = findWinCell(board, size, p);
    if (winCell) return winCell;
    var block = findWinCell(board, size, opp);
    if (block) return block;
    var cands = candidates(board, size), best = null, bestScore = -Infinity;
    var ctr = (size - 1) / 2;
    for (var i = 0; i < cands.length; i++) {
      var m = cands[i];
      var s = evalCell(board, size, m.r, m.c, p) * 1.2 + evalCell(board, size, m.r, m.c, opp);
      s -= (Math.abs(m.r - ctr) + Math.abs(m.c - ctr)) * 0.5;
      if (s > bestScore) { bestScore = s; best = m; }
    }
    return best || { r: Math.floor(size / 2), c: Math.floor(size / 2) };
  }
  function gomokuAiMove(game, aiStone, diff) {
    var size = game.size, board = game.board, opp = aiStone === 'X' ? 'O' : 'X';
    var filled = 0, r, c, i;
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (board[r][c]) filled++;
    if (!filled) return { r: Math.floor(size / 2), c: Math.floor(size / 2) };
    if (diff === 'easy') return randOf(emptyCells(game));
    var winCell = findWinCell(board, size, aiStone);
    if (winCell) return winCell;
    var block = findWinCell(board, size, opp);
    if (block) return block;
    var cands = candidates(board, size), best = null, bestScore = -Infinity;
    var ctr = (size - 1) / 2;
    var wMul = diff === 'hard' ? 1.35 : 1.2;
    for (i = 0; i < cands.length; i++) {
      var m = cands[i];
      var s;
      if (diff === 'hard') {
        var my = evalCell(board, size, m.r, m.c, aiStone);
        board[m.r][m.c] = aiStone;
        var bm = gomokuBestMove(board, size, opp);
        var loss = 0;
        if (bm) {
          var w = gomokuWins(board, bm.r, bm.c, opp);
          loss = w ? 500000 : evalCell(board, size, bm.r, bm.c, aiStone);
        }
        board[m.r][m.c] = null;
        s = my * wMul - loss;
      } else {
        s = evalCell(board, size, m.r, m.c, aiStone) * wMul + evalCell(board, size, m.r, m.c, opp);
      }
      s -= (Math.abs(m.r - ctr) + Math.abs(m.c - ctr)) * 0.5;
      if (s > bestScore) { bestScore = s; best = m; }
    }
    return best || { r: Math.floor(size / 2), c: Math.floor(size / 2) };
  }

  return {
    createGame: createGame,
    cloneGame: cloneGame,
    place: place,
    undo: undo,
    resign: resign,
    tttAiMove: tttAiMove,
    gomokuAiMove: gomokuAiMove
  };
});