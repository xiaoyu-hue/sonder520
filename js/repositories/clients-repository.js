/* clients-repository.js - 咨询管理场景的数据访问边界（v6.x 架构升级 · Repository 第五刀）
 *
 * 覆盖耦合集合：clients（客户）/ projects（项目，嵌套）/ followups（跟进，嵌套）/
 * income（收入，嵌套）。本版为过渡形态——内部直接委托旧 Store 的领域方法
 * （store-content.js），行为完全一致（含 commit/事件/undo 闭包恢复）；
 * 目标是让 consulting.js 的子操作不再直连 Store。
 *
 * 边界规则（执行方案 §11）：只负责数据访问，不掺 UI/页面状态/Toast/DOM。
 *
 * 浏览器：<script src="js/repositories/clients-repository.js">（在 store-content.js 之后加载）
 * Node：module.exports 返回工厂 createClientsRepository(store)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.SonderClientsRepository = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function findById(arr, id) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) return arr[i];
    }
    return null;
  }

  function createClientsRepository(store) {
    if (!store || typeof store.addClient !== 'function' || !store.state ||
        typeof store.state.clients === 'undefined') {
      throw new TypeError('ClientsRepository: store 必须为 SonderStore 实例（clients 集合齐备）');
    }

    return {
      /* ---------- clients 读 ---------- */
      getClient: function (id) {
        return findById(store.state.clients, id);
      },
      getClients: function () {
        return store.state.clients.slice();
      },

      /* ---------- clients 写（委托旧 Store） ---------- */
      createClient: function (d) {
        return store.addClient(d);
      },
      updateClient: function (id, patch) {
        return store.updateClient(id, patch);
      },
      removeClient: function (id) {
        return store.removeClient(id);
      },

      /* ---------- 项目（嵌套） ---------- */
      addProject: function (clientId, d) {
        return store.addClientProject(clientId, d);
      },
      updateProject: function (clientId, projId, patch) {
        return store.updateClientProject(clientId, projId, patch);
      },
      removeProject: function (clientId, projId) {
        return store.removeClientProject(clientId, projId);
      },

      /* ---------- 跟进（嵌套） ---------- */
      addFollowup: function (clientId, d) {
        return store.addClientFollowup(clientId, d);
      },
      updateFollowup: function (clientId, fuId, patch) {
        return store.updateClientFollowup(clientId, fuId, patch);
      },
      removeFollowup: function (clientId, fuId) {
        return store.removeClientFollowup(clientId, fuId);
      },

      /* ---------- 收入（嵌套） ---------- */
      addIncome: function (clientId, d) {
        return store.addClientIncome(clientId, d);
      },
      updateIncome: function (clientId, incId, patch) {
        return store.updateClientIncome(clientId, incId, patch);
      },
      removeIncome: function (clientId, incId) {
        return store.removeClientIncome(clientId, incId);
      }
    };
  }

  return { createClientsRepository: createClientsRepository };
});
