/* news.js - 看新闻计划：收藏/待读/已读、标签筛选、打开链接
 * 已迁移至标准模块工厂（Sonder-Frame v0.1.2，试点四）——协议见 docs/adr/ADR-011：
 * 文件不改名不换位、Pages/DOM/store API 契约零变更、数据写同一 state 集合；
 * news 为单工厂模块（prepend + timeField:time）；页面筛选（status/tag）是视图层派生状态留页面；
 * 卡内按钮统一容器委托绑定（data-* 回查 state）；删除撤销走工厂 _undoPush。
 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var S = window.SonderStore;
  var currentEl = null, currentCtx = null;
  var state = { status: '', tag: '' };
  var mod = null;
  var unsubs = [];
  var delegatedBound = false;

  function routeIs() {
    return (location.hash || '').replace(/^#\/?/, '').split('/')[0] === 'news';
  }

  /* 单工厂模块配置：id 对应 state 同名集合（与 store.addNews 等同一集合）
   * prepend 对齐 addNews 的 unshift（最新在前）；timeField 对齐既有 time 字段（新增写入、编辑不刷） */
  /** @type {SonderModuleConfig} */
  var CONFIG = {
    id: 'news', displayName: '看新闻计划', storageKey: 'sonder_data_v1', schemaVersion: 1, prepend: true, timeField: 'time',
    fields: [
      { key: 'title', type: 'text', label: '标题', required: true },
      { key: 'url', type: 'text', label: '链接' },
      { key: 'source', type: 'text', label: '来源' },
      { key: 'tags', type: 'array', label: '标签' },
      { key: 'status', type: 'select', label: '状态', options: ['unread', 'read', 'favorite'] },
      { key: 'note', type: 'text', label: '备注' }
    ]
  };

  function ensureMod(ctx) {
    if (!mod) {
      mod = globalThis.SonderModuleFactory.createModule(ctx.store, CONFIG);
      /* 工厂操作（add/update/remove）完成即统一重绘（仅当前路由为本页） */
      mod.render(function () { if (currentEl && currentCtx && routeIs()) render(currentCtx); });
    }
    return mod;
  }

  function render(ctx) {
    var container = currentEl, store = ctx.store, UI = ctx.UI;
    container.innerHTML = '';
    container.appendChild(UI.el(
      '<div class="hbar">' +
      '<button class="btn primary" id="nwAdd">＋ 新增资讯</button>' +
      '<select id="nwStatus" class="tool"><option value="">全部状态</option>' +
      '<option value="unread">待读</option><option value="read">已读</option><option value="favorite">收藏</option></select>' +
      '<select id="nwTag" class="tool"><option value="">全部标签</option>' +
      tagOptions(S.collectTags(store.state.news.map(function (n) { return { tags: n.tags }; }))) + '</select>' +
      '<button class="btn" id="nwClear">清除筛选</button>' +
      '</div>'
    ));
    container.querySelector('#nwAdd').addEventListener('click', function () { openAdd(ctx); });
    var st = container.querySelector('#nwStatus');
    var tg = container.querySelector('#nwTag');
    st.value = state.status; tg.value = state.tag;
    st.addEventListener('change', function (e) { state.status = e.target.value; render(ctx); });
    tg.addEventListener('change', function (e) { state.tag = e.target.value; render(ctx); });
    container.querySelector('#nwClear').addEventListener('click', function () { state.status = ''; state.tag = ''; render(ctx); });
    bindDelegated(ctx);

    var list = store.state.news.filter(function (n) {
      if (state.status && n.status !== state.status) return false;
      if (state.tag && (n.tags || []).indexOf(state.tag) < 0) return false;
      return true;
    });
    if (!list.length) {
      container.appendChild(UI.emptyState('还没有资讯', '＋ 新增资讯', function () { openAdd(ctx); }));
      return;
    }
    list.forEach(function (n) { container.appendChild(itemEl(n, ctx)); });
  }

  function tagOptions(items) {
    var esc = currentCtx.UI.esc;
    return items.map(function (i) { return '<option value="' + esc(i) + '">' + esc(i) + '</option>'; }).join('');
  }

  /* 卡内按钮容器委托（与 memo/today/dev 四模块写法收敛）：data-* 回查 state 最新对象 */
  function bindDelegated(ctx) {
    var container = currentEl, store = ctx.store, UI = ctx.UI;
    if (delegatedBound) return; /* 常驻容器只绑一次，防监听累积 */
    delegatedBound = true;
    container.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-act="mark"],[data-act="fav"],[data-act="unfav"],[data-act="edit"],[data-act="del"]');
      if (!b) return;
      var row = b.closest('[data-id]');
      var n = row && store.state.news.filter(function (x) { return x.id === row.dataset.id; })[0];
      if (!n) return;
      var act = b.dataset.act;
      if (act === 'mark') { ensureMod(ctx).update(n.id, { status: 'read' }); return; }
      if (act === 'fav') { ensureMod(ctx).update(n.id, { status: 'favorite' }); return; }
      if (act === 'unfav') { ensureMod(ctx).update(n.id, { status: 'unread' }); return; }
      if (act === 'edit') { openAdd(ctx, n); return; }
      if (act === 'del') {
        UI.confirmBox('删除这条资讯？').then(function (ok) {
          if (ok) {
            ensureMod(ctx).remove(n.id);
            UI.toast('资讯已删除', null, { label: '撤销', onClick: function () {
              store.undoRemove();
              render(ctx);
            } });
          }
        });
      }
    });
  }

  function itemEl(n, ctx) {
    var UI = ctx.UI;
    var pill = n.status === 'favorite' ? '<span class="pill hi">收藏</span>'
      : n.status === 'read' ? '<span class="pill lo">已读</span>'
      : '<span class="pill">待读</span>';
    var safeUrl = UI.sanitizeUrl(n.url);
    var titleHtml = n.url && safeUrl
      ? '<a href="' + safeUrl + '" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none">' + UI.esc(n.title) + '</a>'
      : UI.esc(n.title);
    return UI.el(
      '<div class="list-item" data-id="' + n.id + '">' +
      '<div class="grow">' +
      '<div class="title">' + titleHtml + '</div>' +
      '<div class="sub">' + (n.source ? UI.esc(n.source) : '无来源') +
      (n.note ? ' · ' + UI.esc(n.note) : '') + '</div>' +
      (n.tags || []).map(function (t) { return '<span class="tag">' + UI.esc(t) + '</span>'; }).join('') +
      '</div>' +
      pill +
      (n.status !== 'read' ? '<button class="small-btn" data-act="mark">标已读</button>' : '') +
      (n.status === 'favorite' ? '<button class="small-btn" data-act="unfav">取消收藏</button>' : '<button class="small-btn" data-act="fav">收藏</button>') +
      '<button class="small-btn" data-act="edit">编辑</button>' +
      '<button class="small-btn danger" data-act="del">删除</button>' +
      '</div>'
    );
  }

  function openAdd(ctx, target) {
    ctx.UI.formModal({
      title: target ? '编辑资讯' : '新增资讯', confirmText: '保存',
      fields: [
        { key: 'title', label: '标题', type: 'text', required: true, value: target ? target.title : '' },
        { key: 'url', label: '链接', type: 'text', value: target ? target.url : '' },
        { key: 'source', label: '来源', type: 'text', value: target ? target.source : '' },
        { key: 'tags', label: '标签(逗号分隔)', type: 'text', value: target ? (target.tags || []).join(',') : '' },
        { key: 'status', label: '状态', type: 'select', value: target ? target.status : 'unread', options: ['unread', 'read', 'favorite'] },
        { key: 'note', label: '备注', type: 'text', value: target ? target.note : '' }
      ],
      onSubmit: function (v) {
        v.tags = String(v.tags || '').split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean);
        if (target) ensureMod(ctx).update(target.id, v);
        else ensureMod(ctx).add(v);
        ctx.UI.toast('已保存'); return true;
      }
    });
  }

  Pages.news = {
    title: '看新闻计划',
    render: function (container, ctx) { currentEl = container; currentCtx = ctx; render(ctx); },
    add: function (ctx) { openAdd(ctx); }
  };

  /* 数据变更自动重绘（EventBridge，ADR-010）：资讯/设置变更时仅当前路由为本页才刷新 */
  (function () {
    var bus = globalThis.SonderBus && globalThis.SonderBus.bus;
    if (!bus) return;
    ['/data/news', '/data/settings', '/data/all'].forEach(function (p) {
      var off = bus.on(p, function () {
        if (currentEl && currentCtx && ((location.hash || '').replace(/^#\/?/, '').split('/')[0] === 'news')) {
          render(currentCtx);
        }
      });
      unsubs.push(off);
    });
  })();
})();
