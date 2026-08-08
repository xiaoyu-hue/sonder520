/* today.js - 今日计划 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var S = window.SonderStore;
  var esc = window.UI.esc;
  var currentCtx = null;
  var currentEl = null;

  function openAdd(ctx, target) {
    ctx.UI.formModal({
      title: target ? '编辑任务' : '新建任务',
      confirmText: '保存',
      fields: [
        { key: 'title', label: '任务', type: 'text', required: true, value: target ? target.title : '', placeholder: '要做什么？' },
        { key: 'note', label: '备注', type: 'textarea', value: target ? target.note : '' },
        { key: 'date', label: '计划日期', type: 'date', value: target ? target.date : S.todayStr() },
        { key: 'priority', label: '优先级', type: 'select', value: target ? target.priority : '中', options: ['高', '中', '低'] }
      ],
      onSubmit: function (v) {
        if (target) ctx.store.updateTask(target.id, v);
        else ctx.store.addTask(v);
        ctx.UI.toast('已保存');
        render(currentEl, ctx);
        return true;
      }
    });
  }

  function render(container, ctx) {
    var UI = ctx.UI, store = ctx.store;
    currentCtx = ctx;
    currentEl = container;
    container.innerHTML = '';
    container.appendChild(UI.el(
      '<div class="hbar">' +
      '  <input type="date" id="tplDate" value="' + UI.esc(S.todayStr()) + '" class="tool">' +
      '  <button class="btn primary" id="tplAdd">＋ 新建任务</button>' +
      '  <span class="sp"></span>' +
      '  <button class="btn" id="tplRefresh">刷新排序</button>' +
      '</div>'
    ));

    var box = UI.el('<div id="tplList"></div>');
    container.appendChild(box);

    container.querySelector('#tplDate').addEventListener('change', function (e) {
      renderGroups(box, store, e.target.value);
    });
    container.querySelector('#tplAdd').addEventListener('click', function () { openAdd(ctx); });
    container.querySelector('#tplRefresh').addEventListener('click', function () { render(currentEl, currentCtx); });

    renderGroups(box, store, S.todayStr());
  }

  function renderGroups(listEl, store, day) {
    var g = S.groupTasks(store.state.tasks, day);
    var html = '';
    html += section('待办 · 今天 (' + day + ')', g.now, day) ;
    html += section('已过期', g.overdue, day);
    html += section('之后安排', g.upcoming, day);
    html += section('已完成', g.done, day);

    listEl.innerHTML = html;
    bind(listEl, store, day);
  }

  function section(title, items, day) {
    if (!items.length) return '';
    var inner = items.map(function (t) {
      var prio = PRI_CLASS[t.priority] || 'mid';
      return '<div class="list-item" data-id="' + t.id + '">' +
        '<input type="checkbox" class="tpl-done" ' + (t.done ? 'checked' : '') + '>' +
        (t.done ? delOnly(t.id) : buttonsUpDown(t.id)) +
        '<div class="grow"><div class="title ' + (t.done ? 'done' : '') + '">' + esc(t.title) + '</div>' +
        (t.note ? '<div class="sub">' + esc(t.note) + '</div>' : '') +
        '</div>' +
        '<span class="pill ' + prio + '">' + esc(t.priority || '中') + '</span>' +
        '<button class="small-btn" data-act="edit" data-id="' + t.id + '" title="编辑">✎</button>' +
        '</div>';
    }).join('');
    return '<div class="section-title">' + esc(title) + '</div>' + inner + (items.length ? '' : '');
  }
  var PRI_CLASS = { '高': 'hi', '中': 'mid', '低': 'lo' };

  var esc = window.UI.esc;
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

  function bind(container, store, day) {
    var UI = window.UI;
    container.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        var id = b.dataset.id;
        if (b.dataset.act === 'del') {
          UI.confirmBox('确定删除这条任务？').then(function (ok) {
            if (ok) { store.removeTask(id); renderGroups(container, store, day); }
          });
        } else if (b.dataset.act === 'edit') {
          var t = store.state.tasks.find(function (x) { return x.id === id; });
          if (t) openAdd(currentCtx, t);
        } else {
          store.reorderTask(id, b.dataset.act);
          renderGroups(container, store, day);
        }
      });
    });
    container.querySelectorAll('.tpl-done').forEach(function (c) {
      c.addEventListener('change', function () {
        store.updateTask(c.closest('[data-id]').dataset.id, { done: c.checked });
        renderGroups(container, store, day);
      });
    });
  }

  Pages.today = { title: '今日计划', render: render, add: function (ctx) { openAdd(ctx); } };
})();