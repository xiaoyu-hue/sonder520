/* store-media.js - SonderStore 领域扩展：自媒体 + 开发工作 + 技术笔记/代码片段
 * 浏览器：在 store.js 之后加载（接收 root.SonderStore.Store 与 _h）
 * Node：由 store.js 的 UMD 分支 require 并注入 (Store, _h) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else factory(root.SonderStore.Store, root.SonderStore._h);
})(typeof self !== 'undefined' ? self : this, function (Store, h) {
  'use strict';

  /* ====== 自媒体 ====== */
  var STAT_FIELDS = ['views', 'likes', 'comments', 'favorites'];
  function num0(v) { var n = Number(v); return isNaN(n) ? 0 : Math.max(0, n); }
  function postFactory(d) {
    var p = {
      id: h.uid(), title: String(d.title || '').trim() || '未命名内容',
      platform: String(d.platform || '').trim(), account: String(d.account || '').trim(),
      note: String(d.note || ''), tags: (Array.isArray(d.tags) ? d.tags.slice() : []),
      status: d.status || 'draft', publishDate: d.publishDate || null,
      createdAt: h.nowISO()
    };
    STAT_FIELDS.forEach(function (f) { p[f] = num0(d[f]); });
    p.progress = num0(d.progress);
    if (p.progress > 100) p.progress = 100;
    return p;
  }
  Store.prototype.addPost = function (d) { var p = postFactory(d); this.state.posts.unshift(p); this.save(); return p; };
  Store.prototype.updatePost = function (id, patch) {
    var p = h.find(this.state.posts, id); if (!p) return null;
    ['title', 'platform', 'account', 'note', 'status', 'publishDate'].forEach(function (k) {
      if (typeof patch[k] === 'string') p[k] = patch[k];
    });
    STAT_FIELDS.forEach(function (f) {
      if (patch[f] !== undefined && patch[f] !== null && patch[f] !== '') p[f] = num0(patch[f]);
    });
    if (patch.progress !== undefined && patch.progress !== null && patch.progress !== '') {
      var pr = num0(patch.progress);
      p.progress = pr > 100 ? 100 : pr;
    }
    if (Array.isArray(patch.tags)) p.tags = patch.tags.slice();
    this.save(); return p;
  };
  Store.prototype.removePost = function (id) {
    var at = h.idxOf(this.state.posts, id);
    if (at >= 0) {
      var posts = this.state.posts.splice(at, 1); /* P4c 记录供撤销 */
      this._undoPush({ list: 'posts', at: at, data: posts[0] });
    }
    this.save();
  };

  /* ====== 开发工作 ====== */
  Store.prototype.addDevProject = function (d) {
    var p = {
      id: h.uid(), name: String(d.name || '').trim() || '未命名项目',
      note: String(d.note || ''), tasks: [], createdAt: h.nowISO()
    };
    this.state.devProjects.unshift(p); this.save(); return p;
  };
  Store.prototype.updateDevProject = function (id, patch) {
    var p = h.find(this.state.devProjects, id); if (!p) return null;
    if (typeof patch.name === 'string') p.name = patch.name.trim() || p.name;
    if (typeof patch.note === 'string') p.note = patch.note;
    this.save(); return p;
  };
  Store.prototype.removeDevProject = function (id) {
    var at = h.idxOf(this.state.devProjects, id);
    if (at >= 0) {
      var ps = this.state.devProjects.splice(at, 1); /* P4c 记录供撤销 */
      this._undoPush({ list: 'devProjects', at: at, data: ps[0] });
    }
    this.save();
  };
  function devTask(d) { return { id: h.uid(), title: String(d.title || ''), note: String(d.note || ''), done: !!d.done }; }
  Store.prototype.addDevTask = function (projId, d) {
    var p = h.find(this.state.devProjects, projId); if (!p) return null;
    var t = devTask(d); p.tasks.push(t); this.save(); return t;
  };
  Store.prototype.updateDevTask = function (projId, taskId, patch) {
    var p = h.find(this.state.devProjects, projId); if (!p) return null;
    var t = h.find(p.tasks, taskId); if (!t) return null;
    if (typeof patch.title === 'string') t.title = patch.title;
    if (typeof patch.note === 'string') t.note = patch.note;
    if (typeof patch.done === 'boolean') t.done = patch.done;
    this.save(); return t;
  };
  Store.prototype.removeDevTask = function (projId, taskId) {
    var p = h.find(this.state.devProjects, projId); if (!p) return;
    p.tasks = p.tasks.filter(function (t) { return t.id !== taskId; });
    this.save();
  };

  /* ====== 技术笔记 / 代码片段 ====== */
  Store.prototype.addDevNote = function (d) {
    var now = h.nowISO();
    var n = { id: h.uid(), title: String(d.title || '').trim() || '未命名笔记', content: String(d.content || ''), createdAt: now, updatedAt: now };
    this.state.devNotes.unshift(n); this.save(); return n;
  };
  Store.prototype.updateDevNote = function (id, patch) {
    var n = h.find(this.state.devNotes, id); if (!n) return null;
    if (typeof patch.title === 'string') n.title = patch.title.trim() || n.title;
    if (typeof patch.content === 'string') n.content = patch.content;
    n.updatedAt = h.nowISO();
    this.save(); return n;
  };
  Store.prototype.removeDevNote = function (id) {
    var at = h.idxOf(this.state.devNotes, id);
    if (at >= 0) {
      var ns = this.state.devNotes.splice(at, 1); /* P4c 记录供撤销 */
      this._undoPush({ list: 'devNotes', at: at, data: ns[0] });
    }
    this.save();
  };
  Store.prototype.addDevSnippet = function (d) {
    var now = h.nowISO();
    var s = { id: h.uid(), title: String(d.title || '').trim() || '未命名片段', code: String(d.code || ''), createdAt: now, updatedAt: now };
    this.state.devSnippets.unshift(s); this.save(); return s;
  };
  Store.prototype.updateDevSnippet = function (id, patch) {
    var s = h.find(this.state.devSnippets, id); if (!s) return null;
    if (typeof patch.title === 'string') s.title = patch.title.trim() || s.title;
    if (typeof patch.code === 'string') s.code = patch.code;
    s.updatedAt = h.nowISO();
    this.save(); return s;
  };
  Store.prototype.removeDevSnippet = function (id) {
    var at = h.idxOf(this.state.devSnippets, id);
    if (at >= 0) {
      var ss = this.state.devSnippets.splice(at, 1); /* P4c 记录供撤销 */
      this._undoPush({ list: 'devSnippets', at: at, data: ss[0] });
    }
    this.save();
  };
});