/* games-shared.js - 娱乐游戏：共享状态与工具（须先于 games-mini.js / games-battle.js / games.js 加载）
 * 单点可变状态：对局（state.game）、小游戏（state.mini）、AI Worker 调度状态、确认框互斥。
 * 页面编排见 games.js，休闲小游戏见 games-mini.js，对弈见 games-battle.js。 */
(function () {
  'use strict';

  /* 页面内部瞬态（契约见 tests/state.test.js 白名单）：对局/小游戏进行中 + UI 相关 */
  var state = { game: null, mode: 'ai', playerStone: 'X', difficulty: 'normal', mini: null };

  window.SonderGamesShared = {
    currentEl: null,
    currentCtx: null,
    ctxRef: { store: null }, /* 最近一次 render 的 store 引用（小游戏纪录统一读写 store） */
    legacyMigrated: false, /* 旧版独立 localStorage 纪录一次性迁移标记 */
    state: state,
    busy: false,
    aiTimer: null,
    /* 五子棋 AI Worker：承载耗时计算，避免阻塞主线程（无 Worker 环境自动回退同步计算，行为与旧版一致） */
    aiWorker: null,
    aiSeq: 0, /* 递增序号：悔棋/重开/切换时作废在途 AI 回复；同时用作 worker 消息 id */
    aiWaitCtx: null, /* 等待 worker 回复期间的 ctx 快照（onerror/兜底使用） */
    WORKER_TIMEOUT: 3000, /* worker 回复最大等待：超过即视为挂起，走同步兜底防死锁 */
    confirmOpen: false,
    KIND_NAME: { tictactoe: '井字棋', gomoku: '五子棋', guessnum: '🎯 猜数字', minesweeper: '💣 扫雷', idiom: '📖 猜成语', brainteaser: '🧠 脑筋急转弯' }
  };

  var S = window.SonderGamesShared;

  /* 统一确认框：防连点/叠加（同一时刻只允许一个弹窗），返回 Promise<boolean>。
   * 已有弹窗时新请求被忽略并提示，避免用户"点了没反应"。 */
  S.askConfirm = function (ctx, message, okText) {
    if (S.confirmOpen) {
      ctx.UI.toast('请先处理当前弹出的确认框', 'err');
      return Promise.resolve(null);
    }
    S.confirmOpen = true;
    return ctx.UI.confirmBox(message, okText).then(function (ok) {
      S.confirmOpen = false;
      return ok;
    });
  };

  S.aiStone = function () { return S.state.playerStone === 'X' ? 'O' : 'X'; };
  S.playerName = function (stone) {
    if (S.state.mode === 'ai') return stone === S.state.playerStone ? '你' : 'AI';
    return stone === 'X' ? '玩家1' : '玩家2';
  };
  S.sym = function (stone) { return stone === 'X' ? '✕' : '◯'; };
  S.kindName = function (g) { return S.KIND_NAME[g.kind] || g.kind; };
})();