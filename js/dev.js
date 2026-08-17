/* dev.js - 开发工作：项目/任务/进度 + 技术笔记(Markdown) + 代码片段(一键复制)
 * 已迁移至标准模块工厂（Sonder-Frame v0.1.2，试点三）——协议见 docs/adr/ADR-011：
 * 文件不改名不换位、Pages/DOM/store API 契约零变更、数据写同一 state 集合；
 * 项目(prepend)/笔记/片段为三个工厂模块；嵌套任务属内嵌数组局部操作，留 store 领域 API（嵌套不进工厂）；
 * 卡内按钮统一容器委托绑定（data-* 回查 state）；删除撤销不对称（项目/笔记可撤销、任务/片段无）为历史行为保留。
 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var S = window.SonderStore;
  var MD = window.SonderMarkdown;
  var currentEl = null, currentCtx = null;
  var tabState = 'projects';
  var modP = null, modN = null, modS = null;
  var unsubs = [];
  var delegatedBound = false;

  function routeIs() {
    return (location.hash || '').replace(/^#\/?/, '').split('/')[0] === 'dev';
  }

  /* 三个工厂模块配置：id 对应 state 同名集合（与 store.addDevProject 等同一集合）
   * devProjects: prepend 对齐 addDevProject 的 unshift（最新在前）；tasks 声明 array 仅作默认保底，内部操作不经工厂
   * devNotes/devSnippets: 未配 timeField——工厂默认 createdAt/updatedAt，编辑自动刷新 updatedAt（排序置顶依赖它） */
  /** @type {SonderModuleConfig} */
  var CONFIG_P = {
    id: 'devProjects', displayName: '开发项目', storageKey: 'sonder_data_v1', schemaVersion: 1, prepend: true,
    fields: [
      { key: 'name', type: 'text', label: '项目名', required: true },
      { key: 'note', type: 'textarea', label: '说明' },
      { key: 'tasks', type: 'array', label: '任务清单' }
    ]
  };
  /** @type {SonderModuleConfig} */
  var CONFIG_N = {
    id: 'devNotes', displayName: '技术笔记', storageKey: 'sonder_data_v1', schemaVersion: 1,
    fields: [
      { key: 'title', type: 'text', label: '标题', required: true },
      { key: 'content', type: 'textarea', label: '内容' }
    ]
  };
  /** @type {SonderModuleConfig} */
  var CONFIG_S = {
    id: 'devSnippets', displayName: '代码片段', storageKey: 'sonder_data_v1', schemaVersion: 1,
    fields: [
      { key: 'title', type: 'text', label: '名称', required: true },
      { key: 'code', type: 'textarea', label: '代码' }
    ]
  };

  function ensureMods(ctx) {
    if (!modP) {
      modP = globalThis.SonderModuleFactory.createModule(ctx.store, CONFIG_P);
      modN = globalThis.SonderModuleFactory.createModule(ctx.store, CONFIG_N);
      modS = globalThis.SonderModuleFactory.createModule(ctx.store, CONFIG_S);
      /* 工厂操作（add/update/remove）完成即统一重绘（仅当前路由为本页） */
      [modP, modN, modS].forEach(function (m) {
        m.render(function () { if (currentEl && currentCtx && routeIs()) render(currentCtx); });
      });
    }
    return modP;
  }

  function render(ctx) {
    var container = currentEl, UI = ctx.UI;
    container.innerHTML = '';
    container.appendChild(UI.el(
      '<div class="hbar">' +
      '<div class="lg-seg">' +
      '<button data-tab="projects" type="button"' + (tabState === 'projects' ? ' class="on"' : '') + '>项目</button>' +
      '<button data-tab="notes" type="button"' + (tabState === 'notes' ? ' class="on"' : '') + '>技术笔记</button>' +
      '<button data-tab="snippets" type="button"' + (tabState === 'snippets' ? ' class="on"' : '') + '>代码片段</button>' +
      '</div>' +
      '<span class="sp"></span>' +
      (tabState === 'projects' ? '<button class="btn primary" id="devAdd">＋ 新建项目</button>' : '') +
      '</div>'
    ));
    container.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () {
        tabState = b.dataset.tab;
        render(ctx);
      });
    });
    if (tabState === 'projects') projectsSection(ctx);
    else if (tabState === 'notes') notesSection(ctx);
    else snippetsSection(ctx);
    bindDelegated(ctx);
  }

  function findById(list, id) {
    var t = list.find(function (x) { return x.id === id; });
    return t || null;
  }

  /* 卡内按钮统一容器委托：编辑/删除/复制经 data-* 回查 state（target 为临时对象不可靠） */
  function bindDelegated(ctx) {
    var container = currentEl, store = ctx.store, UI = ctx.UI;
    if (delegatedBound) return; /* 常驻容器只绑一次，防监听累积（每 render 重建的元素无需处理） */
    delegatedBound = true;
    container.addEventListener('change', function (e) {
      var c = e.target.closest && e.target.closest('[data-tcheck]');
      if (!c) return;
      var row = c.closest('[data-task]'), card = c.closest('[data-proj]');
      var proj = card && findById(store.state.devProjects, card.dataset.proj);
      if (proj) store.updateDevTask(proj.id, row.dataset.task, { done: c.checked });
    });
    container.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-pinfo],[data-pdel],[data-tadd],[data-tedit],[data-tdel],[data-copy],[data-nedit],[data-ndel],[data-sedit],[data-sdel]');
      if (!b) return;
      if (b.hasAttribute('data-pinfo') || b.hasAttribute('data-pdel')) {
        var proj = b.closest('[data-proj]') && findById(store.state.devProjects, b.closest('[data-proj]').dataset.proj);
        if (!proj) return;
        if (b.hasAttribute('data-pinfo')) openProject(ctx, proj);
        else {
          UI.confirmBox('确定删除整个项目？').then(function (ok) {
            if (ok) {
              ensureMods(ctx);
              modP.remove(proj.id);
              UI.toast('项目已删除', null, { label: '撤销', onClick: function () {
                store.undoRemove();
                render(ctx);
              } });
            }
          });
        }
        return;
      }
      if (b.hasAttribute('data-tadd')) {
        var pc = b.closest('[data-proj]') && findById(store.state.devProjects, b.closest('[data-proj]').dataset.proj);
        if (pc) openTask(ctx, pc.id);
        return;
      }
      if (b.hasAttribute('data-tedit') || b.hasAttribute('data-tdel')) {
        var row = b.closest('[data-task]'), card = b.closest('[data-proj]');
        var pr = card && findById(store.state.devProjects, card.dataset.proj);
        if (!pr) return;
        var t = findById(pr.tasks, row.dataset.task);
        if (b.hasAttribute('data-tedit')) { if (t) openTask(ctx, pr.id, t); }
        else {
          UI.confirmBox('删除这个任务？').then(function (ok) {
            if (ok) store.removeDevTask(pr.id, row.dataset.task);
          });
        }
        return;
      }
      if (b.hasAttribute('data-copy')) {
        var sn = findById(store.state.devSnippets, b.getAttribute('data-copy'));
        if (sn) UI.copyText(sn.code);
        return;
      }
      if (b.hasAttribute('data-nedit')) {
        var n = b.closest('[data-note]') && findById(store.state.devNotes, b.closest('[data-note]').dataset.note);
        if (n) openNote(ctx, n);
        return;
      }
      if (b.hasAttribute('data-ndel')) {
        var nm = b.closest('[data-note]') && findById(store.state.devNotes, b.closest('[data-note]').dataset.note);
        if (!nm) return;
        UI.confirmBox('删除这篇笔记？').then(function (ok) {
          if (ok) {
            ensureMods(ctx);
            modN.remove(nm.id);
            UI.toast('笔记已删除', null, { label: '撤销', onClick: function () {
              store.undoRemove();
              render(ctx);
            } });
          }
        });
        return;
      }
      if (b.hasAttribute('data-sedit')) {
        var sm = b.closest('[data-snip]') && findById(store.state.devSnippets, b.closest('[data-snip]').dataset.snip);
        if (sm) openSnippet(ctx, sm);
        return;
      }
      if (b.hasAttribute('data-sdel')) {
        var sd = b.closest('[data-snip]') && findById(store.state.devSnippets, b.closest('[data-snip]').dataset.snip);
        if (!sd) return;
        UI.confirmBox('删除这个代码片段？').then(function (ok) {
          if (ok) {
            ensureMods(ctx);
            modS.remove(sd.id);
          }
        });
      }
    });
  }

  function projectsSection(ctx) {
    var container = currentEl, store = ctx.store, UI = ctx.UI;
    container.querySelector('#devAdd').addEventListener('click', function () { openProject(ctx); });
    if (!store.state.devProjects.length) {
      container.appendChild(UI.emptyState('还没有开发项目', '＋ 新建项目', function () { openProject(ctx); }));
      return;
    }
    store.state.devProjects.forEach(function (p) { container.appendChild(projectCard(p, ctx)); });
  }

  function openProject(ctx, target) {
    ensureMods(ctx);
    ctx.UI.formModal({
      title: target ? '编辑项目' : '新建项目',
      confirmText: '保存',
      fields: [
        { key: 'name', label: '项目名', type: 'text', required: true, value: target ? target.name : '' },
        { key: 'note', label: '说明', type: 'textarea', value: target ? target.note : '' }
      ],
      onSubmit: function (v) {
        if (target) modP.update(target.id, v);
        else modP.add(v);
        ctx.UI.toast('已保存');
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
    var tasks = (findById(store.state.devProjects, p.id) || { tasks: [] }).tasks;
    var wrap = card.querySelector('[data-taskswrap]');
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
    return card;
  }

  Pages.dev = {
    title: '开发工作',
    render: function (container, ctx) { currentEl = container; currentCtx = ctx; render(ctx); },
    add: function (ctx) { openProject(ctx); }
  };

  /* 数据变更自动重绘（SonderBus EVENT 表）：项目/笔记/片段/设置变更时仅当前路由为本页才刷新
   * （任务增删走 store 领域 API，其 emitChange 亦由此订阅兜底重绘） */
  (function () {
    var bus = globalThis.SonderBus && globalThis.SonderBus.bus;
    var E = globalThis.SonderBus && globalThis.SonderBus.EVENT;
    if (!bus || !E) return;
    [E.data('devProjects'), E.data('devNotes'), E.data('devSnippets'), E.data('settings'), E.DATA_ALL].forEach(function (p) {
      unsubs.push(bus.on(p, function () {
        if (currentEl && currentCtx && routeIs()) render(currentCtx);
      }));
    });
  })();

  /* ---------- 技术笔记（按更新时间倒序，Markdown 渲染） ---------- */
  function notesSection(ctx) {
    var container = currentEl, store = ctx.store, UI = ctx.UI;
    container.appendChild(UI.el(
      '<div class="hbar">' +
      '<span class="muted small">支持 # 标题 · **粗体** · ``` 代码块</span>' +
      '<span class="sp"></span>' +
      '<button class="btn primary" id="devNoteAdd">＋ 新建笔记</button>' +
      '</div>'
    ));
    container.querySelector('#devNoteAdd').addEventListener('click', function () { openNote(ctx); });
    var notes = S.sortNotesByUpdate(store.state.devNotes);
    if (!notes.length) {
      container.appendChild(UI.emptyState('还没有技术笔记', '＋ 新建笔记', function () { openNote(ctx); }));
      return;
    }
    notes.forEach(function (n) { container.appendChild(noteCard(n, ctx)); });
  }

  function noteCard(n, ctx) {
    var UI = ctx.UI;
    var card = UI.el(
      '<div class="card" style="margin-bottom:14px" data-note="' + n.id + '">' +
      '<div class="row">' +
      '<div class="grow"><div class="title" style="font-size:15px">' + UI.esc(n.title) + '</div>' +
      '<div class="sub muted">更新于 ' + UI.esc(String(n.updatedAt || '').slice(0, 16).replace('T', ' ')) + '</div></div>' +
      '<button class="small-btn" data-nedit>编辑</button>' +
      '<button class="small-btn danger" data-ndel>删除</button>' +
      '</div>' +
      '<div class="md-body">' + MD.render(n.content) + '</div>' +
      '</div>'
    );
    return card;
  }

  function openNote(ctx, target) {
    ensureMods(ctx);
    ctx.UI.formModal({
      title: target ? '编辑笔记' : '新建笔记', confirmText: '保存',
      fields: [
        { key: 'title', label: '标题', type: 'text', required: true, value: target ? target.title : '' },
        { key: 'content', label: '内容（Markdown）', type: 'textarea', value: target ? target.content : '', placeholder: '# 标题\n**要点**\n```\ncode\n```' }
      ],
      onSubmit: function (v) {
        if (target) modN.update(target.id, v);
        else modN.add(v);
        ctx.UI.toast('笔记已保存');
        return true;
      }
    });
  }

  /* ---------- 代码片段（一键复制） ---------- */
  function snippetsSection(ctx) {
    var container = currentEl, store = ctx.store, UI = ctx.UI;
    container.appendChild(UI.el(
      '<div class="hbar">' +
      '<span class="muted small">常用命令行 / 代码片段，一键复制</span>' +
      '<span class="sp"></span>' +
      '<button class="btn primary" id="devSnipAdd">＋ 新建片段</button>' +
      '</div>'
    ));
    container.querySelector('#devSnipAdd').addEventListener('click', function () { openSnippet(ctx); });
    var snippets = S.sortNotesByUpdate(store.state.devSnippets);
    if (!snippets.length) {
      container.appendChild(UI.emptyState('还没有代码片段', '＋ 新建片段', function () { openSnippet(ctx); }));
      return;
    }
    snippets.forEach(function (s) { container.appendChild(snippetCard(s, ctx)); });
  }

  function snippetCard(s, ctx) {
    var UI = ctx.UI;
    var card = UI.el(
      '<div class="card" style="margin-bottom:14px" data-snip="' + s.id + '">' +
      '<div class="row">' +
      '<div class="grow"><div class="title" style="font-size:15px">' + UI.esc(s.title) + '</div>' +
      '<div class="sub muted">更新于 ' + UI.esc(String(s.updatedAt || '').slice(0, 16).replace('T', ' ')) + '</div></div>' +
      '<button class="small-btn primary-copy" data-copy="' + s.id + '" aria-label="一键复制代码">一键复制</button>' +
      '<button class="small-btn" data-sedit>编辑</button>' +
      '<button class="small-btn danger" data-sdel>删除</button>' +
      '</div>' +
      '<pre class="md-code"><code>' + UI.esc(s.code) + '</code></pre>' +
      '</div>'
    );
    return card;
  }

  function openSnippet(ctx, target) {
    ensureMods(ctx);
    ctx.UI.formModal({
      title: target ? '编辑片段' : '新建片段', confirmText: '保存',
      fields: [
        { key: 'title', label: '名称', type: 'text', required: true, value: target ? target.title : '' },
        { key: 'code', label: '代码 / 命令', type: 'textarea', required: true, value: target ? target.code : '' }
      ],
      onSubmit: function (v) {
        if (target) modS.update(target.id, v);
        else modS.add(v);
        ctx.UI.toast('片段已保存');
        return true;
      }
    });
  }
})();