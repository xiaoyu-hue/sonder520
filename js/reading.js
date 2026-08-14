/* reading.js - 阅读计划：书单三状态、进度、读书笔记、阅读计时、摘抄金句、我的书摘页 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var S = window.SonderStore;
  var currentEl = null, currentCtx = null;

  /* ---------- 阅读计时（当前正在计时的书，会话结束才落账） ---------- */
  var timer = null; // { bookId, startTs }
  function timerOn(id) { return !!timer && timer.bookId === id; }
  function elapsedSecs() { return timer ? (Date.now() - timer.startTs) / 1000 : 0; }
  function mmss(s) {
    s = Math.max(0, Math.floor(s));
    var m = Math.floor(s / 60), t = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (t < 10 ? '0' : '') + t;
  }
  var clockTimer = null;
  function clockTick() {
    var nodes = document.querySelectorAll('[data-clock]');
    if (!nodes.length || !timer) { stopClockLoop(); return; }
    var sec = elapsedSecs();
    nodes.forEach(function (n) { n.textContent = mmss(sec); });
    stopClockLoop(); /* 单链自愈：先停旧链再重排，防止多次 render 各起一条链造成泄漏 */
    clockTimer = setTimeout(clockTick, 1000);
    if (clockTimer.unref) clockTimer.unref(); /* 仅测试环境（Node）防进程悬挂；浏览器无 unref */
  }
  function stopClockLoop() {
    if (clockTimer) { clearTimeout(clockTimer); clockTimer = null; }
  }
  function startTimer(ctx, bookId) {
    if (timer) { ctx.UI.toast('已有书籍计时中，先停止上一本吧', 'err'); return; }
    timer = { bookId: bookId, startTs: Date.now() };
    ctx.UI.toast('📖 开始阅读计时');
    var btn = document.querySelector('[data-timerbtn="' + bookId + '"]');
    if (btn) {
      btn.textContent = '■ 停止计时';
      var wrap = btn.parentNode;
      if (wrap && !wrap.querySelector('[data-clock="' + bookId + '"]')) {
        var clk = document.createElement('span');
        clk.className = 'small rd-clock';
        clk.setAttribute('data-clock', bookId);
        clk.textContent = '00:00';
        btn.insertAdjacentElement('afterend', clk);
      }
    }
    clockTick();
  }
  function stopTimer(ctx) {
    if (!timer) { ctx.UI.toast('当前没有进行中的计时', 'err'); return; }
    var minutes = elapsedSecs() / 60;
    var bookId = timer.bookId;
    timer = null;
    stopClockLoop();
    var added = ctx.store.addReadingSession(bookId, minutes);
    ctx.UI.toast(added ? '已累计 ' + added + ' 分钟阅读' : '阅读时长已记录');
    render(ctx);
  }

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
    /* 切页恢复：计时中切走再切回时 data-clock 节点重建但时钟循环已停，重启之 */
    if (timer) clockTick();
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
    var stops = stats.byStatus.map(function (s, i) {
      var pct = Math.round((s.count / total) * 100);
      /* 末段兜底，保证分段总和恰为 100，避免 conic-gradient 缺口 */
      if (i === stats.byStatus.length - 1) pct = Math.max(0, 100 - cum);
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
    var timing = timerOn(b.id);
    var card = UI.el(
      '<div class="list-item" data-id="' + b.id + '">' +
      '<div class="grow">' +
      '<div class="title">' + UI.esc(b.title) + (b.author ? ' <span class="muted small">' + UI.esc(b.author) + '</span>' : '') + '</div>' +
      '<div class="row" style="margin-top:6px"><span class="progress grow" style="max-width:160px"><i style="width:' + b.progress + '%"></i></span>' +
      '<span class="small muted">' + b.progress + '%</span>' +
      (b.status === '已读完' && b.finishedAt ? '<span class="small muted"> · ' + UI.esc(b.finishedAt) + ' 读完</span>' : '') +
      '</div>' +
      '<div class="row" style="margin-top:8px;flex-wrap:wrap;gap:6px">' +
      '<button class="small-btn" data-timerbtn="' + b.id + '" aria-label="' + (timing ? '停止阅读计时' : '开始阅读计时') + '">' +
      (timing ? '■ 停止计时' : '▶ 开始阅读') + '</button>' +
      '<span class="small muted">累计 <b data-minutes="' + b.id + '">' + b.readingMinutes + '</b> 分钟</span>' +
      (timing ? '<span class="small rd-clock" data-clock>00:00</span>' : '') +
      '<button class="small-btn" data-excerpt="' + b.id + '">摘抄金句</button>' +
      '</div>' +
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
    card.querySelector('[data-excerpt]').onclick = function () { openExcerpt(ctx, b); };
    card.querySelector('[data-timerbtn]').onclick = function () {
      if (timerOn(b.id)) stopTimer(ctx);
      else startTimer(ctx, b.id);
    };
    card.querySelector('[data-act="del"]').onclick = function () {
      UI.confirmBox('删除这本书？').then(function (ok) {
        if (ok) {
          store.removeBook(b.id);
          render(ctx);
          UI.toast('书籍已删除', null, { label: '撤销', onClick: function () {
            store.undoRemove();
            render(ctx);
          } });
        }
      });
    };
    card.querySelectorAll('[data-note="del"]').forEach(function (btn) {
      btn.onclick = function () {
        var noteId = btn.closest('[data-noteitem]').dataset.id;
        store.removeBookNote(b.id, noteId);
        render(ctx);
        UI.toast('笔记已删除', null, { label: '撤销', onClick: function () {
          store.undoRemove();
          render(ctx);
        } });
      };
    });
    return card;
  }

  function notesArea(b, ctx) {
    if (!b.notes || !b.notes.length) return '';
    return '<div style="margin-top:6px">' + b.notes.map(function (n) {
      return '<div class="notes-area" data-noteitem data-id="' + n.id + '" style="background:var(--glass-2);padding:6px 8px;border-radius:6px;margin-bottom:4px">' +
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
        { key: 'progress', label: '进度(%)', type: 'number', required: true, min: 0, max: 100, value: target ? target.progress : 0 }
      ],
      onSubmit: function (v) {
        if (v.progress !== null && (v.progress < 0 || v.progress > 100)) return '进度需在 0~100 之间';
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
  function openExcerpt(ctx, b) {
    ctx.UI.formModal({
      title: '摘抄金句 · ' + b.title, confirmText: '保存摘抄',
      fields: [
        { key: 'text', label: '句子', type: 'textarea', required: true, placeholder: '原句摘抄…' },
        { key: 'page', label: '页码', type: 'number', value: 1 }
      ],
      onSubmit: function (v) {
        var ex = ctx.store.addExcerpt({ bookId: b.id, text: v.text, page: v.page });
        if (!ex) return '句子不能为空';
        ctx.UI.toast('已摘抄，可在「我的书摘」查看');
        render(ctx); return true;
      }
    });
  }

  /* ---------- 我的书摘页（按书籍分组） ---------- */
  function renderExcerpts(container, ctx) {
    var UI = ctx.UI, store = ctx.store;
    container.innerHTML = '';
    var groups = S.excerptsByBook(store.state.excerpts);
    if (!groups.length) {
      container.appendChild(UI.emptyState('还没有摘抄', '去阅读计划摘抄一句', function () { ctx.navigate('reading'); }));
      return;
    }
    var total = store.state.excerpts.length;
    container.appendChild(UI.el('<div class="section-title" style="margin-top:0">我的书摘 · 共 ' + total + ' 条</div>'));
    groups.forEach(function (g) {
      var card = UI.el('<div class="card" style="margin-bottom:14px"></div>');
      card.appendChild(UI.el('<div class="section-title" style="margin:0 0 8px">📖 ' + UI.esc(g.bookTitle) + ' · ' + g.items.length + '</div>'));
      g.items.forEach(function (it) {
        card.appendChild(UI.el(
          '<div class="list-item" data-exid="' + it.id + '" style="margin-bottom:6px">' +
          '<div class="grow"><div class="ex-text">「' + UI.esc(it.text) + '」</div>' +
          '<div class="sub muted">第 ' + UI.esc(it.page) + ' 页 · ' + UI.esc(String(it.time || '').slice(0, 10)) + '</div></div>' +
          '<button class="small-btn danger" data-exdel="' + it.id + '" aria-label="删除这条书摘">✕</button>' +
          '</div>'
        ));
      });
      container.appendChild(card);
    });
    container.querySelectorAll('[data-exdel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        store.removeExcerpt(btn.dataset.exdel);
        renderExcerpts(container, ctx);
        UI.toast('已删除该条书摘', null, { label: '撤销', onClick: function () {
          store.undoRemove();
          /* P5a：撤销只恢复数据；仍在书摘页才重渲染书摘视图（避免渲染成阅读列表页顶替当前页） */
          if (((location.hash || '').replace(/^#\/?/, '').split('/')[0]) === 'excerpts') renderExcerpts(container, ctx);
          else UI.toast('书摘已恢复');
        } });
      });
    });
  }

  /* 测试/调试钩子（对正常运行无害） */
  window.__readingDbg = {
    timerOn: timerOn,
    elapsedSecs: elapsedSecs,
    startTimer: function (ctx, bookId) { startTimer(ctx, bookId); },
    stopTimer: function (ctx) { stopTimer(ctx); }
  };

  Pages.reading = {
    title: '阅读计划',
    render: function (container, ctx) { currentEl = container; currentCtx = ctx; render(ctx); },
    add: function (ctx) { openBook(ctx); }
  };
  Pages.excerpts = {
    title: '我的书摘',
    render: function (container, ctx) { currentEl = container; currentCtx = ctx; renderExcerpts(container, ctx); }
  };

  /* 数据变更自动重绘（SonderBus）：书籍/书摘/设置变更时仅当前路由为本页才刷新 */
  (function () {
    var bus = globalThis.SonderBus && globalThis.SonderBus.bus;
    if (!bus) return;
    ['/data/books', '/data/settings', '/data/all'].forEach(function (p) {
      bus.on(p, function () {
        if (currentEl && currentCtx && ((location.hash || '').replace(/^#\/?/, '').split('/')[0] === 'reading')) {
          render(currentCtx);
        }
      });
    });
    ['/data/excerpts', '/data/settings', '/data/all'].forEach(function (p) {
      bus.on(p, function () {
        if (currentEl && currentCtx && ((location.hash || '').replace(/^#\/?/, '').split('/')[0] === 'excerpts')) {
          renderExcerpts(currentEl, currentCtx);
        }
      });
    });
  })();
})();