/* book-repository.js - 阅读场景的数据访问边界（v6.x 架构升级 · Repository 第二刀）
 *
 * 覆盖三个耦合集合：books（书）/ notes（书内笔记，books 子集合）/ excerpts（书摘）。
 * 本版为过渡形态——内部直接委托旧 Store 的领域方法（store-content.js），行为完全一致
 * （含 commit/事件/undo）；目标是让 reading.js 不再直连 Store，统一经此边界访问。
 *
 * 边界规则（执行方案 §11）：只负责数据访问，不掺 UI/页面状态/Toast/DOM。
 *
 * 浏览器：<script src="js/repositories/book-repository.js">（在 store-content.js 之后加载）
 * Node：module.exports 返回工厂 createBookRepository(store)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.SonderBookRepository = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function findById(arr, id) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) return arr[i];
    }
    return null;
  }

  function createBookRepository(store) {
    if (!store || typeof store.addBook !== 'function' || !store.state ||
        typeof store.state.books === 'undefined') {
      throw new TypeError('BookRepository: store 必须为 SonderStore 实例（books 集合齐备）');
    }

    return {
      /* ---------- books 读 ---------- */
      get: function (id) {
        return findById(store.state.books, id);
      },
      /* 只读快照：调用方改动返回数组不影响 store.state（元素为引用，更新请走 update） */
      getAll: function () {
        return store.state.books.slice();
      },

      /* ---------- books 写（委托旧 Store，行为完全一致） ---------- */
      create: function (d) {
        return store.addBook(d);
      },
      update: function (id, patch) {
        return store.updateBook(id, patch);
      },
      remove: function (id) {
        return store.removeBook(id);
      },
      /* 阅读计时落账（minutes 浮点，不足 1 分钟按 1 分钟计） */
      addReadingSession: function (bookId, minutes) {
        return store.addReadingSession(bookId, minutes);
      },

      /* ---------- 书内笔记（books 子集合） ---------- */
      addNote: function (bookId, text) {
        return store.addBookNote(bookId, text);
      },
      removeNote: function (bookId, noteId) {
        return store.removeBookNote(bookId, noteId);
      },

      /* ---------- 书摘（excerpts 集合） ---------- */
      getExcerpts: function () {
        return store.state.excerpts.slice();
      },
      addExcerpt: function (d) {
        return store.addExcerpt(d);
      },
      removeExcerpt: function (id) {
        return store.removeExcerpt(id);
      }
    };
  }

  return { createBookRepository: createBookRepository };
});
