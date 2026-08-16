/* games-battle.js - 娱乐游戏：对弈域（井字棋 & 五子棋：AI 对决 / 双人对弈，悔棋 / 认输 / 战绩）
 * 共享状态见 games-shared.js（window.SonderGamesShared，须先加载），逻辑见 games-logic.js（window.SonderGames），
 * 视图纯函数见 games-view.js（window.SonderGamesView）。输出 window.SonderGamesBattle（games.js 编排调用）。 */
(function () {
  'use strict';
  var G = window.SonderGames;
  var V = window.SonderGamesView;
  var S = window.SonderGamesShared;

  /* 共享对象引用（games.js 的 render 在运行时挂到 S.render，此处仅为同名局部包装） */
  var state = S.state;
  function render(ctx) { S.render(ctx); }
  function askConfirm(ctx, message, okText) { return S.askConfirm(ctx, message, okText); }
  function aiStone() { return S.aiStone(); }
  function playerName(stone) { return S.playerName(stone); }
  function sym(stone) { return S.sym(stone); }

  /* ---------- 对局界面 ---------- */
  function gameView(ctx) {
    var UI = ctx.UI, g = state.game;
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
          '<select id="gDiff" title="AI 难度档位">' + V.diffOptions(state.difficulty) + '</select>'
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
      if (g.winLine && V.onLine(g.winLine, r, c)) cls += ' win';
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
        if (S.busy || !state.game || state.game.over) return;
        if (state.mode === 'ai' && state.game.turn !== state.playerStone) return;
        doPlace(ctx, Number(cell.dataset.r), Number(cell.dataset.c));
      });
    });
    return wrap;
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
    if (state.mode === 'ai' && S.busy) return t + ' 思考中…';
    return t + '（' + sym(g.turn) + '）落子';
  }

  /* ---------- 对局操作 ---------- */
  function startGame(ctx, kind) {
    if (S.aiTimer) { clearTimeout(S.aiTimer); S.aiTimer = null; }
    S.aiSeq++; /* 作废在途 worker 计算（重开/切换） */
    S.aiWaitCtx = null;
    state.game = G.createGame(kind);
    S.busy = false;
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
    if (!g || g.over || S.aiTimer || S.aiWaitCtx) return; /* P5a：重入守卫——render 恢复路径与落子路径可能各自调度，已挂起时直接跳过 */
    S.busy = true;
    var st = document.querySelector('#gStatus');
    if (st) st.textContent = statusText();
    var delay = g.moves.length === 0 ? 320 : 220;
    /* 五子棋：优先交给 Worker 异步计算（结构化克隆投递，不阻塞主线程）；失败自动回退同步 */
    if (g.kind === 'gomoku' && ensureAiWorker()) {
      S.aiWaitCtx = ctx;
      S.aiTimer = setTimeout(workerTimeout, S.WORKER_TIMEOUT); /* P5f：worker 挂起/永不回复时同步兜底，防止 busy 永久锁死棋盘 */
      S.aiWorker.postMessage({ id: ++S.aiSeq, game: g, stone: aiStone(), diff: state.difficulty });
      return;
    }
    S.aiTimer = setTimeout(function () {
      S.aiTimer = null;
      S.busy = false;
      if (!state.game || state.game !== g || state.game.over || state.game.turn !== aiStone()) return;
      /* 越页守卫：玩家在 AI 思考期间切走（#gStatus 已从 #content 移除）时不劫持当前页面；
       * 对局保留，切回时 render 会重新调度 AI 落子 */
      if (!document.getElementById('gStatus')) return;
      var mv = state.game.kind === 'tictactoe' ? G.tttAiMove(state.game, aiStone(), state.difficulty) : G.gomokuAiMove(state.game, aiStone(), state.difficulty);
      var res = G.place(state.game, mv.r, mv.c);
      render(ctx);
      if (res.winner || res.draw) recordEnd(ctx);
    }, delay);
  }

  /* ---------- 五子棋 AI Worker ---------- */
  function ensureAiWorker() {
    if (S.aiWorker) return true;
    if (typeof Worker === 'undefined') return false;
    try {
      var w = new Worker('js/game-worker.js');
      w.onmessage = onAiWorkerMsg;
      w.onerror = function () {
        S.aiWorker = null;
        fallbackSyncAi();
      };
      S.aiWorker = w;
      return true;
    } catch (e) {
      S.aiWorker = null;
      return false;
    }
  }

  /* worker 回复落子：id 与当前 aiSeq 不一致即过期（悔棋/重开/切换），直接丢弃 */
  function onAiWorkerMsg(e) {
    var d = e && e.data;
    if (!d || d.id !== S.aiSeq) return;
    S.aiSeq++; /* 本回复已消费，后续同 id 消息视为过期 */
    if (S.aiTimer) { clearTimeout(S.aiTimer); S.aiTimer = null; } /* 取消在看守的 watchdog */
    S.busy = false;
    var ctx = S.aiWaitCtx;
    S.aiWaitCtx = null; /* P6a：先消费等待上下文再执行守卫——越页/换局回复不得残留 aiWaitCtx，否则切回时 aiThink 重入守卫永久阻塞 AI */
    var g = state.game;
    if (!g || g.over || g.turn !== aiStone()) return;
    if (!document.getElementById('gStatus')) return; /* 越页守卫：不劫持当前页面，切回时 render 恢复路径重新调度 */
    var mv = d.mv;
    if (!mv || typeof mv.r !== 'number' || typeof mv.c !== 'number') { fallbackSyncAi(); return; }
    var res = G.place(g, mv.r, mv.c);
    render(ctx);
    if (res.winner || res.draw) recordEnd(ctx);
  }

  /* worker 回复超时：AI 思考中未收到回复则同步兜底（fallbackSyncAi 内部先复位状态再守卫，
   * 若玩家已悔棋/切走/对局结束则静默作废） */
  function workerTimeout() {
    fallbackSyncAi();
  }

  /* worker 异常/超时兜底：同步重算落子（保证 AI 对局不卡死） */
  function fallbackSyncAi() {
    S.aiSeq++; /* 结构性作废在途 worker 回复：兜底落子后旧 id 消息即使到达也会被 id 守卫丢弃，杜绝双落子 */
    var ctx = S.aiWaitCtx;
    S.aiWaitCtx = null;
    S.aiTimer = null;
    S.busy = false;
    if (!ctx || !state.game || state.game.kind !== 'gomoku' || state.game.over || state.game.turn !== aiStone()) return;
    if (!document.getElementById('gStatus')) return;
    var mv = G.gomokuAiMove(state.game, aiStone(), state.difficulty);
    var res = G.place(state.game, mv.r, mv.c);
    render(ctx);
    if (res.winner || res.draw) recordEnd(ctx);
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
    if (!g.moves.length) {
      /* P6b：AI 思考窗口期（AI 先手开局/思考中）空盘悔棋——先复位在途 AI 状态再刷新，
       * 否则状态条停在「思考中」且 AI 永不落子（点击被 turn 守卫吞掉，对局卡死） */
      if (S.busy) {
        clearTimeout(S.aiTimer);
        S.aiTimer = null;
        S.aiSeq++; /* 作废在途 worker 回复 */
        S.aiWaitCtx = null;
        S.busy = false;
      }
      UI.toast('暂无落子可悔', 'err');
      render(ctx);
      return;
    }
    if (S.busy) {
      clearTimeout(S.aiTimer);
      S.aiTimer = null;
      S.aiSeq++; /* 作废在途 worker 回复（AI 思考中悔棋） */
      S.aiWaitCtx = null;
      S.busy = false;
    }
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
    if (!g.moves.length) {
      /* P6c：AI 思考窗口期（AI 先手开局）空盘认输——同 P6b，先复位再刷新，对局不得卡死 */
      if (S.busy) {
        clearTimeout(S.aiTimer);
        S.aiTimer = null;
        S.aiSeq++; /* 作废在途 worker 回复 */
        S.aiWaitCtx = null;
        S.busy = false;
      }
      UI.toast('还没落子，先下一手吧', 'err');
      render(ctx);
      return;
    }
    if (S.busy) {
      clearTimeout(S.aiTimer);
      S.aiTimer = null;
      S.aiSeq++; /* 作废在途 worker 回复（AI 思考中认输） */
      S.aiWaitCtx = null;
      S.busy = false;
    }
    askConfirm(ctx, state.mode === 'ai' ? '确定认输？本局判给 AI 获胜' : '确定认输？本局判给对面获胜', '认输').then(function (ok) {
      if (ok !== true) return;
      var w = G.resign(g, state.mode === 'ai' ? state.playerStone : 'X');
      if (w === null) { UI.toast('对局已结束，未产生记录'); return; } /* P5a：终局后（如幽灵定时器已落子）不再补记 */
      recordMatch(ctx);
      UI.toast('你已认输');
      render(ctx);
    });
  }

  function newGame(ctx) {
    var g = state.game;
    if (!g) return;
    if (!g.moves.length) { startGame(ctx, g.kind); return; }
    askConfirm(ctx, '新开一局？当前进度将被清空', '新开局').then(function (ok) {
      if (ok === true) startGame(ctx, g.kind);
    });
  }

  function backToPick(ctx) {
    var g = state.game;
    if (!g) return;
    var leave = function () {
      if (S.aiTimer) { clearTimeout(S.aiTimer); S.aiTimer = null; }
      state.game = null;
      S.busy = false;
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

  /* 对域外暴露：games.js（render 分派 / 游戏选择 / AI 恢复调度）与测试经此引用 */
  window.SonderGamesBattle = {
    gameView: gameView,
    aiThink: aiThink,
    startGame: startGame,
    switchDiff: switchDiff
  };
})();