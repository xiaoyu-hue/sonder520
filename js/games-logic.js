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
  function gomokuWins(board, size, r, c, p) {
    for (var i = 0; i < DIRS.length; i++) {
      var d = DIRS[i], n = 1, s, rr, cc;
      for (s = -1; s <= 1; s += 2) {
        rr = r + d[0] * s; cc = c + d[1] * s;
        while (rr >= 0 && rr < size && cc >= 0 && cc < size && board[rr][cc] === p) {
          n++; rr += d[0] * s; cc += d[1] * s;
        }
      }
      if (n >= 5) return true;
    }
    return false;
  }
  function tttStateWinner(board) {
    var i, p;
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
    if (r % 1 !== 0 || c % 1 !== 0) return { ok: false, error: '位置非法' };
    if (g.board[r][c] !== null) return { ok: false, error: '该位置已有棋子' };
    p = g.turn;
    g.board[r][c] = p;
    g.moves.push({ r: r, c: c, p: p });
    var win = g.kind === 'tictactoe' ? tttWins(g.board, r, c, p) : gomokuWins(g.board, g.size, r, c, p);
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
    if (!empties.length) return null;
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
      var w = gomokuWins(board, size, r, c, p);
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
    /* 困难模式前瞻预算：候选过多时仅对评分最高的前 HARD_LOOKAHEAD 个做一层前瞻，其余用基础评分。
       避免终盘百级候选数的平方级评估拖慢低端手机，棋力损失可忽略 */
    var HARD_LOOKAHEAD = 16;
    var topIdx = null;
    if (diff === 'hard' && cands.length > HARD_LOOKAHEAD) {
      var scoreArr = new Array(cands.length);
      for (i = 0; i < cands.length; i++) {
        scoreArr[i] = evalCell(board, size, cands[i].r, cands[i].c, aiStone) * wMul + evalCell(board, size, cands[i].r, cands[i].c, opp);
      }
      var idxs = [];
      for (i = 0; i < cands.length; i++) idxs.push(i);
      idxs.sort(function (a, b) { return scoreArr[b] - scoreArr[a]; });
      topIdx = {};
      for (i = 0; i < HARD_LOOKAHEAD; i++) topIdx[idxs[i]] = 1;
    }
    for (i = 0; i < cands.length; i++) {
      var m = cands[i];
      var s;
      if (diff === 'hard' && (!topIdx || topIdx[i])) {
        var my = evalCell(board, size, m.r, m.c, aiStone);
        board[m.r][m.c] = aiStone;
        var bm = gomokuBestMove(board, size, opp);
        var loss = 0;
        if (bm) {
          var w = gomokuWins(board, size, bm.r, bm.c, opp);
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

  /* ================================================================
   * 猜数字：1~100 随机数，最多 7 次机会（纯逻辑，无 DOM）
   * ================================================================ */
  function guessNumStart() {
    return {
      target: 1 + Math.floor(Math.random() * 100),
      max: 7,
      attempts: [],
      over: false,
      won: false
    };
  }
  /* input: 用户输入（字符串或数字）。返回 { ok:false, error } 或 { ok:true, n, hint, win?, lose?, used?, target? } */
  function guessNumTry(g, input) {
    if (!g) return { ok: false, error: '请先开始一局' };
    if (g.over) return { ok: false, error: '本局已结束，重新开始吧' };
    var s = String(input == null ? '' : input).trim();
    if (!/^\d+$/.test(s)) return { ok: false, error: '请输入 1~100 之间的整数' };
    var n = Number(s);
    if (n < 1 || n > 100) return { ok: false, error: '数字要在 1~100 之间' };
    g.attempts.push(n);
    if (n === g.target) {
      g.over = true;
      g.won = true;
      return { ok: true, n: n, win: true, used: g.attempts.length };
    }
    var res = { ok: true, n: n, hint: n > g.target ? 'high' : 'low' };
    if (g.attempts.length >= g.max) {
      g.over = true;
      res.lose = true;
      res.target = g.target;
    }
    return res;
  }

  /* ================================================================
   * 扫雷：经典扫雷纯逻辑（雷区首次翻开时布雷，首击必安全）
   * ================================================================ */
  function mineStart(rows, cols, mines) {
    var n = Math.max(1, rows * cols - 1);
    return {
      rows: rows, cols: cols, mines: Math.min(mines, n),
      board: null, over: false, won: false,
      revealed: 0, flagged: 0, first: true
    };
  }
  function mineCell() {
    return { mine: false, revealed: false, flagged: false, adj: 0 };
  }
  /* 首次翻开时布雷：(r,c) 及其 3×3 邻域不布雷，保证首击安全 */
  function mineLay(s, r, c) {
    var b = [];
    for (var i = 0; i < s.rows; i++) {
      b.push([]);
      for (var j = 0; j < s.cols; j++) b[i].push(mineCell());
    }
    var exclude = {};
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        var er = r + dr, ec = c + dc;
        if (er >= 0 && er < s.rows && ec >= 0 && ec < s.cols) exclude[er + ',' + ec] = 1;
      }
    }
    var placed = 0, guard = 0;
    while (placed < s.mines && guard++ < 5000) {
      var mr = Math.floor(Math.random() * s.rows);
      var mc = Math.floor(Math.random() * s.cols);
      var key = mr + ',' + mc;
      if (exclude[key] || b[mr][mc].mine) continue;
      b[mr][mc].mine = true;
      exclude[key] = 1;
      placed++;
    }
    for (i = 0; i < s.rows; i++) {
      for (j = 0; j < s.cols; j++) {
        if (b[i][j].mine) continue;
        var a = 0;
        for (dr = -1; dr <= 1; dr++) {
          for (dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            er = i + dr; ec = j + dc;
            if (er >= 0 && er < s.rows && ec >= 0 && ec < s.cols && b[er][ec].mine) a++;
          }
        }
        b[i][j].adj = a;
      }
    }
    s.board = b;
    s.first = false;
    s.mines = placed; /* 排除区过大时实际布雷数可能少于请求，以实盘为准 */
    return b;
  }
  function mineNeighbors(s, r, c) {
    var out = [];
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        var nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < s.rows && nc >= 0 && nc < s.cols) out.push([nr, nc]);
      }
    }
    return out;
  }
  function mineReveal(s, r, c) {
    if (!s || s.over) return { ok: false, error: '本局已结束' };
    if (!(r >= 0 && r < s.rows && c >= 0 && c < s.cols) || r % 1 !== 0 || c % 1 !== 0) return { ok: false, error: '越界' };
    if (!s.board) {
      mineLay(s, r, c);
      /* 布雷后回填先插的旗（首次插旗不布雷，因此这里不会踩到首击必安全逻辑） */
      if (s.pendingFlags) {
        var pf;
        for (pf in s.pendingFlags) {
          var p = pf.split(','), pr = +p[0], pc = +p[1];
          if (pr >= 0 && pr < s.rows && pc >= 0 && pc < s.cols) s.board[pr][pc].flagged = true;
        }
      }
    }
    var b = s.board;
    if (b[r][c].revealed) return { ok: false, error: '该格已翻开' };
    if (b[r][c].flagged) return { ok: false, error: '该格已被标记，先取消标记再翻开' };
    if (b[r][c].mine) {
      s.over = true;
      b[r][c].revealed = true;
      s.revealed++;
      return { ok: true, mine: true, over: true };
    }
    var opened = 0;
    var queue = [[r, c]];
    b[r][c].revealed = true;
    opened++;
    while (queue.length) {
      var cur = queue.shift();
      if (b[cur[0]][cur[1]].adj === 0) {
        mineNeighbors(s, cur[0], cur[1]).forEach(function (n) {
          var cell = b[n[0]][n[1]];
          if (cell.revealed || cell.flagged || cell.mine) return;
          cell.revealed = true;
          opened++;
          queue.push(n);
        });
      }
    }
    s.revealed += opened;
    if (s.revealed >= s.rows * s.cols - s.mines) {
      s.over = true;
      s.won = true;
      return { ok: true, opened: opened, won: true, over: true };
    }
    return { ok: true, opened: opened };
  }
  function mineToggleFlag(s, r, c) {
    if (!s || s.over) return { ok: false, error: '本局已结束' };
    if (!(r >= 0 && r < s.rows && c >= 0 && c < s.cols) || r % 1 !== 0 || c % 1 !== 0) return { ok: false, error: '越界' };
    /* 首次动作是插旗时不布雷：布雷推迟到首次翻开，保证首击必安全（插旗只暂存旗位，翻开时回填） */
    if (!s.board) {
      var key = r + ',' + c;
      if (!s.pendingFlags) s.pendingFlags = {};
      var on = !s.pendingFlags[key];
      if (on) s.pendingFlags[key] = 1; else delete s.pendingFlags[key];
      s.flagged += on ? 1 : -1;
      return { ok: true, flagged: on };
    }
    var b = s.board, cell = b[r][c];
    if (cell.revealed) return { ok: false, error: '已翻开的格子不能标记' };
    cell.flagged = !cell.flagged;
    s.flagged += cell.flagged ? 1 : -1;
    /* 旗数等于雷数且全部标对 → 判胜，避免错旗导致无法翻开的死局 */
    if (s.flagged === s.mines && mineAllFlaggedCorrect(b)) {
      s.over = true;
      s.won = true;
      return { ok: true, flagged: cell.flagged, won: true, over: true, left: 0 };
    }
    return { ok: true, flagged: cell.flagged, left: s.mines - s.flagged };
  }
  function mineAllFlaggedCorrect(b) {
    for (var i = 0; i < b.length; i++) {
      for (var j = 0; j < b[i].length; j++) {
        if (b[i][j].flagged && !b[i][j].mine) return false;
      }
    }
    return true;
  }

  /* ================================================================
   * 猜成语：根据谜面猜成语，3 次机会，答错给提示字
   * ================================================================ */
  var IDIOM_POOL = [
    { q: '最贵的字', hint: '字', a: '一字千金' },
    { q: '最长的腿', hint: '步', a: '一步登天' },
    { q: '最吝啬的人', hint: '毛', a: '一毛不拔' },
    { q: '最反常的天气', hint: '晴', a: '晴天霹雳' },
    { q: '最绝望的前途', hint: '山', a: '山穷水尽' },
    { q: '最长的寿命', hint: '万', a: '万寿无疆' },
    { q: '最宽阔的嘴巴', hint: '口', a: '口若悬河' },
    { q: '最高大的人', hint: '顶', a: '顶天立地' },
    { q: '最快的看书方法', hint: '目', a: '一目十行' },
    { q: '最短的季节', hint: '日', a: '一日三秋' }
  ];
  function idiomStart() {
    var item = IDIOM_POOL[Math.floor(Math.random() * IDIOM_POOL.length)];
    return {
      q: item.q, hint: item.hint, answer: item.a,
      tries: 0, max: 3, over: false, correct: false
    };
  }
  function idiomTry(s, input) {
    if (!s || s.over) return { ok: false, error: '本局已结束，再来一题吧' };
    var text = String(input == null ? '' : input).trim().replace(/\s+/g, '');
    if (!text) return { ok: false, error: '请输入一个成语' };
    if (text === s.answer) {
      s.over = true;
      s.correct = true;
      return { ok: true, correct: true, answer: s.answer, tries: s.tries + 1 };
    }
    s.tries++;
    var res = { ok: true, correct: false, tries: s.tries };
    if (s.tries >= s.max) {
      s.over = true;
      res.answer = s.answer;
    } else {
      res.hint = s.hint;
    }
    return res;
  }

  /* ================================================================
   * 脑筋急转弯：奇趣问答，可多次作答，支持「看答案」揭示
   * ================================================================ */
  var BRAIN_POOL = [
    { q: '什么事天不知地知，你不知我知？', a: ['鞋底破了个洞', '鞋底破洞'] },
    { q: '什么东西天气越热，它爬得越高？', a: ['温度计'] },
    { q: '什么数字倒立以后会增加一半？', a: ['6'] },
    { q: '什么车开不了？', a: ['风车'] },
    { q: '什么门永远关不上？', a: ['球门'] },
    { q: '什么人一下子就会变老？', a: ['新娘'] },
    { q: '什么布剪不断？', a: ['瀑布'] },
    { q: '什么书从来没人见过？', a: ['天书'] },
    { q: '什么牛不吃草？', a: ['蜗牛'] },
    { q: '什么碗不能盛饭？', a: ['铁饭碗'] }
  ];
  function brainStart() {
    var item = BRAIN_POOL[Math.floor(Math.random() * BRAIN_POOL.length)];
    return { q: item.q, accepted: item.a.slice(), over: false, correct: false };
  }
  function brainTry(s, input) {
    if (!s || s.over) return { ok: false, error: '本题已结束，换个问题吧' };
    var text = String(input == null ? '' : input).trim().replace(/\s+/g, '');
    if (!text) return { ok: false, error: '请输入你的答案' };
    for (var i = 0; i < s.accepted.length; i++) {
      if (text === s.accepted[i]) {
        s.over = true;
        s.correct = true;
        return { ok: true, correct: true, answer: s.accepted[0] };
      }
    }
    return { ok: true, correct: false };
  }

  return {
    createGame: createGame,
    place: place,
    undo: undo,
    resign: resign,
    tttAiMove: tttAiMove,
    gomokuAiMove: gomokuAiMove,
    guessNumStart: guessNumStart,
    guessNumTry: guessNumTry,
    mineStart: mineStart,
    mineLay: mineLay,
    mineReveal: mineReveal,
    mineToggleFlag: mineToggleFlag,
    idiomStart: idiomStart,
    idiomTry: idiomTry,
    IDIOM_POOL: IDIOM_POOL,
    brainStart: brainStart,
    brainTry: brainTry,
    BRAIN_POOL: BRAIN_POOL
  };
});