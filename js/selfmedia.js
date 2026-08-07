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
      writeTags(p.tags) +
      '</div>' +
      pill +
      '<button class="small-btn" data-act="edit">编辑</button>' +
      '<button class="small-btn danger" data-act="del">删除</button>' +
      '</div>'
    );
    row.querySelector('[data-act="edit"]').onclick = function () { openAdd(ctx, p); };
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