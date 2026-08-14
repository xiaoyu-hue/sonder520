/* store-tasks.js - SonderStore 领域扩展：快速备忘 + 今日计划
 * 浏览器：在 store.js 之后加载（接收 root.SonderStore.Store 与 _h）
 * Node：由 store.js 的 UMD 分支 require 并注入 (Store, _h)
 * 共享 helper 一律通过 _h 传入，不引用任何闭包外变量。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else factory(root.SonderStore.Store, root.SonderStore._h);
})(typeof self !== 'undefined' ? self : this, function (Store, h) {
  'use strict';

  /* ====== 快速备忘 ====== */
  Store.prototype.addMemo = function (text) {
    var m = { id: h.uid(), text: String(text || '').trim(), time: h.nowISO(), archived: false };
    this.state.memos.unshift(m);
    this.save();
    this._emitChange('memos');
    return m;
  };
  Store.prototype.updateMemo = function (id, patch) {
    var m = h.find(this.state.memos, id);
    if (!m) return null;
    if (typeof patch.text === 'string') m.text = patch.text.trim();
    if (patch.archived === true) m.archived = true;
    if (patch.archived === false) m.archived = false;
    this.save();
    this._emitChange('memos');
    return m;
  };
  Store.prototype.removeMemo = function (id) {
    var at = h.idxOf(this.state.memos, id);
    if (at >= 0) {
      var memos = this.state.memos.splice(at, 1); /* P4c 记录供撤销 */
      this._undoPush({ list: 'memos', at: at, data: memos[0] });
    }
    this.save();
    this._emitChange('memos');
  };

  /* ====== 今日计划 ====== */
  Store.prototype.addTask = function (data) {
    var t = {
      id: h.uid(),
      title: String(data.title || '').trim() || '未命名任务',
      note: String(data.note || ''),
      date: data.date || h.todayStr(),
      priority: h.normalizePriority(data.priority || 'p2'),
      done: !!data.done,
      doneAt: data.doneAt || null,
      order: this.state.tasks.length
    };
    this.state.tasks.push(t);
    this.save();
    this._emitChange('tasks');
    return t;
  };
  Store.prototype.updateTask = function (id, patch) {
    var t = h.find(this.state.tasks, id);
    if (!t) return null;
    if (typeof patch.title === 'string') t.title = patch.title.trim() || t.title;
    if (typeof patch.note === 'string') t.note = patch.note;
    if (typeof patch.date === 'string') t.date = patch.date;
    if (typeof patch.priority === 'string') t.priority = h.normalizePriority(patch.priority);
    if (typeof patch.done === 'boolean') {
      t.done = patch.done;
      t.doneAt = patch.done ? h.nowISO() : null;
    }
    this.save();
    this._emitChange('tasks');
    return t;
  };
  Store.prototype.removeTask = function (id) {
    var at = h.idxOf(this.state.tasks, id);
    if (at >= 0) {
      var tasks = this.state.tasks.splice(at, 1); /* P4c 记录供撤销 */
      this._undoPush({ list: 'tasks', at: at, data: tasks[0] });
    }
    this.save();
    this._emitChange('tasks');
  };
  Store.prototype.reorderTask = function (id, dir) {
    var idx = h.idxOf(this.state.tasks, id);
    var swap = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= this.state.tasks.length) return false;
    var arr = this.state.tasks;
    var tmp = arr[idx]; arr[idx] = arr[swap]; arr[swap] = tmp;
    for (var i = 0; i < arr.length; i++) arr[i].order = i;
    this.save();
    this._emitChange('tasks');
    return true;
  };
});