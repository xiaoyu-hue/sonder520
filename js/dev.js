/* dev.js - 开发工作：项目/任务/进度 + 技术笔记(Markdown) + 代码片段(一键复制) */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var S = window.SonderStore;
  var MD = window.SonderMarkdown;
  var currentEl = null;
  var tabState = 'projects';

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
        if (ok) {
          store.removeDevProject(p.id);
          render(ctx);
          ctx.UI.toast('项目已删除', null, { label: '撤销', onClick: function () {
            store.undoRemove();
            render(ctx);
          } });
        }
      });
    });
    bindTaskButtons();
    return card;
  }

  Pages.dev = {
    title: '开发工作',
    render: function (container, ctx) { currentEl = container; render(ctx); },
    add: function (ctx) { openProject(ctx); }
  };

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
    var UI = ctx.UI, store = ctx.store;
    var card = UI.el(
      '<div class="card" style="margin-bottom:14px">' +
      '<div class="row">' +
      '<div class="grow"><div class="title" style="font-size:15px">' + UI.esc(n.title) + '</div>' +
      '<div class="sub muted">更新于 ' + UI.esc(String(n.updatedAt || '').slice(0, 16).replace('T', ' ')) + '</div></div>' +
      '<button class="small-btn" data-nedit>编辑</button>' +
      '<button class="small-btn danger" data-ndel>删除</button>' +
      '</div>' +
      '<div class="md-body">' + MD.render(n.content) + '</div>' +
      '</div>'
    );
    card.querySelector('[data-nedit]').onclick = function () { openNote(ctx, n); };
    card.querySelector('[data-ndel]').onclick = function () {
      ctx.UI.confirmBox('删除这篇笔记？').then(function (ok) {
        if (ok) {
          store.removeDevNote(n.id);
          render(ctx);
          ctx.UI.toast('笔记已删除', null, { label: '撤销', onClick: function () {
            store.undoRemove();
            render(ctx);
          } });
        }
      });
    };
    return card;
  }

  function openNote(ctx, target) {
    ctx.UI.formModal({
      title: target ? '编辑笔记' : '新建笔记', confirmText: '保存',
      fields: [
        { key: 'title', label: '标题', type: 'text', required: true, value: target ? target.title : '' },
        { key: 'content', label: '内容（Markdown）', type: 'textarea', value: target ? target.content : '', placeholder: '# 标题\n**要点**\n```\ncode\n```' }
      ],
      onSubmit: function (v) {
        if (target) ctx.store.updateDevNote(target.id, v);
        else ctx.store.addDevNote(v);
        ctx.UI.toast('笔记已保存');
        render(ctx);
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
    var UI = ctx.UI, store = ctx.store;
    var card = UI.el(
      '<div class="card" style="margin-bottom:14px">' +
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
    card.querySelector('[data-copy]').onclick = function () {
      copyText(ctx, s.code);
    };
    card.querySelector('[data-sedit]').onclick = function () { openSnippet(ctx, s); };
    card.querySelector('[data-sdel]').onclick = function () {
      ctx.UI.confirmBox('删除这个代码片段？').then(function (ok) {
        if (ok) { store.removeDevSnippet(s.id); render(ctx); }
      });
    };
    return card;
  }

  function openSnippet(ctx, target) {
    ctx.UI.formModal({
      title: target ? '编辑片段' : '新建片段', confirmText: '保存',
      fields: [
        { key: 'title', label: '名称', type: 'text', required: true, value: target ? target.title : '' },
        { key: 'code', label: '代码 / 命令', type: 'textarea', required: true, value: target ? target.code : '' }
      ],
      onSubmit: function (v) {
        if (target) ctx.store.updateDevSnippet(target.id, v);
        else ctx.store.addDevSnippet(v);
        ctx.UI.toast('片段已保存');
        render(ctx);
        return true;
      }
    });
  }

  /* 一键复制：Clipboard API 优先，execCommand 兜底 */
  function copyText(ctx, text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;top:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); ctx.UI.toast('已复制'); } catch (e) { ctx.UI.toast('复制失败，请手动选择', 'err'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(function () {
        ctx.UI.toast('已复制');
      }).catch(fallback);
      return;
    }
    fallback();
  }
})();