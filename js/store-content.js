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
    this.state.clients.unshift(c); this.save(); return c;
  };
  Store.prototype.updateClient = function (id, patch) {
    var c = h.find(this.state.clients, id); if (!c) return null;
    if (typeof patch.name === 'string') c.name = patch.name.trim() || c.name;
    if (typeof patch.contact === 'string') c.contact = patch.contact;
    if (typeof patch.note === 'string') c.note = patch.note;
    this.save(); return c;
  };
  Store.prototype.removeClient = function (id) {
    this.state.clients = this.state.clients.filter(function (c) { return c.id !== id; });
    this.save();
  };
  Store.prototype.addClientProject = function (clientId, d) {
    var c = h.find(this.state.clients, clientId); if (!c) return null;
    var pr = { id: h.uid(), name: String(d.name || '').trim() || '未命名项目', stage: d.stage || '进行中', note: String(d.note || '') };
    c.projects.push(pr); this.save(); return pr;
  };
  Store.prototype.updateClientProject = function (clientId, projId, patch) {
    var c = h.find(this.state.clients, clientId); if (!c) return null;
    var pr = h.find(c.projects, projId); if (!pr) return null;
    if (typeof patch.name === 'string') pr.name = patch.name.trim() || pr.name;
    if (typeof patch.stage === 'string') pr.stage = patch.stage;
    if (typeof patch.note === 'string') pr.note = patch.note;
    this.save(); return pr;
  };
  Store.prototype.removeClientProject = function (clientId, projId) {
    var c = h.find(this.state.clients, clientId); if (!c) return;
    c.projects = c.projects.filter(function (p) { return p.id !== projId; });
    this.save();
  };
  Store.prototype.addClientFollowup = function (clientId, d) {
    var c = h.find(this.state.clients, clientId); if (!c) return null;
    var f = { id: h.uid(), date: d.date || h.todayStr(), note: String(d.note || ''), done: !!d.done };
    c.followups.push(f); this.save(); return f;
  };
  Store.prototype.updateClientFollowup = function (clientId, fuId, patch) {
    var c = h.find(this.state.clients, clientId); if (!c) return null;
    var f = h.find(c.followups, fuId); if (!f) return null;
    if (typeof patch.date === 'string') f.date = patch.date;
    if (typeof patch.note === 'string') f.note = patch.note;
    if (typeof patch.done === 'boolean') f.done = patch.done;
    this.save(); return f;
  };
  Store.prototype.removeClientFollowup = function (clientId, fuId) {
    var c = h.find(this.state.clients, clientId); if (!c) return;
    c.followups = c.followups.filter(function (f) { return f.id !== fuId; });
    this.save();
  };
  Store.prototype.addClientIncome = function (clientId, d) {
    var c = h.find(this.state.clients, clientId); if (!c) return null;
    var amt = Number(d.amount);
    if (isNaN(amt)) amt = 0;
    var inc = { id: h.uid(), date: d.date || h.todayStr(), amount: amt, note: String(d.note || '') };
    c.income.push(inc); this.save(); return inc;
  };
  Store.prototype.updateClientIncome = function (clientId, incId, patch) {
    var c = h.find(this.state.clients, clientId); if (!c) return null;
    var inc = h.find(c.income, incId); if (!inc) return null;
    if (typeof patch.date === 'string') inc.date = patch.date;
    if (patch.amount !== undefined) { var a = Number(patch.amount); if (!isNaN(a)) inc.amount = a; }
    if (typeof patch.note === 'string') inc.note = patch.note;
    this.save(); return inc;
  };
  Store.prototype.removeClientIncome = function (clientId, incId) {
    var c = h.find(this.state.clients, clientId); if (!c) return;
    c.income = c.income.filter(function (i) { return i.id !== incId; });
    this.save();
  };

  /* ====== 阅读计划 ====== */
  Store.prototype.addBook = function (d) {
    var pr = Number(d.progress);
    if (isNaN(pr)) pr = 0;
    pr = Math.max(0, Math.min(100, pr));
    var b = { id: h.uid(), title: String(d.title || '').trim() || '未命名书籍', author: String(d.author || ''), status: d.status || '想读', progress: pr, notes: [], readingMinutes: 0, readingLog: [], finishedAt: null, createdAt: h.nowISO() };
    /* 新建即标记已读完：自动记录完成日期 */
    if (b.status === '已读完' && !b.finishedAt) b.finishedAt = h.todayStr();
    this.state.books.unshift(b); this.save(); return b;
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
    this.save(); return b;
  };
  Store.prototype.removeBook = function (id) {
    this.state.books = this.state.books.filter(function (b) { return b.id !== id; });
    this.save();
  };
  /* 阅读计时落账：minutes 为分钟数（浮点）。不足 1 分钟按 1 分钟计，写入当日会话日志（供周报）。 */
  Store.prototype.addReadingSession = function (bookId, minutes) {
    var b = h.find(this.state.books, bookId); if (!b) return null;
    var m = Math.max(1, Math.ceil(Number(minutes) || 0));
    b.readingMinutes = (b.readingMinutes || 0) + m;
    b.readingLog.push({ date: h.todayStr(), minutes: m });
    this.save(); return m;
  };

  /* ====== 我的书摘 ====== */
  Store.prototype.addExcerpt = function (d) {
    var b = h.find(this.state.books, d.bookId);
    var text = String(d.text || '').trim();
    if (!text) return null;
    var ex = { id: h.uid(), bookId: d.bookId, bookTitle: b ? b.title : String(d.bookTitle || '未知书籍'), text: text, page: h.num0(d.page), time: h.nowISO() };
    this.state.excerpts.unshift(ex); this.save(); return ex;
  };
  Store.prototype.removeExcerpt = function (id) {
    this.state.excerpts = this.state.excerpts.filter(function (x) { return x.id !== id; });
    this.save();
  };
  Store.prototype.addBookNote = function (bookId, text) {
    var b = h.find(this.state.books, bookId); if (!b) return null;
    var n = { id: h.uid(), time: h.nowISO(), text: String(text || '').trim() };
    b.notes.push(n); this.save(); return n;
  };
  Store.prototype.removeBookNote = function (bookId, noteId) {
    var b = h.find(this.state.books, bookId); if (!b) return;
    b.notes = b.notes.filter(function (n) { return n.id !== noteId; });
    this.save();
  };

  /* ====== 看新闻计划 ====== */
  Store.prototype.addNews = function (d) {
    var n = { id: h.uid(), title: String(d.title || '').trim() || '未命名资讯', url: String(d.url || ''), source: String(d.source || ''), tags: (Array.isArray(d.tags) ? d.tags.slice() : []), status: d.status || 'unread', note: String(d.note || ''), time: h.nowISO() };
    this.state.news.unshift(n); this.save(); return n;
  };
  Store.prototype.updateNews = function (id, patch) {
    var n = h.find(this.state.news, id); if (!n) return null;
    if (typeof patch.title === 'string') n.title = patch.title.trim() || n.title;
    if (typeof patch.url === 'string') n.url = patch.url;
    if (typeof patch.source === 'string') n.source = patch.source;
    if (Array.isArray(patch.tags)) n.tags = patch.tags.slice();
    if (typeof patch.status === 'string') n.status = patch.status;
    if (typeof patch.note === 'string') n.note = patch.note;
    this.save(); return n;
  };
  Store.prototype.removeNews = function (id) {
    this.state.news = this.state.news.filter(function (n) { return n.id !== id; });
    this.save();
  };

  /* ====== 设计计划 ====== */
  Store.prototype.addDesign = function (d) {
    var x = { id: h.uid(), type: d.type === 'project' ? 'project' : 'idea', title: String(d.title || '').trim() || '未命名', link: String(d.link || ''), category: String(d.category || ''), note: String(d.note || ''), stage: d.stage || '构想', time: h.nowISO() };
    this.state.designs.unshift(x); this.save(); return x;
  };
  Store.prototype.updateDesign = function (id, patch) {
    var x = h.find(this.state.designs, id); if (!x) return null;
    if (typeof patch.title === 'string') x.title = patch.title.trim() || x.title;
    if (typeof patch.type === 'string') x.type = patch.type === 'project' ? 'project' : 'idea';
    if (typeof patch.category === 'string') x.category = patch.category;
    if (typeof patch.link === 'string') x.link = patch.link;
    if (typeof patch.note === 'string') x.note = patch.note;
    if (typeof patch.stage === 'string') x.stage = patch.stage;
    this.save(); return x;
  };
  Store.prototype.removeDesign = function (id) {
    this.state.designs = this.state.designs.filter(function (x) { return x.id !== id; });
    this.save();
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
    this.save();
    return r;
  };
  Store.prototype.clearGameRecords = function () {
    this.state.gameRecords = [];
    this.save();
  };
});