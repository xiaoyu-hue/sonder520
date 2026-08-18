/* consulting.js - 咨询工作：客户档案、项目、跟进、收入
 * 已迁移至标准模块工厂（Sonder-Frame v0.1.2，试点六）——协议见 docs/adr/ADR-011：
 * 文件不改名不换位、Pages/DOM/store API 契约零变更、数据写同一 state 集合；
 * 客户主对象为单工厂模块（prepend：最新在前，createdAt 由工厂默认生成；
 * projects/followups/income 三个 array 字段声明后工厂 add 自动补 []，对齐 addClient 契约）；
 * 项目/跟进/收入三个嵌套子集合不建模块、继续走领域 API——子项 remove 的 restore 闭包撤销
 * 工厂不提供（工厂仅整记录撤销），嵌套边界留领域层（试点六结论）；
 * 折叠（expanded）/收入合计/负数拦截/空态是页面层能力进页面；
 * 卡内按钮统一容器委托绑定（click/change 双委托，data-* 回查 state 最新对象）；
 * 客户删除撤销走工厂 _undoPush；/data/clients 订阅保留（addClient 等领域 API 仍可能被
 * 外部调用方写入，bus 兜底重绘，双写路径并存）。
 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var S = window.SonderStore;
  var currentEl = null, currentCtx = null;
  var STAGES = ['进行中', '待确认', '已完结'];
  var expanded = {};
  var mod = null;
  var delegatedBound = false;
  var unsubs = [];

  /* 单工厂模块配置：id 对应 state.clients（与 store.addClient 等同一集合）
   * prepend 对齐 addClient 的 unshift（最新在前）；不配 timeField——createdAt/updatedAt 由工厂默认生成；
   * 三个 array 字段声明后工厂 add 自动补 []（对齐 addClient 契约：id + projects/followups/income）；
   * name required 与表单 required 双保险（领域 API「未命名客户」兜底保留在 store-content.js） */
  /** @type {SonderModuleConfig} */
  var CONFIG = {
    id: 'clients', displayName: '咨询工作', storageKey: 'sonder_data_v1', schemaVersion: 1, prepend: true,
    fields: [
      { key: 'name', type: 'text', label: '名称', required: true },
      { key: 'contact', type: 'text', label: '联系方式' },
      { key: 'note', type: 'textarea', label: '备注' },
      { key: 'projects', type: 'array', label: '项目' },
      { key: 'followups', type: 'array', label: '跟进' },
      { key: 'income', type: 'array', label: '收入' }
    ]
  };

  function routeIs() {
    return (location.hash || '').replace(/^#\/?/, '').split('/')[0] === 'consulting';
  }

  function ensureMod(ctx) {
    if (!mod) {
      mod = globalThis.SonderModuleFactory.createModule(ctx.store, CONFIG);
      /* 工厂操作（客户 add/update/remove）完成即统一重绘（仅当前路由为本页） */
      mod.render(function () { if (currentEl && currentCtx && routeIs()) render(currentCtx); });
    }
    return mod;
  }

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
    var UI = ctx.UI;
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
    var body = card.querySelector('[data-call]');
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
    var UI = ctx.UI;
    var wrap = body.querySelector('[data-spwrap]');
    wrap.innerHTML = c.projects.length ? c.projects.map(function (pr) {
      return '<div class="list-item cs-item" data-id="' + pr.id + '" style="margin-bottom:6px;padding:8px 10px">' +
        '<div class="grow"><div class="title" style="font-weight:500">' + UI.esc(pr.name) + '</div>' +
        (pr.note ? '<div class="sub">' + UI.esc(pr.note) + '</div>' : '') + '</div>' +
        '<span class="pill">' + UI.esc(pr.stage || '进行中') + '</span>' +
        '<button class="small-btn" data-pe="1">编辑</button>' +
        '<button class="small-btn danger" data-pd="1">✕</button></div>';
    }).join('') : '<div class="muted small">暂无项目</div>';
  }

  function renderFollowups(body, c, ctx) {
    var UI = ctx.UI;
    var wrap = body.querySelector('[data-fuwrap]');
    wrap.innerHTML = c.followups.length ? c.followups.map(function (f) {
      return '<div class="list-item cs-item" data-id="' + f.id + '" style="margin-bottom:6px;padding:8px 10px">' +
        '<input type="checkbox" data-fcheck="1" ' + (f.done ? 'checked' : '') + '>' +
        '<div class="grow"><div class="title ' + (f.done ? 'done' : '') + '" style="font-weight:500">' + UI.esc(f.note || '') + '</div>' +
        '<div class="sub">' + UI.esc(f.date || '') + '</div></div>' +
        '<button class="small-btn" data-fe="1">编辑</button>' +
        '<button class="small-btn danger" data-fd="1">✕</button></div>';
    }).join('') : '<div class="muted small">暂无跟进记录</div>';
  }

  function renderIncomes(body, c, ctx) {
    var UI = ctx.UI;
    var wrap = body.querySelector('[data-inwrap]');
    wrap.innerHTML = c.income.length ? c.income.map(function (i) {
      return '<div class="list-item cs-item" data-id="' + i.id + '" style="margin-bottom:6px;padding:8px 10px">' +
        '<div class="grow"><div class="title" style="font-weight:500">¥' + (Number(i.amount) || 0) + '</div>' +
        '<div class="sub">' + UI.esc(i.date || '') + (i.note ? ' · ' + UI.esc(i.note) : '') + '</div></div>' +
        '<button class="small-btn" data-ie="1">编辑</button>' +
        '<button class="small-btn danger" data-idel="1">✕</button></div>';
    }).join('') : '<div class="muted small">暂无收入记录</div>';
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
        if (target) ensureMod(ctx).update(target.id, v);
        else ensureMod(ctx).add(v);
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

  /* 卡内按钮容器委托（与 memo/today/dev/news/selfmedia 写法收敛）：
   * click 委托：客户卡三键 + 三区块添加键 + 子项行编辑/删除键；
   * change 委托：跟进 checkbox（data-fcheck）为控件走 change 事件，与 click 委托并存；
   * data-* 回查 state 最新对象（子项行经 .cs-item[data-id] 再回查嵌套数组） */
  function bindDelegated(ctx) {
    var container = currentEl, store = ctx.store, UI = ctx.UI;
    if (delegatedBound) return; /* 常驻容器只绑一次，防监听累积 */
    delegatedBound = true;
    container.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest(
        '[data-cx],[data-cedit],[data-cdel],[data-spadd],[data-fuadd],[data-inadd],[data-pe],[data-pd],[data-fe],[data-fd],[data-ie],[data-idel]');
      if (!b) return;
      var card = b.closest('[data-client]');
      var c = card && store.state.clients.filter(function (x) { return x.id === card.dataset.client; })[0];
      if (!c) return;
      var row = b.closest('.cs-item');
      var id = row && row.dataset.id;
      if ('cx' in b.dataset) { expanded[c.id] = !expanded[c.id]; render(ctx); return; }
      if ('cedit' in b.dataset) { openClient(ctx, c); return; }
      if ('cdel' in b.dataset) {
        UI.confirmBox('确定删除该客户？会一并删除其项目/跟进/收入。').then(function (ok) {
          if (ok) {
            ensureMod(ctx).remove(c.id);
            delete expanded[c.id];
            render(ctx);
            UI.toast('客户已删除', null, { label: '撤销', onClick: function () {
              store.undoRemove();
              render(ctx);
            } });
          }
        });
        return;
      }
      if ('spadd' in b.dataset) { openPrj(ctx, c.id); return; }
      if ('fuadd' in b.dataset) { openFollowup(ctx, c.id); return; }
      if ('inadd' in b.dataset) { openIncome(ctx, c.id); return; }
      var pr = c.projects.find(function (x) { return x.id === id; });
      var f = c.followups.find(function (x) { return x.id === id; });
      var inc = c.income.find(function (x) { return x.id === id; });
      if ('pe' in b.dataset) { openPrj(ctx, c.id, pr); return; }
      if ('pd' in b.dataset) {
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
        return;
      }
      if ('fe' in b.dataset) { openFollowup(ctx, c.id, f); return; }
      if ('fd' in b.dataset) {
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
        return;
      }
      if ('ie' in b.dataset) { openIncome(ctx, c.id, inc); return; }
      if ('idel' in b.dataset) {
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
      }
    });
    container.addEventListener('change', function (e) {
      var b = e.target.closest && e.target.closest('[data-fcheck]');
      if (!b) return;
      var card = b.closest('[data-client]');
      var c = card && store.state.clients.filter(function (x) { return x.id === card.dataset.client; })[0];
      if (!c) return;
      store.updateClientFollowup(c.id, b.closest('.cs-item').dataset.id, { done: b.checked });
      render(ctx);
    });
  }

  Pages.consulting = {
    title: '咨询工作',
    render: function (container, ctx) { currentEl = container; currentCtx = ctx; bindDelegated(ctx); render(ctx); },
    add: function (ctx) { openClient(ctx); }
  };

  /* 数据变更自动重绘（EventBridge）：客户/设置变更时仅当前路由为本页才刷新
   * /data/clients 订阅保留：addClient 等领域 API 仍可能被外部调用方写入，bus 兜底重绘（双写路径并存）；
   * unsubscribe 保存（模块销毁清理契约，当前页面常驻） */
  (function () {
    var bus = globalThis.SonderBus && globalThis.SonderBus.bus;
    if (!bus) return;
    ['/data/clients', '/data/settings', '/data/all'].forEach(function (p) {
      var off = bus.on(p, function () {
        if (currentEl && currentCtx && routeIs()) render(currentCtx);
      });
      unsubs.push(off);
    });
  })();
})();
