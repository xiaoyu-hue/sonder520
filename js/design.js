/* design.js - 设计计划：灵感收集 + 设计项目与阶段 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var currentEl = null, currentCtx = null;
  var STAGES = ['构想', '进行', '定稿'];

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
    var UI = ctx.UI, store = ctx.store;
    var isProj = x.type === 'project';
    var link = x.link
      ? '<a href="' + UI.esc(x.link) + '" target="_blank" rel="noopener" class="small" style="color:var(--accent)">链接 →</a>'
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
    card.querySelector('[data-act="edit"]').onclick = function () { openDesign(ctx, x.type, x); };
    card.querySelector('[data-act="del"]').onclick = function () {
      UI.confirmBox('删除这条' + (isProj ? '项目' : '灵感') + '？').then(function (ok) {
        if (ok) { store.removeDesign(x.id); render(ctx); }
      });
    };
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
        if (target) ctx.store.updateDesign(target.id, v);
        else ctx.store.addDesign(v);
        ctx.UI.toast('已保存'); render(ctx); return true;
      }
    });
  }

  Pages.design = {
    title: '设计计划',
    render: function (container, ctx) { currentEl = container; currentCtx = ctx; render(ctx); },
    add: function (ctx) { openDesign(ctx, 'idea'); }
  };
})();