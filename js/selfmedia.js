/* selfmedia.js - 自媒体：选题/内容、标签与状态筛选、导出 CSV */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var S = window.SonderStore;
  var currentEl = null, currentCtx = null;
  var state = { status: '', tag: '' };

  function writeTags(tags) {
    return (tags || []).map(function (t) { return '<span class="tag">' + currentCtx.UI.esc(t) + '</span>'; }).join('');
  }
  function num0(v) { var n = Number(v); return isNaN(n) ? 0 : Math.max(0, n); }

  function openAdd(ctx, target) {
    ctx.UI.formModal({
      title: target ? '编辑内容' : '新增内容',
      confirmText: '保存',
      fields: [
        { key: 'title', label: '标题', type: 'text', required: true, value: target ? target.title : '' },
        { key: 'platform', label: '平台', type: 'text', value: target ? target.platform : '' },
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
        if (target) ctx.store.updatePost(target.id, v);
        else ctx.store.addPost(v);
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
    var stSel = container.querySelector('#smStatus');
    var tagSel = container.querySelector('#smTag');
    stSel.value = state.status;
    tagSel.value = state.tag;
    stSel.addEventListener('change', function (e) { state.status = e.target.value; render(ctx); });
    tagSel.addEventListener('change', function (e) { state.tag = e.target.value; render(ctx); });
    container.querySelector('#smClear').addEventListener('click', function () { state.status = ''; state.tag = ''; render(ctx); });
    container.querySelector('#smCsv').addEventListener('click', function () { exportCsv(); });

    var list = S.filterPosts(store.state.posts, { tag: state.tag, status: state.status });
    if (!list.length) {
      box.appendChild(UI.emptyState('还没有内容', '＋ 新增内容', function () { openAdd(ctx); }));
    }
    list.forEach(function (p) { box.appendChild(itemEl(p, ctx)); });

    /* 已发布数据统计可视化 */
    container.appendChild(statsSection(store, ctx));
  }

  var METRICS = [
    { key: 'views', label: '播放', color: '#4f6ef7' },
    { key: 'likes', label: '点赞', color: '#2ea86b' },
    { key: 'comments', label: '评论', color: '#e8a13c' },
    { key: 'favorites', label: '收藏', color: '#d33b6f' }
  ];
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
      '<div class="row" style="margin-bottom:10px">' + pills + '</div>' +
      '<div class="st-legend">' + legend + '</div>' +
      '<div class="st-chart">' + rows + '</div>' +
      '</div>';
    return wrap;
  }

  function tagsOptions(tags) {
    return tags.map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join('');
  }

  function itemEl(p, ctx) {
    var UI = ctx.UI, store = ctx.store;
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
        ? '<div class="sub">播放 ' + UI.esc(num0(p.views)) + ' · 点赞 ' + UI.esc(num0(p.likes)) + ' · 评论 ' + UI.esc(num0(p.comments)) + ' · 收藏 ' + UI.esc(num0(p.favorites)) + '</div>'
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
    row.querySelector('[data-act="edit"]').onclick = function () { openAdd(ctx, p); };
    var prog = row.querySelector('[data-prog]');
    if (prog) {
      prog.addEventListener('change', function () {
        ctx.store.updatePost(p.id, { progress: Number(prog.value) });
        var lab = row.querySelector('[data-proglabel]');
        if (lab) lab.textContent = prog.value + '%';
      });
    }
    row.querySelector('[data-act="del"]').onclick = function () {
      UI.confirmBox('确定删除这条内容？').then(function (ok) {
        if (ok) { store.removePost(p.id); render(ctx); }
      });
    };
    return row;
  }

  function exportCsv() {
    var csv = S.toCSV(S.filterPosts(currentCtx.store.state.posts, { tag: state.tag, status: state.status }));
    var blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'selfmedia.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  Pages.selfmedia = {
    title: '自媒体',
    render: function (container, ctx) { currentEl = container; currentCtx = ctx; render(ctx); },
    add: function (ctx) { openAdd(ctx); }
  };
})();