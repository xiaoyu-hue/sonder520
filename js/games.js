/* games.js - 娱乐游戏：井字棋 & 五子棋（AI 对决 / 双人对弈，悔棋 / 认输 / 战绩） */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var G = window.SonderGames;

  var currentEl = null, currentCtx = null;
  var state = { game: null, mode: 'ai', playerStone: 'X', difficulty: 'normal', mini: null };
  var busy = false;
  var aiTimer = null;
  var confirmOpen = false;

  var DIFF_LABEL = { easy: '简单', normal: '普通', hard: '困难' };
  function diffOptions(sel) {
    var s = '';
    ['easy', 'normal', 'hard'].forEach(function (d) {
      s += '<option value="' + d + '"' + (sel === d ? ' selected' : '') + '>' + DIFF_LABEL[d] + '</option>';
    });
    return s;
  }

  /* 统一确认框：防连点/叠加（同一时刻只允许一个弹窗），返回 Promise<boolean>。
   * 已有弹窗时新请求被忽略并提示，避免用户"点了没反应"。 */
  function askConfirm(ctx, message, okText) {
    if (confirmOpen) {
      ctx.UI.toast('请先处理当前弹出的确认框', 'err');
      return Promise.resolve(null);
    }
    confirmOpen = true;
    return ctx.UI.confirmBox(message, okText).then(function (ok) {
      confirmOpen = false;
      return ok;
    });
  }

  function aiStone() { return state.playerStone === 'X' ? 'O' : 'X'; }
  function playerName(stone) {
    if (state.mode === 'ai') return stone === state.playerStone ? '你' : 'AI';
    return stone === 'X' ? '玩家1' : '玩家2';
  }
  function sym(stone) { return stone === 'X' ? '✕' : '◯'; }
  function kindName(g) { return g.kind === 'gomoku' ? '五子棋' : '井字棋'; }

  function render(ctx) {
    var container = currentEl, UI = ctx.UI;
    container.innerHTML = '';
    container.appendChild(state.game ? gameView(ctx) : (state.mini ? miniView(ctx) : pickView(ctx)));
    container.appendChild(recordsArea(ctx));
  }

  /* ---------- 休闲小游戏 ---------- */
  function startMini(ctx, kind) {
    state.game = null;
    state.mini = { kind: kind, g: kind === 'guessnum' ? G.guessNumStart() : null };
    render(ctx);
  }

  function miniView(ctx) {
    if (state.mini.kind === 'guessnum') return guessNumView(ctx);
    return pickView(ctx);
  }

  function miniBest(kind) {
    try {
      var raw = window.localStorage.getItem('sonder_games_' + kind);
      if (!raw) return null;
      var o = JSON.parse(raw);
      return o && typeof o.best === 'number' ? o.best : null;
    } catch (e) { return null; }
  }
  function saveMiniBest(kind, best) {
    try { window.localStorage.setItem('sonder_games_' + kind, JSON.stringify({ best: best })); } catch (e) { /* 存储不可用则忽略 */ }
  }

  /* -------- 猜数字 -------- */
  function guessNumView(ctx) {
    var UI = ctx.UI, m = state.mini, g = m.g;
    var used = g.attempts.length, left = g.max - used;
    var best = miniBest('guessnum');
    var wrap = UI.el('<div></div>');
    wrap.appendChild(UI.el(
      '<div class="hbar">' +
      '<div class="lab" style="font-size:15px">🎯 猜数字</div>' +
      '<span class="muted small">心里想好 1~100，7 次机会猜中</span>' +
      '<span class="sp"></span>' +
      '<button class="btn" data-mact="back" type="button">← 选游戏</button>' +
      '</div>'
    ));
    var card = UI.el(
      '<div class="card">' +
      '<div class="row" style="align-items:center;gap:8px">' +
      '<span class="small muted">剩余机会</span><b id="mgLeft" aria-live="polite">' + left + '</b>' +
      '<span class="small muted" style="margin-left:auto">' + (best ? '最佳纪录 ' + best + ' 次' : '还没有纪录，打破它！') + '</span>' +
      '</div>' +
      '<div class="row" style="gap:10px;margin-top:12px">' +
      '<input type="number" id="mgGuess" min="1" max="100" step="1" inputmode="numeric" placeholder="输入 1~100" ' +
      'aria-label="输入要猜的数字（1 到 100）" style="min-height:44px;flex:1">' +
      '<button class="btn primary" id="mgGo" type="button" style="min-height:44px">猜！</button>' +
      '</div>' +
      '<div class="mg-hist" id="mgHist" role="status" aria-live="polite">' + histHtml(g) + '</div>' +
      (g.over ? '<div class="mg-result" id="mgResult">' + resultHtml(g, best) + '</div>' : '') +
      '<div class="row" style="margin-top:12px">' +
      '<button class="btn" data-mact="again" type="button" style="min-height:44px">🔄 再来一局</button>' +
      '</div>' +
      '</div>'
    );
    var go = function () {
      var input = card.querySelector('#mgGuess');
      var v = input ? input.value : '';
      var res = G.guessNumTry(g, v);
      if (!res.ok) { UI.toast(res.error, 'err'); return; }
      render(ctx);
    };
    var btn = card.querySelector('#mgGo');
    if (btn) btn.addEventListener('click', go);
    var input = card.querySelector('#mgGuess');
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    wrap.appendChild(card);
    wrap.querySelectorAll('[data-mact]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.mact === 'back') {
          state.mini = null;
          render(ctx);
        } else if (b.dataset.mact === 'again') {
          state.mini = { kind: 'guessnum', g: G.guessNumStart() };
          render(ctx);
        }
      });
    });
    return wrap;
  }

  function histHtml(g) {
    if (!g.attempts.length) return '<div class="muted small" style="margin-top:10px">还没开始，输入数字点击「猜！」</div>';
    var rows = '';
    g.attempts.forEach(function (n, i) {
      var cls = 'mid';
      var label = '平';
      if (n === g.target) { cls = 'got'; label = '中了！'; }
      else if (n > g.target) { cls = 'hi'; label = '大了'; }
      else { cls = 'lo'; label = '小了'; }
      rows += '<div class="mg-line"><span class="muted small">第' + (i + 1) + '次</span>' +
        '<b class="mg-num">' + n + '</b>' +
        '<span class="mg-hint ' + cls + '">' + label + '</span></div>';
    });
    return '<div style="margin-top:10px">' + rows + '</div>';
  }

  function resultHtml(g, best) {
    var html;
    if (g.won) {
      var nb = best === null || g.attempts.length < best ? g.attempts.length : best;
      saveMiniBest('guessnum', nb);
      html = '🎉 猜中了！用了 <b>' + g.attempts.length + '</b> 次' +
        (nb === g.attempts.length ? '，新纪录！' : '');
    } else {
      html = '机会用完了，答案是 <b>' + g.target + '</b>，下次加油！';
    }
    return html;
  }

  /* ---------- 游戏选择 ---------- */
  function pickView(ctx) {
    var UI = ctx.UI;
    var box = UI.el(
      '<div>' +
      '<div class="card" style="margin-bottom:14px">' +
      '<div class="row">' +
      '<span class="muted" style="margin-right:12px;white-space:nowrap">AI 难度</span>' +
      '<select id="gDiffPick" title="AI 难度档位">' + diffOptions(state.difficulty) + '</select>' +
      '<span class="muted small" style="margin-left:auto">困难 AI 更会进攻与布防</span>' +
      '</div>' +
      '</div>' +
      '<div class="grid cols-2">' +
      '<div class="card lg-pick" data-pick="tictactoe">' +
      '<div class="lab">井字棋</div>' +
      '<div class="sub">3×3 速战 · 三子连线即胜</div>' +
      '<div class="sub">AI 对决 / 双人对弈 · 悔棋 · 认输</div>' +
      '</div>' +
      '<div class="card lg-pick" data-pick="gomoku">' +
      '<div class="lab">五子棋</div>' +
      '<div class="sub">15×15 标准盘 · 五连即胜</div>' +
      '<div class="sub">AI 对决 / 双人对弈 · 悔棋 · 认输</div>' +
      '</div>' +
      '</div>' +
      '<div class="section-title" style="margin-top:18px">休闲小游戏</div>' +
      '<div class="grid cols-2">' +
      '<div class="card lg-pick" data-pick="guessnum">' +
      '<div class="lab">🎯 猜数字</div>' +
      '<div class="sub">1~100 心里数 · 7 次机会</div>' +
      '<div class="sub">大小提示 · 最佳纪录</div>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
    box.querySelectorAll('[data-pick]').forEach(function (c) {
      c.addEventListener('click', function () {
        var kind = c.dataset.pick;
        if (kind === 'guessnum' || kind === 'minesweeper' || kind === 'idiom' || kind === 'brainteaser') startMini(ctx, kind);
        else startGame(ctx, kind);
      });
    });
    var diffSel = box.querySelector('#gDiffPick');
    diffSel.addEventListener('change', function (e) { switchDiff(ctx, e.target.value); });
    return box;
  }

  /* ---------- 对局界面 ---------- */
  function gameView(ctx) {
    var UI = ctx.UI, g = state.game, i;
    var wrap = UI.el('<div></div>');
    wrap.appendChild(UI.el(
      '<div class="hbar">' +
      '<div class="lg-seg">' +
      '<button data-mode="ai" type="button">AI 对决</button>' +
      '<button data-mode="pvp" type="button">双人对弈</button>' +
      '</div>' +
      (state.mode === 'ai'
        ? '<select id="gFirst" title="先后手">' +
          '<option value="X"' + (state.playerStone === 'X' ? ' selected' : '') + '>执先（' + sym('X') + '）</option>' +
          '<option value="O"' + (state.playerStone === 'O' ? ' selected' : '') + '>执后（' + sym('O') + '）</option>' +
          '</select>' +
          '<select id="gDiff" title="AI 难度档位">' + diffOptions(state.difficulty) + '</select>'
        : '') +
      '<button class="btn" data-act="new" type="button">新开局</button>' +
      '</div>'
    ));
    wrap.appendChild(UI.el('<div class="gstatus" id="gStatus">' + UI.esc(statusText()) + '</div>'));

    var cells = '';
    for (var r = 0; r < g.size; r++) for (var c = 0; c < g.size; c++) {
      var v = g.board[r][c];
      var cls = 'cell';
      var inner = '';
      if (v === 'X') { inner = g.kind === 'tictactoe' ? '<span class="mk x">✕</span>' : '<span class="stone b"></span>'; }
      else if (v === 'O') { inner = g.kind === 'tictactoe' ? '<span class="mk o">◯</span>' : '<span class="stone w"></span>'; }
      if (v && g.moves.length && g.moves[g.moves.length - 1].r === r && g.moves[g.moves.length - 1].c === c) cls += ' last';
      if (g.winLine && onLine(g.winLine, r, c)) cls += ' win';
      cells += '<button type="button" class="' + cls + '" data-r="' + r + '" data-c="' + c + '" aria-label="第' + (r + 1) + '行第' + (c + 1) + '列">' + inner + '</button>';
    }
    var boardWrap = UI.el(
      '<div class="board-wrap">' +
      '<div class="game-board ' + (g.kind === 'gomoku' ? 'big' : 'small') + (g.over ? ' done' : '') + '" id="gBoard">' + cells + '</div>' +
      '</div>'
    );
    wrap.appendChild(boardWrap);

    var ops = UI.el(
      '<div class="row" style="justify-content:center;gap:12px;margin-top:14px">' +
      '<button class="btn" data-act="undo" type="button">悔棋</button>' +
      '<button class="btn danger" data-act="resign" type="button">认输</button>' +
      '<button class="btn" data-act="back" type="button">← 选游戏</button>' +
      '</div>'
    );
    wrap.appendChild(ops);

    var segbtns = wrap.querySelectorAll('.lg-seg button');
    segbtns.forEach(function (b) {
      b.classList.toggle('on', b.dataset.mode === state.mode);
      b.addEventListener('click', function () { switchMode(ctx, b.dataset.mode); });
    });
    wrap.querySelector('[data-act="new"]').addEventListener('click', function () { newGame(ctx); });
    wrap.querySelector('[data-act="undo"]').addEventListener('click', function () { undoMove(ctx); });
    wrap.querySelector('[data-act="resign"]').addEventListener('click', function () { resignGame(ctx); });
    wrap.querySelector('[data-act="back"]').addEventListener('click', function () { backToPick(ctx); });
    var firstSel = wrap.querySelector('#gFirst');
    if (firstSel) firstSel.addEventListener('change', function (e) { switchFirst(ctx, e.target.value); });
    var diffSel = wrap.querySelector('#gDiff');
    if (diffSel) diffSel.addEventListener('change', function (e) { switchDiff(ctx, e.target.value); });
    boardWrap.querySelectorAll('.cell').forEach(function (cell) {
      cell.addEventListener('click', function () {
        if (busy || !state.game || state.game.over) return;
        if (state.mode === 'ai' && state.game.turn !== state.playerStone) return;
        doPlace(ctx, Number(cell.dataset.r), Number(cell.dataset.c));
      });
    });
    return wrap;
  }

  function onLine(line, r, c) {
    for (var i = 0; i < line.length; i++) if (line[i][0] === r && line[i][1] === c) return true;
    return false;
  }

  function statusText() {
    var g = state.game;
    if (!g) return '';
    if (g.over) {
      if (g.winner === 'draw') return '平局，不分胜负';
      var w = playerName(g.winner);
      return w + ' 获胜' + (g.byResign ? '（对方认输）' : '');
    }
    var t = playerName(g.turn);
    if (state.mode === 'ai' && busy) return t + ' 思考中…';
    return t + '（' + sym(g.turn) + '）落子';
  }

  /* ---------- 对局操作 ---------- */
  function startGame(ctx, kind) {
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    state.game = G.createGame(kind);
    busy = false;
    render(ctx);
    if (state.mode === 'ai' && state.game.turn === aiStone()) aiThink(ctx);
  }

  function doPlace(ctx, r, c) {
    var g = state.game;
    var res = G.place(g, r, c);
    if (!res.ok) { ctx.UI.toast(res.error, 'err'); return; }
    render(ctx);
    if (res.winner || res.draw) { recordEnd(ctx); return; }
    if (state.mode === 'ai' && g.turn === aiStone()) aiThink(ctx);
  }

  function aiThink(ctx) {
    var g = state.game;
    if (!g || g.over) return;
    busy = true;
    var st = document.querySelector('#gStatus');
    if (st) st.textContent = statusText();
    var delay = g.moves.length === 0 ? 320 : 220;
    aiTimer = setTimeout(function () {
      aiTimer = null;
      busy = false;
      if (!state.game || state.game !== g || state.game.over || state.game.turn !== aiStone()) return;
      var mv = state.game.kind === 'tictactoe' ? G.tttAiMove(state.game, aiStone(), state.difficulty) : G.gomokuAiMove(state.game, aiStone(), state.difficulty);
      var res = G.place(state.game, mv.r, mv.c);
      render(ctx);
      if (res.winner || res.draw) recordEnd(ctx);
    }, delay);
  }

    /* 悔棋：
   * 仅对局进行中可用（终局后禁止）。
   * AI 模式 - 撤回己方与 AI 各一步回到玩家思考点，可连续悔多步；
   *           AI 思考中悔棋会取消其待落子（正在想的那步一并撤回）。
   * 双人模式 - 由刚落子的一方提出收回刚落的这步，对方同意才撤销。 */
  function undoMove(ctx) {
    var g = state.game, UI = ctx.UI;
    if (!g) return;
    if (g.over) { UI.toast('对局已结束，不能悔棋', 'err'); return; }
    if (busy) {
      clearTimeout(aiTimer);
      aiTimer = null;
      busy = false;
    }
    if (!g.moves.length) { UI.toast('暂无落子可悔', 'err'); return; }
    if (state.mode === 'pvp') {
      var last = g.moves[g.moves.length - 1];
      var asker = playerName(last.p);
      var opp = playerName(last.p === 'X' ? 'O' : 'X');
      askConfirm(ctx, asker + '（' + sym(last.p) + '）想收回刚落的这一步，' + opp + ' 是否同意？', '同意悔棋').then(function (ok) {
        if (ok === null) return;
        if (!ok) { UI.toast('对方不同意悔棋'); return; }
        G.undo(g);
        UI.toast('对方已同意，撤销一步');
        render(ctx);
      });
      return;
    }
    G.undo(g);
    if (g.turn !== state.playerStone) G.undo(g);
    UI.toast('已悔棋');
    render(ctx);
    if (state.mode === 'ai' && g.turn === aiStone()) aiThink(ctx);
  }

  function resignGame(ctx) {
    var g = state.game, UI = ctx.UI;
    if (!g || g.over) return;
    if (busy) {
      clearTimeout(aiTimer);
      aiTimer = null;
      busy = false;
    }
    if (!g.moves.length) { UI.toast('还没落子，先下一手吧', 'err'); return; }
    askConfirm(ctx, state.mode === 'ai' ? '确定认输？本局判给 AI 获胜' : '确定认输？本局判给对面获胜', '认输').then(function (ok) {
      if (ok !== true) return;
      G.resign(g, state.mode === 'ai' ? state.playerStone : g.turn);
      recordMatch(ctx);
      UI.toast('你已认输');
      render(ctx);
    });
  }

  function newGame(ctx) {
    var g = state.game, UI = ctx.UI;
    if (!g) return;
    if (!g.moves.length) { startGame(ctx, g.kind); return; }
    askConfirm(ctx, '新开一局？当前进度将被清空', '新开局').then(function (ok) {
      if (ok === true) startGame(ctx, g.kind);
    });
  }

  function backToPick(ctx) {
    var g = state.game, UI = ctx.UI;
    if (!g) return;
    var leave = function () {
      if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
      state.game = null;
      busy = false;
      render(ctx);
    };
    if (!g.moves.length && !g.over) { leave(); return; }
    askConfirm(ctx, '返回游戏选择？当前对局进度将丢失', '返回').then(function (ok) { if (ok === true) leave(); });
  }

  function switchMode(ctx, mode) {
    if (state.mode === mode) return;
    var g = state.game;
    if (!g) return;
    var go = function () {
      state.mode = mode;
      startGame(ctx, g.kind);
    };
    if (g.moves.length || g.over) askConfirm(ctx, '切换模式将重新开局，确定？', '切换').then(function (ok) { if (ok === true) go(); });
    else go();
  }

  function switchFirst(ctx, stone) {
    var g = state.game;
    var v = stone === 'O' ? 'O' : 'X';
    if (state.playerStone === v) return;
    var go = function () {
      state.playerStone = v;
      startGame(ctx, g.kind);
    };
    if (g.moves.length || g.over) askConfirm(ctx, '改变先后手将重新开局，确定？', '切换').then(function (ok) { if (ok === true) go(); });
    else go();
  }

  function switchDiff(ctx, v) {
    if (state.difficulty === v) return;
    var g = state.game;
    var go = function () {
      state.difficulty = ctx.store.setGameDifficulty(v);
      if (g) startGame(ctx, g.kind);
      else render(ctx);
    };
    if (g && (g.moves.length || g.over)) askConfirm(ctx, '切换难度将重新开局，确定？', '切换').then(function (ok) { if (ok === true) go(); });
    else go();
  }

  /* ---------- 战绩 ---------- */
  function recordMatch(ctx) {
    var g = state.game;
    ctx.store.addGameRecord({
      kind: g.kind, mode: state.mode,
      player: state.mode === 'ai' ? state.playerStone : 'X',
      winner: g.winner, byResign: g.byResign,
      difficulty: state.mode === 'ai' ? state.difficulty : null
    });
  }
  function recordEnd(ctx) {
    var g = state.game;
    recordMatch(ctx);
    ctx.UI.toast(g.winner !== 'draw' ? '本局结束：' + playerName(g.winner) + ' 获胜' : '本局平局');
    render(ctx);
  }

  function resultText(r) {
    if (r.winner === 'draw') return '平局';
    if (r.mode === 'pvp') return r.winner === 'X' ? '玩家1胜' : '玩家2胜';
    return r.winner === r.player ? '你胜' : 'AI胜';
  }
  function resultPill(r) {
    if (r.winner === 'draw') return 'mid';
    return r.winner === r.player ? 'lo' : 'hi';
  }
  function shortDate(d) {
    return String(d || '').slice(5);
  }
  function diffBadge(r) {
    if (r.mode !== 'ai' || !r.difficulty) return '';
    var label = DIFF_LABEL[r.difficulty] || r.difficulty;
    return '<span class="small muted" style="margin-left:8px;white-space:nowrap">' + window.UI.esc(label) + '</span>';
  }

  function recordsArea(ctx) {
    var UI = ctx.UI, recs = ctx.store.state.gameRecords;
    var box = UI.el('<div></div>');
    box.appendChild(UI.el('<div class="section-title">对战记录</div>'));
    var card = UI.el('<div class="card"></div>');
    if (!recs.length) {
      card.appendChild(UI.el('<div class="muted small" style="padding:12px 16px">暂无对局记录，来一局吧</div>'));
    } else {
      recs.forEach(function (r) {
        card.appendChild(UI.el(
          '<div class="list-item">' +
          '<div class="grow">' +
          '<div class="title">' + UI.esc(kindName({ kind: r.kind })) + ' · ' + (r.mode === 'ai' ? 'AI 对决' : '双人对弈') + diffBadge(r) + '</div>' +
          '<div class="sub">' + UI.esc(shortDate(r.date)) + (r.byResign ? ' · 认输' : '') + '</div>' +
          '</div>' +
          '<span class="pill ' + resultPill(r) + '">' + resultText(r) + '</span>' +
          '</div>'
        ));
      });
      var clearBtn = UI.el('<button class="small-btn danger" style="margin:10px 16px 6px" data-rec="clear">清空记录</button>');
      clearBtn.addEventListener('click', function () {
        askConfirm(ctx, '清空全部战绩记录？', '清空').then(function (ok) {
          if (ok !== true) return;
          ctx.store.clearGameRecords();
          UI.toast('战绩已清空');
          render(ctx);
        });
      });
      card.appendChild(clearBtn);
    }
    box.appendChild(card);
    return box;
  }

  Pages.game = {
    title: '娱乐游戏',
    render: function (container, ctx) {
      currentEl = container;
      currentCtx = ctx;
      var d = ctx.store.state.settings.gameDifficulty;
      if (d === 'easy' || d === 'hard' || d === 'normal') state.difficulty = d;
      render(ctx);
    }
  };

  /* 测试/调试钩子：只读快照，对正常运行无害 */
  window.__gamesDbg = function () {
    var g = state.game;
    return {
      mode: state.mode,
      playerStone: state.playerStone,
      difficulty: state.difficulty,
      busy: busy,
      game: g && { kind: g.kind, turn: g.turn, moves: g.moves.length, over: g.over, winner: g.winner },
      mini: state.mini && { kind: state.mini.kind, target: state.mini.g.target, attempts: state.mini.g.attempts.length, over: state.mini.g.over, won: state.mini.g.won }
    };
  };
  /* 测试钩子：注入确定的猜数字答案（仅测试用） */
  window.__gamesDbg.setMiniTarget = function (n) {
    if (state.mini && state.mini.kind === 'guessnum') state.mini.g.target = n;
  };
})();