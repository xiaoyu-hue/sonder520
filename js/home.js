/* home.js - 首页总览（现代化卡片版本） */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var S = window.SonderStore;
  var currentEl = null, currentCtx = null;

  function greeting() {
    var h = new Date().getHours();
    if (h < 6) return '夜深了，注意休息';
    if (h < 12) return '早上好，开始今天吧';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  function render(container, ctx) {
    var UI = ctx.UI, store = ctx.store;
    currentEl = container; currentCtx = ctx;
    var sum = store.summarize();
    var day = S.todayStr();
    
    /* 每日金句 */
    var ex = S.dailyExcerpt(store.state.excerpts, day);
    var quote = (window.SonderQuotes && typeof window.SonderQuotes.quoteOfDay === 'function')
      ? UI.esc(window.SonderQuotes.quoteOfDay(day))
      : '';
    var quoteHtml;
    if (ex) {
      quoteHtml = '<div class="quote-card">「' + UI.esc(ex.text) + '」<span class="quote-from">—— 来自《' + UI.esc(ex.bookTitle) + '》' +
        (ex.page ? ' 第' + UI.esc(ex.page) + '页' : '') + '</span></div>';
    } else {
      quoteHtml = quote ? '<div class="quote-card">「' + quote + '」</div>' : '';
    }
    
    var g = S.groupTasks(store.state.tasks, day);
    var todayList = g.now.slice(0, 6);

    var taskInner = todayList.length
      ? todayList.map(function (t) {
        return '<div class="stat-row" style="padding:4px 0" data-tid="' + t.id + '">' +
          '<input type="checkbox" class="hm-done" ' + (t.done ? 'checked' : '') + '>' +
          '<span class="grow ' + (t.done ? 'done' : '') + '">' + UI.esc(t.title) + '</span></div>';
      }).join('')
      : '<div class="muted small">今天暂无待办，去"今日计划"安排吧</div>';

    var memos = store.state.memos.filter(function (m) { return !m.archived; });
    var lastMemo = memos.length ? memos[0].text : '暂无备忘';

    /* 使用现代化卡片布局 */
    container.innerHTML = [
      '<div class="section-title" style="margin-top:0">' + UI.esc(greeting()) + '</div>',
      quoteHtml,
      '<div class="grid-cards cols-2">',
        /* 今日计划卡片 */
        '<div class="main-card card-animate-in">',
          '<div class="card-header">',
            '<div class="card-header-left">',
              '<div class="card-icon">📋</div>',
              '<div>',
                '<div class="card-title">今日计划</div>',
                '<div class="card-subtitle">待办 ' + sum.tasks.current + ' · 已完成 ' + sum.tasks.doneToday + ' · 过期 ' + sum.tasks.overdue + '</div>',
              '</div>',
            '</div>',
          '</div>',
          '<div class="card-body">',
            taskInner,
            '<div style="margin-top:16px"><button class="btn" data-go="today">进入今日计划 →</button></div>',
          '</div>',
        '</div>',
        
        /* 快速备忘卡片 */
        '<div class="main-card card-animate-in">',
          '<div class="card-header">',
            '<div class="card-header-left">',
              '<div class="card-icon">📝</div>',
              '<div><div class="card-title">快速备忘</div></div>',
            '</div>',
          '</div>',
          '<div class="card-body">',
            '<textarea id="hmMemo" placeholder="随手记点什么…" style="width:100%;height:80px;margin-bottom:12px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--glass-2);color:var(--text);font-family:inherit;resize:none"></textarea>',
            '<div style="display:flex;gap:8px;flex-wrap:wrap">',
              '<button class="btn primary" id="hmSave">保存备忘</button>',
              '<button class="btn" data-go="memo">全部备忘 →</button>',
            '</div>',
            '<div class="muted small" style="margin-top:16px">最近一条</div>',
            '<div class="notes-area" style="margin-top:8px;padding:12px;background:var(--glass);border-radius:8px;">' + UI.esc(lastMemo) + '</div>',
          '</div>',
        '</div>',
      '</div>',
      
      '<div class="section-title" style="margin-top:24px">各模块概览</div>',
      '<div class="grid-cards cols-4">',
        moduleCard(UI, 'selfmedia', sum.selfmedia.total, '自媒体', '待发布 ' + sum.selfmedia.pending, '📱'),
        moduleCard(UI, 'dev', sum.dev.total, '开发工作', '进行中 ' + sum.dev.active, '💻'),
        moduleCard(UI, 'consulting', sum.consulting.total, '咨询工作', '待跟进 ' + sum.consulting.followups, '🎯'),
        moduleCard(UI, 'reading', sum.reading.total, '阅读计划', '在读 ' + sum.reading.reading, '📚'),
        moduleCard(UI, 'news', sum.news.total, '看新闻计划', '待读 ' + sum.news.unread, '📰'),
        moduleCard(UI, 'design', sum.design.total, '设计计划', '进行中 ' + sum.design.active, '🎨'),
        moduleCard(UI, 'game', sum.game.total, '娱乐游戏', '胜 ' + sum.game.wins + ' · 平 ' + sum.game.draws, '🎮'),
        '<div class="module-card card-animate-in" data-go="home" style="opacity:0.6;cursor:default">',
          '<div class="module-icon">✨</div>',
          '<div class="module-title">更多功能</div>',
          '<div class="module-desc">持续更新中...</div>',
        '</div>',
      '</div>'
    ].join('');

    /* 事件绑定 */
    container.querySelector('#hmSave').addEventListener('click', function () {
      var v = container.querySelector('#hmMemo').value;
      if (!String(v).trim()) { UI.toast('请输入内容', 'err'); return; }
      store.addMemo(v);
      container.querySelector('#hmMemo').value = '';
      UI.toast('已保存备忘');
      render(container, ctx);
    });
    
    container.querySelectorAll('.hm-done').forEach(function (c) {
      c.addEventListener('change', function () {
        store.updateTask(c.closest('[data-tid]').dataset.tid, { done: c.checked });
        render(container, ctx);
      });
    });
    
    container.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { ctx.navigate(b.dataset.go); });
    });
  }

  function moduleCard(UI, go, num, lab, sub, icon) {
    return '<div class="module-card card-animate-in" data-go="' + go + '">'+
      '<div class="module-icon">' + icon + '</div>'+
      '<div class="module-title">' + UI.esc(lab) + '</div>'+
      '<div class="module-desc">' + UI.esc(sub) + '</div>'+
      '<div class="module-stats">'+
        '<div class="module-stat">'+
          '<div class="module-stat-num">' + num + '</div>'+
          '<div class="module-stat-label">总计</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }

  Pages.home = { title: '首页总览', render: render };

  /* 数据变更自动重绘 */
  (function () {
    var bus = globalThis.SonderBus && globalThis.SonderBus.bus;
    if (!bus) return;
    bus.on('/data/*', function () {
      var h = (location.hash || '').replace(/^#\/?/, '');
      var clean = h.split('/')[0];
      if (currentEl && currentCtx && (clean === '' || clean === 'home')) {
        render(currentEl, currentCtx);
      }
    });
  })();
})();