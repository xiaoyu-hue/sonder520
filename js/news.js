/* news.js - 看新闻计划：收藏/待读/已读、标签筛选、打开链接 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var S = window.SonderStore;
  var currentEl = null, currentCtx = null;
  var state = { status: '', tag: '' };

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

  function itemEl(n, ctx) {
    var UI = ctx.UI, store = ctx.store;
    var pill = n.status === 'favorite' ? '<span class="pill hi">收藏</span>'
      : n.status === 'read' ? '<span class="pill lo">已读</span>'
      : '<span class="pill">待读</span>';
    var safeUrl = UI.sanitizeUrl(n.url);
    var titleHtml = n.url && safeUrl
      ? '<a href="' + safeUrl + '" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none">' + UI.esc(n.title) + '</a>'
      : UI.esc(n.title);
    var row = UI.el(
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
    var mk = row.querySelector('[data-act="mark"]');
    var fav = row.querySelector('[data-act="fav"]');
    var unfav = row.querySelector('[data-act="unfav"]');
    if (mk) mk.onclick = function () { store.updateNews(n.id, { status: 'read' }); render(ctx); };
    if (fav) fav.onclick = function () { store.updateNews(n.id, { status: 'favorite' }); render(ctx); };
    if (unfav) unfav.onclick = function () { store.updateNews(n.id, { status: 'unread' }); render(ctx); };
    row.querySelector('[data-act="edit"]').onclick = function () { openAdd(ctx, n); };
    row.querySelector('[data-act="del"]').onclick = function () {
      UI.confirmBox('删除这条资讯？').then(function (ok) { if (ok) { store.removeNews(n.id); render(ctx); } });
    };
    return row;
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
        if (target) ctx.store.updateNews(target.id, v);
        else ctx.store.addNews(v);
        ctx.UI.toast('已保存'); render(ctx); return true;
      }
    });
  }

  Pages.news = {
    title: '看新闻计划',
    render: function (container, ctx) { currentEl = container; currentCtx = ctx; render(ctx); },
    add: function (ctx) { openAdd(ctx); }
  };
})();