/* SonderBus - 轻量事件总线（单页协作）+ EventBridge v0.1 事件契约
 * 兼容浏览器(<script> 暴露 window.SonderBus)与 Node(module.exports)。
 * 用途：store 数据变更 → 页面模块自动重绘；多模块间解耦通知。
 * 路径约定：/data/<数据键>，通配 '*' 匹配任意数量路径段（跨层）。
 * 依赖：无。
 *
 * ================= EventBridge v0.1 事件契约（谁发 / 谁听 / 结构 / 缺字段） =================
 * EVENT.data(key)      数据变更    谁发：store 集合方法持久化成功后（save → 广播）
 *                                 谁听：页面模块重绘——home/总览订阅 /data/* 全量，
 *                                       单页模块按 /data/<集合> 精确订阅
 *                                 结构：path = /data/<集合>；detail 恒为 undefined
 *                                 缺字段：订阅者只依赖 path，不得读取 detail
 * EVENT.DATA_ALL       全量数据变更 谁发：导入 / 清空 / 锁定解锁 / 加解密切换
 *                                 谁听：全量重绘入口（detail 同 DATA 规则）
 * EVENT.STORE_YIELDED  多标签让位    谁发：store 写锁让位吸收（_absorbNewer）
 *                                 谁听：app.js（toast 提示已同步）
 * 纪律：新框架代码一律经 EVENT 表（禁止书写魔法字符串路径）；
 *       订阅必须保存返回值 unsubscribe，销毁时调用（destroy 完整清理）。
 *       存量页面模块维持字面量路径订阅（兼容），收编改造随模块迁移进行。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SonderBus = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 事件名常量表（冻结）：新代码唯一事件名真源 */
  var EVENT = {
    DATA_ALL: '/data/all',
    STORE_YIELDED: '/store/yielded',
    /* /data/<集合> 路径生成器：与 store._emitChange 广播完全等价 */
    data: function (key) { return '/data/' + String(key); }
  };
  Object.freeze(EVENT);

  /* 路径匹配：pattern 中 '*' 匹配任意数量段（含层级）。
   * '/data/*'  命中 '/data/memos'、'/data/dev/projects'
   * '/data/dev/*' 命中 '/data/dev/projects'、'/data/dev/notes'
   * 非通配 pattern 需与 path 完全一致 */
  function matches(pattern, path) {
    if (pattern === path) return true;
    if (pattern.indexOf('*') === -1) return false;
    var pa = pattern.replace(/^\/+|\/+$/g, '').split('/');
    var pp = path.replace(/^\/+|\/+$/g, '').split('/');
    var pi = 0, hi = 0;
    while (pi < pa.length) {
      if (pa[pi] === '*') {
        if (pi === pa.length - 1) return true; /* 尾部 *：吞掉剩余任意层 */
        var next = pa[pi + 1]; /* 中部 *：贪心跨层找下一个固定段 */
        while (hi < pp.length && pp[hi] !== next) hi++;
        if (hi >= pp.length) return false;
        pi += 2; hi += 1;
      } else {
        if (pp[hi] !== pa[pi]) return false;
        pi++; hi++;
      }
    }
    return hi === pp.length;
  }

  /**
   * 总线构造器
   * @this {{ _map: any, counts: { on: number, emit: number } }}
   */
  function Bus() {
    this._map = Object.create(null); /* pattern -> [fn] */
    /* 计数器（测试/诊断用）：on 注册数、emit 触发数 */
    this.counts = { on: 0, emit: 0 };
  }

  /* 订阅；返回取消函数。同一 pattern+fn 重复注册按两次处理（调用两次） */
  Bus.prototype.on = function (pattern, fn) {
    if (typeof fn !== 'function') return function () {};
    if (!this._map[pattern]) this._map[pattern] = [];
    this._map[pattern].push(fn);
    this.counts.on++;
    var self = this;
    return function () { self.off(pattern, fn); };
  };

  Bus.prototype.off = function (pattern, fn) {
    var list = this._map[pattern];
    if (!list) return;
    var i = list.indexOf(fn);
    if (i !== -1) list.splice(i, 1);
  };

  /* 广播：同步调用所有匹配 pattern 的订阅者 fn(path, detail) */
  Bus.prototype.emit = function (path, detail) {
    this.counts.emit++;
    var keys = Object.keys(this._map);
    for (var i = 0; i < keys.length; i++) {
      if (!matches(keys[i], path)) continue;
      var list = this._map[keys[i]];
      /* 快照遍历：订阅者内可能再次 on/off，避免迭代器越界 */
      var fns = list.slice();
      for (var j = 0; j < fns.length; j++) {
        try { fns[j](path, detail); } catch (e) { /* 单订阅者异常不拖垮广播 */ }
      }
    }
  };

  /* 清空全部订阅（测试隔离/模块重载用） */
  Bus.prototype.clear = function () {
    this._map = Object.create(null);
    this.counts.on = 0;
    this.counts.emit = 0;
  };

  var bus = new Bus();

  return {
    bus: bus,
    matches: matches,
    EVENT: EVENT,
    on: function (p, fn) { return bus.on(p, fn); },
    off: function (p, fn) { bus.off(p, fn); },
    emit: function (p, d) { bus.emit(p, d); },
    /* 测试隔离：清空订阅并复位计数器 */
    reset: function () { bus.clear(); }
  };
});