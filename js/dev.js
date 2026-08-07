/* dev.js - 开发工作：项目、任务、进度、技术笔记 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var S = window.SonderStore;
  var currentEl = null, currentCtx = null;

  function render(ctx) {
    var container = currentEl, store = ctx.store, UI = ctx.UI;
    container.innerHTML = '';
    container.appendChild(UI.el('<div class="hbar"><button class="btn primary" id="devAdd">＋ 新建项目</button><span class="sp"></span><span class="muted small">进度由任务完成情况自动统计</span></div>'));
    container.querySelector('#devAdd').addEventListener('click', function () { openProject(ctx); });

    if (!store.state.devProjects.length) {
      container.appendChild(UI.emptyState('还没有开发项目', '＋ 新建项目', function () { openProject(ctx); }));
      return;
    }
    store.state.devProjects.forEach(function (p) { container.appendChild(projectCard(p, ctx)); });
  }

  function openProject(ctx, target) {
    ctx.UI.formModal({
      title: target ? '编辑项目' : '新建项目',
      confirmText: '保存',
      fields: [
        { key: 'name', label: '项目名', type: 'text', required: true, value: target ? target.name : '' },
        { key: 'note', label: '说明', type: 'textarea', value: target ? target.note : '' }
      ],
      onSubmit: function (v) {
        if (target) ctx.store.updateDevProject(target.id, v);
        else ctx.store.addDevProject(v);
        ctx.UI.toast('已保存');
        render(ctx);
        return true;
      }
    });
  }

  function openTask(ctx, projId, target) {
    ctx.UI.formModal({
      title: target ? '编辑任务' : '添加任务',
      confirmText: '保存',
      fields: [
        { key: 'title', label: '任务', type: 'text', required: true, value: target ? target.title : '' },
        { key: 'note', label: '说明', type: 'textarea', value: target ? (target.note || '') : '' }
      ],
      onSubmit: function (v) {
        if (target) ctx.store.updateDevTask(projId, target.id, v);
        else ctx.store.addDevTask(projId, v);
        ctx.UI.toast('已保存');
        render(ctx);
        return true;
      }
    });
  }

  function projectCard(p, ctx) {
    var UI = ctx.UI, store = ctx.store;
    var prog = S.devProgress(p);

    var card = UI.el(
      '<div class="card" style="margin-bottom:14px" data-proj="' + p.id + '">' +
      '<div class="row">' +
      '<div class="grow"><div class="title" style="font-size:15px">' + UI.esc(p.name) + '</div>' +
      (p.note ? '<div class="sub">' + UI.esc(p.note) + '</div>' : '') + '</div>' +
      '<span class="pill">' + prog.percent + '%</span>' +
      '<button class="small-btn" data-pinfo>设置</button>' +
      '<button class="small-btn danger" data-pdel>删除</button>' +
      '</div>' +
      '<div class="row" style="margin-top:8px"><span class="small muted">已完成 ' + prog.done + ' / ' + prog.total + '</span>' +
      '<div class="progress grow" style="margin-left:8px"><i style="width:' + prog.percent + '%"></i></div></div>' +
      '<div class="details">' +
      '<div class="hbar" style="margin:6px 0 4px"><span class="muted small">任务清单</span>' +
      '<button class="small-btn" data-tadd style="margin-left:auto">＋ 添加任务</button></div>' +
      '<div data-taskswrap></div>' +
      '</div>' +
      '</div>'
    );

    function bindTaskButtons() {
      var wrap = card.querySelector('[data-taskswrap]');
      var wrapId = store.state.devProjects.find(function (x) { return x.id === p.id; });
      var tasks = (wrapId ? wrapId.tasks : []);
      if (!tasks.length) {
        wrap.innerHTML = '<div class="muted small" style="padding:6px 0">暂无任务</div>';
      } else {
        wrap.innerHTML = tasks.map(function (t) {
          return '<div class="list-item" style="margin-bottom:6px;padding:8px 10px" data-task="' + t.id + '">' +
            '<input type="checkbox" data-tcheck ' + (t.done ? 'checked' : '') + '>' +
            '<div class="grow title ' + (t.done ? 'done' : '') + '" style="font-weight:500">' + UI.esc(t.title) + '</div>' +
            '<button class="small-btn" data-tedit>编辑</button>' +
            '<button class="small-btn danger" data-tdel>✕</button>' +
            '</div>';
        }).join('');
      }
      wrap.querySelectorAll('[data-tcheck]').forEach(function (c) {
        c.addEventListener('change', function () {
          store.updateDevTask(p.id, c.closest('[data-task]').dataset.task, { done: c.checked });
          render(ctx);
        });
      });
      wrap.querySelectorAll('[data-tedit]').forEach(function (b) {
        b.addEventListener('click', function () {
          var t = tasks.find(function (x) { return x.id === b.closest('[data-task]').dataset.task; });
          openTask(ctx, p.id, t);
        });
      });
      wrap.querySelectorAll('[data-tdel]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.closest('[data-task]').dataset.task;
          ctx.UI.confirmBox('删除这个任务？').then(function (ok) {
            if (ok) { store.removeDevTask(p.id, id); render(ctx); }
          });
        });
      });
    }

    card.querySelector('[data-tadd]').addEventListener('click', function () { openTask(ctx, p.id); });
    card.querySelector('[data-pinfo]').addEventListener('click', function () { openProject(ctx, p); });
    card.querySelector('[data-pdel]').addEventListener('click', function () {
      ctx.UI.confirmBox('确定删除整个项目？').then(function (ok) {
        if (ok) { store.removeDevProject(p.id); render(ctx); }
      });
    });
    bindTaskButtons();
    return card;
  }

  Pages.dev = {
    title: '开发工作',
    render: function (container, ctx) { currentEl = container; currentCtx = ctx; render(ctx); },
    add: function (ctx) { openProject(ctx); }
  };
})();