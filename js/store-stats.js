/* store-stats.js - SonderStore 纯函数统计/聚合层（无 Store 依赖）
 * 职责：任务分组、自媒体/开发/阅读等模块的纯计算函数与常量
 *      （原位于 store.js，为缩小其体积独立成层，行为与导出键名完全一致）。
 * 浏览器：在 store.js 之前加载，暴露 window.SonderStats
 * Node：module.exports 返回同一对象（store.js 与 store-report.js 均经由它引用）
 * 自包含迷你工具（fmtDate/todayStr/clone/num0/hashStr）：与 store.js 核心闭包解耦，
 * 行为与核心同名实现保持一致（不得与 store.js 内部版本产生分歧）。 */
(function (root) {
  'use strict';

  function fmtDate(d) {
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function todayStr() { return fmtDate(new Date()); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function num0(v) { var n = Number(v); return isNaN(n) ? 0 : Math.max(0, n); }
  /* 字符串哈希（djb2 变体）：供每日金句等按日期种子稳定取数 */
  function hashStr(s) {
    var h = 5381, i;
    for (i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
    return Math.abs(h);
  }

  /* ---- 任务分组：today 形如 'YYYY-MM-DD' ---- */
  function groupTasks(tasks, today) {
    today = today || todayStr();
    var nowList = [], overdue = [], upcoming = [], done = [];
    tasks.forEach(function (t) {
      if (t.done) { done.push(clone(t)); return; }
      var d = t.date || today;
      if (d < today) overdue.push(clone(t));
      else if (d === today) nowList.push(clone(t));
      else upcoming.push(clone(t));
    });
    nowList.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    overdue.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    upcoming.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    done.sort(function (a, b) { return (a.doneAt || '') > (b.doneAt || '') ? -1 : 1; });
    return { now: nowList, overdue: overdue, upcoming: upcoming, done: done };
  }

  /* 今日完成率：统计日期为 today 的任务完成占比（供今日计划环形进度条） */
  function todayProgress(tasks, today) {
    today = today || todayStr();
    var list = tasks.filter(function (t) { return String(t.date || today) === today; });
    var done = list.filter(function (t) { return t.done; }).length;
    return { done: done, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
  }

  /* ---- 自媒体 ---- */
  var STAT_FIELDS = ['views', 'likes', 'comments', 'favorites'];
  function filterPosts(posts, opts) {
    opts = opts || {};
    var tag = opts.tag, status = opts.status;
    return posts.filter(function (p) {
      if (tag && p.tags.indexOf(tag) < 0) return false;
      if (status && p.status !== status) return false;
      return true;
    }).map(clone);
  }
  function collectTags(posts) {
    var set = {};
    posts.forEach(function (p) { p.tags.forEach(function (t) { set[t] = true; }); });
    return Object.keys(set).sort();
  }
  /* 已发布内容的统计数据汇总（供图表）。只统计 status === 'published'。 */
  function publishedStats(posts) {
    var published = posts.filter(function (p) { return p.status === 'published'; }).map(function (p) {
      return {
        id: p.id, title: p.title,
        views: num0(p.views), likes: num0(p.likes),
        comments: num0(p.comments), favorites: num0(p.favorites)
      };
    });
    var sums = { views: 0, likes: 0, comments: 0, favorites: 0 };
    var max = { views: 0, likes: 0, comments: 0, favorites: 0 };
    published.forEach(function (p) {
      STAT_FIELDS.forEach(function (f) { sums[f] += p[f]; if (p[f] > max[f]) max[f] = p[f]; });
    });
    var sorted = published.slice().sort(function (a, b) { return b.views - a.views; });
    return { count: published.length, sums: sums, max: max, posts: sorted };
  }
  /* 最近 N 篇已发布选题（按发布日倒序，无发布日按创建时间），供折线图 */
  function recentPublished(posts, n) {
    n = (typeof n === 'number' && n > 0) ? n : 5;
    var pub = posts.filter(function (p) { return p.status === 'published'; })
      .map(function (p) {
        return { id: p.id, title: p.title, views: num0(p.views), likes: num0(p.likes), publishDate: p.publishDate || '', createdAt: p.createdAt || '' };
      });
    pub.sort(function (a, b) {
      var ka = a.publishDate || String(a.createdAt || '').slice(0, 10);
      var kb = b.publishDate || String(b.createdAt || '').slice(0, 10);
      return ka > kb ? -1 : (ka < kb ? 1 : 0);
    });
    return pub.slice(0, n);
  }

  /* 导出 CSV - 含字段转义 */
  function toCSV(posts) {
    var header = ['标题', '平台', '账号', '标签', '状态', '发布日期', '备注'];
    var rows = [header];
    posts.forEach(function (p) {
      rows.push([
        p.title, p.platform, p.account, p.tags.join(' | '),
        p.status, p.publishDate || '', p.note || ''
      ]);
    });
    function esc(v) {
      v = String(v === null || v === undefined ? '' : v);
      /* 防公式注入：以 = + - @ 开头的字段在 Excel/WPS 会被当公式执行，前置单引号转为文本 */
      if (/^[=+\-@]/.test(v)) v = "'" + v;
      if (/[",\r\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }
    return rows.map(function (row) {
      return row.map(esc).join(',');
    }).join('\n');
  }

  /* ---- 开发工作 ---- */
  function devProgress(p) {
    var total = p.tasks.length;
    var done = p.tasks.filter(function (t) { return t.done; }).length;
    return { total: total, done: done, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  function sortNotesByUpdate(items) {
    return items.slice().sort(function (a, b) {
      var ka = a.updatedAt || a.createdAt || '';
      var kb = b.updatedAt || b.createdAt || '';
      return ka > kb ? -1 : (ka < kb ? 1 : 0);
    });
  }

  /* ---- 阅读 / 书摘 ---- */
  function excerptsByBook(excerpts) {
    var byTime = function (a, b) { return a.time < b.time ? 1 : (a.time > b.time ? -1 : 0); };
    var groups = [];
    excerpts.slice().sort(byTime).forEach(function (x) {
      var g = null;
      for (var i = 0; i < groups.length; i++) if (groups[i].bookId === x.bookId) { g = groups[i]; break; }
      if (!g) {
        g = { bookId: x.bookId, bookTitle: x.bookTitle || '未知书籍', items: [] };
        groups.push(g);
      }
      g.items.push({ id: x.id, text: x.text, page: x.page, time: x.time });
    });
    return groups;
  }
  /* 首页「每日金句」位置：有摘抄时按日期种子随机挑一条（当天稳定、隔天换新）；无摘抄返回 null */
  function dailyExcerpt(excerpts, dateStr) {
    if (!Array.isArray(excerpts) || !excerpts.length) return null;
    var sorted = excerpts.slice().sort(function (a, b) { return a.time < b.time ? -1 : (a.time > b.time ? 1 : 0); });
    var d = String(dateStr || todayStr());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) d = todayStr();
    var x = sorted[hashStr(d + '|excerpt') % sorted.length];
    return { text: x.text, bookTitle: x.bookTitle || '未知书籍', page: num0(x.page) };
  }
  function booksByStatus(books) {
    var out = { '想读': [], '在读': [], '已读完': [] };
    books.forEach(function (b) {
      var key = b.status in out ? b.status : '想读';
      out[key].push(clone(b));
    });
    return out;
  }

  /* 阅读统计：书籍总数 + 按状态分布 + 阅读进度区间分布 */
  var PROG_BUCKETS = [
    { label: '未开始', min: 0, max: 0, color: '#a8a297' },
    { label: '前期 1-33%', min: 1, max: 33, color: '#b0723f' },
    { label: '中期 34-66%', min: 34, max: 66, color: '#3b4a6b' },
    { label: '后期 67-99%', min: 67, max: 99, color: '#7a5e9e' },
    { label: '已完成 100%', min: 100, max: 100, color: '#2e7d63' }
  ];
  function readingStats(books) {
    var want = 0, reading = 0, finished = 0, readingSum = 0, progressSum = 0;
    var buckets = PROG_BUCKETS.map(function () { return 0; });
    books.forEach(function (b) {
      var pr = Number(b.progress);
      if (isNaN(pr)) pr = 0;
      progressSum += pr;
      if (b.status === '已读完') finished++;
      else if (b.status === '在读') { reading += 1; readingSum += pr; }
      else want++;
      var bi = 0;
      for (var i = PROG_BUCKETS.length - 1; i >= 0; i--) {
        if (pr >= PROG_BUCKETS[i].min) { bi = i; break; }
      }
      buckets[bi]++;
    });
    var statusArr = [
      { label: '想读', count: want, color: '#a8a297' },
      { label: '在读', count: reading, color: '#3b4a6b' },
      { label: '已读完', count: finished, color: '#2e7d63' }
    ].filter(function (s) { return s.count > 0; });
    return {
      total: books.length,
      want: want, reading: reading, finished: finished,
      avgReading: reading ? Math.round(readingSum / reading) : 0,
      avgAll: books.length ? Math.round(progressSum / books.length) : 0,
      byStatus: statusArr,
      buckets: PROG_BUCKETS.map(function (b, i) { return { label: b.label, color: b.color, count: buckets[i] }; })
    };
  }

  var moduleKeysList = [{ key: 'today', label: '今日计划' }, { key: 'memo', label: '快速备忘' }, { key: 'selfmedia', label: '自媒体' }, { key: 'dev', label: '开发工作' }, { key: 'consulting', label: '咨询工作' }, { key: 'reading', label: '阅读计划' }, { key: 'news', label: '看新闻计划' }, { key: 'design', label: '设计计划' }, { key: 'game', label: '娱乐游戏' }];

  var api = {
    fmtDate: fmtDate,
    todayStr: todayStr,
    num0: num0,
    hashStr: hashStr,
    groupTasks: groupTasks,
    todayProgress: todayProgress,
    STAT_FIELDS: STAT_FIELDS,
    filterPosts: filterPosts,
    collectTags: collectTags,
    publishedStats: publishedStats,
    recentPublished: recentPublished,
    toCSV: toCSV,
    devProgress: devProgress,
    sortNotesByUpdate: sortNotesByUpdate,
    excerptsByBook: excerptsByBook,
    dailyExcerpt: dailyExcerpt,
    booksByStatus: booksByStatus,
    PROG_BUCKETS: PROG_BUCKETS,
    readingStats: readingStats,
    moduleKeysList: moduleKeysList
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SonderStats = api;
})(typeof self !== 'undefined' ? self : this);