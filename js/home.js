/* home.js - 首页总览 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var S = window.SonderStore;

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
    var sum = store.summarize();
    var day = S.todayStr();
    var g = S.groupTasks(store.state.tasks, day);
    var todayList = g.now.slice(0, 6);

    var taskInner = todayList.length
      ? todayList.map(function (t) {
        return '<div class="stat-row" style="padding:4px 0" data-tid="' + t.id + '">' +
          '<input type="checkbox" class="hm-done" ' + (t.done ? 'checked' : '') + '>' +
          '<span class="grow ' + (t.done ? 'done' : '') + '">' + UI.esc(t.title) + '</span></div>';
      }).join('')
      : '<div class="muted small">今天暂无待办，去“今日计划”安排吧</div>';

    var memos = store.state.memos.filter(function (m) { return !m.archived; });
    var lastMemo = memos.length ? memos[0].text : '暂无备忘';

    container.innerHTML = [
      '<div class="section-title" style="margin-top:0">' + UI.esc(greeting()) + '</div>',
      '<div class="grid cols-2">',
      '  <div class="card">',
      '    <div class="row"><div class="section-title" style="margin:0">今日计划</div>',
      '      <span class="muted small">待办 ' + sum.tasks.current + ' · 已完成 ' + sum.tasks.doneToday + ' · 过期 ' + sum.tasks.overdue + '</span></div>',
      '    <div>' + taskInner + '</div>',
      '    <div style="margin-top:12px"><button class="btn" data-go="today">进入今日计划 →</button></div>',
      '  </div>',
      '  <div class="card">',
      '    <div class="section-title" style="margin:0">快速备忘</div>',
      '    <textarea id="hmMemo" placeholder="随手记点什么…" style="width:100%;height:52px;margin-top:10px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--glass-2);color:var(--text);font-family:inherit"></textarea>',
      '    <div style="margin-top:8px"><button class="btn primary" id="hmSave">保存备忘</button>',
      '      <button class="btn" data-go="memo" style="margin-left:8px">全部备忘 →</button></div>',
      '    <div class="muted small" style="margin-top:12px">最近一条</div>',
      '    <div class="notes-area">' + UI.esc(lastMemo) + '</div>',
      '  </div>',
      '</div>',
      '<div class="section-title">各模块概览</div>',
      '<div class="grid cols-6">',
      rankCard('selfmedia', sum.selfmedia.total, '自媒体', '待发布 ' + sum.selfmedia.pending) +
      rankCard('dev', sum.dev.total, '开发工作', '进行中 ' + sum.dev.active) +
      rankCard('consulting', sum.consulting.total, '咨询工作', '待跟进 ' + sum.consulting.followups) +
      rankCard('reading', sum.reading.total, '阅读计划', '在读 ' + sum.reading.reading) +
      rankCard('news', sum.news.total, '看新闻计划', '待读 ' + sum.news.unread) +
      rankCard('design', sum.design.total, '设计计划', '进行中 ' + sum.design.active),
      '</div>'
    ].join('');

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

  function rankCard(go, num, lab, sub) {
    return '<div class="rank-card" data-go="' + go + '"><div class="num">' + window.UI.esc(num) + '</div>' +
      '<div class="lab">' + window.UI.esc(lab) + '</div><div class="sub">' + window.UI.esc(sub) + '</div></div>';
  }

  Pages.home = { title: '首页总览', render: render };
})();