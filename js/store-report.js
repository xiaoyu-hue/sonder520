/* store-report.js - SonderStore 领域扩展：统计汇总 + 本周周报
 * 职责：Store.prototype.summarize / buildWeeklyReport（原位于 store.js，独立成层缩小核心体积）。
 * 浏览器：在 store.js 之后加载（注入 root.SonderStore.Store 与 root.SonderStats）
 * Node：由 store.js 在 UMD 分支 require 并注入 (Store, Stats)
 * 计算全部委托 store-stats.js 纯函数，不引用 store.js 闭包内任何变量。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else factory(root.SonderStore.Store, root.SonderStats);
})(typeof self !== 'undefined' ? self : this, function (Store, Stats) {
  'use strict';

  /* ====== 统计汇总（首页 + 数据页） ====== */
  Store.prototype.summarize = function () {
    var st = this.state;
    var tasksAll = st.tasks;
    var grouped = Stats.groupTasks(tasksAll, Stats.todayStr());
    var today = Stats.todayStr();
    var doneToday = tasksAll.filter(function (t) {
      if (!t.done || !t.doneAt) return false;
      return Stats.fmtDate(new Date(t.doneAt)) === today;
    }).length;
    var posts = st.posts;
    var pendingFollowups = 0;
    st.clients.forEach(function (c) { c.followups.forEach(function (f) { if (!f.done) pendingFollowups++; }); });
    return {
      date: Stats.todayStr(),
      tasks: {
        total: tasksAll.length,
        doneToday: doneToday,
        remaining: grouped.now.length + grouped.overdue.length + grouped.upcoming.length,
        current: grouped.now.length,
        overdue: grouped.overdue.length
      },
      selfmedia: { total: posts.length, pending: Stats.filterPosts(posts, { status: 'queue' }).length + Stats.filterPosts(posts, { status: 'draft' }).length },
      dev: { total: st.devProjects.length, active: st.devProjects.filter(function (p) { return Stats.devProgress(p).percent < 100; }).length },
      consulting: { total: st.clients.length, followups: pendingFollowups },
      reading: { total: st.books.length, reading: st.books.filter(function (b) { return b.status === '在读'; }).length },
      news: { total: st.news.length, unread: st.news.filter(function (n) { return n.status !== 'read'; }).length },
      design: { total: st.designs.length, active: st.designs.filter(function (x) { return x.type === 'project' && x.stage !== '定稿'; }).length },
      game: {
        total: st.gameRecords.length,
        wins: st.gameRecords.filter(function (r) { return r.winner !== 'draw' && r.winner === r.player; }).length,
        draws: st.gameRecords.filter(function (r) { return r.winner === 'draw'; }).length
      }
    };
  };

  /* ====== 本周周报（周一 ~ 周日） ====== */
  Store.prototype.buildWeeklyReport = function (now) {
    var st = this.state;
    var d = now ? new Date(now) : new Date();
    var dw = d.getDay();
    var offset = dw === 0 ? -6 : 1 - dw;
    var mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
    var keyOf = function (x) {
      return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    };
    var startKey = keyOf(mon);
    var end = new Date(mon);
    end.setDate(end.getDate() + 7);
    var endKey = keyOf(end);
    var inWeek = function (k) { return k >= startKey && k < endKey; };
    var weekKey = function (v) { return String(v || '').slice(0, 10); };

    var tasksTotal = 0, tasksDone = 0;
    st.tasks.forEach(function (t) {
      if (inWeek(weekKey(t.date))) { tasksTotal++; if (t.done) tasksDone++; }
    });
    var readingMinutes = 0;
    (st.books || []).forEach(function (b) {
      var log = b.readingLog || [];
      if (Array.isArray(log)) {
        /* 会话日志形态：[{date, minutes}]，同日多条逐条累加 */
        log.forEach(function (s) {
          if (s && s.date && inWeek(weekKey(s.date))) readingMinutes += (Number(s.minutes) || 0);
        });
      } else {
        /* 兼容旧对象形态 {dateKey: minutes} */
        Object.keys(log).forEach(function (k) { if (inWeek(k)) readingMinutes += log[k]; });
      }
    });
    var memos = 0;
    (st.memos || []).forEach(function (m) {
      if (inWeek(weekKey(m.time))) memos++;
    });
    var topics = 0;
    (st.posts || []).forEach(function (p) {
      if (inWeek(weekKey(p.publishDate || p.date || p.createdAt))) topics++;
    });
    var rate = tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0;
    var endIncl = keyOf(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6));
    var text = [
      '本周周报（' + startKey + ' ~ ' + endIncl + '）',
      '',
      '• 本周计划任务 ' + tasksTotal + ' 条，完成 ' + tasksDone + ' 条（完成率 ' + rate + '%）',
      '• 阅读 ' + readingMinutes + ' 分钟',
      '• 随手记 ' + memos + ' 条',
      '• 新增自媒体选题 ' + topics + ' 个',
      '',
      '—— Sonder 自动生成'
    ].join('\n');
    return {
      start: startKey, end: endIncl, tasksTotal: tasksTotal, tasksDone: tasksDone,
      rate: rate, readingMinutes: readingMinutes, memos: memos, topics: topics, text: text
    };
  };
});