/* game-worker.js - 五子棋 AI 计算 Worker
 * 主线程只投递结构化克隆的对局快照，本 Worker 复用 games-logic.js 纯逻辑引擎计算后回发落子。
 * 协议：
 *   主线程 → worker: { id, game, stone, diff }
 *   worker → 主线程: { id, mv: {r, c} } | { id, error }
 * id 为调用方递增序号，主线程据此丢弃过期回复（悔棋/重开/切换后）。
 * 注意：不进入 index.html 的 script 列表（无 DOM 需求），由 games.js 按需 new Worker 加载，
 *       并在 sw.js 预缓存清单中登记（scripts/sync-sw.js 的 EXTRA 列表）。 */
/* eslint-disable no-var */
'use strict';
importScripts('games-logic.js');

self.addEventListener('message', function (e) {
  var d = e.data || {};
  var g = self.SonderGames;
  if (!g || !d.game || d.game.kind !== 'gomoku' || !d.stone || typeof d.id !== 'number' ||
      (d.stone !== 'X' && d.stone !== 'O')) {
    self.postMessage({ id: typeof d.id === 'number' ? d.id : -1, error: 'bad-request' });
    return;
  }
  try {
    var mv = g.gomokuAiMove(d.game, d.stone, d.diff);
    if (!mv || typeof mv.r !== 'number' || typeof mv.c !== 'number') {
      self.postMessage({ id: d.id, error: 'no-move' });
      return;
    }
    self.postMessage({ id: d.id, mv: mv });
  } catch (err) {
    self.postMessage({ id: d.id, error: String((err && err.message) || err) });
  }
});
