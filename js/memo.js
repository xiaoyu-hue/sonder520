/* memo.js - 快速备忘 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var currentEl = null;

  function fmt(t) {
    var d = new Date(t);
    if (isNaN(d.getTime())) return '';
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function openAdd(ctx, target) {
    ctx.UI.formModal({
      title: target ? '编辑备忘' : '快速备忘',
      confirmText: '保存',
      fields: [{ key: 'text', label: '内容', type: 'textarea', required: true, value: target ? target.text : '', placeholder: '随手记点什么…' }],
      onSubmit: function (v) {
        if (target) ctx.store.updateMemo(target.id, { text: v.text });
        else ctx.store.addMemo(v.text);
        ctx.UI.toast('已保存备忘');
        render(currentEl, ctx);
        return true;
      }
    });
  }

  function render(container, ctx) {
    var UI = ctx.UI, store = ctx.store;
    currentEl = container;
    container.innerHTML = '';
    container.appendChild(UI.el(
      '<div class="hbar">' +
      '<button class="btn primary" id="memoAdd">＋ 新建备忘</button>' +
      '</div>'
    ));
    container.querySelector('#memoAdd').addEventListener('click', function () { openAdd(ctx); });

    var active = store.state.memos.filter(function (m) { return !m.archived; });
    var archived = store.state.memos.filter(function (m) { return m.archived; });

    var box = UI.el('<div id="memoBox"></div>');
    container.appendChild(box);

    box.appendChild(UI.el('<div class="section-title">备忘 ' + active.length + '</div>'));
    if (!active.length) {
      box.appendChild(UI.emptyState('还没有备忘，记一条吧', '＋ 新建备忘', function () { openAdd(ctx); }));
    }
    active.forEach(function (m) { box.appendChild(itemEl(m, false, ctx)); });

    if (archived.length) {
      box.appendChild(UI.el('<div class="section-title">已归档 ' + archived.length + '</div>'));
      archived.forEach(function (m) { box.appendChild(itemEl(m, true, ctx)); });
    }
  }

  function itemEl(m, isArchived, ctx) {
    var UI = ctx.UI, store = ctx.store;
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
      store.updateMemo(m.id, { archived: !isArchived });
      render(currentEl, ctx);
    };
    row.querySelector('[data-act="edit"]').onclick = function () { openAdd(ctx, m); };
    row.querySelector('[data-act="del"]').onclick = function () {
      UI.confirmBox('确定删除这条备忘？').then(function (ok) {
        if (ok) {
          store.removeMemo(m.id);
          render(currentEl, ctx);
          UI.toast('备忘已删除', null, { label: '撤销', onClick: function () {
            store.undoRemove();
            /* P5a：撤销只恢复数据；已切页则不整页顶替当前页面 */
            if (((location.hash || '').replace(/^#\/?/, '').split('/')[0]) === 'memo') render(currentEl, ctx);
            else UI.toast('备忘已恢复');
          } });
        }
      });
    };
    return row;
  }

  Pages.memo = { title: '快速备忘', render: render, add: function (ctx) { openAdd(ctx); } };
})();