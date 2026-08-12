/* search.js - 全局搜索：实时模糊匹配全模块数据，分组展示，点击跳转并高亮条目 */
(function () {
  'use strict';

  var input = /** @type {HTMLInputElement|null} */ (document.getElementById('globalSearch'));
  var panel = document.getElementById('gsearchPanel');
  var UI = window.UI;
  var NAV_MODULE = { today: 'today', memo: 'memo', selfmedia: 'selfmedia', dev: 'dev', consulting: 'consulting', reading: 'reading', excerpts: 'excerpts', news: 'news', design: 'design', game: 'game' };
  var GAME_KIND = { guessnum: '猜数字', minesweeper: '扫雷', idiom: '猜成语', brainteaser: '脑筋急转弯', ttt: '井字棋', gomoku: '五子棋' };

  function shortTime(t) {
    if (!t) return '';
    var d = new Date(t);
    if (isNaN(d.getTime())) return '';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getMonth() + 1 + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* 构建全模块索引：{ module, label, id, text, sub } */
  function buildIndex(store) {
    var s = store.state, out = [];
    s.tasks.forEach(function (t) {
      out.push({ module: 'today', label: '今日计划', id: t.id, text: t.title + ' ' + (t.note || ''), sub: t.done ? '已完成' : t.priority ? t.priority + ' 优先级' : '' });
    });
    (s.memos || []).forEach(function (m) {
      out.push({ module: 'memo', label: '快速备忘', id: m.id, text: m.text, sub: shortTime(m.time) });
    });
    s.posts.forEach(function (p) {
      out.push({ module: 'selfmedia', label: '自媒体', id: p.id, text: p.title + ' ' + (p.tags || []).join(' '), sub: p.status || '' });
    });
    s.devProjects.forEach(function (p) {
      out.push({ module: 'dev', label: '开发工作', id: p.id, text: p.name + ' ' + (p.note || ''), sub: p.name });
      (p.tasks || []).forEach(function (t) {
        out.push({ module: 'dev', label: '开发工作', id: t.id, text: t.title + ' ' + (t.note || ''), sub: p.name + ' · ' + t.title });
      });
    });
    s.clients.forEach(function (c) {
      out.push({ module: 'consulting', label: '咨询工作', id: c.id, text: c.name + ' ' + (c.note || ''), sub: c.note || '' });
    });
    s.books.forEach(function (b) {
      out.push({ module: 'reading', label: '阅读计划', id: b.id, text: b.title + ' ' + (b.author || ''), sub: b.author || '' });
    });
    s.news.forEach(function (n) {
      out.push({ module: 'news', label: '看新闻计划', id: n.id, text: n.title + ' ' + (n.source || ''), sub: n.source || '' });
    });
    s.designs.forEach(function (d) {
      out.push({ module: 'design', label: '设计计划', id: d.id, text: d.title + ' ' + (d.note || ''), sub: d.category || '' });
    });
    (s.excerpts || []).forEach(function (x) {
      out.push({ module: 'excerpts', label: '我的书摘', id: x.id, text: x.text + ' ' + (x.bookTitle || ''), sub: (x.bookTitle || '') + (x.page ? ' · P' + x.page : '') });
    });
    (s.gameRecords || []).forEach(function (r) {
      out.push({ module: 'game', label: '娱乐游戏', id: r.id, text: (GAME_KIND[r.kind] || r.kind) + ' ' + (r.note || ''), sub: (r.winner === 'draw' ? '平局' : (r.winner === r.player ? '胜利' : '失败')) + ' · ' + r.date });
    });
    return out;
  }

  function terms(q) {
    return String(q).trim().toLowerCase().split(/\s+/).filter(Boolean);
  }
  function matches(text, qs) {
    var t = String(text).toLowerCase();
    for (var i = 0; i < qs.length; i++) if (t.indexOf(qs[i]) < 0) return false;
    return true;
  }

  function currentQuery() {
    return input ? input.value : '';
  }

  /* 优先复用应用运行实例（避免每次击键全量反序列化）；数据版本 _rev 未变时索引复用 */
  var idxCache = { rev: -1, index: [] };
  function getIndex() {
    var hooks = window.__sonderHooks;
    var store = hooks && hooks.store;
    if (!store) return buildIndex(SonderStore.createStore()); /* 启动早期兜底：一次性索引，不缓存（避免双实例 _rev 失步） */
    if (idxCache.rev !== store._rev) {
      idxCache.index = buildIndex(store);
      idxCache.rev = store._rev;
    }
    return idxCache.index;
  }

  function onInput() {
    var q = currentQuery();
    var qs = terms(q);
    if (!qs.length) { hidePanel(); return; }
    var hits = getIndex().filter(function (r) { return matches(r.text, qs); });
    showPanel(qs, hits);
  }

  function showPanel(qs, hits) {
    if (!panel) return;
    var groups = [];
    var byModule = {};
    hits.forEach(function (h) {
      (byModule[h.module] = byModule[h.module] || []).push(h);
    });
    Object.keys(NAV_MODULE).forEach(function (mod) {
      var list = byModule[mod];
      if (!list) return;
      groups.push({ label: list[0].label, items: list });
    });

    var html = '';
    if (!groups.length) {
      html = '<div class="gsearch-empty">空谷无音，换个词试试吧</div>';
    } else {
      groups.forEach(function (g) {
        html += '<div class="gsearch-group"><div class="ghead">在【' + UI.esc(g.label) + '】中找到 ' + g.items.length + ' 条</div>';
        g.items.forEach(function (it) {
          html += '<button type="button" class="gsearch-item" data-module="' + it.module + '" data-text="' + UI.esc(currentQuery().trim()) + '">' +
            '<span class="t">' + UI.esc(it.sub || it.text) + '</span>' +
            '<span class="s">' + UI.esc(it.text) + '</span>' +
            '</button>';
        });
        html += '</div>';
      });
    }
    panel.innerHTML = html;
    panel.hidden = false;
    panel.querySelectorAll('.gsearch-item').forEach(function (b) {
      b.addEventListener('click', function () { go(b); });
    });
  }

  function hidePanel() {
    if (panel) panel.hidden = true;
  }

  function go(btn) {
    var module = btn.dataset.module;
    var q = btn.dataset.text || '';
    hidePanel();
    if (input) input.blur();
    if (location.hash.replace(/^#\/?/, '') === module) {
      flashInPage(q);
    } else {
      var prev = contentSig();
      location.hash = module;
      waitRendered(prev, q); /* 渲染就绪后高亮（替代固定 80ms，消除快慢机器竞态） */
    }
  }

  function contentSig() {
    var c = document.getElementById('content');
    return c ? c.textContent : '';
  }

  /* 轮询 #content 内容变化：hash 切换后新页面渲染完成（文本签名变化）即高亮，1s 超时兜底 */
  function waitRendered(prev, q) {
    var t0 = Date.now();
    var timer = setInterval(function () {
      if (contentSig() !== prev || Date.now() - t0 > 1000) {
        clearInterval(timer);
        flashInPage(q);
      }
    }, 40);
  }

  /* 跳转后高亮包含关键词的条目：找到文本节点，向上定位列表项/卡片，闪烁标出 */
  function flashInPage(q) {
    var qs = terms(q);
    if (!qs.length) return;
    var content = document.getElementById('content');
    if (!content) return;
    var walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    var hit = null;
    while (walker.nextNode()) {
      var v = String(walker.currentNode.nodeValue).toLowerCase();
      for (var i = 0; i < qs.length; i++) { /* 多词搜索：任一词命中即可定位条目 */
        if (v.indexOf(qs[i]) >= 0) { hit = walker.currentNode; break; }
      }
      if (hit) break;
    }
    var el = hit && hit.parentNode;
    while (el && el !== content && el.nodeType === 1) {
      if (el.classList && (el.classList.contains('list-item') || el.classList.contains('card') || el.classList.contains('rank-card'))) break;
      el = el.parentNode;
    }
    if (!el || el === content) return;
    el.classList.add('search-flash');
    if (el.scrollIntoView) el.scrollIntoView({ block: 'center' });
    var target = el;
    setTimeout(function () { target.classList.remove('search-flash'); }, 2600);
  }

  if (input) {
    input.addEventListener('input', onInput);
    input.addEventListener('focus', function () { if (terms(input.value).length) onInput(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { hidePanel(); input.blur(); } });
    document.addEventListener('click', function (e) {
      if (!panel || panel.hidden) return;
      var t = /** @type {Node} */ (e.target);
      if (!input.contains(t) && !panel.contains(t)) hidePanel();
    });
  }
})();