/* ModuleFactory.js - Sonder-Frame v0.1：标准模块工厂
 * 浏览器：在 store.js 之后加载（暴露 window.SonderModuleFactory）
 * Node：require 直出 api（与 store-stats.js 同一 UMD 形态）
 *
 * 职责：模块配置校验/规范化/冻结 + 标准 CRUD（add/update/remove/getById/query）
 *      + 最小 render 挂点 + destroy。
 * 不负责：IndexedDB 原始操作 / 加密 / PWA / 游戏 AI / 特殊图表 / 页面级业务流程。
 *
 * 落盘语义与既有领域方法一致：store._commit(集合id) + store._emitChange(collectionKey)，
 * 记录写入 store.state.<id> 数组（页面/搜索/周报的既有读法不受影响）。
 * 撤销语义与既有 remove 一致：删除记录进 store._undoPush 撤销栈。
 *
 * 持久化走 TrustLayer 集合级 key（ADR-009 决策 7）；工厂 CRUD 经 store._commit(id)。
 * v0.1.1（迁移试点前置扩展）：新增可选配置 prepend（add 最新在前，默认 append）
 * 与 timeField（集合时间戳字段名——新增写入、编辑不刷、配置后不再生成默认
 * createdAt/updatedAt；用于兼容既有 time 字段的集合）。不配置时行为与 v0.1 完全一致。
 * v0.1.2（迁移试点二前置扩展）：新增可选配置 orderField（启用保留键 order 作为
 * 集合排序键——add 时自动分配 order = 当前长度，并开放 move(id, dir) 上下移：
 * 交换位置并重写全集合 order，语义对齐 store.reorderTask）。orderField 与 prepend
 * 互斥（最新在前与用户排序矛盾）；未配置时无 order 字段、无 move（行为与 v0.1.1 一致）。
 * 集合注册：createModule 时经 store._registerCollection 纳入 normalize 白名单，
 * 保证"新建→刷新→还在"（含导入/解密/清空路径）；destroy 不注销，数据留存。
 * 字段净化：用户输入默认不可信——text/textarea/date 取 trim 字符串、
 * number 夹数字、boolean 转布尔、array 拷贝、select 限 options 白名单。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SonderModuleFactory = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 共享 helper（浏览器 window.SonderStore._h / Node require('./store.js')._h） */
  var h = (typeof window !== 'undefined' && window.SonderStore && window.SonderStore._h) ||
    (typeof module === 'object' && typeof require === 'function' ? require('../store.js')._h : null);
  if (!h) throw new Error('ModuleFactory: 无法获取 _h 共享 helper');

  var FIELD_TYPES = ['text', 'textarea', 'date', 'boolean', 'number', 'select', 'array'];
  /* 工厂自行生成的字段，业务字段不得占用 */
  var RESERVED_KEYS = { id: 1, createdAt: 1, updatedAt: 1, order: 1 };

  /* ---------- 配置三件套：validate → normalize → freeze ---------- */

  function validateConfig(config) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new TypeError('ModuleFactory: config 必须是对象');
    }
    if (typeof config.id !== 'string' || !config.id.trim()) {
      throw new TypeError('ModuleFactory: config.id 必填且为非空字符串');
    }
    if (typeof config.displayName !== 'string' || !config.displayName.trim()) {
      throw new TypeError('ModuleFactory: config.displayName 必填且为非空字符串');
    }
    if (typeof config.storageKey !== 'string' || !config.storageKey.trim()) {
      throw new TypeError('ModuleFactory: config.storageKey 必填且为非空字符串');
    }
    if (typeof config.schemaVersion !== 'number' || config.schemaVersion !== Math.floor(config.schemaVersion) || config.schemaVersion < 1) {
      throw new TypeError('ModuleFactory: config.schemaVersion 必须为正整数');
    }
    if (!Array.isArray(config.fields) || config.fields.length === 0) {
      throw new TypeError('ModuleFactory: config.fields 必须为非空数组');
    }
    if (config.prepend !== undefined && typeof config.prepend !== 'boolean') {
      throw new TypeError('ModuleFactory: config.prepend 必须为布尔');
    }
    if (config.timeField !== undefined &&
        (typeof config.timeField !== 'string' || !config.timeField.trim() ||
         RESERVED_KEYS[config.timeField] ||
         config.fields.some(function (f) { return f.key === config.timeField; }))) {
      throw new TypeError('ModuleFactory: config.timeField 必须为未占用的字段名');
    }
    if (config.orderField !== undefined && config.orderField !== 'order') {
      throw new TypeError('ModuleFactory: config.orderField 当前仅支持保留键 "order"');
    }
    if (config.orderField === 'order' && config.prepend === true) {
      throw new TypeError('ModuleFactory: config.orderField 与 config.prepend 互斥（排序语义矛盾）');
    }
    var seen = {};
    config.fields.forEach(function (f, i) {
      if (!f || typeof f !== 'object' || Array.isArray(f)) {
        throw new TypeError('ModuleFactory: fields[' + i + '] 必须是对象');
      }
      if (typeof f.key !== 'string' || !f.key.trim()) {
        throw new TypeError('ModuleFactory: fields[' + i + '].key 必填且为非空字符串');
      }
      if (RESERVED_KEYS[f.key]) {
        throw new TypeError('ModuleFactory: 字段 key "' + f.key + '" 为保留字段');
      }
      if (seen[f.key]) {
        throw new TypeError('ModuleFactory: 字段 key "' + f.key + '" 重复');
      }
      seen[f.key] = 1;
      if (FIELD_TYPES.indexOf(f.type) < 0) {
        throw new TypeError('ModuleFactory: 字段 "' + f.key + '" 类型 "' + f.type + '" 非法，允许: ' + FIELD_TYPES.join('/'));
      }
      if (typeof f.label !== 'string' || !f.label.trim()) {
        throw new TypeError('ModuleFactory: 字段 "' + f.key + '" 缺少 label');
      }
      if (f.type === 'select' && (!Array.isArray(f.options) || f.options.length === 0)) {
        throw new TypeError('ModuleFactory: select 字段 "' + f.key + '" 必须提供非空 options');
      }
      if (f.required !== undefined && typeof f.required !== 'boolean') {
        throw new TypeError('ModuleFactory: 字段 "' + f.key + '" required 必须为布尔');
      }
    });
  }

  function normalizeConfig(config) {
    var fields = config.fields.map(function (f) {
      var o = { key: f.key, type: f.type, label: f.label };
      if (f.required === true) o.required = true;
      if (f.type === 'select') o.options = f.options.slice();
      return o;
    });
    var fieldMap = {};
    fields.forEach(function (f) { fieldMap[f.key] = f; });
    return {
      id: config.id,
      displayName: config.displayName,
      storageKey: config.storageKey,
      schemaVersion: config.schemaVersion,
      fields: fields,
      fieldMap: fieldMap,
      /* v0.1.1：prepend 新增在最前（unshift，默认 append）；
       * timeField 集合时间戳字段名（新增写入、编辑不刷、不生成默认时间字段） */
      prepend: config.prepend === true,
      timeField: (typeof config.timeField === 'string' && config.timeField.trim()) ? config.timeField : null,
      /* v0.1.2：orderField 启用保留键 order（add 分配 + move 上下移） */
      orderField: config.orderField === 'order' ? 'order' : null
    };
  }

  function freezeConfig(cfg) {
    Object.keys(cfg.fieldMap).forEach(function (k) { Object.freeze(cfg.fieldMap[k]); });
    Object.freeze(cfg.fieldMap);
    cfg.fields.forEach(function (f) { Object.freeze(f); });
    Object.freeze(cfg.fields);
    Object.freeze(cfg);
    return cfg;
  }

  /* ---------- 字段净化：用户输入默认不可信 ---------- */

  function sanitize(cfg, key, value) {
    var f = cfg.fieldMap[key];
    if (f.type === 'text' || f.type === 'textarea' || f.type === 'date') {
      return String(value === undefined || value === null ? '' : value).trim();
    }
    if (f.type === 'boolean') {
      return value === true || value === 'true' || value === 1 || value === '1';
    }
    if (f.type === 'number') {
      var n = Number(value);
      return isNaN(n) ? 0 : n;
    }
    if (f.type === 'array') return Array.isArray(value) ? value.slice() : [];
    if (f.type === 'select') {
      var v = String(value === undefined || value === null ? '' : value);
      return f.options.indexOf(v) >= 0 ? v : f.options[0];
    }
    return '';
  }

  function checkRequired(cfg, record) {
    cfg.fields.forEach(function (f) {
      if (!f.required) return;
      var v = record[f.key];
      if (v === '' || v === undefined || v === null || (Array.isArray(v) && v.length === 0)) {
        throw new TypeError('ModuleFactory[' + cfg.id + ']: 必填字段 "' + f.key + '" 缺少值');
      }
    });
  }

  /* ---------- createModule ---------- */

  function createModule(store, config) {
    if (!store || typeof store.save !== 'function' || !store.state ||
        typeof store._emitChange !== 'function' || typeof store._undoPush !== 'function' ||
        typeof store._registerCollection !== 'function') {
      throw new TypeError('ModuleFactory: store 必须为 SonderStore 实例（save/state/_emitChange/_undoPush/_registerCollection 齐备）');
    }
    validateConfig(config);
    var cfg = freezeConfig(normalizeConfig(config));
    /* 注册集合进 normalize 白名单：重载/导入/解密后数据不丢（Phase 7 迁移前提） */
    store._registerCollection(cfg.id);

    var renderer = null;
    var destroyed = false;

    function requireLive() {
      if (destroyed) throw new Error('ModuleFactory[' + cfg.id + ']: 模块已销毁');
    }
    function notify() {
      if (renderer) renderer();
    }
    function collection() {
      if (!store.state[cfg.id]) store.state[cfg.id] = [];
      return store.state[cfg.id];
    }

    return {
      id: cfg.id,
      config: cfg,
      add: function (data) {
        requireLive();
        var record = { id: h.uid() };
        if (cfg.timeField) record[cfg.timeField] = h.nowISO();
        else { record.createdAt = h.nowISO(); record.updatedAt = h.nowISO(); }
        if (cfg.orderField) record[cfg.orderField] = collection().length;
        cfg.fields.forEach(function (f) {
          record[f.key] = sanitize(cfg, f.key, data ? data[f.key] : undefined);
        });
        checkRequired(cfg, record);
        if (cfg.prepend) collection().unshift(record);
        else collection().push(record);
        store._commit(cfg.id);
        store._emitChange(cfg.id);
        notify();
        return record;
      },
      update: function (id, patch) {
        requireLive();
        var rec = h.find(collection(), id);
        if (!rec) return null;
        if (!patch || typeof patch !== 'object') return rec;
        /* 先净化为临时副本并校验（required 检查），通过后才落回记录：
         * 校验失败时内存记录与持久化均不被污染。 */
        var next = {};
        cfg.fields.forEach(function (f) {
          if (Object.prototype.hasOwnProperty.call(patch, f.key)) {
            next[f.key] = sanitize(cfg, f.key, patch[f.key]);
          } else {
            next[f.key] = rec[f.key];
          }
        });
        checkRequired(cfg, next);
        cfg.fields.forEach(function (f) {
          if (Object.prototype.hasOwnProperty.call(patch, f.key)) rec[f.key] = next[f.key];
        });
        if (!cfg.timeField) rec.updatedAt = h.nowISO();
        store._commit(cfg.id);
        store._emitChange(cfg.id);
        notify();
        return rec;
      },
      remove: function (id) {
        requireLive();
        var arr = collection();
        var at = h.idxOf(arr, id);
        if (at >= 0) {
          var removed = arr.splice(at, 1);
          store._undoPush({ list: cfg.id, at: at, data: removed[0] });
        }
        store._commit(cfg.id);
        store._emitChange(cfg.id);
        notify();
      },
      /* v0.1.2：上下移（仅配置 orderField 时可用）。
       * 语义对齐 store.reorderTask：交换相邻位置并重写全集合 order；
       * 越界/未知 id 返回 false 且无副作用。 */
      move: function (id, dir) {
        requireLive();
        if (!cfg.orderField) throw new Error('ModuleFactory[' + cfg.id + ']: 未配置 orderField，不支持 move');
        var arr = collection();
        var idx = h.idxOf(arr, id);
        var swap = dir === 'up' ? idx - 1 : idx + 1;
        if (idx < 0 || swap < 0 || swap >= arr.length) return false;
        var tmp = arr[idx]; arr[idx] = arr[swap]; arr[swap] = tmp;
        for (var i = 0; i < arr.length; i++) arr[i][cfg.orderField] = i;
        store._commit(cfg.id);
        store._emitChange(cfg.id);
        notify();
        return true;
      },
      getById: function (id) {
        requireLive();
        return h.find(collection(), id) || null;
      },
      /* 纯净查询：不改 state、不触发渲染；返回记录浅拷贝，不外泄可变引用 */
      query: function (filter, sort) {
        requireLive();
        var out = collection().slice();
        if (typeof filter === 'function') out = out.filter(filter);
        out = out.map(function (r) {
          var c = {};
          for (var k in r) if (Object.prototype.hasOwnProperty.call(r, k)) c[k] = r[k];
          return c;
        });
        if (typeof sort === 'function') out.sort(sort);
        return out;
      },
      render: function (fn) {
        renderer = typeof fn === 'function' ? fn : null;
      },
      destroy: function () {
        destroyed = true;
        renderer = null;
      }
    };
  }

  return /** @type {SonderModuleFactoryApi} */ ({
    createModule: createModule,
    FIELD_TYPES: FIELD_TYPES
  });
});
