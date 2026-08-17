/* memo.js - 快速备忘（已迁入标准模块工厂：Sonder-Frame ModuleFactory v0.1.1）
 * 迁移协议（ADR-011）：文件不改名、不换加载位置；页面契约（Pages.memo/DOM/撤销
 * 含 P5a 切页守卫）与 store API（home/app 调用方）零变更；数据写同一 state.memos。
 * 渲染：工厂 customRender（模块自带渲染，复用 ctx.UI 助手；VisualEngine 待 2-3 个
 * 模块迁移后按需进框架）。事件订阅：经 EVENT 表（ADR-010），unsubscribe 保存。 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var currentEl = null, currentCtx = null;
  var mod = null;
  var unsubs = [];

  /* 工厂模块配置：id=memos 对应 state.memos（与 store.addMemo 同一集合）
   * prepend: 最新在最前（对齐 store.addMemo unshift）
   * timeField: 时间戳写既有 time 字段（渲染显示创建时间，编辑不刷新） */
  /** @type {SonderModuleConfig} */
  var CONFIG = {
    id: 'memos',
    displayName: '快速备忘',
    storageKey: 'sonder_memos_v1',
    schemaVersion: 1,
    prepend: true,
    timeField: 'time',
    fields: [
      { key: 'text', type: 'textarea', label: '内容', required: true },
      { key: 'archived', type: 'boolean', label: '已归档' }
    ]
  };

  /* 工厂模块懒初始化：首次渲染/操作时创建（ctx.store 注入） */
  function ensureMod(ctx) {
    if (mod || !ctx || !ctx.store) return mod;
    var F = globalThis.SonderModuleFactory;
    if (F && F.createModule) {
      mod = F.createModule(ctx.store, CONFIG);
      mod.render(function () {
        if (currentEl && currentCtx && routeIs('memo')) draw();
      });
    }
    return mod;
  }

  function routeIs(name) {
    return ((location.hash || '').replace(/^#\/?/, '').split('/')[0] === name);
  }

  function fmt(t) {
    var d = new Date(t);
    if (isNaN(d.getTime())) return '';
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function openAdd(ctx, target) {
    ensureMod(ctx);
    ctx.UI.formModal({
      title: target ? '编辑备忘' : '快速备忘',
      confirmText: '保存',
      fields: [{ key: 'text', label: '内容', type: 'textarea', required: true, value: target ? target.text : '', placeholder: '随手记点什么…' }],
      onSubmit: function (v) {
        if (target) mod.update(target.id, { text: v.text });
        else mod.add({ text: v.text });
        ctx.UI.toast('已保存备忘');
        draw();
        return true;
      }
    });
  }

  /* 页面渲染（app.js 导航调用）与工厂 renderer 共用同一绘制 */
  function render(container, ctx) {
    currentEl = container; currentCtx = ctx;
    ensureMod(ctx);
    draw();
  }

  function draw() {
    var UI = currentCtx.UI, store = currentCtx.store;
    var container = currentEl;
    container.innerHTML = '';
    container.appendChild(UI.el(
      '<div class="hbar">' +
      '<button class="btn primary" id="memoAdd">＋ 新建备忘</button>' +
      '</div>'
    ));
    container.querySelector('#memoAdd').addEventListener('click', function () { openAdd(currentCtx); });

    var active = store.state.memos.filter(function (m) { return !m.archived; });
    var archived = store.state.memos.filter(function (m) { return m.archived; });

    var box = UI.el('<div id="memoBox"></div>');
    container.appendChild(box);

    box.appendChild(UI.el('<div class="section-title">备忘 ' + active.length + '</div>'));
    if (!active.length) {
      box.appendChild(UI.emptyState('还没有备忘，记一条吧', '＋ 新建备忘', function () { openAdd(currentCtx); }));
    }
    active.forEach(function (m) { box.appendChild(itemEl(m, false, currentCtx)); });

    if (archived.length) {
      box.appendChild(UI.el('<div class="section-title">已归档 ' + archived.length + '</div>'));
      archived.forEach(function (m) { box.appendChild(itemEl(m, true, currentCtx)); });
    }
  }

  function itemEl(m, isArchived, ctx) {
    var UI = ctx.UI;
    var row = UI.el(
      '<div class="list-item" data-id="' + m.id + '">' +
      '<div class="grow"><div class="notes-area">' + UI.esc(m.text) + '</div>' +
      '<div class="sub">' + fmt(m.time) + '</div></div>' +
      '<button class="small-btn" data-act="archive">' + (isArchived ? '取消归档' : '归档') + '</button>' +
      '<button class="small-btn" data-act="edit">编辑</button>' +
      '<button class="small-btn danger" data-act="del">删除</button>' +
      '</div>'
    );
    row.querySelector('[data-act="archive"]').onclick = function () {
      ensureMod(ctx);
      mod.update(m.id, { archived: !isArchived });
      draw();
    };
    row.querySelector('[data-act="edit"]').onclick = function () { openAdd(ctx, m); };
    row.querySelector('[data-act="del"]').onclick = function () {
      UI.confirmBox('确定删除这条备忘？').then(function (ok) {
        if (ok) {
          ensureMod(ctx);
          mod.remove(m.id);
          draw();
          UI.toast('备忘已删除', null, { label: '撤销', onClick: function () {
            ctx.store.undoRemove();
            /* P5a：撤销只恢复数据；已切页则不整页顶替当前页面 */
            if (routeIs('memo')) draw();
            else UI.toast('备忘已恢复');
          } });
        }
      });
    };
    return row;
  }

  Pages.memo = { title: '快速备忘', render: render, add: function (ctx) { openAdd(ctx); } };

  /* 数据变更自动重绘（EventBridge，EVENT 表契约）：备忘/设置变更/全量变更时
   * 仅当前路由为本页才刷新；unsubscribe 保存（模块销毁清理契约，当前页面常驻） */
  (function () {
    var bus = globalThis.SonderBus && globalThis.SonderBus.bus;
    var E = globalThis.SonderBus && globalThis.SonderBus.EVENT;
    if (!bus || !E) return;
    function onData() {
      if (currentEl && currentCtx && routeIs('memo')) draw();
    }
    [E.data('memos'), E.data('settings'), E.DATA_ALL].forEach(function (p) {
      unsubs.push(bus.on(p, onData));
    });
  })();
})();
