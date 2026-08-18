/* reading.js - 阅读计划：书单三状态、进度、读书笔记、阅读计时、摘抄金句、我的书摘页
 * 已迁移至标准模块工厂（Sonder-Frame v0.1.2，试点七）——协议见 docs/adr/ADR-011：
 * 文件不改名不换位、Pages/DOM/store API 契约零变更、数据写同一 state 集合；
 * 书单为单工厂模块 books（prepend：最新在前，createdAt 由工厂默认生成；
 * notes/readingMinutes/readingLog 声明后工厂 add 自动补齐默认值，对齐 addBook 契约）；
 * 阅读计时（addReadingSession 嵌套字段累计业务规则）、嵌套笔记（restore 闭包撤销）、
 * 书摘集合（excerpts，独立平级集合不在本试点范围）继续走领域 API，不进工厂（试点七结论）；
 * finishedAt 联动（已读完自动记录完成日期/改回清除）为页面层业务规则留 onSubmit；
 * 统计区/时钟/切页恢复留页面层；卡内按钮统一容器 click 委托（data-* 回查 state 最新对象），
 * 计时按钮例外：与 clock 节点联动且 detached-click 契约要求节点级绑定（见 bookCard）；
 * 书籍删除撤销走工厂 _undoPush；/data/books 订阅保留（addReadingSession 等领域 API
 * 仍可能被外部调用方写入，bus 兜底重绘，双写路径并存）。
 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var S = window.SonderStore;
  var currentEl = null, currentCtx = null;
  var mod = null;
  var delegatedBound = false;
  var unsubs = [];

  /* 单工厂模块配置：id 对应 state.books（与 store.addBook 等同一集合）
   * prepend 对齐 addBook 的 unshift（最新在前）；不配 timeField——createdAt/updatedAt 由工厂默认生成；
   * 工厂 add 无条件 sanitize 所有声明字段：readingMinutes → 0、readingLog/notes → []、
   * progress → 0、status → options 首项'想读'、finishedAt → ''（falsy，等价原 null），对齐 addBook 默认值；
   * title required 与表单 required 双保险（领域 API「未命名书籍」兜底保留在 store-content.js） */
  /** @type {SonderModuleConfig} */
  var CONFIG = {
    id: 'books', displayName: '阅读计划', storageKey: 'sonder_data_v1', schemaVersion: 1, prepend: true,
    fields: [
      { key: 'title', type: 'text', label: '书名', required: true },
      { key: 'author', type: 'text', label: '作者' },
      { key: 'status', type: 'select', label: '状态', options: ['想读', '在读', '已读完'] },
      { key: 'progress', type: 'number', label: '进度(%)' },
      { key: 'finishedAt', type: 'date', label: '读完日期' },
      { key: 'notes', type: 'array', label: '笔记' },
      { key: 'readingMinutes', type: 'number', label: '累计分钟' },
      { key: 'readingLog', type: 'array', label: '阅读日志' }
    ]
  };

  function routeIs(p) {
    return (location.hash || '').replace(/^#\/?/, '').split('/')[0] === p;
  }

  function ensureMod(ctx) {
    if (!mod) {
      mod = globalThis.SonderModuleFactory.createModule(ctx.store, CONFIG);
      /* 工厂操作（书籍 add/update/remove）完成即统一重绘（仅当前路由为本页） */
      mod.render(function () { if (currentEl && currentCtx && routeIs('reading')) render(currentCtx); });
    }
    return mod;
  }

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
    var UI = ctx.UI;
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
    /* 计时按钮保留节点级绑定（不计入容器委托）：
     * ① 计时按钮与 clock 节点/文本联动，click 语义是「切换计时状态」而非记录 CRUD，委托无增益；
     * ② store 异步 persist 迟到广播会重建卡片，旧节点 detached 后 jsdom click 不冒泡到容器，
     *    委托收不到停止事件 → clockTick 链永生挂进程；节点级绑定在 detached 节点上依然触发。
     * 计时器本就是页面层业务例外（试点七结论），其按钮随计时器留在页面层。 */
    card.querySelector('[data-timerbtn]').onclick = function () {
      if (timerOn(b.id)) stopTimer(ctx);
      else startTimer(ctx, b.id);
    };
    return card;
  }

  function notesArea(b, ctx) {
    if (!b.notes || !b.notes.length) return '';
    return '<div style="margin-top:6px">' + b.notes.map(function (n) {
      return '<div class="notes-area" data-noteitem data-noteid="' + n.id + '" style="background:var(--glass-2);padding:6px 8px;border-radius:6px;margin-bottom:4px">' +
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
        /* 页面层业务规则（对齐 store.updateBook 联动语义）：
         * 已读完 → 自动记录完成日期（已有保留/缺省补今天）；从已读完改回 → 清除；
         * 其余不动（patch 无 finishedAt key，工厂 update hasOwnProperty 门保留旧值） */
        if (v.status === '已读完') v.finishedAt = (target && target.finishedAt) || S.todayStr();
        else if (target && target.finishedAt && v.status !== target.status) v.finishedAt = null;
        if (target) ensureMod(ctx).update(target.id, v);
        else ensureMod(ctx).add(v);
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
          if (routeIs('excerpts')) renderExcerpts(container, ctx);
          else UI.toast('书摘已恢复');
        } });
      });
    });
  }

  /* 测试/调试钩子。门闩 __SONDER_TEST__：仅测试进程暴露，生产不挂载 */
  if (window.__SONDER_TEST__) {
    window.__readingDbg = {
      timerOn: timerOn,
      elapsedSecs: elapsedSecs,
      startTimer: function (ctx, bookId) { startTimer(ctx, bookId); },
      stopTimer: function (ctx) { stopTimer(ctx); }
    };
  }

  /* 书卡按钮容器 click 委托（与 memo/today/dev/news/selfmedia/consulting 写法收敛）：
   * data-* 回查 state.books 最新对象（书卡经 .list-item[data-id]，笔记行经 [data-noteitem]）；
   * 编辑/笔记/删除/摘抄/笔记删除走委托；#rdAdd 为非行内按钮维持节点级绑定；
   * 计时按钮例外：与 clock 节点联动 + detached-click 契约，保留节点级绑定（见 bookCard） */
  function bindDelegated(ctx) {
    var container = currentEl, store = ctx.store, UI = ctx.UI;
    if (delegatedBound) return; /* 常驻容器只绑一次，防监听累积 */
    delegatedBound = true;
    container.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest(
        '[data-act],[data-excerpt],[data-note="del"]');
      if (!b) return;
      var card = b.closest('[data-id]');
      var book = card && store.state.books.filter(function (x) { return x.id === card.dataset.id; })[0];
      if (!book) return;
      if (b.dataset.act === 'edit') { openBook(ctx, book); return; }
      if (b.dataset.act === 'note') { openNote(ctx, book.id); return; }
      if (b.dataset.act === 'del') {
        UI.confirmBox('删除这本书？').then(function (ok) {
          if (ok) {
            ensureMod(ctx).remove(book.id);
            render(ctx);
            UI.toast('书籍已删除', null, { label: '撤销', onClick: function () {
              store.undoRemove();
              render(ctx);
            } });
          }
        });
        return;
      }
      if ('excerpt' in b.dataset) { openExcerpt(ctx, book); return; }
      if (b.dataset.note === 'del') {
        var noteId = b.closest('[data-noteitem]').dataset.noteid;
        store.removeBookNote(book.id, noteId);
        render(ctx);
        UI.toast('笔记已删除', null, { label: '撤销', onClick: function () {
          store.undoRemove();
          render(ctx);
        } });
      }
    });
  }

  Pages.reading = {
    title: '阅读计划',
    render: function (container, ctx) { currentEl = container; currentCtx = ctx; bindDelegated(ctx); render(ctx); },
    add: function (ctx) { openBook(ctx); }
  };
  Pages.excerpts = {
    title: '我的书摘',
    render: function (container, ctx) { currentEl = container; currentCtx = ctx; renderExcerpts(container, ctx); }
  };

  /* 数据变更自动重绘（EventBridge）：书/书摘/设置变更时仅当前路由为本页才刷新
   * /data/books、/data/excerpts 订阅保留：addReadingSession/addBookNote/addExcerpt 等领域 API
   * 仍可能被外部调用方写入，bus 兜底重绘（双写路径并存）；
   * unsubscribe 保存（模块销毁清理契约，当前页面常驻） */
  (function () {
    var bus = globalThis.SonderBus && globalThis.SonderBus.bus;
    if (!bus) return;
    ['/data/books', '/data/settings', '/data/all'].forEach(function (p) {
      var off = bus.on(p, function () {
        if (currentEl && currentCtx && routeIs('reading')) render(currentCtx);
      });
      unsubs.push(off);
    });
    ['/data/excerpts', '/data/settings', '/data/all'].forEach(function (p) {
      var off = bus.on(p, function () {
        if (currentEl && currentCtx && routeIs('excerpts')) renderExcerpts(currentEl, currentCtx);
      });
      unsubs.push(off);
    });
  })();
})();
