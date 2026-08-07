/* reading.js - 阅读计划：书单三状态、进度、读书笔记 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var currentEl = null, currentCtx = null;

  function render(ctx) {
    var container = currentEl, store = ctx.store, UI = ctx.UI;
    container.innerHTML = '';
    container.appendChild(UI.el('<div class="hbar"><button class="btn primary" id="rdAdd">＋ 新建书</button></div>'));
    container.querySelector('#rdAdd').addEventListener('click', function () { openBook(ctx); });

    if (!store.state.books.length) {
      container.appendChild(UI.emptyState('书单是空的', '＋ 新建书', function () { openBook(ctx); }));
      return;
    }
    container.appendChild(statsSection(store, ctx));
    var groups = window.SonderStore.booksByStatus(store.state.books);
    ['想读', '在读', '已读完'].forEach(function (grp) {
      var list = groups[grp];
      if (!list.length) return;
      container.appendChild(UI.el('<div class="section-title">' + grp + ' ' + list.length + '</div>'));
      list.forEach(function (b) { container.appendChild(bookCard(store, ctx, b)); });
    });
  }

  function statsSection(store, ctx) {
    var UI = ctx.UI, stats = window.SonderStore.readingStats(store.state.books);
    var pills = [
      ['书籍总数', stats.total], ['在读', stats.reading], ['已读完', stats.finished],
      ['想读', stats.want], ['在读平均进度', stats.avgReading + '%']
    ].map(function (x) { return '<span class="pill">' + UI.esc(x[0]) + ' ' + UI.esc(x[1]) + '</span>'; }).join(' ');

    /* 状态分布环形图（conic-gradient） */
    var total = Math.max(1, stats.total);
    var cum = 0;
    var stops = stats.byStatus.map(function (s) {
      var pct = Math.round((s.count / total) * 100);
      var stop = s.color + ' ' + cum + '% ' + (cum + pct) + '%';
      cum += pct;
      return stop;
    }).join(', ');
    var donutBg = stats.total ? 'conic-gradient(' + stops + ')' : 'none';
    var legend = stats.byStatus.map(function (s) {
      return '<div class="rd-legend"><i style="background:' + s.color + '"></i>' + UI.esc(s.label) + ' <b>' + s.count + '</b></div>';
    }).join('');

    /* 进度区间分布条形图 */
    var maxBucket = Math.max.apply(null, stats.buckets.map(function (b) { return b.count; }));
    var bars = stats.buckets.map(function (b) {
      var w = maxBucket > 0 ? Math.round((b.count / maxBucket) * 100) : 0;
      return '<div class="rd-brow"><span class="rd-blabel">' + UI.esc(b.label) + '</span>' +
        '<div class="st-bar"><i style="width:' + w + '%;background:' + b.color + '"></i></div>' +
        '<span class="st-val">' + b.count + '</span></div>';
    }).join('');

    return UI.el(
      '<div class="card" style="margin-bottom:16px">' +
      '<div class="section-title" style="margin-top:0">阅读统计</div>' +
      '<div class="row" style="margin-bottom:14px;flex-wrap:wrap">' + pills + '</div>' +
      '<div class="rd-grid">' +
      '  <div><div class="rd-donut" style="background:' + donutBg + '"></div>' +
      '    <div class="rd-donut-legend">' + legend + '</div></div>' +
      '  <div><div class="section-title" style="margin-top:0">按阅读进度分布</div>' + bars + '</div>' +
      '</div></div>'
    );
  }

  function bookCard(container, ctx, b) {
    var UI = ctx.UI, store = ctx.store;
    var card = UI.el(
      '<div class="list-item" data-id="' + b.id + '">' +
      '<div class="grow">' +
      '<div class="title">' + UI.esc(b.title) + (b.author ? ' <span class="muted small">' + UI.esc(b.author) + '</span>' : '') + '</div>' +
      '<div class="row" style="margin-top:6px"><span class="progress grow" style="max-width:160px"><i style="width:' + b.progress + '%"></i></span>' +
      '<span class="small muted">' + b.progress + '%</span></div>' +
      notesArea(b, ctx) +
      '</div>' +
      '<span class="pill ' + (b.status === '在读' ? 'mid' : '') + '">' + UI.esc(b.status || '想读') + '</span>' +
      '<button class="small-btn" data-act="edit">编辑</button>' +
      '<button class="small-btn" data-act="note">笔记</button>' +
      '<button class="small-btn danger" data-act="del">删除</button>' +
      '</div>'
    );
    card.querySelector('[data-act="edit"]').onclick = function () { openBook(ctx, b); };
    card.querySelector('[data-act="note"]').onclick = function () { openNote(ctx, b.id); };
    card.querySelector('[data-act="del"]').onclick = function () {
      UI.confirmBox('删除这本书？').then(function (ok) { if (ok) { store.removeBook(b.id); render(ctx); } });
    };
    card.querySelectorAll('[data-note="del"]').forEach(function (btn) {
      btn.onclick = function () {
        store.removeBookNote(b.id, btn.closest('[data-noteitem]').dataset.id); render(ctx);
      };
    });
    return card;
  }

  function notesArea(b, ctx) {
    if (!b.notes || !b.notes.length) return '';
    return '<div style="margin-top:6px">' + b.notes.map(function (n) {
      return '<div class="notes-area" data-noteitem data-id="' + n.id + '" style="background:var(--panel-2);padding:6px 8px;border-radius:6px;margin-bottom:4px">' +
        ctx.UI.esc(n.text) + ' <button class="small-btn" data-note="del">✕</button></div>';
    }).join('') + '</div>';
  }

  function openBook(ctx, target) {
    ctx.UI.formModal({
      title: target ? '编辑书' : '新建书', confirmText: '保存',
      fields: [
        { key: 'title', label: '书名', type: 'text', required: true, value: target ? target.title : '' },
        { key: 'author', label: '作者', type: 'text', value: target ? target.author : '' },
        { key: 'status', label: '状态', type: 'select', value: target ? target.status : '想读', options: ['想读', '在读', '已读完'] },
        { key: 'progress', label: '进度(%)', type: 'number', required: true, value: target ? target.progress : 0 }
      ],
      onSubmit: function (v) {
        if (target) ctx.store.updateBook(target.id, v);
        else ctx.store.addBook(v);
        ctx.UI.toast('已保存'); render(ctx); return true;
      }
    });
  }
  function openNote(ctx, bookId) {
    ctx.UI.formModal({
      title: '添加笔记', confirmText: '保存',
      fields: [{ key: 'text', label: '摘录/笔记', type: 'textarea', required: true }],
      onSubmit: function (v) {
        ctx.store.addBookNote(bookId, v.text);
        ctx.UI.toast('已添加'); render(ctx); return true;
      }
    });
  }

  Pages.reading = {
    title: '阅读计划',
    render: function (container, ctx) { currentEl = container; currentCtx = ctx; render(ctx); },
    add: function (ctx) { openBook(ctx); }
  };
})();