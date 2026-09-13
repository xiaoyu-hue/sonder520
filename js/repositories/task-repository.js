/* task-repository.js - 任务集合的数据访问边界（v6.x 架构升级 · Repository 第一版）
 *
 * 定位：Application/Domain 与 Store 之间的"数据管理员"层。
 * 本版为过渡形态——内部直接委托旧 Store 的 tasks 领域方法（store-tasks.js），
 * 行为与 store.addTask 等完全一致（含 commit/事件/undo）；目标是先建立稳定的
 * 数据访问边界，后续 today.js 逐步迁移到此接口，Store 直连随之退出。
 *
 * 边界规则（执行方案 §11）：
 *   - 只负责数据访问（get/getAll/create/update/remove/reorder）
 *   - 不掺 UI 逻辑、页面状态、Toast、DOM
 *
 * 浏览器：<script src="js/repositories/task-repository.js">（在 store-tasks.js 之后加载）
 * Node：module.exports 返回工厂 createTaskRepository(store)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.SonderTaskRepository = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function findById(arr, id) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) return arr[i];
    }
    return null;
  }

  function createTaskRepository(store) {
    if (!store || typeof store.addTask !== 'function' || !store.state ||
        typeof store.state.tasks === 'undefined') {
      throw new TypeError('TaskRepository: store 必须为 SonderStore 实例（tasks 集合齐备）');
    }

    return {
      /* ---------- 读 ---------- */
      get: function (id) {
        return findById(store.state.tasks, id);
      },
      /* 只读快照：调用方改动返回数组不影响 store.state（元素为引用，更新请走 update） */
      getAll: function () {
        return store.state.tasks.slice();
      },

      /* ---------- 写（委托旧 Store，行为完全一致） ---------- */
      create: function (data) {
        return store.addTask(data);
      },
      update: function (id, patch) {
        return store.updateTask(id, patch);
      },
      remove: function (id) {
        return store.removeTask(id);
      },
      /* 排序：dir 为 'up' | 'down'（与 store.reorderTask 语义一致） */
      reorder: function (id, dir) {
        return store.reorderTask(id, dir);
      }
    };
  }

  return { createTaskRepository: createTaskRepository };
});
