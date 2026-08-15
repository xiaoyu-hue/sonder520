/* games-view.js - 游戏视图纯函数层（对局/记录状态 → HTML 字符串，无闭包状态依赖）
 * 职责：diffOptions/resultHtml/mineCellsHtml/idiomResult/brainResult/onLine 与战绩
 *      记录文案（resultText/resultPill/shortDate/diffBadge），原位于 games.js，独立成层缩小其体积。
 * 浏览器：在 games.js 之前加载，暴露 window.SonderGamesView
 * Node：module.exports 返回同一对象（函数体内才解析 window.UI，Node 下仅 require 无副作用）
 * 依赖仅限参数与 window.UI（HTML 转义），不得引用 games.js 闭包内任何变量。 */
(function (root) {
  'use strict';

  var DIFF_LABEL = { easy: '简单', normal: '普通', hard: '困难' };
  function esc(v) { return window.UI.esc(v); }

  function diffOptions(sel) {
    var s = '';
    ['easy', 'normal', 'hard'].forEach(function (d) {
      s += '<option value="' + d + '"' + (sel === d ? ' selected' : '') + '>' + DIFF_LABEL[d] + '</option>';
    });
    return s;
  }

  function resultHtml(g, isNewBest) {
    if (g.won) {
      return '🎉 猜中了！用了 <b>' + g.attempts.length + '</b> 次' + (isNewBest ? '，新纪录！' : '');
    }
    return '机会用完了，答案是 <b>' + g.target + '</b>，下次加油！';
  }

  function mineCellsHtml(g, UI) {
    if (!g.board) {
      var empty = '';
      for (var i = 0; i < g.rows * g.cols; i++) {
        var er = Math.floor(i / g.cols), ec = i % g.cols;
        /* 首次插旗不布雷，暂存旗位仍需渲染 */
        var pf = g.pendingFlags && g.pendingFlags[er + ',' + ec];
        var pfInner = pf ? '⚑' : '';
        var pfLabel = pf ? '已标记' : '未翻开';
        empty += '<button type="button" class="ms-cell' + (pf ? ' flagged' : '') + '" data-r="' + er + '" data-c="' + ec + '" ' +
          'aria-label="第' + (er + 1) + '行第' + (ec + 1) + '列，' + pfLabel + '" style="min-height:28px">' + pfInner + '</button>';
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

  function idiomResult(g) {
    if (g.correct) return '🎉 答对了！就是「' + esc(g.answer) + '」';
    return '答案是「<b>' + esc(g.answer) + '</b>」，下次再战！';
  }

  function brainResult(g) {
    if (g.correct) return '🎉 答对了！就是「' + esc(g.accepted[0]) + '」';
    return '答案：「<b>' + esc(g.accepted[0]) + '</b>」——脑筋急转弯嘛，别想太复杂～';
  }

  /* 获胜连线是否经过 (r, c)（井字棋/五子棋高亮用） */
  function onLine(line, r, c) {
    for (var i = 0; i < line.length; i++) if (line[i][0] === r && line[i][1] === c) return true;
    return false;
  }

  /* ---- 战绩记录文案 ---- */
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
    return '<span class="small muted" style="margin-left:8px;white-space:nowrap">' + esc(label) + '</span>';
  }

  var api = {
    DIFF_LABEL: DIFF_LABEL,
    diffOptions: diffOptions,
    resultHtml: resultHtml,
    mineCellsHtml: mineCellsHtml,
    idiomResult: idiomResult,
    brainResult: brainResult,
    onLine: onLine,
    resultText: resultText,
    resultPill: resultPill,
    shortDate: shortDate,
    diffBadge: diffBadge
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SonderGamesView = api;
})(typeof self !== 'undefined' ? self : this);