/* design.js - 设计计划：灵感收集 + 设计项目与阶段
 * 已迁移至标准模块工厂（Sonder-Frame v0.1.2，试点八）——协议见 docs/adr/ADR-011：
 * 文件不改名不换位、Pages/DOM/store API 契约零变更、数据写同一 state 集合；
 * 设计计划为单工厂模块 designs（prepend：最新在前，timeField:time 对齐 addDesign 的 time 字段；
 * type/stage 声明为 select 仅作工厂 sanitize 通道——type 白名单外回落 'idea'、
 * stage 白名单外回落 '构想'，逐字段对齐 addDesign 归一语义；title required 与表单
 * required 双保险（领域 API「未命名」兜底保留在 store-content.js）；
 * 双节分栏（灵感/项目 + 计数）、阶段 pill、删除确认弹窗、空态、链接渲染全留页面层；
 * 删除撤销走工厂 _undoPush；/data/designs 订阅保留（addDesign 等领域 API 仍可能被
 * 外部调用方写入，bus 兜底重绘，双写路径并存）；卡内按钮统一容器 click 委托
 * （data-* 回查 state 最新对象），data-dadd 新建按钮维持节点级绑定。
 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var currentEl = null, currentCtx = null;
  var STAGES = ['构想', '进行', '定稿'];
  var mod = null;
  var delegatedBound = false;
  var unsubs = [];

  /* 单工厂模块配置：id 对应 state.designs（与 store.addDesign 等同一集合）
   * prepend 对齐 addDesign 的 unshift（最新在前）；timeField: 'time'——新增写 time、
   * 编辑不刷、不生成默认时间字段（对齐 addDesign/updateDesign 语义，news 先例）；
   * type 声明 select：白名单外回落 options[0]='idea'，等价 addDesign「非 project 归一 idea」；
   * stage 声明 select：默认首项 '构想'，等价 addDesign 默认；title required 与表单双保险 */
  /** @type {SonderModuleConfig} */
  var CONFIG = {
    id: 'designs', displayName: '设计计划', storageKey: 'sonder_data_v1', schemaVersion: 1, prepend: true, timeField: 'time',
    fields: [
      { key: 'type', type: 'select', label: '类型', options: ['idea', 'project'] },
      { key: 'title', type: 'text', label: '标题', required: true },
      { key: 'category', type: 'text', label: '分类' },
      { key: 'link', type: 'text', label: '链接' },
      { key: 'note', type: 'textarea', label: '备注' },
      { key: 'stage', type: 'select', label: '阶段', options: STAGES }
    ]
  };

  function routeIs(p) {
    return (location.hash || '').replace(/^#\/?/, '').split('/')[0] === p;
  }

  function ensureMod(ctx) {
    if (!mod) {
      mod = globalThis.SonderModuleFactory.createModule(ctx.store, CONFIG);
      /* 工厂操作（灵感/项目 add/update/remove）完成即统一重绘（仅当前路由为本页） */
      mod.render(function () { if (currentEl && currentCtx && routeIs('design')) render(currentCtx); });
    }
    return mod;
  }

  function render(ctx) {
    var container = currentEl, store = ctx.store, UI = ctx.UI;
    container.innerHTML = '';
    container.appendChild(UI.el(
      '<div class="hbar">' +
      '<button class="btn primary" data-dadd="idea">＋ 收集灵感</button>' +
      '<button class="btn" data-dadd="project">＋ 新建项目</button>' +
      '</div>'
    ));
    container.querySelectorAll('[data-dadd]').forEach(function (b) {
      b.addEventListener('click', function () { openDesign(ctx, b.dataset.dadd); });
    });

    var ideas = store.state.designs.filter(function (x) { return x.type === 'idea'; });
    var projects = store.state.designs.filter(function (x) { return x.type === 'project'; });

    if (!store.state.designs.length) {
      container.appendChild(UI.emptyState('还没有设计灵感或项目', '收集灵感', function () { openDesign(ctx, 'idea'); }));
      return;
    }
    container.appendChild(UI.el('<div class="section-title">灵感 ' + ideas.length + '</div>'));
    if (!ideas.length) {
      container.appendChild(UI.el('<div class="muted small" style="margin-bottom:10px">暂无灵感</div>'));
    }
    ideas.forEach(function (x) { container.appendChild(designCard(x, ctx)); });

    container.appendChild(UI.el('<div class="section-title">项目 ' + projects.length + '</div>'));
    if (!projects.length) {
      container.appendChild(UI.el('<div class="muted small">暂无项目</div>'));
    }
    projects.forEach(function (x) { container.appendChild(designCard(x, ctx)); });
  }

  function designCard(x, ctx) {
    var UI = ctx.UI;
    var isProj = x.type === 'project';
    var safeLink = UI.sanitizeUrl(x.link);
    var link = x.link && safeLink
      ? '<a href="' + safeLink + '" target="_blank" rel="noopener" class="small" style="color:var(--accent)">链接 →</a>'
      : '';
    var card = UI.el(
      '<div class="list-item" data-id="' + x.id + '">' +
      '<div class="grow">' +
      '<div class="title">' + UI.esc(x.title) + '</div>' +
      '<div class="sub">' + (x.category ? '<span class="tag">' + UI.esc(x.category) + '</span>' : '') + ' ' +
      (x.note ? UI.esc(x.note) : '') + ' ' + link + '</div>' +
      '</div>' +
      (isProj ? '<span class="pill ' + (x.stage === '定稿' ? 'lo' : 'mid') + '">' + UI.esc(x.stage || '构想') + '</span>' : '') +
      '<button class="small-btn" data-act="edit">编辑</button>' +
      '<button class="small-btn danger" data-act="del">删除</button>' +
      '</div>'
    );
    return card;
  }

  function openDesign(ctx, type, target) {
    var isProj = type === 'project';
    ctx.UI.formModal({
      title: target ? '编辑' : (isProj ? '新建项目' : '收集灵感'), confirmText: '保存',
      fields: [
        { key: 'title', label: isProj ? '项目名' : '灵感', type: 'text', required: true, value: target ? target.title : '' },
        { key: 'category', label: '分类', type: 'text', value: target ? target.category : '' },
        { key: 'link', label: '链接', type: 'text', value: target ? target.link : '' },
        { key: 'note', label: '备注', type: 'textarea', value: target ? target.note : '' },
        { key: 'stage', label: '阶段', type: 'select', value: target ? (target.stage || '构想') : '构想', options: STAGES }
      ],
      onSubmit: function (v) {
        v.type = type;
        if (target) ensureMod(ctx).update(target.id, v);
        else ensureMod(ctx).add(v);
        ctx.UI.toast('已保存'); render(ctx); return true;
      }
    });
  }

  /* 卡内按钮容器 click 委托（与 memo/today/dev/news/selfmedia/consulting/reading 写法收敛）：
   * data-* 回查 state.designs 最新对象（消除 stale-closure 竞态）；
   * 编辑/删除走委托；data-dadd 新建按钮为非行内按钮维持节点级绑定 */
  function bindDelegated(ctx) {
    var container = currentEl, store = ctx.store, UI = ctx.UI;
    if (delegatedBound) return; /* 常驻容器只绑一次，防监听累积 */
    delegatedBound = true;
    container.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-act]');
      if (!b) return;
      var card = b.closest('[data-id]');
      var rec = card && store.state.designs.filter(function (x) { return x.id === card.dataset.id; })[0];
      if (!rec) return;
      if (b.dataset.act === 'edit') { openDesign(ctx, rec.type, rec); return; }
      if (b.dataset.act === 'del') {
        var isProj = rec.type === 'project';
        UI.confirmBox('删除这条' + (isProj ? '项目' : '灵感') + '？').then(function (ok) {
          if (ok) {
            ensureMod(ctx).remove(rec.id);
            render(ctx);
            UI.toast(isProj ? '项目已删除' : '灵感已删除', null, { label: '撤销', onClick: function () {
              store.undoRemove();
              render(ctx);
            } });
          }
        });
        return;
      }
    });
  }

  Pages.design = {
    title: '设计计划',
    render: function (container, ctx) { currentEl = container; currentCtx = ctx; bindDelegated(ctx); render(ctx); },
    add: function (ctx) { openDesign(ctx, 'idea'); }
  };

  /* 数据变更自动重绘（EventBridge）：设计/设置变更时仅当前路由为本页才刷新
   * /data/designs 订阅保留：addDesign 等领域 API 仍可能被外部调用方写入，
   * bus 兜底重绘（双写路径并存）；unsubscribe 保存（模块销毁清理契约，当前页面常驻） */
  (function () {
    var bus = globalThis.SonderBus && globalThis.SonderBus.bus;
    if (!bus) return;
    ['/data/designs', '/data/settings', '/data/all'].forEach(function (p) {
      var off = bus.on(p, function () {
        if (currentEl && currentCtx && routeIs('design')) render(currentCtx);
      });
      unsubs.push(off);
    });
  })();
})();