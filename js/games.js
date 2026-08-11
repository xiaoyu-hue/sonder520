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

  var DIFF_LABEL = { easy: '简单', normal: '普通', hard: '困难', mid: '中等' };
  var KIND_NAME = { tictactoe: '井字棋', gomoku: '五子棋', guessnum: '🎯 猜数字', minesweeper: '💣 扫雷', idiom: '📖 猜成语', brainteaser: '🧠 脑筋急转弯' };
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
  function kindName(g) { return KIND_NAME[g.kind] || g.kind; }

  function render(ctx) {
    var container = currentEl;
    container.innerHTML = '';
    container.appendChild(state.game ? gameView(ctx) : (state.mini ? miniView(ctx) : pickView(ctx)));
    container.appendChild(recordsArea(ctx));
    /* 恢复被切页打断的 AI 回合：AI 模式对局停在 AI 思考且未在思考中时重新调度落子 */
    if (state.mode === 'ai' && state.game && !state.game.over && state.game.turn === aiStone() && !busy) {
      aiThink(ctx);
    }
  }

  /* ---------- 休闲小游戏 ---------- */
  var MS_DIFFS = {
    easy: { label: '简单', rows: 9, cols: 9, mines: 10 },
    mid: { label: '中等', rows: 12, cols: 12, mines: 20 },
    hard: { label: '困难', rows: 16, cols: 16, mines: 40 }
  };
  var MS_DEFAULT_DIFF = 'easy';
  var msFlagMode = false;

  function startMini(ctx, kind) {
    state.game = null;
    if (kind === 'guessnum') {
      state.mini = { kind: 'guessnum', g: G.guessNumStart() };
    } else if (kind === 'minesweeper') {
      var diff = miniBest2('minesweeper', 'diff') || MS_DEFAULT_DIFF;
      var d = MS_DIFFS[diff] || MS_DIFFS[MS_DEFAULT_DIFF];
      state.mini = { kind: 'minesweeper', g: G.mineStart(d.rows, d.cols, d.mines), diff: diff };
      msFlagMode = false;
    } else if (kind === 'idiom') {
      state.mini = { kind: 'idiom', g: G.idiomStart() };
    } else if (kind === 'brainteaser') {
      state.mini = { kind: 'brainteaser', g: G.brainStart() };
    } else {
      state.mini = { kind: kind, g: null };
    }
    render(ctx);
  }

  function miniView(ctx) {
    if (state.mini.kind === 'guessnum') return guessNumView(ctx);
    if (state.mini.kind === 'minesweeper') return mineView(ctx);
    if (state.mini.kind === 'idiom') return idiomView(ctx);
    if (state.mini.kind === 'brainteaser') return brainView(ctx);
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
  function miniRec(kind) {
    try {
      var raw = window.localStorage.getItem('sonder_games_' + kind);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function miniBest2(kind, key) {
    var o = miniRec(kind);
    return key in o ? o[key] : null;
  }
  function saveMiniRec(kind, patch) {
    var o = miniRec(kind);
    Object.keys(patch).forEach(function (k) { o[k] = patch[k]; });
    try { window.localStorage.setItem('sonder_games_' + kind, JSON.stringify(o)); } catch (e) { /* 忽略 */ }
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
      if (res.win || res.lose) {
        ctx.store.addGameRecord({
          kind: 'guessnum', mode: 'solo', player: 'player',
          winner: res.win ? 'player' : 'opponent',
          note: res.win ? ('第 ' + g.attempts.length + ' 次猜中，目标 ' + g.target) : ('七次未中，目标 ' + g.target)
        });
      }
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

  /* -------- 扫雷 -------- */
  function mineView(ctx) {
    var UI = ctx.UI, m = state.mini, g = m.g;
    var wrap = UI.el('<div></div>');
    wrap.appendChild(UI.el(
      '<div class="hbar">' +
      '<div class="lab" style="font-size:15px">💣 扫雷</div>' +
      '<select id="msDiff" title="雷区尺寸与雷数" aria-label="选择扫雷难度">' +
      Object.keys(MS_DIFFS).map(function (k) {
        var d = MS_DIFFS[k];
        return '<option value="' + k + '"' + (state.mini.diff === k ? ' selected' : '') + '>' + d.label + '（' + d.rows + '×' + d.cols + ' · ' + d.mines + '雷）</option>';
      }).join('') +
      '</select>' +
      '<span class="sp"></span>' +
      '<button class="btn" data-mact="back" type="button">← 选游戏</button>' +
      '</div>'
    ));
    var rec = miniRec('minesweeper');
    var statsTxt = rec.wins !== undefined
      ? '胜 ' + rec.wins + ' · 负 ' + rec.losses
      : '还没有战绩，来一局！';
    var statusTxt = g.over
      ? (g.won ? '🎉 扫雷成功！点对了吗？再来挑战更高难度！' : '💥 踩到雷了，下次小心！')
      : '剩余 ' + Math.max(0, g.mines - g.flagged) + ' 雷';
    var card = UI.el(
      '<div class="card">' +
      '<div class="row" style="align-items:center;gap:10px;flex-wrap:wrap">' +
      '<span class="muted small">' + statusTxt + '</span>' +
      '<label class="toggle small" style="margin-left:auto"><input type="checkbox" id="msFlagMode"' + (msFlagMode ? ' checked' : '') + '> ⚑ 标记模式' + '</label>' +
      '<span class="muted small">' + statsTxt + '</span>' +
      '</div>' +
      '<div class="ms-board-wrap" style="margin-top:12px">' +
      '<div class="ms-board" id="msBoard" style="--cols:' + g.cols + ';grid-template-columns:repeat(' + g.cols + ',1fr)" role="grid" aria-label="扫雷雷区">' + mineCellsHtml(g, ctx.UI) + '</div>' +
      '</div>' +
      '<div class="row" style="margin-top:12px">' +
      '<button class="btn" data-mact="again" type="button" style="min-height:44px">🔄 再来一局</button>' +
      '</div>' +
      '</div>'
    );
    msFlagChange(card, ctx);
    var board = card.querySelector('#msBoard');
    board.querySelectorAll('.ms-cell').forEach(function (cell) {
      cell.addEventListener('click', function () { mineCellClick(ctx, cell); });
      cell.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        mineCellFlag(ctx, cell);
      });
    });
    wrap.appendChild(card);
    wrap.querySelectorAll('[data-mact]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.mact === 'back') {
          state.mini = null;
          render(ctx);
        } else if (b.dataset.mact === 'again') {
          msRestart(ctx);
        }
      });
    });
    var diffReal = wrap.querySelector('#msDiff');
    if (diffReal) diffReal.addEventListener('change', function () {
      state.mini.diff = diffReal.value;
      saveMiniRec('minesweeper', { diff: diffReal.value });
      msRestart(ctx);
      UI.toast('已切换难度并重新开始');
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

  function mineCellsHtml(g, UI) {
    if (!g.board) {
      var empty = '';
      for (var i = 0; i < g.rows * g.cols; i++) {
        var er = Math.floor(i / g.cols), ec = i % g.cols;
        empty += '<button type="button" class="ms-cell" data-r="' + er + '" data-c="' + ec + '" ' +
          'aria-label="第' + (er + 1) + '行第' + (ec + 1) + '列，未翻开" style="min-height:28px"></button>';
      }
      return empty;
    }
    var html = '';
    for (var r = 0; r < g.rows; r++) {
      for (var c = 0; c < g.cols; c++) {
        var cell = g.board[r][c];
        var inner = '', cls = 'ms-cell';
        var label;
        if (cell.flagged && g.over && !cell.mine) {
          inner = '⚑'; cls += ' flagged wrong-flag';
          label = '插旗错误';
        } else if (g.over && cell.mine && !cell.flagged) {
          inner = '💥'; cls += ' mined';
          label = '雷';
        } else if (cell.flagged) {
          inner = '⚑'; cls += ' flagged';
          label = '已标记';
        } else if (cell.revealed) {
          if (cell.mine) { inner = '💥'; label = '雷'; }
          else if (cell.adj) { inner = cell.adj; cls += ' n' + cell.adj; label = '数字 ' + cell.adj; }
          else { cls += ' open'; label = '空白格'; }
        } else {
          label = '未翻开';
        }
        html += '<button type="button" class="' + cls + '" data-r="' + r + '" data-c="' + c + '" ' +
          'aria-label="第' + (r + 1) + '行第' + (c + 1) + '列，' + label + '" style="min-height:28px">' + inner + '</button>';
      }
    }
    return html;
  }

  function msFlagChange(card, ctx) {
    var cb = card.querySelector('#msFlagMode');
    if (!cb) return;
    cb.addEventListener('change', function () {
      msFlagMode = cb.checked;
      ctx.UI.toast(msFlagMode ? '标记模式已开启：点击格子将插旗' : '已切回翻开模式');
    });
  }

  function mineCellClick(ctx, cell) {
    var g = state.mini.g;
    if (g.over) return;
    var r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    if (!isFinite(r) || !isFinite(c)) return;
    if (msFlagMode) {
      mineCellFlag(ctx, cell);
      return;
    }
    var res = G.mineReveal(g, r, c);
    if (!res.ok) { ctx.UI.toast(res.error, 'err'); return; }
    if (res.over) {
      var rec = miniRec('minesweeper');
      var won = res.won;
      rec.wins = (rec.wins || 0) + (won ? 1 : 0);
      rec.losses = (rec.losses || 0) + (won ? 0 : 1);
      rec.diff = state.mini.diff;
      saveMiniRec('minesweeper', rec);
      ctx.store.addGameRecord({
        kind: 'minesweeper', mode: 'solo', player: 'player',
        winner: won ? 'player' : 'opponent',
        difficulty: state.mini.diff,
        note: won ? '扫清全部地雷' : ('踩中地雷，雷数 ' + g.mineCount)
      });
      render(ctx);
      return;
    }
    render(ctx);
  }

  function mineCellFlag(ctx, cell) {
    var g = state.mini.g;
    if (g.over) return;
    var res = G.mineToggleFlag(g, Number(cell.dataset.r), Number(cell.dataset.c));
    if (!res.ok) { ctx.UI.toast(res.error, 'err'); return; }
    render(ctx);
  }

  function msRestart(ctx) {
    var d = MS_DIFFS[state.mini.diff] || MS_DIFFS[MS_DEFAULT_DIFF];
    state.mini = { kind: 'minesweeper', g: G.mineStart(d.rows, d.cols, d.mines), diff: state.mini.diff };
    msFlagMode = false;
    render(ctx);
  }

  /* -------- 猜成语 -------- */
  function idiomView(ctx) {
    var UI = ctx.UI, g = state.mini.g;
    var rec = miniRec('idiom');
    var tips = g.tries > 0 ? ' · 提示：<b>' + UI.esc(g.hint) + '</b>' : '';
    var wrap = UI.el('<div></div>');
    wrap.appendChild(UI.el(
      '<div class="hbar">' +
      '<div class="lab" style="font-size:15px">📖 猜成语</div>' +
      '<span class="muted small">谜面猜成语 · 3 次机会</span>' +
      '<span class="sp"></span>' +
      '<button class="btn" data-mact="back" type="button">← 选游戏</button>' +
      '</div>'
    ));
    var card = UI.el(
      '<div class="card">' +
      '<div class="row" style="align-items:center;gap:10px">' +
      '<span class="small muted">答对 ' + (rec.right || 0) + ' · 答错 ' + (rec.wrong || 0) + '</span>' +
      '<span class="small muted" style="margin-left:auto">机会 ' + Math.max(0, g.max - g.tries) + '/' + g.max + '</span>' +
      '</div>' +
      '<div class="idm-q" role="status" aria-live="polite">「' + UI.esc(g.q) + '」</div>' +
      (g.over ? '' :
        '<div class="row" style="gap:10px;margin-top:12px">' +
        '<input type="text" id="idmInput" maxlength="4" placeholder="输入四字成语" ' +
        'aria-label="输入猜出的成语" style="min-height:44px;flex:1">' +
        '<button class="btn primary" id="idmGo" type="button" style="min-height:44px">提交</button>' +
        '</div>') +
      '<div class="idm-tip">' + tips + '</div>' +
      (g.over ? '<div class="mg-result" id="idmResult">' + idiomResult(g) + '</div>' : '') +
      '<div class="row" style="margin-top:12px">' +
      '<button class="btn" data-mact="again" type="button" style="min-height:44px">🔄 换一题</button>' +
      '</div>' +
      '</div>'
    );
    var go = function () {
      var input = card.querySelector('#idmInput');
      var res = G.idiomTry(g, input ? input.value : '');
      if (!res.ok) { UI.toast(res.error, 'err'); return; }
      if (res.correct) {
        saveMiniRec('idiom', { right: (miniRec('idiom').right || 0) + 1 });
        ctx.store.addGameRecord({ kind: 'idiom', mode: 'solo', player: 'player', winner: 'player', note: '答对「' + g.answer + '」' });
      } else if (res.tries === g.max) {
        saveMiniRec('idiom', { wrong: (miniRec('idiom').wrong || 0) + 1 });
        ctx.store.addGameRecord({ kind: 'idiom', mode: 'solo', player: 'player', winner: 'opponent', note: '三次未中，答案是「' + g.answer + '」' });
      }
      render(ctx);
    };
    var goBtn = card.querySelector('#idmGo');
    if (goBtn) goBtn.addEventListener('click', go);
    var input = card.querySelector('#idmInput');
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    wrap.appendChild(card);
    wrap.querySelectorAll('[data-mact]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.mact === 'back') {
          state.mini = null;
          render(ctx);
        } else {
          state.mini = { kind: 'idiom', g: G.idiomStart() };
          render(ctx);
        }
      });
    });
    return wrap;
  }

  function idiomResult(g) {
    if (g.correct) return '🎉 答对了！就是「' + window.UI.esc(g.answer) + '」';
    return '答案是「<b>' + window.UI.esc(g.answer) + '</b>」，下次再战！';
  }

  /* -------- 脑筋急转弯 -------- */
  function brainView(ctx) {
    var UI = ctx.UI, g = state.mini.g;
    var rec = miniRec('brainteaser');
    var wrap = UI.el('<div></div>');
    wrap.appendChild(UI.el(
      '<div class="hbar">' +
      '<div class="lab" style="font-size:15px">🧠 脑筋急转弯</div>' +
      '<span class="muted small">猜猜看，想不出来可看答案</span>' +
      '<span class="sp"></span>' +
      '<button class="btn" data-mact="back" type="button">← 选游戏</button>' +
      '</div>'
    ));
    var card = UI.el(
      '<div class="card">' +
      '<div class="row" style="align-items:center;gap:10px">' +
      '<span class="small muted">答对 ' + (rec.right || 0) + ' · 放弃 ' + (rec.wrong || 0) + '</span>' +
      '<span class="sp"></span>' +
      '</div>' +
      '<div class="idm-q" role="status" aria-live="polite">' + UI.esc(g.q) + '</div>' +
      (g.over ? '' :
        '<div class="row" style="gap:10px;margin-top:12px">' +
        '<input type="text" id="brainInput" placeholder="输入你的答案" ' +
        'aria-label="输入脑筋急转弯的答案" style="min-height:44px;flex:1">' +
        '<button class="btn primary" id="brainGo" type="button" style="min-height:44px">提交</button>' +
        '<button class="btn" id="brainGiveup" type="button" style="min-height:44px">看答案</button>' +
        '</div>') +
      (g.over ? '<div class="mg-result" id="brainResult">' + brainResult(g) + '</div>' : '') +
      '<div class="row" style="margin-top:12px">' +
      '<button class="btn" data-mact="again" type="button" style="min-height:44px">🔄 换一题</button>' +
      '</div>' +
      '</div>'
    );
    var go = function () {
      var input = card.querySelector('#brainInput');
      var res = G.brainTry(g, input ? input.value : '');
      if (!res.ok) { UI.toast(res.error, 'err'); return; }
      if (res.correct) {
        saveMiniRec('brainteaser', { right: (miniRec('brainteaser').right || 0) + 1 });
        ctx.store.addGameRecord({ kind: 'brainteaser', mode: 'solo', player: 'player', winner: 'player' });
        render(ctx);
      } else {
        UI.toast('再想想，脑筋转个弯～');
        input.value = '';
        input.focus();
      }
    };
    var goBtn = card.querySelector('#brainGo');
    if (goBtn) goBtn.addEventListener('click', go);
    var input = card.querySelector('#brainInput');
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    var giveup = card.querySelector('#brainGiveup');
    if (giveup) giveup.addEventListener('click', function () {
      g.over = true;
      g.correct = false;
      saveMiniRec('brainteaser', { wrong: (miniRec('brainteaser').wrong || 0) + 1 });
      ctx.store.addGameRecord({ kind: 'brainteaser', mode: 'solo', player: 'player', winner: 'opponent', note: '直接看了答案' });
      render(ctx);
    });
    wrap.appendChild(card);
    wrap.querySelectorAll('[data-mact]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.mact === 'back') {
          state.mini = null;
          render(ctx);
        } else {
          state.mini = { kind: 'brainteaser', g: G.brainStart() };
          render(ctx);
        }
      });
    });
    return wrap;
  }

  function brainResult(g) {
    if (g.correct) return '🎉 答对了！就是「' + window.UI.esc(g.accepted[0]) + '」';
    return '答案：「<b>' + window.UI.esc(g.accepted[0]) + '</b>」——脑筋急转弯嘛，别想太复杂～';
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
      /* 越页守卫：玩家在 AI 思考期间切走（#gStatus 已从 #content 移除）时不劫持当前页面；
       * 对局保留，切回时 render 会重新调度 AI 落子 */
      if (!document.getElementById('gStatus')) return;
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
    if (r.mode === 'pvp') return r.winner === r.player ? '玩家1胜' : '玩家2胜';
    if (r.mode === 'solo') return r.winner === r.player ? '你胜' : '你负';
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
    if (r.mode === 'pvp' || !r.difficulty) return '';
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
          '<div class="title">' + UI.esc(kindName({ kind: r.kind })) + ' · ' + (r.mode === 'ai' ? 'AI 对决' : (r.mode === 'solo' ? '单人挑战' : '双人对弈')) + diffBadge(r) + '</div>' +
          '<div class="sub">' + UI.esc(shortDate(r.date)) + (r.byResign ? ' · 认输' : '') + (r.note ? ' · ' + UI.esc(r.note) : '') + '</div>' +
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
      mini: state.mini && (state.mini.kind === 'guessnum'
        ? { kind: 'guessnum', target: state.mini.g.target, attempts: state.mini.g.attempts.length, over: state.mini.g.over, won: state.mini.g.won }
        : { kind: state.mini.kind, over: state.mini.g.over, won: state.mini.g.won, revealed: state.mini.g.revealed, flagged: state.mini.g.flagged, boardReady: !!state.mini.g.board, rows: state.mini.g.rows, cols: state.mini.g.cols, mines: state.mini.g.mines })
    };
  };
  /* 测试钩子：注入确定的猜数字答案（仅测试用） */
  window.__gamesDbg.setMiniTarget = function (n) {
    if (state.mini && state.mini.kind === 'guessnum') state.mini.g.target = n;
  };
  /* 测试钩子：注入确定的扫雷雷位布局（仅测试用） */
  window.__gamesDbg.setMineField = function (rows, cols, mineList) {
    if (!state.mini || state.mini.kind !== 'minesweeper') return;
    var s = state.mini.g;
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
    render(currentCtx);
  };
/* 测试钩子：注入确定的猜成语答案（仅测试用） */
  window.__gamesDbg.setIdiomAnswer = function (a) {
    if (state.mini && state.mini.kind === 'idiom') state.mini.g.answer = a;
  };
  /* 测试钩子：注入确定的脑筋急转弯题目与答案（仅测试用） */
  window.__gamesDbg.setBrainQ = function (q, accepted) {
    if (state.mini && state.mini.kind === 'brainteaser') {
      state.mini.g.q = q;
      state.mini.g.accepted = (accepted || []).slice();
    }
  };
})();