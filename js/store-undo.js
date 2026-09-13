/* store-undo.js - SonderStore 领域扩展：删除撤销（P4c）
 * 浏览器：在 store.js 之后加载（接收 root.SonderStore.Store 与 _h）
 * Node：由 store.js 的 UMD 分支 require 并注入 (Store, _h)
 * 共享 helper 一律通过 _h 传入，不引用任何闭包外变量。
 * 说明：v6.x Phase 6 拆 store.js——undo 职责独立成文件（纯搬家，行为零变化）。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else factory(root.SonderStore.Store, root.SonderStore._h);
})(typeof self !== 'undefined' ? self : this, function (Store, h) {
  'use strict';

  /* P4c：删除撤销——记录删除条目（容量 10，超出丢最旧），undoRemove 恢复 */
  Store.prototype._undoPush = function (u) {
    this._undo.push(u);
    if (this._undo.length > 10) this._undo.shift();
  };
  /* P4c：撤销最近一次删除；成功返回被恢复的数据，无可撤销返回 null */
  Store.prototype.undoRemove = function () {
    var u = this._undo.pop();
    if (!u) return null;
    if (u.restore) {
      u.restore(this.state);
    } else {
      var arr = this.state[u.list];
      if (!Array.isArray(arr)) return null;
      arr.splice(Math.min(u.at, arr.length), 0, u.data);
    }
    this._commit(u.list); /* 撤销恢复写回被撤销的集合（多文档删除跨集合时全量兜底） */
    this._emitChange(u.list || 'all'); /* 撤销恢复：广播受影响数据 */
    return u.data || true;
  };
});
