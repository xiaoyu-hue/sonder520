/* today.js - 今日计划
 * 已迁移至标准模块工厂（Sonder-Frame v0.1.2，试点二）——协议见 docs/adr/ADR-011：
 * 文件不改名不换位、Pages/DOM/store API 契约零变更、数据写同一 state.tasks；
 * CRUD 与排序经工厂模块（orderField: order + move），store.addTask 等保留给既有调用方；
 * done/doneAt 联动为业务规则，页面层显式传参（勾选写时间戳、取消置空）；
 * 🍅 专注计时器为页面级瞬态（悬浮窗/通知/测试钩子），不进框架。
 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var S = window.SonderStore;
  var esc = window.UI.esc;
  var currentCtx = null;
  var currentEl = null;
  var viewDay = null; /* 日期筛选状态：null = 跟随今天（状态提升，切页/刷新后保留） */
  var mod = null;
  var unsubs = [];

  function routeIs() {
    return (location.hash || '').replace(/^#\/?/, '').split('/')[0] === 'today';
  }

  /* 工厂模块配置：id=tasks 对应 state.tasks（与 store.addTask 同一集合）
   * orderField: 启用保留键 order——add 自动分配、move 上下移（分组显示依赖 order）
   * doneAt: 完成时间戳（非表单字段，仅作 update patch 通道，由页面按 done 联动写入）
   * 未配置 timeField：编辑会刷新 updatedAt（新增无害字段，渲染不依赖） */
  /** @type {SonderModuleConfig} */
  var CONFIG = {
    id: 'tasks',
    displayName: '今日计划',
    storageKey: 'sonder_data_v1',
    schemaVersion: 1,
    orderField: 'order',
    fields: [
      { key: 'title', type: 'text', label: '任务', required: true },
      { key: 'note', type: 'textarea', label: '备注' },
      { key: 'date', type: 'date', label: '计划日期' },
      { key: 'priority', type: 'select', label: '优先级', options: ['p1', 'p2', 'p3', 'p4'] },
      { key: 'done', type: 'boolean', label: '已完成' },
      { key: 'doneAt', type: 'text', label: '完成时间' }
    ]
  };

  function ensureMod(ctx) {
    if (!mod) {
      mod = globalThis.SonderModuleFactory.createModule(ctx.store, CONFIG);
      /* 工厂操作（add/update/remove/move）完成即统一重绘（仅当前路由为本页） */
      mod.render(function () { if (currentEl && currentCtx && routeIs()) render(currentEl, currentCtx); });
    }
    return mod;
  }

  function openAdd(ctx, target) {
    ensureMod(ctx);
    ctx.UI.formModal({
      title: target ? '编辑任务' : '新建任务',
      confirmText: '保存',
      fields: [
        { key: 'title', label: '任务', type: 'text', required: true, value: target ? target.title : '', placeholder: '要做什么？' },
        { key: 'note', label: '备注', type: 'textarea', value: target ? target.note : '' },
        { key: 'date', label: '计划日期', type: 'date', value: target ? target.date : S.todayStr() },
        { key: 'priority', label: '优先级', type: 'select', value: target ? target.priority : 'p2', options: [
          { value: 'p1', label: '紧急重要' }, { value: 'p2', label: '重要不紧急' },
          { value: 'p3', label: '紧急不重要' }, { value: 'p4', label: '不紧急不重要' }
        ] }
      ],
      onSubmit: function (v) {
        if (target) mod.update(target.id, v);
        else mod.add(v);
        ctx.UI.toast('已保存');
        return true;
      }
    });
  }

  /* 优先级四档：文字标签 + 四色圆点（朱砂红=紧急重要、花青=重要不紧急、赭石=紧急不重要、淡墨=不紧急不重要） */
  var PRI = {
    p1: { label: '紧急重要' }, p2: { label: '重要不紧急' },
    p3: { label: '紧急不重要' }, p4: { label: '不紧急不重要' }
  };

  function render(container, ctx) {
    var UI = ctx.UI, store = ctx.store;
    currentCtx = ctx;
    currentEl = container;
    container.innerHTML = '';
    var day = viewDay || S.todayStr(); /* 日期筛选状态提升：切页/刷新后保留所选日期 */
    var tp = S.todayProgress(store.state.tasks, day);
    container.appendChild(UI.el(
      '<div class="card tp-card">' +
      '<div class="tp-donut" style="background:conic-gradient(var(--accent) 0% ' + tp.pct + '%, var(--ink-mount) ' + tp.pct + '% 100%)">' +
      '<div class="tp-hole"><b>' + tp.pct + '%</b><span>今日完成</span></div></div>' +
      '<div class="grow">' +
      '<div class="section-title" style="margin:0">今日完成率</div>' +
      '<div class="sub muted" style="margin-top:4px">已完成 ' + tp.done + ' / ' + tp.total + ' 项' +
      (tp.total - tp.done > 0 ? ' · 待完成 ' + (tp.total - tp.done) + ' 项' : (tp.total ? ' 🎉' : '')) +
      '</div></div></div>'
    ));
    container.appendChild(UI.el(
      '<div class="hbar">' +
      '  <input type="date" id="tplDate" value="' + UI.esc(day) + '" class="tool">' +
      '  <button class="btn primary" id="tplAdd">＋ 新建任务</button>' +
      '  <span class="sp"></span>' +
      '  <button class="btn" id="tplRefresh">刷新排序</button>' +
      '</div>'
    ));

    var box = UI.el('<div id="tplList"></div>');
    container.appendChild(box);

    container.querySelector('#tplDate').addEventListener('change', function (e) {
      viewDay = e.target.value || null;
      render(currentEl, currentCtx); /* 整页重渲染：进度卡与列表保持一致日期 */
    });
    container.querySelector('#tplAdd').addEventListener('click', function () { openAdd(ctx); });
    container.querySelector('#tplRefresh').addEventListener('click', function () { render(currentEl, currentCtx); });

    renderGroups(box, store, day);
  }

  function renderGroups(listEl, store, day) {
    var g = S.groupTasks(store.state.tasks, day);
    var html = '';
    html += section('待办 · 今天 (' + day + ')', g.now, day);
    html += section('已过期', g.overdue, day);
    html += section('之后安排', g.upcoming, day);
    html += section('已完成', g.done, day);

    listEl.innerHTML = html;
    bind(listEl, store);
  }

  function section(title, items, day) {
    if (!items.length) return '';
    var inner = items.map(function (t) {
      var pr = PRI[t.priority] || PRI.p2;
      return '<div class="list-item" data-id="' + t.id + '">' +
        '<input type="checkbox" class="tpl-done" ' + (t.done ? 'checked' : '') + '>' +
        (t.done ? delOnly(t.id) : buttonsUpDown(t.id)) +
        '<div class="grow"><div class="title ' + (t.done ? 'done' : '') + '">' + esc(t.title) + '</div>' +
        (t.note ? '<div class="sub">' + esc(t.note) + '</div>' : '') +
        '</div>' +
        '<span class="prio-tag"><i class="prio-dot" data-p="' + esc(t.priority) + '"></i>' + esc(pr.label) + '</span>' +
        (t.done ? '' : '<button class="small-btn focus-btn" data-focus="' + t.id + '" title="🍅 开始 25 分钟专注" aria-label="开始专注">🍅</button>') +
        '<button class="small-btn" data-act="edit" data-id="' + t.id + '" title="编辑">✎</button>' +
        '</div>';
    }).join('');
    return '<div class="section-title">' + esc(title) + '</div>' + inner + (items.length ? '' : '');
  }
  function delOnly(id) {
    return '<span class="row">' +
      '<button class="small-btn danger" data-act="del" data-id="' + id + '" title="删除">✕</button>' +
      '</span>';
  }
  function buttonsUpDown(id) {
    return '<span class="row">' +
      '<button class="small-btn" data-act="up" data-id="' + id + '" title="上移">↑</button>' +
      '<button class="small-btn" data-act="down" data-id="' + id + '" title="下移">↓</button>' +
      '<button class="small-btn danger" data-act="del" data-id="' + id + '" title="删除">✕</button>' +
      '</span>';
  }

  function bind(container, store) {
    var UI = window.UI;
    container.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        var id = b.dataset.id;
        if (b.dataset.act === 'del') {
          UI.confirmBox('确定删除这条任务？').then(function (ok) {
            if (ok) {
              ensureMod({ store: store });
              mod.remove(id);
              UI.toast('任务已删除', null, { label: '撤销', onClick: function () {
                store.undoRemove();
                /* P5a：撤销只恢复数据；若已切页（#content 常驻，currentEl 仍指向它）则不整页顶替当前页面 */
                if (routeIs()) renderGroups(container, store, viewDay || S.todayStr());
                else UI.toast('任务已恢复');
              } });
            }
          });
        } else if (b.dataset.act === 'edit') {
          var t = store.state.tasks.find(function (x) { return x.id === id; });
          if (t) openAdd(currentCtx, t);
        } else {
          ensureMod({ store: store });
          mod.move(id, b.dataset.act);
        }
      });
    });
    container.querySelectorAll('.tpl-done').forEach(function (c) {
      c.addEventListener('change', function () {
        var checked = c.checked;
        ensureMod({ store: store });
        /* 业务规则：done 联动完成时间戳（已完成组按 doneAt 排序） */
        mod.update(c.closest('[data-id]').dataset.id, { done: checked, doneAt: checked ? S._h.nowISO() : null });
      });
    });
    container.querySelectorAll('[data-focus]').forEach(function (b) {
      b.addEventListener('click', function () { startFocus(currentCtx, b.dataset.focus); });
    });
  }

  /* ---------- 🍅 专注倒计时（25 分钟，悬浮窗 + 到时浏览器通知） ---------- */
  var FOCUS_DEFAULT = 25 * 60;
  var focusEl = null, focusTimer = null, focusLeft = 0, focusTotal = 0, focusTitle = '', focusDeadline = 0;
  function mmss(s) {
    var m = Math.floor(Math.max(0, s) / 60), t = Math.max(0, s) % 60;
    return (m < 10 ? '0' : '') + m + ':' + (t < 10 ? '0' : '') + t;
  }
  function startFocus(ctx, taskId, seconds) {
    if (focusEl) { ctx.UI.toast('已有专注在进行中，先结束它吧', 'err'); return; }
    var t = ctx.store.state.tasks.find(function (x) { return x.id === taskId; });
    focusTotal = (typeof seconds === 'number' && seconds > 0) ? Math.round(seconds) : FOCUS_DEFAULT;
    focusLeft = focusTotal;
    /* 按真实时钟计算截止时刻，tick 时重算剩余秒数——吸收 setTimeout 累积漂移，
     * 长专注（25 分钟 × 1500 tick）不因事件循环延迟而越走越慢 */
    focusDeadline = Date.now() + focusTotal * 1000;
    focusTitle = t ? t.title : '';
    focusEl = ctx.UI.el(
      '<div id="focusFloat" class="focus-float" role="status" aria-live="polite">' +
      '<div class="ff-head"><span>🍅 专注中</span>' +
      '<button class="small-btn" id="ffClose" title="关闭" aria-label="关闭专注">✕</button></div>' +
      '<div class="ff-title">' + ctx.UI.esc(focusTitle || '无任务专注') + '</div>' +
      '<div class="ff-time" id="ffTime">' + mmss(focusLeft) + '</div>' +
      '<button class="btn primary" id="ffStop" type="button">结束专注</button>' +
      '</div>'
    );
    document.body.appendChild(focusEl);
    focusEl.querySelector('#ffClose').addEventListener('click', function () { stopFocus(ctx, true); });
    focusEl.querySelector('#ffStop').addEventListener('click', function () { stopFocus(ctx, true); });
    focusTick(ctx);
  }
  function focusTick(ctx) {
    if (!focusEl) return;
    focusLeft = Math.max(0, Math.ceil((focusDeadline - Date.now()) / 1000));
    if (focusLeft <= 0) { finishFocus(ctx); return; }
    var t = focusEl.querySelector('#ffTime');
    if (t) t.textContent = mmss(focusLeft);
    focusTimer = setTimeout(function () { focusTick(ctx); }, 1000);
  }
  function finishFocus(ctx) {
    if (focusTimer) { clearTimeout(focusTimer); focusTimer = null; }
    if (!focusEl) return;
    focusEl.remove();
    focusEl = null;
    ctx.UI.toast('🍅 专注完成！');
    notifyFocus(ctx, focusTitle, focusTotal);
  }
  function stopFocus(ctx, manual) {
    if (focusTimer) { clearTimeout(focusTimer); focusTimer = null; }
    if (!focusEl) return;
    focusEl.remove();
    focusEl = null;
    if (manual) ctx.UI.toast('已结束专注');
  }
  /* 浏览器通知：已授权直接发；未决定先请求授权（用户可拒绝）；拒绝则静默 */
  function notifyFocus(ctx, title, totalSeconds) {
    var N = window.Notification;
    var minutes = Math.round(totalSeconds / 60);
    function show() {
      try { new N('🍅 专注完成', { body: '你完成了 ' + minutes + ' 分钟专注' + (title ? ' · ' + title : ''), tag: 'sonder-focus' }); } catch (e) { /* 忽略构造失败 */ }
    }
    if (!N || typeof N !== 'function') return;
    if (N.permission === 'granted') { show(); return; }
    if (N.permission === 'denied') return;
    if (typeof N.requestPermission === 'function') {
      try { N.requestPermission(function (p) { if (p === 'granted') show(); }); } catch (e) { /* 忽略 */ }
    }
  }

  /* 测试/调试钩子：只读快照 + 可控起停。门闩 __SONDER_TEST__：仅测试进程暴露，生产不挂载 */
  if (window.__SONDER_TEST__) {
    window.__todayDbg = {
      startFocus: function (ctx, taskId, seconds) { startFocus(ctx, taskId, seconds); },
      stopFocus: function () { stopFocus(currentCtx || { UI: window.UI }, true); },
      focusLeft: function () { return focusLeft; },
      focusOpen: function () { return !!focusEl; }
    };
  }

  Pages.today = { title: '今日计划', render: render, add: function (ctx) { openAdd(ctx); } };

  /* 数据变更自动重绘（SonderBus EVENT 表）：计划/设置变更时仅当前路由为本页才刷新 */
  (function () {
    var bus = globalThis.SonderBus && globalThis.SonderBus.bus;
    var E = globalThis.SonderBus && globalThis.SonderBus.EVENT;
    if (!bus || !E) return;
    [E.data('tasks'), E.data('settings'), E.DATA_ALL].forEach(function (p) {
      unsubs.push(bus.on(p, function () {
        if (currentEl && currentCtx && routeIs()) render(currentEl, currentCtx);
      }));
    });
  })();
})();
