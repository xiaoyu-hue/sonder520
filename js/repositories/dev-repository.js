/* dev-repository.js - 开发工作场景的数据访问边界（v6.x 架构升级 · Repository 第三刀）
 *
 * 覆盖耦合集合：devProjects（项目）/ devTasks（项目内任务，嵌套子集合）/
 * devNotes（技术笔记）/ devSnippets（代码片段）。
 * 本版为过渡形态——内部直接委托旧 Store 的领域方法（store-media.js），行为完全一致
 * （含 commit/事件/undo）；目标是让 dev.js 的子操作不再直连 Store。
 *
 * 边界规则（执行方案 §11）：只负责数据访问，不掺 UI/页面状态/Toast/DOM。
 *
 * 浏览器：<script src="js/repositories/dev-repository.js">（在 store-media.js 之后加载）
 * Node：module.exports 返回工厂 createDevRepository(store)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.SonderDevRepository = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function findById(arr, id) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) return arr[i];
    }
    return null;
  }

  function createDevRepository(store) {
    if (!store || typeof store.addDevProject !== 'function' || !store.state ||
        typeof store.state.devProjects === 'undefined') {
      throw new TypeError('DevRepository: store 必须为 SonderStore 实例（devProjects 集合齐备）');
    }

    return {
      /* ---------- devProjects 读 ---------- */
      getProject: function (id) {
        return findById(store.state.devProjects, id);
      },
      getProjects: function () {
        return store.state.devProjects.slice();
      },

      /* ---------- devProjects 写（委托旧 Store） ---------- */
      createProject: function (d) {
        return store.addDevProject(d);
      },
      updateProject: function (id, patch) {
        return store.updateDevProject(id, patch);
      },
      removeProject: function (id) {
        return store.removeDevProject(id);
      },

      /* ---------- devTasks（项目内任务，嵌套） ---------- */
      addTask: function (projId, d) {
        return store.addDevTask(projId, d);
      },
      updateTask: function (projId, taskId, patch) {
        return store.updateDevTask(projId, taskId, patch);
      },
      removeTask: function (projId, taskId) {
        return store.removeDevTask(projId, taskId);
      },

      /* ---------- devNotes / devSnippets ---------- */
      addNote: function (d) {
        return store.addDevNote(d);
      },
      updateNote: function (id, patch) {
        return store.updateDevNote(id, patch);
      },
      removeNote: function (id) {
        return store.removeDevNote(id);
      },
      addSnippet: function (d) {
        return store.addDevSnippet(d);
      },
      updateSnippet: function (id, patch) {
        return store.updateDevSnippet(id, patch);
      },
      removeSnippet: function (id) {
        return store.removeDevSnippet(id);
      }
    };
  }

  return { createDevRepository: createDevRepository };
});
