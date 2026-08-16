/* games.js - 娱乐游戏：页面编排层（render 分派 / 游戏选择 / 战绩区 / 自动重绘 / 测试钩子）
 * 共享状态见 games-shared.js（window.SonderGamesShared，须最先加载），视图纯函数见 games-view.js（window.SonderGamesView），
 * 休闲小游戏见 games-mini.js（window.SonderGamesMini），对弈域见 games-battle.js（window.SonderGamesBattle）。
 * 本文件仅保留页面交互路由、自动重绘订阅与测试钩子。 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var V = window.SonderGamesView;
  var S = window.SonderGamesShared;
  var MI = window.SonderGamesMini;
  var BT = window.SonderGamesBattle;

  function render(ctx) {
    var container = S.currentEl;
    S.ctxRef.store = (ctx && ctx.store) || null;
    container.innerHTML = '';
    container.appendChild(S.state.game ? BT.gameView(ctx) : (S.state.mini ? MI.miniView(ctx) : pickView(ctx)));
    container.appendChild(recordsArea(ctx));
    /* P3e：首次进入游戏页时把旧版独立 localStorage 纪录一次性并入统一 store（老用户数据不丢） */
    if (!S.legacyMigrated) {
      S.legacyMigrated = true;
      MI.migrateMiniRecords(ctx);
    }
    /* 恢复被切页打断的 AI 回合：AI 模式对局停在 AI 思考且未在思考中时重新调度落子 */
    if (S.state.mode === 'ai' && S.state.game && !S.state.game.over && S.state.game.turn === S.aiStone() && !S.busy) {
      BT.aiThink(ctx);
    }
  }

  /* 域文件经 window.SonderGamesShared.render 调用总渲染入口（运行时已就绪：本文件最后加载） */
  S.render = render;

  /* ---------- 游戏选择 ---------- */
  function pickView(ctx) {
    var UI = ctx.UI;
    var box = UI.el(
      '<div>' +
      '<div class="card" style="margin-bottom:14px">' +
      '<div class="row">' +
      '<span class="muted" style="margin-right:12px;white-space:nowrap">AI 难度</span>' +
      '<select id="gDiffPick" title="AI 难度档位">' + V.diffOptions(S.state.difficulty) + '</select>' +
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
      '<div class="card lg-pick" data-pick="minesweeper">' +
      '<div class="lab">💣 扫雷</div>' +
      '<div class="sub">经典扫雷 · 三档难度</div>' +
      '<div class="sub">⚑ 标记模式 · 右键插旗</div>' +
      '</div>' +
      '<div class="card lg-pick" data-pick="idiom">' +
      '<div class="lab">📖 猜成语</div>' +
      '<div class="sub">谜面猜成语 · 3 次机会</div>' +
      '<div class="sub">答错提示字 · 战绩统计</div>' +
      '</div>' +
      '<div class="card lg-pick" data-pick="brainteaser">' +
      '<div class="lab">🧠 脑筋急转弯</div>' +
      '<div class="sub">奇趣问答 · 开动脑洞</div>' +
      '<div class="sub">可提示看答案 · 战绩统计</div>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
    box.querySelectorAll('[data-pick]').forEach(function (c) {
      c.addEventListener('click', function () {
        var kind = c.dataset.pick;
        if (kind === 'guessnum' || kind === 'minesweeper' || kind === 'idiom' || kind === 'brainteaser') MI.startMini(ctx, kind);
        else BT.startGame(ctx, kind);
      });
    });
    var diffSel = box.querySelector('#gDiffPick');
    diffSel.addEventListener('change', function (e) { BT.switchDiff(ctx, e.target.value); });
    return box;
  }

  /* ---------- 战绩 ---------- */
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
          '<div class="title">' + UI.esc(S.kindName({ kind: r.kind })) + ' · ' + (r.mode === 'ai' ? 'AI 对决' : (r.mode === 'solo' ? '单人挑战' : '双人对弈')) + V.diffBadge(r) + '</div>' +
          '<div class="sub">' + UI.esc(V.shortDate(r.date)) + (r.byResign ? ' · 认输' : '') + (r.note ? ' · ' + UI.esc(r.note) : '') + '</div>' +
          '</div>' +
          '<span class="pill ' + V.resultPill(r) + '">' + V.resultText(r) + '</span>' +
          '</div>'
        ));
      });
      var clearBtn = UI.el('<button class="small-btn danger" style="margin:10px 16px 6px" data-rec="clear">清空记录</button>');
      clearBtn.addEventListener('click', function () {
        S.askConfirm(ctx, '清空全部战绩记录？', '清空').then(function (ok) {
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
      S.currentEl = container;
      S.currentCtx = ctx;
      var d = ctx.store.state.settings.gameDifficulty;
      if (d === 'easy' || d === 'hard' || d === 'normal') S.state.difficulty = d;
      render(ctx);
    }
  };

  /* 数据变更自动重绘（SonderBus）：战绩/设置变更时仅当前路由为本页才刷新（对局中不打断） */
  (function () {
    var bus = globalThis.SonderBus && globalThis.SonderBus.bus;
    if (!bus) return;
    ['/data/gameRecords', '/data/miniRecords', '/data/settings', '/data/all'].forEach(function (p) {
      bus.on(p, function () {
        if (S.currentEl && S.currentCtx && !S.busy && ((location.hash || '').replace(/^#\/?/, '').split('/')[0] === 'game')) {
          render(S.currentCtx);
        }
      });
    });
  })();

  /* 测试/调试钩子：只读快照 + 可控注入。门闩 __SONDER_TEST__：仅测试进程暴露（harness 在脚本加载前注入），生产不挂载 */
  if (window.__SONDER_TEST__) {
  window.__gamesDbg = function () {
    var g = S.state.game;
    return {
      mode: S.state.mode,
      playerStone: S.state.playerStone,
      difficulty: S.state.difficulty,
      busy: S.busy,
      game: g && { kind: g.kind, turn: g.turn, moves: g.moves.length, over: g.over, winner: g.winner },
      mini: S.state.mini && (S.state.mini.kind === 'guessnum'
        ? { kind: 'guessnum', target: S.state.mini.g.target, attempts: S.state.mini.g.attempts.length, over: S.state.mini.g.over, won: S.state.mini.g.won }
        : { kind: S.state.mini.kind, over: S.state.mini.g.over, won: S.state.mini.g.won, revealed: S.state.mini.g.revealed, flagged: S.state.mini.g.flagged, boardReady: !!S.state.mini.g.board, rows: S.state.mini.g.rows, cols: S.state.mini.g.cols, mines: S.state.mini.g.mines }),
      worker: !!S.aiWorker
    };
  };
  /* 测试钩子：注入确定的猜数字答案（仅测试用） */
  window.__gamesDbg.setMiniTarget = function (n) {
    if (S.state.mini && S.state.mini.kind === 'guessnum') S.state.mini.g.target = n;
  };
  /* 测试钩子：注入确定的扫雷雷位布局（仅测试用） */
  window.__gamesDbg.setMineField = function (rows, cols, mineList) {
    if (!S.state.mini || S.state.mini.kind !== 'minesweeper') return;
    var s = S.state.mini.g;
    var b = [], i, j;
    for (i = 0; i < rows; i++) {
      b.push([]);
      for (j = 0; j < cols; j++) b[i].push({ mine: false, revealed: false, flagged: false, adj: 0 });
    }
    mineList.forEach(function (p) { b[p[0]][p[1]].mine = true; });
    for (i = 0; i < rows; i++) {
      for (j = 0; j < cols; j++) {
        if (b[i][j].mine) continue;
        var a = 0;
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            var rr = i + dr, cc = j + dc;
            if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && b[rr][cc].mine) a++;
          }
        }
        b[i][j].adj = a;
      }
    }
    s.board = b;
    s.first = false;
    s.revealed = 0;
    s.flagged = 0;
    s.mines = mineList.length; /* 以实盘为准 */
    render(S.currentCtx);
  };
  /* 测试钩子：注入确定的猜成语答案（仅测试用） */
  window.__gamesDbg.setIdiomAnswer = function (a) {
    if (S.state.mini && S.state.mini.kind === 'idiom') S.state.mini.g.answer = a;
  };
  /* 测试钩子：注入确定的脑筋急转弯题目与答案（仅测试用） */
  window.__gamesDbg.setBrainQ = function (q, accepted) {
    if (S.state.mini && S.state.mini.kind === 'brainteaser') {
      S.state.mini.g.q = q;
      S.state.mini.g.accepted = (accepted || []).slice();
    }
  };
  }

  /* 对外暴露：小游戏域的 miniView 兜底分支与未来扩展经此引用 */
  window.SonderGamesPage = { pickView: pickView };
})();