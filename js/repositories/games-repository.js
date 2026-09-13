/* games-repository.js - 游戏域数据访问边界（v6.x 架构升级 · Repository 第六刀）
 *
 * 覆盖集合：gameRecords（战绩，追加型）/ miniRecords（单人小游戏纪录，per-kind 对象）。
 * 本版为过渡形态——内部直接委托旧 Store 的领域方法（store-content.js），行为完全一致
 * （addGameRecord 的 kind/mode/difficulty 规范化、getMiniRecord 返回深拷贝）。
 *
 * 边界规则（执行方案 §11）：只负责数据访问，不掺 UI/页面状态/Toast/DOM。
 *
 * 浏览器：<script src="js/repositories/games-repository.js">（在 store-content.js 之后加载）
 * Node：module.exports 返回工厂 createGamesRepository(store)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.SonderGamesRepository = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function createGamesRepository(store) {
    if (!store || typeof store.addGameRecord !== 'function' || !store.state ||
        typeof store.state.gameRecords === 'undefined') {
      throw new TypeError('GamesRepository: store 必须为 SonderStore 实例（gameRecords 集合齐备）');
    }

    return {
      /* ---------- 战绩（追加型） ---------- */
      addRecord: function (d) {
        return store.addGameRecord(d);
      },
      clearRecords: function () {
        return store.clearGameRecords();
      },

      /* ---------- 单人小游戏纪录（per-kind 对象，返回深拷贝） ---------- */
      getMiniRecord: function (kind) {
        return store.getMiniRecord(kind);
      },
      updateMiniRecord: function (kind, patch) {
        return store.updateMiniRecord(kind, patch);
      }
    };
  }

  return { createGamesRepository: createGamesRepository };
});
