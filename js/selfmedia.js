/* selfmedia.js - 自媒体：选题/内容、标签与状态筛选、导出 CSV
 * 已迁移至标准模块工厂（Sonder-Frame v0.1.2，试点五）——协议见 docs/adr/ADR-011：
 * 文件不改名不换位、Pages/DOM/store API 契约零变更、数据写同一 state 集合；
 * selfmedia 为单工厂模块（prepend：最新在前，createdAt 由工厂默认生成）；
 * 页面筛选（status/tag）、视图（list/cal）、月历（cal）、统计、CSV、数字反馈、进度条是页面层能力进页面；
 * 卡内按钮（编辑/删除）统一容器委托绑定（data-* 回查 state 最新对象）；
 * 删除撤销走工厂 _undoPush；/data/posts 订阅保留（addPost 等领域 API 仍可能被外部调用，bus 兜底重绘）。
 * 数字字段负数/超百夹紧由 onSubmit 与反馈输入预处理承担（对齐 store.updatePost 的 num0 语义）。
 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var S = window.SonderStore;
  var currentEl = null, currentCtx = null;
  var state = { status: '', tag: '', view: 'list' };
  var mod = null;
  var delegatedBound = false;
  var CHANNELS = ['公众号', '小红书', 'B站', '抖音'];
  var cal = { year: null, month: null };
  function initCal() {
    var d = new Date();
    cal.year = d.getFullYear();
    cal.month = d.getMonth();
  }
  function shiftCal(delta) {
    var d = new Date(cal.year, cal.month + delta, 1);
    cal.year = d.getFullYear();
    cal.month = d.getMonth();
  }

  /* 统计区的口袋数字：发布数据反馈口径（select/number/表单控件） */
  var METRICS = [
    { key: 'views', label: '播放', color: '#3b4a6b' },
    { key: 'likes', label: '点赞', color: '#2e7d63' },
    { key: 'comments', label: '评论', color: '#b0723f' },
    { key: 'favorites', label: '收藏', color: '#c23b2e' }
  ];

  function writeTags(tags) {
    return (tags || []).map(function (t) { return '<span class="tag">' + currentCtx.UI.esc(t) + '</span>'; }).join('');
  }
  var num0 = S._h.num0;

  /* 单工厂模块配置：id 对应 state 同名集合（与 store.addPost 等同一集合）
   * prepend 对齐 addPost 的 unshift（最新在前）；不配 timeField——createdAt/updatedAt 由工厂默认生成，
   * 恰对齐 postFactory 的 createdAt 语义；platform 空串首项保住「未设置平台」显示语义 */
  /** @type {SonderModuleConfig} */
  var CONFIG = {
    id: 'posts', displayName: '自媒体', storageKey: 'sonder_data_v1', schemaVersion: 1, prepend: true,
    fields: [
      { key: 'title', type: 'text', label: '标题', required: true },
      { key: 'platform', type: 'select', label: '发布渠道', options: ['', '公众号', '小红书', 'B站', '抖音'] },
      { key: 'account', type: 'text', label: '账号' },
      { key: 'tags', type: 'array', label: '标签' },
      { key: 'status', type: 'select', label: '状态', options: ['draft', 'queue', 'published'] },
      { key: 'publishDate', type: 'date', label: '发布日期' },
      { key: 'views', type: 'number', label: '播放量' },
      { key: 'likes', type: 'number', label: '点赞' },
      { key: 'comments', type: 'number', label: '评论' },
      { key: 'favorites', type: 'number', label: '收藏' },
      { key: 'note', type: 'textarea', label: '备注' },
      { key: 'progress', type: 'number', label: '制作进度' }
    ]
  };

  function routeIs() {
    return (location.hash || '').replace(/^#\/?/, '').split('/')[0] === 'selfmedia';
  }

  function ensureMod(ctx) {
    if (!mod) {
      mod = globalThis.SonderModuleFactory.createModule(ctx.store, CONFIG);
      /* 工厂操作（add/update/remove）完成即统一重绘（仅当前路由为本页） */
      mod.render(function () { if (currentEl && currentCtx && routeIs()) render(currentCtx); });
    }
    return mod;
  }

  /* 表单数字字段预处理：补齐 store.updatePost 的 num0 语义
   * （负数夹 0、进度夹 100——工厂 number 类型仅做 Number() 转义，差异由提交前收敛） */
  function clampNumbers(v) {
    ['views', 'likes', 'comments', 'favorites'].forEach(function (k) { v[k] = num0(v[k]); });
    var pr = num0(v.progress);
    v.progress = pr > 100 ? 100 : pr;
    return v;
  }

  function openAdd(ctx, target) {
    ctx.UI.formModal({
      title: target ? '编辑内容' : '新增内容',
      confirmText: '保存',
      fields: [
        { key: 'title', label: '标题', type: 'text', required: true, value: target ? target.title : '' },
        { key: 'platform', label: '发布渠道', type: 'select', value: target ? target.platform : '', options: [{ value: '', label: '未设置' }].concat(CHANNELS.map(function (c) { return { value: c, label: c }; })) },
        { key: 'account', label: '账号', type: 'text', value: target ? target.account : '' },
        { key: 'tags', label: '标签(逗号分隔)', type: 'text', value: target ? (target.tags || []).join(',') : '' },
        { key: 'status', label: '状态', type: 'select', value: target ? target.status : 'draft', options: ['draft', 'queue', 'published'] },
        { key: 'publishDate', label: '发布日期', type: 'date', value: target ? (target.publishDate || '') : '' },
        { key: 'views', label: '播放量', type: 'number', value: target ? (target.views || 0) : 0 },
        { key: 'likes', label: '点赞', type: 'number', value: target ? (target.likes || 0) : 0 },
        { key: 'comments', label: '评论', type: 'number', value: target ? (target.comments || 0) : 0 },
        { key: 'favorites', label: '收藏', type: 'number', value: target ? (target.favorites || 0) : 0 },
        { key: 'note', label: '备注', type: 'textarea', value: target ? target.note : '' }
      ],
      onSubmit: function (v) {
        v.tags = String(v.tags || '').split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean);
        if (!v.publishDate) v.publishDate = null;
        clampNumbers(v);
        if (target) ensureMod(ctx).update(target.id, v);
        else ensureMod(ctx).add(v);
        ctx.UI.toast('已保存');
        render(ctx);
        return true;
      }
    });
  }

  function render(ctx) {
    var container = currentEl, store = ctx.store, UI = ctx.UI;
    var tags = S.collectTags(store.state.posts);
    container.innerHTML = '';
    container.appendChild(UI.el(
      '<div class="hbar">' +
      '<button class="btn primary" id="smAdd">＋ 新增内容</button>' +
      '<div class="lg-seg" style="margin-right:10px">' +
      '<button data-view="list" type="button"' + (state.view === 'list' ? ' class="on"' : '') + '>列表</button>' +
      '<button data-view="cal" type="button"' + (state.view === 'cal' ? ' class="on"' : '') + '>月历</button>' +
      '</div>' +
      '<select id="smStatus" class="tool"><option value="">全部状态</option>' +
      '<option value="draft">草稿</option><option value="queue">排队</option><option value="published">已发布</option></select>' +
      '<select id="smTag" class="tool"><option value="">全部标签</option>' +
      tagsOptions(tags) + '</select>' +
      '<button class="btn" id="smClear">清除筛选</button>' +
      '<span class="sp"></span>' +
      '<button class="btn" id="smCsv">导出 CSV</button>' +
      '</div>'
    ));
    var box = UI.el('<div id="smBox"></div>');
    container.appendChild(box);

    container.querySelector('#smAdd').addEventListener('click', function () { openAdd(ctx); });
    container.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.view = b.dataset.view;
        render(ctx);
      });
    });
    var stSel = container.querySelector('#smStatus');
    var tagSel = container.querySelector('#smTag');
    stSel.value = state.status;
    tagSel.value = state.tag;
    stSel.addEventListener('change', function (e) { state.status = e.target.value; render(ctx); });
    tagSel.addEventListener('change', function (e) { state.tag = e.target.value; render(ctx); });
    container.querySelector('#smClear').addEventListener('click', function () { state.status = ''; state.tag = ''; render(ctx); });
    container.querySelector('#smCsv').addEventListener('click', function () { exportCsv(); });

    if (state.view === 'cal') {
      renderCalendar(box, ctx);
    } else {
      var list = S.filterPosts(store.state.posts, { tag: state.tag, status: state.status });
      if (!list.length) {
        box.appendChild(UI.emptyState('还没有内容', '＋ 新增内容', function () { openAdd(ctx); }));
      }
      else list.forEach(function (p) { box.appendChild(itemEl(p, ctx)); });
    }

    /* 已发布数据统计可视化 */
    container.appendChild(statsSection(store, ctx));
  }

  /* ---------- 月历视图：选题可拖拽到具体日期排期 ---------- */
  var dragId = null;
  function renderCalendar(box, ctx) {
    var store = ctx.store, UI = ctx.UI;
    if (cal.year === null) initCal();
    var y = cal.year, m = cal.month;
    var head = UI.el(
      '<div class="hbar" style="flex-wrap:wrap">' +
      '<button class="small-btn" data-cal="prev" aria-label="上个月">← 上月</button>' +
      '<span class="grow" style="text-align:center;font-weight:600">' + y + '年' + (m + 1) + '月</span>' +
      '<button class="small-btn" data-cal="next" aria-label="下个月">下月 →</button>' +
      '<button class="small-btn" data-cal="back" aria-label="回到本月">本月</button>' +
      '</div>'
    );
    box.appendChild(head);
    head.querySelector('[data-cal="prev"]').addEventListener('click', function () { shiftCal(-1); render(ctx); });
    head.querySelector('[data-cal="next"]').addEventListener('click', function () { shiftCal(1); render(ctx); });
    head.querySelector('[data-cal="back"]').addEventListener('click', function () { initCal(); render(ctx); });

    var weekStart = new Date(y, m, 1).getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var today = S.todayStr();
    var cellHtml = '';
    var i, n;
    for (i = 0; i < weekStart; i++) cellHtml += '<div class="cal-day empty"></div>';
    for (n = 1; n <= daysInMonth; n++) {
      var dateStr = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(n).padStart(2, '0');
      var todays = store.state.posts.filter(function (p) { return p.publishDate === dateStr; });
      cellHtml += '<div class="cal-day' + (dateStr === today ? ' cal-today' : '') + '" data-date="' + dateStr + '">' +
        '<span class="cal-num">' + n + '</span>' +
        todays.map(function (p) {
          return '<span class="cal-chip" draggable="true" data-post="' + p.id + '" title="' + UI.esc(p.title) + '">' + UI.esc(p.title) + '</span>';
        }).join('') +
        '</div>';
    }
    var grid = UI.el(
      '<div class="cal-grid" role="grid" aria-label="选题排期月历">' +
      ['日', '一', '二', '三', '四', '五', '六'].map(function (w) { return '<div class="cal-wd">' + w + '</div>'; }).join('') +
      cellHtml + '</div>'
    );
    box.appendChild(grid);
    if (!store.state.posts.length) {
      box.appendChild(UI.el('<div class="muted small" style="padding:10px 4px">还没有选题：把内容排期到具体日期，日历会显示在这里</div>'));
    }
    bindCalendarDnd(grid, ctx);
  }

  function bindCalendarDnd(grid, ctx) {
    var store = ctx.store, UI = ctx.UI;
    grid.querySelectorAll('.cal-chip').forEach(function (chip) {
      chip.addEventListener('dragstart', function (e) {
        dragId = chip.dataset.post;
        chip.classList.add('dragging');
        try { if (e.dataTransfer) e.dataTransfer.setData('text/plain', dragId); } catch (err) { /* 测试环境无 DataTransfer */ }
      });
      chip.addEventListener('dragend', function () {
        chip.classList.remove('dragging');
        dragId = null;
      });
      /* 移动端：长按 380ms 进入拖拽，滑动到目标日期后松手落账 */
      var lt = null;
      chip.addEventListener('touchstart', function (e) {
        lt = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY, on: false };
        chip._ltTimer = setTimeout(function () { lt.on = true; chip.classList.add('dragging'); }, 380);
      }, { passive: true });
      chip.addEventListener('touchmove', function (e) {
        if (!lt || !lt.on) return;
        e.preventDefault();
        var t = e.changedTouches[0];
        chip.style.position = 'fixed';
        chip.style.left = (t.clientX - 30) + 'px';
        chip.style.top = (t.clientY - 18) + 'px';
        var el = document.elementFromPoint(t.clientX, t.clientY);
        var day = /** @type {HTMLElement|null} */ (el ? el.closest('.cal-day[data-date]') : null);
        chip._stayDate = day ? day.dataset.date : null;
        grid.querySelectorAll('.cal-day.drop-target').forEach(function (d) { d.classList.remove('drop-target'); });
        if (el && el.closest('.cal-day[data-date]')) el.closest('.cal-day[data-date]').classList.add('drop-target');
      }, { passive: false });
      chip.addEventListener('touchend', function () {
        clearTimeout(chip._ltTimer);
        chip.style.position = '';
        chip.classList.remove('dragging');
        grid.querySelectorAll('.cal-day.drop-target').forEach(function (d) { d.classList.remove('drop-target'); });
        if (lt && lt.on && chip._stayDate) {
          ensureMod(ctx).update(chip.dataset.post, { publishDate: chip._stayDate });
          UI.toast('已排期到 ' + chip._stayDate);
          render(ctx);
        }
        lt = null;
      });
      /* touchcancel：来电/系统手势打断时同样清理拖拽态，防止 chip 永久卡在 fixed 定位 */
      chip.addEventListener('touchcancel', function () {
        clearTimeout(chip._ltTimer);
        chip.style.position = '';
        chip.classList.remove('dragging');
        grid.querySelectorAll('.cal-day.drop-target').forEach(function (d) { d.classList.remove('drop-target'); });
        lt = null;
      });
    });
    grid.querySelectorAll('.cal-day[data-date]').forEach(function (day) {
      day.addEventListener('dragover', function (e) { e.preventDefault(); });
      day.addEventListener('drop', function (e) {
        var id = dragId;
        if (!id) { try { id = e.dataTransfer && e.dataTransfer.getData('text/plain'); } catch (err) { id = null; } }
        if (!id) return;
        var p = store.state.posts.find(function (x) { return x.id === id; });
        if (!p) return;
        ensureMod(ctx).update(id, { publishDate: day.dataset.date });
        UI.toast('已排期到 ' + day.dataset.date);
        dragId = null;
        render(ctx);
      });
    });
  }

  function statsSection(store, ctx) {
    var UI = ctx.UI, stats = S.publishedStats(store.state.posts);
    var wrap = UI.el('<div id="smStats"></div>');
    if (!stats.count) return wrap;
    var legend = METRICS.map(function (m) {
      return '<span class="small muted"><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + m.color + ';margin-right:3px"></i>' + m.label + '</span>';
    }).join('<span style="margin:0 4px"></span>');
    var pills = [
      ['总播放', stats.sums.views], ['总点赞', stats.sums.likes],
      ['总评论', stats.sums.comments], ['总收藏', stats.sums.favorites]
    ].map(function (x) { return '<span class="pill">' + UI.esc(x[0]) + ' ' + UI.esc(x[1]) + '</span>'; }).join(' ');
    var rows = stats.posts.map(function (p) {
      var bars = METRICS.map(function (m) {
        var v = p[m.key];
        var w = stats.max[m.key] > 0 ? Math.round((v / stats.max[m.key]) * 100) : 0;
        return '<div class="st-col"><div class="st-bar"><i style="width:' + w + '%;background:' + m.color + '"></i></div><span class="st-val">' + v + '</span></div>';
      }).join('');
      return '<div class="st-row">' +
        '<div class="st-title" title="' + UI.esc(p.title) + '">' + UI.esc(p.title) + '</div>' +
        '<div class="st-bars">' + bars + '</div></div>';
    }).join('');
    wrap.innerHTML = '<div class="section-title">发布数据统计</div>' +
      '<div class="card">' +
      miniLine(store.state.posts, UI) +
      '<div class="row" style="margin-bottom:10px">' + pills + '</div>' +
      '<div class="st-legend">' + legend + '</div>' +
      '<div class="st-chart">' + rows + '</div>' +
      '</div>';
    return wrap;
  }

  /* 最近 5 篇阅读量微型折线图（SVG polyline，新→旧） */
  function miniLine(posts, UI) {
    var rec = S.recentPublished(posts, 5);
    if (!rec.length) return '';
    var W = 240, H = 64, pad = 8;
    var max = Math.max.apply(null, rec.map(function (p) { return p.views; }));
    max = Math.max(1, max);
    var pts = rec.map(function (p, i) {
      var x = rec.length === 1 ? W / 2 : pad + (i / (rec.length - 1)) * (W - pad * 2);
      var y = H - pad - (p.views / max) * (H - pad * 2);
      return Math.round(x) + ',' + Math.round(y);
    });
    var p0 = pts[0].split(','), pl = pts[pts.length - 1].split(',');
    return '<div class="sm-line">' +
      '<div class="small muted" style="margin-bottom:4px">最近 ' + rec.length + ' 篇阅读量变化（右→最新）</div>' +
      '<svg class="mini-line" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="最近5篇阅读量折线图">' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>' +
      '<circle cx="' + p0[0] + '" cy="' + p0[1] + '" r="2.5" fill="var(--accent)"></circle>' +
      '<circle cx="' + pl[0] + '" cy="' + pl[1] + '" r="2.5" fill="var(--accent)"></circle>' +
      rec.map(function (p, i) {
        var c = pts[i].split(',');
        return '<text x="' + c[0] + '" y="' + (Number(c[1]) - 6) + '" font-size="9" fill="var(--muted)" text-anchor="middle">' + UI.esc(p.views) + '</text>';
      }).join('') +
      '</svg></div>';
  }

  function tagsOptions(tags) {
    var esc = currentCtx.UI.esc;
    return tags.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('');
  }

  /* 卡内按钮（编辑/删除）容器委托（与 memo/today/dev/news 写法收敛）：data-* 回查 state 最新对象 */
  function bindDelegated(ctx) {
    var container = currentEl, store = ctx.store, UI = ctx.UI;
    if (delegatedBound) return; /* 常驻容器只绑一次，防监听累积 */
    delegatedBound = true;
    container.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-act="edit"],[data-act="del"]');
      if (!b) return;
      var row = b.closest('[data-id]');
      var p = row && store.state.posts.filter(function (x) { return x.id === row.dataset.id; })[0];
      if (!p) return;
      var act = b.dataset.act;
      if (act === 'edit') { openAdd(ctx, p); return; }
      if (act === 'del') {
        UI.confirmBox('确定删除这条内容？').then(function (ok) {
          if (ok) {
            ensureMod(ctx).remove(p.id);
            render(ctx);
            UI.toast('内容已删除', null, { label: '撤销', onClick: function () {
              store.undoRemove();
              render(ctx);
            } });
          }
        });
      }
    });
  }

  function itemEl(p, ctx) {
    var UI = ctx.UI;
    var pill = p.status === 'published' ? '<span class="pill lo">已发布</span>'
      : p.status === 'queue' ? '<span class="pill mid">排队</span>'
      : '<span class="pill">草稿</span>';
    var row = UI.el(
      '<div class="list-item" data-id="' + p.id + '">' +
      '<div class="grow">' +
      '<div class="title">' + UI.esc(p.title) + '</div>' +
      '<div class="sub">' + UI.esc(p.platform || '未设置平台') + (p.account ? ' · ' + UI.esc(p.account) : '') +
      (p.publishDate ? ' · 发布 ' + UI.esc(p.publishDate) : '') + '</div>' +
      (p.status === 'published'
        ? '<div class="row" style="margin-top:6px;gap:10px;flex-wrap:wrap">' +
          '<label class="small muted sm-fb">阅读量<input type="number" min="0" data-fb="views" data-id="' + p.id + '" value="' + num0(p.views) + '" aria-label="阅读量"></label>' +
          '<label class="small muted sm-fb">点赞<input type="number" min="0" data-fb="likes" data-id="' + p.id + '" value="' + num0(p.likes) + '" aria-label="点赞数"></label>' +
          '</div>'
        : '') +
      '<div class="row" style="margin-top:6px">' +
      '<span class="small muted" style="white-space:nowrap">制作进度</span>' +
      '<input type="range" min="0" max="100" step="1" value="' + num0(p.progress) + '" data-prog="' + p.id + '" style="flex:1;max-width:240px;accent-color:var(--accent)">' +
      '<span class="small" data-proglabel="' + p.id + '">' + num0(p.progress) + '%</span>' +
      '</div>' +
      writeTags(p.tags) +
      '</div>' +
      pill +
      '<button class="small-btn" data-act="edit">编辑</button>' +
      '<button class="small-btn danger" data-act="del">删除</button>' +
      '</div>'
    );
    /* 数字反馈输入框与进度条是控件，走节点级绑定（数据反馈与滑块语义非行内按钮，不进委托） */
    row.querySelectorAll('[data-fb]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var patch = {};
        patch[inp.dataset.fb] = num0(inp.value);
        ensureMod(ctx).update(p.id, patch);
        UI.toast('已更新' + (inp.dataset.fb === 'views' ? '阅读量' : '点赞'));
      });
    });
    var prog = row.querySelector('[data-prog]');
    if (prog) {
      prog.addEventListener('change', function () {
        ensureMod(ctx).update(p.id, { progress: num0(prog.value) });
        var lab = row.querySelector('[data-proglabel]');
        if (lab) lab.textContent = prog.value + '%';
      });
    }
    return row;
  }

  function exportCsv() {
    var csv = S.toCSV(S.filterPosts(currentCtx.store.state.posts, { tag: state.tag, status: state.status }));
    var blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'selfmedia.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  Pages.selfmedia = {
    title: '自媒体',
    render: function (container, ctx) { currentEl = container; currentCtx = ctx; bindDelegated(ctx); render(ctx); },
    add: function (ctx) { openAdd(ctx); }
  };

  /* 数据变更自动重绘（EventBridge）：内容/设置变更时仅当前路由为本页才刷新
   * /data/posts 订阅保留：addPost 等领域 API 仍可能被 home 等调用方写入，bus 兜底重绘（双写路径并存） */
  (function () {
    var bus = globalThis.SonderBus && globalThis.SonderBus.bus;
    if (!bus) return;
    ['/data/posts', '/data/settings', '/data/all'].forEach(function (p) {
      bus.on(p, function () {
        if (currentEl && currentCtx && ((location.hash || '').replace(/^#\/?/, '').split('/')[0] === 'selfmedia')) {
          render(currentCtx);
        }
      });
    });
  })();
})();