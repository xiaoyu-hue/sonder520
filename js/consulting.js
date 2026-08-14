/* consulting.js - 咨询工作：客户档案、项目、跟进、收入 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var S = window.SonderStore;
  var currentEl = null, currentCtx = null;
  var STAGES = ['进行中', '待确认', '已完结'];
  var expanded = {};

  function render(ctx) {
    var container = currentEl, store = ctx.store, UI = ctx.UI;
    container.innerHTML = '';
    container.appendChild(UI.el('<div class="hbar"><button class="btn primary" id="csAdd">＋ 新建客户</button><span class="sp"></span><span class="muted small">客户 ' + store.state.clients.length + ' 位</span></div>'));
    container.querySelector('#csAdd').addEventListener('click', function () { openClient(ctx); });
    if (!store.state.clients.length) {
      container.appendChild(UI.emptyState('还没有客户', '＋ 新建客户', function () { openClient(ctx); }));
      return;
    }
    store.state.clients.forEach(function (c) { container.appendChild(clientCard(c, ctx)); });
  }

  function clientCard(c, ctx) {
    var UI = ctx.UI, store = ctx.store;
    var total = Math.round(c.income.reduce(function (s, i) { return s + (Number(i.amount) || 0); }, 0) * 100) / 100;
    var open = expanded[c.id];
    var card = UI.el(
      '<div class="card" style="margin-bottom:14px" data-client="' + c.id + '">' +
      '<div class="row">' +
      '<div class="grow"><div class="title" style="font-size:15px">' + UI.esc(c.name) + '</div>' +
      (c.contact ? '<div class="sub">' + UI.esc(c.contact) + '</div>' : '') + '</div>' +
      '<span class="pill">项目 ' + c.projects.length + '</span>' +
      '<span class="pill">跟进 ' + c.followups.length + '</span>' +
      '<span class="pill">¥' + total + '</span>' +
      '<button class="small-btn" data-cx="1">' + (open ? '折叠' : '展开') + '</button>' +
      '<button class="small-btn" data-cedit="1">编辑</button>' +
      '<button class="small-btn danger" data-cdel="1">删除</button>' +
      '</div>' +
      '<div class="details" data-call style="display:' + (open ? 'block' : 'none') + '">' +
      '<div class="sub">' + UI.esc(c.note || '无备注') + '</div>' +
      sect('咨询项目', 'data-spadd="1"') + '<div data-spwrap></div>' +
      sect('跟进记录', 'data-fuadd="1"') + '<div data-fuwrap></div>' +
      sect('收入记录', 'data-inadd="1"') + '<div data-inwrap></div>' +
      '</div>' +
      '</div>'
    );
    card.querySelector('[data-cx]').onclick = function () { expanded[c.id] = !open; render(ctx); };
    card.querySelector('[data-cedit]').onclick = function () { openClient(ctx, c); };
    card.querySelector('[data-cdel]').onclick = function () {
      UI.confirmBox('确定删除该客户？会一并删除其项目/跟进/收入。').then(function (ok) {
        if (ok) {
          store.removeClient(c.id);
          delete expanded[c.id];
          render(ctx);
          UI.toast('客户已删除', null, { label: '撤销', onClick: function () {
            store.undoRemove();
            render(ctx);
          } });
        }
      });
    };
    var body = card.querySelector('[data-call]');
    body.querySelector('[data-spadd]').onclick = function () { openPrj(ctx, c.id); };
    body.querySelector('[data-fuadd]').onclick = function () { openFollowup(ctx, c.id); };
    body.querySelector('[data-inadd]').onclick = function () { openIncome(ctx, c.id); };
    renderProjects(body, c, ctx);
    renderFollowups(body, c, ctx);
    renderIncomes(body, c, ctx);
    return card;
  }

  function sect(label, addAttrs) {
    return '<div class="section-title" style="margin:14px 0 8px;font-size:14px">' + label + '</div>' +
      '<button class="small-btn" ' + addAttrs + 'style="margin-bottom:8px">＋ 添加</button>';
  }

  function renderProjects(body, c, ctx) {
    var UI = ctx.UI, store = ctx.store;
    var wrap = body.querySelector('[data-spwrap]');
    wrap.innerHTML = c.projects.length ? c.projects.map(function (pr) {
      return '<div class="list-item cs-item" data-id="' + pr.id + '" style="margin-bottom:6px;padding:8px 10px">' +
        '<div class="grow"><div class="title" style="font-weight:500">' + UI.esc(pr.name) + '</div>' +
        (pr.note ? '<div class="sub">' + UI.esc(pr.note) + '</div>' : '') + '</div>' +
        '<span class="pill">' + UI.esc(pr.stage || '进行中') + '</span>' +
        '<button class="small-btn" data-pe="1">编辑</button>' +
        '<button class="small-btn danger" data-pd="1">✕</button></div>';
    }).join('') : '<div class="muted small">暂无项目</div>';
    wrap.querySelectorAll('[data-pe]').forEach(function (b) {
      b.onclick = function () {
        var pr = c.projects.find(function (x) { return x.id === b.closest('.cs-item').dataset.id; });
        openPrj(ctx, c.id, pr);
      };
    });
    wrap.querySelectorAll('[data-pd]').forEach(function (b) {
      b.onclick = function () {
        var id = b.closest('.cs-item').dataset.id;
        UI.confirmBox('删除该项目？').then(function (ok) {
          if (ok) {
            store.removeClientProject(c.id, id);
            render(ctx);
            UI.toast('项目已删除', null, { label: '撤销', onClick: function () {
              store.undoRemove();
              render(ctx);
            } });
          }
        });
      };
    });
  }

  function renderFollowups(body, c, ctx) {
    var UI = ctx.UI, store = ctx.store;
    var wrap = body.querySelector('[data-fuwrap]');
    wrap.innerHTML = c.followups.length ? c.followups.map(function (f) {
      return '<div class="list-item cs-item" data-id="' + f.id + '" style="margin-bottom:6px;padding:8px 10px">' +
        '<input type="checkbox" data-fcheck="1" ' + (f.done ? 'checked' : '') + '>' +
        '<div class="grow"><div class="title ' + (f.done ? 'done' : '') + '" style="font-weight:500">' + UI.esc(f.note || '') + '</div>' +
        '<div class="sub">' + UI.esc(f.date || '') + '</div></div>' +
        '<button class="small-btn" data-fe="1">编辑</button>' +
        '<button class="small-btn danger" data-fd="1">✕</button></div>';
    }).join('') : '<div class="muted small">暂无跟进记录</div>';
    wrap.querySelectorAll('[data-fcheck]').forEach(function (b) {
      b.onchange = function () {
        store.updateClientFollowup(c.id, b.closest('.cs-item').dataset.id, { done: b.checked });
        render(ctx);
      };
    });
    wrap.querySelectorAll('[data-fe]').forEach(function (b) {
      b.onclick = function () {
        var f = c.followups.find(function (x) { return x.id === b.closest('.cs-item').dataset.id; });
        openFollowup(ctx, c.id, f);
      };
    });
    wrap.querySelectorAll('[data-fd]').forEach(function (b) {
      b.onclick = function () {
        var id = b.closest('.cs-item').dataset.id;
        UI.confirmBox('删除该跟进？').then(function (ok) {
          if (ok) {
            store.removeClientFollowup(c.id, id);
            render(ctx);
            UI.toast('跟进已删除', null, { label: '撤销', onClick: function () {
              store.undoRemove();
              render(ctx);
            } });
          }
        });
      };
    });
  }

  function renderIncomes(body, c, ctx) {
    var UI = ctx.UI, store = ctx.store;
    var wrap = body.querySelector('[data-inwrap]');
    wrap.innerHTML = c.income.length ? c.income.map(function (i) {
      return '<div class="list-item cs-item" data-id="' + i.id + '" style="margin-bottom:6px;padding:8px 10px">' +
        '<div class="grow"><div class="title" style="font-weight:500">¥' + (Number(i.amount) || 0) + '</div>' +
        '<div class="sub">' + UI.esc(i.date || '') + (i.note ? ' · ' + UI.esc(i.note) : '') + '</div></div>' +
        '<button class="small-btn" data-ie="1">编辑</button>' +
        '<button class="small-btn danger" data-idel="1">✕</button></div>';
    }).join('') : '<div class="muted small">暂无收入记录</div>';
    wrap.querySelectorAll('[data-ie]').forEach(function (b) {
      b.onclick = function () {
        var inc = c.income.find(function (x) { return x.id === b.closest('.cs-item').dataset.id; });
        openIncome(ctx, c.id, inc);
      };
    });
    wrap.querySelectorAll('[data-idel]').forEach(function (b) {
      b.onclick = function () {
        var id = b.closest('.cs-item').dataset.id;
        UI.confirmBox('删除该笔收入？').then(function (ok) {
          if (ok) {
            store.removeClientIncome(c.id, id);
            render(ctx);
            UI.toast('收入已删除', null, { label: '撤销', onClick: function () {
              store.undoRemove();
              render(ctx);
            } });
          }
        });
      };
    });
  }

  function openClient(ctx, target) {
    ctx.UI.formModal({
      title: target ? '编辑客户' : '新建客户', confirmText: '保存',
      fields: [
        { key: 'name', label: '名称', type: 'text', required: true, value: target ? target.name : '' },
        { key: 'contact', label: '联系方式', type: 'text', value: target ? target.contact : '' },
        { key: 'note', label: '备注', type: 'textarea', value: target ? target.note : '' }
      ],
      onSubmit: function (v) {
        if (target) currentCtx.store.updateClient(target.id, v);
        else ctx.store.addClient(v);
        ctx.UI.toast('已保存'); render(ctx); return true;
      }
    });
  }
  function openPrj(ctx, clientId, target) {
    ctx.UI.formModal({
      title: target ? '编辑项目' : '添加项目', confirmText: '保存',
      fields: [
        { key: 'name', label: '项目名', type: 'text', required: true, value: target ? target.name : '' },
        { key: 'stage', label: '阶段', type: 'select', value: target ? target.stage : '进行中', options: STAGES },
        { key: 'note', label: '备注', type: 'textarea', value: target ? target.note : '' }
      ],
      onSubmit: function (v) {
        if (target) ctx.store.updateClientProject(clientId, target.id, v);
        else ctx.store.addClientProject(clientId, v);
        ctx.UI.toast('已保存'); render(ctx); return true;
      }
    });
  }
  function openFollowup(ctx, clientId, target) {
    ctx.UI.formModal({
      title: target ? '编辑跟进' : '添加跟进', confirmText: '保存',
      fields: [
        { key: 'note', label: '内容', type: 'textarea', required: true, value: target ? target.note : '' },
        { key: 'date', label: '日期', type: 'date', value: target ? target.date : S.todayStr() }
      ],
      onSubmit: function (v) {
        if (target) ctx.store.updateClientFollowup(clientId, target.id, v);
        else ctx.store.addClientFollowup(clientId, v);
        ctx.UI.toast('已保存'); render(ctx); return true;
      }
    });
  }
  function openIncome(ctx, clientId, target) {
    ctx.UI.formModal({
      title: target ? '编辑收入' : '记一笔收入', confirmText: '保存',
      fields: [
        { key: 'amount', label: '金额(元)', type: 'number', required: true, value: target ? target.amount : '0' },
        { key: 'date', label: '日期', type: 'date', value: target ? target.date : S.todayStr() },
        { key: 'note', label: '备注', type: 'text', value: target ? target.note : '' }
      ],
      onSubmit: function (v) {
        if (v.amount === null || !(v.amount >= 0)) return '金额需为非负数字';
        if (target) ctx.store.updateClientIncome(clientId, target.id, v);
        else ctx.store.addClientIncome(clientId, v);
        ctx.UI.toast('已保存'); render(ctx); return true;
      }
    });
  }

  Pages.consulting = {
    title: '咨询工作',
    render: function (container, ctx) { currentEl = container; currentCtx = ctx; render(ctx); },
    add: function (ctx) { openClient(ctx); }
  };

  /* 数据变更自动重绘（SonderBus）：客户/设置变更时仅当前路由为本页才刷新 */
  (function () {
    var bus = globalThis.SonderBus && globalThis.SonderBus.bus;
    if (!bus) return;
    ['/data/clients', '/data/settings', '/data/all'].forEach(function (p) {
      bus.on(p, function () {
        if (currentEl && currentCtx && ((location.hash || '').replace(/^#\/?/, '').split('/')[0] === 'consulting')) {
          render(currentCtx);
        }
      });
    });
  })();
})();