/* memo-repository.js - 备忘集合的数据访问边界（v6.x Phase 5 提炼）
 *
 * 定位：memos 已走 ModuleFactory（路径 A），本文件将其正式包装为 Repository
 * 接口（get/getAll/create/update/remove），使三页与 6 个直连迁移集合共用
 * 同一数据访问边界形态。内部直接委托工厂模块，行为零变化
 * （commit/事件/undo 语义不变）。
 *
 * 边界规则（执行方案 §11）：只负责数据访问，不掺 UI 逻辑、页面状态、DOM。
 * CONFIG 留在页面（memo.js 单源），本文件为纯包装层。
 *
 * 浏览器：<script src="js/repositories/memo-repository.js">（ModuleFactory 之后、memo.js 之前）
 * Node：module.exports 返回工厂 createMemosRepository(store, config)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.SonderMemosRepository = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function createMemosRepository(store, config) {
    var F = globalThis.SonderModuleFactory;
    if (!F || typeof F.createModule !== 'function') {
      throw new TypeError('MemosRepository: 需要 SonderModuleFactory（framework/ModuleFactory.js 先加载）');
    }
    var mod = F.createModule(store, config);
    return {
      id: mod.id,
      /* ---------- 统一 Repository 接口 ---------- */
      get: function (id) { return mod.getById(id); },
      getAll: function () { return mod.query(); },
      create: function (data) { return mod.add(data); },
      update: function (id, patch) { return mod.update(id, patch); },
      remove: function (id) { return mod.remove(id); },
      /* ---------- 兼容工厂模块接口（页面既有调用点零改动） ---------- */
      add: function (data) { return mod.add(data); },
      getById: function (id) { return mod.getById(id); },
      query: function (filter, sort) { return mod.query(filter, sort); },
      render: function (fn) { mod.render(fn); },
      destroy: function () { mod.destroy(); }
    };
  }

  return { createMemosRepository: createMemosRepository };
});
