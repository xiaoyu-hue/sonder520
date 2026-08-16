/* games-mini.js - 娱乐游戏：休闲小游戏域（猜数字 / 扫雷 / 猜成语 / 脑筋急转弯）
 * 共享状态见 games-shared.js（window.SonderGamesShared，须先加载），逻辑见 games-logic.js（window.SonderGames），
 * 视图纯函数见 games-view.js（window.SonderGamesView）。输出 window.SonderGamesMini（games.js 编排调用）。 */
(function () {
  'use strict';
  var G = window.SonderGames;
  var V = window.SonderGamesView;
  var S = window.SonderGamesShared;

  /* 共享对象引用（games.js 的 render 在运行时挂到 S.render，此处仅为同名局部包装） */
  var state = S.state;
  function render(ctx) { S.render(ctx); }

  /* ---------- 休闲小游戏 ---------- */
  var MS_DIFFS = {
    easy: { label: '简单', rows: 9, cols: 9, mines: 10 },
    mid: { label: '中等', rows: 12, cols: 12, mines: 20 },
    hard: { label: '困难', rows: 16, cols: 16, mines: 40 }
  };
  var MS_DEFAULT_DIFF = 'easy';
  var MS_LONG_PRESS_MS = 350;

  function startMini(ctx, kind) {
    state.game = null;
    if (kind === 'guessnum') {
      state.mini = { kind: 'guessnum', g: G.guessNumStart() };
    } else if (kind === 'minesweeper') {
      var diff = miniBest2('minesweeper', 'diff') || MS_DEFAULT_DIFF;
      var d = MS_DIFFS[diff] || MS_DIFFS[MS_DEFAULT_DIFF];
      state.mini = { kind: 'minesweeper', g: G.mineStart(d.rows, d.cols, d.mines), diff: diff };
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
    return window.SonderGamesPage.pickView(ctx);
  }

  /* 单人小游戏纪录统一存 store.state.miniRecords（P3e；原独立 localStorage 键 sonder_games_* 仅用于一次性迁移） */
  var MINI_KINDS = ['guessnum', 'minesweeper', 'idiom', 'brainteaser'];
  function migrateMiniRecords(ctx) {
    try {
      MINI_KINDS.forEach(function (kind) {
        var raw = window.localStorage.getItem('sonder_games_' + kind);
        if (!raw) return;
        var o = JSON.parse(raw);
        if (o && typeof o === 'object') {
          ctx.store.updateMiniRecord(kind, o);
        }
        window.localStorage.removeItem('sonder_games_' + kind);
      });
    } catch (e) { /* 迁移失败则保留旧键，后续访问再试 */ }
  }
  /* 纪录对象按 kind 结构各异（wins/losses/best/right/wrong...），取值/算术由调用方自行处理 */
  /** @returns {any} */
  function miniRec(kind) {
    return S.ctxRef.store ? S.ctxRef.store.getMiniRecord(kind) : {};
  }
  function miniBest(kind) {
    var o = miniRec(kind);
    return typeof o.best === 'number' ? o.best : null;
  }
  function saveMiniBest(kind, best) {
    if (S.ctxRef.store) S.ctxRef.store.updateMiniRecord(kind, { best: best });
  }
  function miniBest2(kind, key) {
    var o = miniRec(kind);
    return key in o ? o[key] : null;
  }
  function saveMiniRec(kind, patch) {
    if (S.ctxRef.store) S.ctxRef.store.updateMiniRecord(kind, patch);
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
      (g.over ? '<div class="mg-result" id="mgResult">' + V.resultHtml(g, state.mini.newBest) + '</div>' : '') +
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
        if (res.win) {
          var oldBest = miniBest('guessnum');
          state.mini.newBest = oldBest === null || g.attempts.length < oldBest;
          if (state.mini.newBest) saveMiniBest('guessnum', g.attempts.length);
        }
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
      '<span class="muted small">' + statsTxt + '</span>' +
      '</div>' +
      '<div class="ms-board-wrap" style="margin-top:12px">' +
      '<div class="ms-board" id="msBoard" style="--cols:' + g.cols + ';grid-template-columns:repeat(' + g.cols + ',1fr)" role="grid" aria-label="扫雷雷区">' + V.mineCellsHtml(g, ctx.UI) + '</div>' +
      '</div>' +
      '<div class="row" style="margin-top:12px">' +
      '<button class="btn" data-mact="again" type="button" style="min-height:44px">🔄 再来一局</button>' +
      '</div>' +
      '</div>'
    );
    var board = card.querySelector('#msBoard');
    board.querySelectorAll('.ms-cell').forEach(function (cell) {
      bindMineCell(ctx, cell);
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

  function finishMinesweeper(ctx, won) {
    var rec = miniRec('minesweeper');
    rec.wins = (rec.wins || 0) + (won ? 1 : 0);
    rec.losses = (rec.losses || 0) + (won ? 0 : 1);
    rec.diff = state.mini.diff;
    saveMiniRec('minesweeper', rec);
    ctx.store.addGameRecord({
      kind: 'minesweeper', mode: 'solo', player: 'player',
      winner: won ? 'player' : 'opponent',
      difficulty: state.mini.diff,
      note: won ? '扫清全部地雷' : ('踩中地雷，雷数 ' + state.mini.g.mines)
    });
    render(ctx);
  }

  function mineCellClick(ctx, cell) {
    var g = state.mini.g;
    if (g.over) return;
    var r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    if (!isFinite(r) || !isFinite(c)) return;
    var res = G.mineReveal(g, r, c);
    if (!res.ok) { ctx.UI.toast(res.error, 'err'); return; }
    if (res.over) {
      finishMinesweeper(ctx, !!res.won);
      return;
    }
    render(ctx);
  }

  function mineCellFlag(ctx, cell) {
    var g = state.mini.g;
    if (g.over) return;
    var res = G.mineToggleFlag(g, Number(cell.dataset.r), Number(cell.dataset.c));
    if (!res.ok) { ctx.UI.toast(res.error, 'err'); return; }
    if (res.over) {
      finishMinesweeper(ctx, !!res.won);
      return;
    }
    render(ctx);
  }

  /* 移动端交互：单击翻开（由 click 触发）、长按 350ms 插旗（仅触屏/手写笔）。
   * pointerdown 启动定时器并显示 .long-pressing 高亮；位移 >10px 或 pointercancel（滚动）取消。
   * 插旗后 render(ctx) 会重建棋盘 DOM，长按抬手时浏览器补发的 click 会落到新格子，
   * 故用「pointerup 关联」抑制：长按触发插旗后（msLpFired），本次抬手打时间戳 msLpUpAt，
   * 紧接的 click/contextmenu 才被吞掉；新一轮 pointerdown 解除，主动点击不受误伤。 */
  var msLpFired = false, msLpUpAt = null;

  function bindMineCell(ctx, cell) {
    var lpTimer = null, sx = 0, sy = 0;
    function cancelLp() {
      if (lpTimer === null) return;
      window.clearTimeout(lpTimer);
      lpTimer = null;
      cell.classList.remove('long-pressing');
    }
    cell.addEventListener('pointerdown', function (e) {
      msLpUpAt = null;
      msLpFired = false;
      if (e.pointerType === 'mouse') return;
      sx = e.clientX; sy = e.clientY;
      cell.classList.add('long-pressing');
      lpTimer = window.setTimeout(function () {
        lpTimer = null;
        cell.classList.remove('long-pressing');
        msLpFired = true;
        mineCellFlag(ctx, cell);
        if (typeof window.navigator.vibrate === 'function') window.navigator.vibrate(15);
      }, MS_LONG_PRESS_MS);
    });
    cell.addEventListener('pointermove', function (e) {
      if (lpTimer !== null && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) cancelLp();
    });
    cell.addEventListener('pointercancel', cancelLp);
    cell.addEventListener('pointerup', function () {
      cancelLp();
      if (msLpFired) msLpUpAt = Date.now();
    });
    cell.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      if (lpSuppressed()) return;
      mineCellFlag(ctx, cell);
    });
    cell.addEventListener('click', function () {
      if (lpSuppressed()) return;
      mineCellClick(ctx, cell);
    });
  }

  function lpSuppressed() {
    if (msLpUpAt === null) return false;
    if (Date.now() - msLpUpAt > 400) { msLpUpAt = null; return false; }
    msLpUpAt = null;
    return true;
  }

  function msRestart(ctx) {
    var d = MS_DIFFS[state.mini.diff] || MS_DIFFS[MS_DEFAULT_DIFF];
    state.mini = { kind: 'minesweeper', g: G.mineStart(d.rows, d.cols, d.mines), diff: state.mini.diff };
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
      (g.over ? '<div class="mg-result" id="idmResult">' + V.idiomResult(g) + '</div>' : '') +
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
      (g.over ? '<div class="mg-result" id="brainResult">' + V.brainResult(g) + '</div>' : '') +
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

  /* 对域外暴露：games.js（render 分派 / 游戏选择）与测试经此引用 */
  window.SonderGamesMini = {
    startMini: startMini,
    miniView: miniView,
    migrateMiniRecords: migrateMiniRecords
  };
})();