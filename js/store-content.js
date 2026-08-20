/* store-content.js - SonderStore 领域扩展：咨询 + 阅读/书摘 + 新闻 + 设计 + 游戏记录
 * 浏览器：在 store.js 之后加载（接收 root.SonderStore.Store 与 _h）
 * Node：由 store.js 的 UMD 分支 require 并注入 (Store, _h) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else factory(root.SonderStore.Store, root.SonderStore._h);
})(typeof self !== 'undefined' ? self : this, function (Store, h) {
  'use strict';

  /* ====== 咨询工作 ====== */
  Store.prototype.addClient = function (d) {
    var c = { id: h.uid(), name: String(d.name || '').trim() || '未命名客户', contact: String(d.contact || ''), note: String(d.note || ''), projects: [], followups: [], income: [], createdAt: h.nowISO() };
    this.state.clients.unshift(c); this._commit('clients'); this._emitChange('clients'); return c;
  };
  Store.prototype.updateClient = function (id, patch) {
    var c = h.find(this.state.clients, id); if (!c) return null;
    if (typeof patch.name === 'string') c.name = patch.name.trim() || c.name;
    if (typeof patch.contact === 'string') c.contact = patch.contact;
    if (typeof patch.note === 'string') c.note = patch.note;
    this._commit('clients'); this._emitChange('clients'); return c;
  };
  Store.prototype.removeClient = function (id) {
    var at = h.idxOf(this.state.clients, id);
    if (at >= 0) {
      var clients = this.state.clients.splice(at, 1); /* P4c 记录供撤销 */
      this._undoPush({ list: 'clients', at: at, data: clients[0] });
    }
    this._commit('clients');
    this._emitChange('clients');
  };
  Store.prototype.addClientProject = function (clientId, d) {
    var c = h.find(this.state.clients, clientId); if (!c) return null;
    var pr = { id: h.uid(), name: String(d.name || '').trim() || '未命名项目', stage: d.stage || '进行中', note: String(d.note || '') };
    c.projects.push(pr); this._commit('clients'); this._emitChange('clients'); return pr;
  };
  Store.prototype.updateClientProject = function (clientId, projId, patch) {
    var c = h.find(this.state.clients, clientId); if (!c) return null;
    var pr = h.find(c.projects, projId); if (!pr) return null;
    if (typeof patch.name === 'string') pr.name = patch.name.trim() || pr.name;
    if (typeof patch.stage === 'string') pr.stage = patch.stage;
    if (typeof patch.note === 'string') pr.note = patch.note;
    this._commit('clients'); this._emitChange('clients'); return pr;
  };
  Store.prototype.removeClientProject = function (clientId, projId) {
    var c = h.find(this.state.clients, clientId); if (!c) return;
    var at = h.idxOf(c.projects, projId);
    if (at >= 0) {
      var projs = c.projects.splice(at, 1); /* P4c 子项删除用闭包恢复 */
      this._undoPush({ restore: function (st) {
        var cc = h.find(st.clients, clientId);
        if (cc) cc.projects.splice(Math.min(at, cc.projects.length), 0, projs[0]);
      } });
    }
    this._commit('clients');
    this._emitChange('clients');
  };
  Store.prototype.addClientFollowup = function (clientId, d) {
    var c = h.find(this.state.clients, clientId); if (!c) return null;
    var f = { id: h.uid(), date: d.date || h.todayStr(), note: String(d.note || ''), done: !!d.done };
    c.followups.push(f); this._commit('clients'); this._emitChange('clients'); return f;
  };
  Store.prototype.updateClientFollowup = function (clientId, fuId, patch) {
    var c = h.find(this.state.clients, clientId); if (!c) return null;
    var f = h.find(c.followups, fuId); if (!f) return null;
    if (typeof patch.date === 'string') f.date = patch.date;
    if (typeof patch.note === 'string') f.note = patch.note;
    if (typeof patch.done === 'boolean') f.done = patch.done;
    this._commit('clients'); this._emitChange('clients'); return f;
  };
  Store.prototype.removeClientFollowup = function (clientId, fuId) {
    var c = h.find(this.state.clients, clientId); if (!c) return;
    var at = h.idxOf(c.followups, fuId);
    if (at >= 0) {
      var fus = c.followups.splice(at, 1); /* P4c 子项删除用闭包恢复 */
      this._undoPush({ restore: function (st) {
        var cc = h.find(st.clients, clientId);
        if (cc) cc.followups.splice(Math.min(at, cc.followups.length), 0, fus[0]);
      } });
    }
    this._commit('clients');
    this._emitChange('clients');
  };
  Store.prototype.addClientIncome = function (clientId, d) {
    var c = h.find(this.state.clients, clientId); if (!c) return null;
    var amt = Number(d.amount);
    if (isNaN(amt)) amt = 0;
    var inc = { id: h.uid(), date: d.date || h.todayStr(), amount: amt, note: String(d.note || '') };
    c.income.push(inc); this._commit('clients'); this._emitChange('clients'); return inc;
  };
  Store.prototype.updateClientIncome = function (clientId, incId, patch) {
    var c = h.find(this.state.clients, clientId); if (!c) return null;
    var inc = h.find(c.income, incId); if (!inc) return null;
    if (typeof patch.date === 'string') inc.date = patch.date;
    if (patch.amount !== undefined) { var a = Number(patch.amount); if (!isNaN(a)) inc.amount = a; }
    if (typeof patch.note === 'string') inc.note = patch.note;
    this._commit('clients'); this._emitChange('clients'); return inc;
  };
  Store.prototype.removeClientIncome = function (clientId, incId) {
    var c = h.find(this.state.clients, clientId); if (!c) return;
    var at = h.idxOf(c.income, incId);
    if (at >= 0) {
      var incs = c.income.splice(at, 1); /* P4c 子项删除用闭包恢复 */
      this._undoPush({ restore: function (st) {
        var cc = h.find(st.clients, clientId);
        if (cc) cc.income.splice(Math.min(at, cc.income.length), 0, incs[0]);
      } });
    }
    this._commit('clients');
    this._emitChange('clients');
  };

  /* ====== 阅读计划 ====== */
  Store.prototype.addBook = function (d) {
    var pr = Number(d.progress);
    if (isNaN(pr)) pr = 0;
    pr = Math.max(0, Math.min(100, pr));
    var b = { id: h.uid(), title: String(d.title || '').trim() || '未命名书籍', author: String(d.author || ''), status: d.status || '想读', progress: pr, notes: [], readingMinutes: 0, readingLog: [], finishedAt: null, createdAt: h.nowISO() };
    /* 新建即标记已读完：自动记录完成日期 */
    if (b.status === '已读完' && !b.finishedAt) b.finishedAt = h.todayStr();
    this.state.books.unshift(b); this._commit('books'); this._emitChange('books'); return b;
  };
  Store.prototype.updateBook = function (id, patch) {
    var b = h.find(this.state.books, id); if (!b) return null;
    if (typeof patch.title === 'string') b.title = patch.title.trim() || b.title;
    if (typeof patch.author === 'string') b.author = patch.author;
    if (typeof patch.status === 'string' && patch.status !== b.status) {
      /* 标记已读完：自动记录完成日期；改回其他状态则清除 */
      b.status = patch.status;
      b.finishedAt = (patch.status === '已读完') ? (b.finishedAt || h.todayStr()) : null;
    }
    if (patch.progress !== undefined) {
      var pr = Number(patch.progress);
      if (!isNaN(pr)) b.progress = Math.max(0, Math.min(100, pr));
    }
    this._commit('books'); this._emitChange('books'); return b;
  };
  Store.prototype.removeBook = function (id) {
    var at = h.idxOf(this.state.books, id);
    if (at >= 0) {
      var books = this.state.books.splice(at, 1); /* P4c 记录供撤销 */
      this._undoPush({ list: 'books', at: at, data: books[0] });
    }
    this._commit('books');
    this._emitChange('books');
  };
  /* 阅读计时落账：minutes 为分钟数（浮点）。不足 1 分钟按 1 分钟计，写入当日会话日志（供周报）。 */
  Store.prototype.addReadingSession = function (bookId, minutes) {
    var b = h.find(this.state.books, bookId); if (!b) return null;
    var m = Math.max(1, Math.ceil(Number(minutes) || 0));
    b.readingMinutes = (b.readingMinutes || 0) + m;
    b.readingLog.push({ date: h.todayStr(), minutes: m });
    this._commit('books'); this._emitChange('books'); return m;
  };

  /* ====== 我的书摘 ====== */
  Store.prototype.addExcerpt = function (d) {
    var b = h.find(this.state.books, d.bookId);
    var text = String(d.text || '').trim();
    if (!text) return null;
    var ex = { id: h.uid(), bookId: d.bookId, bookTitle: b ? b.title : String(d.bookTitle || '未知书籍'), text: text, page: h.num0(d.page), time: h.nowISO() };
    this.state.excerpts.unshift(ex); this._commit('excerpts'); this._emitChange('excerpts'); return ex;
  };
  Store.prototype.removeExcerpt = function (id) {
    var at = h.idxOf(this.state.excerpts, id);
    if (at >= 0) {
      var exs = this.state.excerpts.splice(at, 1); /* P4c 记录供撤销 */
      this._undoPush({ list: 'excerpts', at: at, data: exs[0] });
    }
    this._commit('excerpts');
    this._emitChange('excerpts');
  };
  Store.prototype.addBookNote = function (bookId, text) {
    var b = h.find(this.state.books, bookId); if (!b) return null;
    var n = { id: h.uid(), time: h.nowISO(), text: String(text || '').trim() };
    b.notes.push(n); this._commit('books'); this._emitChange('books'); return n;
  };
  Store.prototype.removeBookNote = function (bookId, noteId) {
    var b = h.find(this.state.books, bookId); if (!b) return;
    var at = h.idxOf(b.notes, noteId);
    if (at >= 0) {
      var notes = b.notes.splice(at, 1); /* P4c 子项删除用闭包恢复 */
      this._undoPush({ restore: function (st) {
        var bb = h.find(st.books, bookId);
        if (bb) bb.notes.splice(Math.min(at, bb.notes.length), 0, notes[0]);
      } });
    }
    this._commit('books');
    this._emitChange('books');
  };

  /* ====== 看新闻计划 ====== */
  Store.prototype.addNews = function (d) {
    var n = { id: h.uid(), title: String(d.title || '').trim() || '未命名资讯', url: String(d.url || ''), source: String(d.source || ''), tags: (Array.isArray(d.tags) ? d.tags.slice() : []), status: d.status || 'unread', note: String(d.note || ''), time: h.nowISO() };
    this.state.news.unshift(n); this._commit('news'); this._emitChange('news'); return n;
  };
  Store.prototype.updateNews = function (id, patch) {
    var n = h.find(this.state.news, id); if (!n) return null;
    if (typeof patch.title === 'string') n.title = patch.title.trim() || n.title;
    if (typeof patch.url === 'string') n.url = patch.url;
    if (typeof patch.source === 'string') n.source = patch.source;
    if (Array.isArray(patch.tags)) n.tags = patch.tags.slice();
    if (typeof patch.status === 'string') n.status = patch.status;
    if (typeof patch.note === 'string') n.note = patch.note;
    this._commit('news'); this._emitChange('news'); return n;
  };
  Store.prototype.removeNews = function (id) {
    var at = h.idxOf(this.state.news, id);
    if (at >= 0) {
      var news = this.state.news.splice(at, 1); /* P4c 记录供撤销 */
      this._undoPush({ list: 'news', at: at, data: news[0] });
    }
    this._commit('news');
    this._emitChange('news');
  };

  /* ====== 设计计划 ====== */
  Store.prototype.addDesign = function (d) {
    var x = { id: h.uid(), type: d.type === 'project' ? 'project' : 'idea', title: String(d.title || '').trim() || '未命名', link: String(d.link || ''), category: String(d.category || ''), note: String(d.note || ''), stage: d.stage || '构想', time: h.nowISO() };
    this.state.designs.unshift(x); this._commit('designs'); this._emitChange('designs'); return x;
  };
  Store.prototype.updateDesign = function (id, patch) {
    var x = h.find(this.state.designs, id); if (!x) return null;
    if (typeof patch.title === 'string') x.title = patch.title.trim() || x.title;
    if (typeof patch.type === 'string') x.type = patch.type === 'project' ? 'project' : 'idea';
    if (typeof patch.category === 'string') x.category = patch.category;
    if (typeof patch.link === 'string') x.link = patch.link;
    if (typeof patch.note === 'string') x.note = patch.note;
    if (typeof patch.stage === 'string') x.stage = patch.stage;
    this._commit('designs'); this._emitChange('designs'); return x;
  };
  Store.prototype.removeDesign = function (id) {
    var at = h.idxOf(this.state.designs, id);
    if (at >= 0) {
      var ds = this.state.designs.splice(at, 1); /* P4c 记录供撤销 */
      this._undoPush({ list: 'designs', at: at, data: ds[0] });
    }
    this._commit('designs');
    this._emitChange('designs');
  };

  /* ====== 娱乐游戏 ====== */
  /* 单人休闲游戏 kind（战绩并入对局记录，mode 记为 solo，难度按自身档位保存） */
  var SOLO_KINDS = { guessnum: 1, minesweeper: 1, idiom: 1, brainteaser: 1 };
  Store.prototype.addGameRecord = function (d) {
    var solo = SOLO_KINDS[d.kind] ? true : false;
    var kind = d.kind === 'gomoku' || d.kind === 'tictactoe' || solo ? d.kind : 'tictactoe';
    var mode = d.mode === 'pvp' ? 'pvp' : (solo ? 'solo' : 'ai');
    var winner = d.winner === 'draw' ? 'draw' : d.winner;
    var r = {
      id: h.uid(),
      kind: kind,
      mode: mode,
      player: d.player || (mode === 'pvp' ? 'X' : 'player'),
      winner: winner,
      byResign: !!d.byResign,
      /* 棋类难度映射为 easy/normal/hard；单人休闲游戏保留自身档位 */
      difficulty: mode === 'pvp' ? null : (solo
        ? (d.difficulty || null)
        : (d.difficulty === 'easy' || d.difficulty === 'hard' ? d.difficulty : 'normal')),
      note: d.note || null,
      date: h.todayStr(),
      time: h.nowISO()
    };
    this.state.gameRecords.unshift(r);
    this._commit('gameRecords');
    this._emitChange('gameRecords');
    return r;
  };
  Store.prototype.clearGameRecords = function () {
    this.state.gameRecords = [];
    this._commit('gameRecords');
    this._emitChange('gameRecords');
  };

  /* 单人小游戏纪录（guessnum/minesweeper/idiom/brainteaser 的 best/diff/right/wrong 等）：
   * 原独立 localStorage key，P3e 并入 state.miniRecords 统一持久化 */
  Store.prototype.getMiniRecord = function (kind) {
    var o = this.state.miniRecords[kind];
    return o && typeof o === 'object' ? h.deepClone(o) : {};
  };
  Store.prototype.updateMiniRecord = function (kind, patch) {
    var o = this.state.miniRecords[kind];
    if (!o || typeof o !== 'object') o = {};
    Object.keys(patch || {}).forEach(function (k) { o[k] = patch[k]; });
    this.state.miniRecords[kind] = o;
    this._commit('miniRecords');
    this._emitChange('miniRecords');
    return this.getMiniRecord(kind);
  };
});