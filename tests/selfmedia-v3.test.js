'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const S = require('../js/store.js');

function newStore() {
  return S.createStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
}
function pubPost(s, title, publishDate, views) {
  return s.addPost({ title, status: 'published', publishDate, views, likes: views ? views * 2 : 0 });
}

/* ================= 数据层：最近 5 篇 ================= */

test('自媒体：recentPublished 按发布日倒序取最近 5 篇', () => {
  const s = newStore();
  pubPost(s, 'A', '2026-08-05', 100);
  pubPost(s, 'B', '2026-08-07', 200);
  pubPost(s, 'C', '2026-08-01', 50);
  pubPost(s, 'D', '2026-08-09', 300);
  pubPost(s, 'E', '2026-08-08', 120);
  pubPost(s, 'F', '2026-08-10', 80);
  pubPost(s, 'G', null, 10);
  s.addPost({ title: '草稿', status: 'draft' });
  const rec = S.recentPublished(s.state.posts, 5);
  assert.equal(rec.length, 5);
  assert.deepEqual(rec.map(p => p.title), ['G', 'F', 'D', 'E', 'B'], '发布日新→旧；无发布日的按创建时间（今天）排前');
  assert.equal(rec[0].views, 10);
  assert.equal(S.recentPublished(s.state.posts, 3).length, 3);
  assert.deepEqual(S.recentPublished([], 5), []);
});

/* ================= UI：视图切换与月历 ================= */

test('自媒体：列表/月历视图可切换，月历渲染当月所有日期且今天高亮', () => {
  const h = boot();
  h.goto('selfmedia');
  h.window.document.querySelector('[data-view="cal"]').click();
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  assert.ok(h.window.document.querySelector('.cal-grid'), '应渲染月历网格');
  assert.equal(h.window.document.querySelectorAll('.cal-day[data-date]').length, daysInMonth, '应含当月每一天');
  const today = S.todayStr();
  const cell = h.window.document.querySelector('.cal-day[data-date="' + today + '"]');
  assert.ok(cell && cell.classList.contains('cal-today'), '今天格子高亮');
  assert.ok(h.window.document.body.textContent.includes(now.getFullYear() + '年' + (now.getMonth() + 1) + '月'), '显示当前年月标题');
  h.window.document.querySelector('[data-view="list"]').click();
  assert.ok(h.window.document.querySelector('#smAdd'), '可切回列表视图');
});

test('自媒体：月份前后切换与回到本月', () => {
  const h = boot();
  h.goto('selfmedia');
  h.window.document.querySelector('[data-view="cal"]').click();
  const now = new Date();
  const monthLabel = () => {
    const head = h.window.document.querySelector('.cal-grid').previousSibling;
    const txt = head ? head.textContent : h.window.document.body.textContent;
    const m = txt.match(/(\d+)年(\d+)月/);
    return m ? Number(m[2]) : -1;
  };
  h.window.document.querySelector('[data-cal="prev"]').click();
  assert.equal(monthLabel(), now.getMonth() === 0 ? 12 : now.getMonth(), '上个月');
  h.window.document.querySelector('[data-cal="next"]').click();
  assert.equal(monthLabel(), now.getMonth() === 11 ? 1 : now.getMonth() + 1, '下个月');
  h.window.document.querySelector('[data-cal="back"]').click();
  assert.equal(monthLabel(), now.getMonth() + 1, '回到本月');
});

test('自媒体：已排期选题在月历显示为可拖拽 chip', () => {
  const h = boot();
  const p = h.store.addPost({ title: '月更选题', status: 'draft', publishDate: S.todayStr() });
  h.goto('selfmedia');
  h.window.document.querySelector('[data-view="cal"]').click();
  const chip = h.window.document.querySelector('.cal-chip[data-post="' + p.id + '"]');
  assert.ok(chip, '月历应显示该选题');
  assert.equal(chip.getAttribute('draggable'), 'true', 'chip 可拖拽');
  assert.ok(chip.textContent.includes('月更选题'));
});

test('自媒体：拖拽选题到目标日期格落账 publishDate 并刷新显示', () => {
  const h = boot();
  const p = h.store.addPost({ title: '拖拽选题', status: 'draft', publishDate: S.todayStr() });
  h.goto('selfmedia');
  h.window.document.querySelector('[data-view="cal"]').click();
  const chip = h.window.document.querySelector('.cal-chip[data-post="' + p.id + '"]');
  const dates = Array.from(h.window.document.querySelectorAll('.cal-day[data-date]'))
    .map(d => d.dataset.date).filter(d => d !== S.todayStr());
  const target = dates[Math.floor(Math.random() * dates.length)];
  chip.dispatchEvent(new h.window.Event('dragstart', { bubbles: true }));
  const day = h.window.document.querySelector('.cal-day[data-date="' + target + '"]');
  day.dispatchEvent(new h.window.Event('dragover', { bubbles: true }));
  day.dispatchEvent(new h.window.Event('drop', { bubbles: true }));
  const p2 = h.store.state.posts.find(x => x.id === p.id);
  assert.equal(p2.publishDate, target, '拖拽后 publishDate 更新');
  assert.equal(h.window.document.querySelector('.cal-day[data-date="' + target + '"] .cal-chip[data-post="' + p.id + '"]') !== null, true, 'chip 移到目标日期');
});

/* ================= UI：发布渠道 ================= */

test('自媒体：新增内容表单发布渠道为四平台下拉并可保存', () => {
  const h = boot();
  h.goto('selfmedia');
  h.window.document.querySelector('#smAdd').click();
  const sel = h.window.document.querySelector('select[data-k="platform"]');
  assert.ok(sel, '应有渠道下拉');
  const opts = Array.from(sel.options).map(o => o.textContent);
  ['公众号', '小红书', 'B站', '抖音'].forEach(c => assert.ok(opts.includes(c), '缺渠道 ' + c));
  sel.value = '小红书';
  h.window.document.querySelector('input[data-k="title"]').value = '选题A';
  h.window.document.querySelector('.overlay [data-act="ok"]').click();
  assert.equal(h.store.state.posts[0].platform, '小红书', '选中渠道入库');
});

/* ================= UI：数据反馈 ================= */

test('自媒体：已发布卡片直接填写阅读量/点赞并入库；未发布无输入框', () => {
  const h = boot();
  h.store.addPost({ title: '已发布内容', status: 'published', publishDate: '2026-08-01' });
  const draft = h.store.addPost({ title: '草稿内容', status: 'draft' });
  h.goto('selfmedia');
  const card = h.window.document.querySelector('[data-id="' + h.store.state.posts.find(x => x.title === '已发布内容').id + '"]');
  const viewsInp = card.querySelector('input[data-fb="views"]');
  const likesInp = card.querySelector('input[data-fb="likes"]');
  assert.ok(viewsInp && likesInp, '已发布卡片应有反馈输入框');
  viewsInp.value = '1234';
  viewsInp.dispatchEvent(new h.window.Event('change', { bubbles: true }));
  likesInp.value = '56';
  likesInp.dispatchEvent(new h.window.Event('change', { bubbles: true }));
  const pub = h.store.state.posts.find(x => x.title === '已发布内容');
  assert.equal(pub.views, 1234, '阅读量入库');
  assert.equal(pub.likes, 56, '点赞入库');
  h.goto('selfmedia');
  const dcard = h.window.document.querySelector('[data-id="' + draft.id + '"]');
  assert.equal(dcard.querySelector('input[data-fb="views"]'), null, '未发布内容不显示反馈输入框');
});

/* ================= UI：折线图 ================= */

test('自媒体：发布内容显示最近 5 篇折线图（svg polyline），超 5 篇只取最近 5', () => {
  const h = boot();
  h.store.addPost({ title: 'P9', status: 'published', publishDate: '2026-08-09', views: 50 });
  h.goto('selfmedia');
  assert.ok(h.window.document.querySelector('svg.mini-line'), '应显示折线图');
  assert.equal(h.window.document.querySelector('svg.mini-line polyline').getAttribute('points').split(' ').length, 1, '一篇一个数据点');
  for (let i = 10; i <= 15; i++) {
    h.store.addPost({ title: 'P' + i, status: 'published', publishDate: '2026-08-' + i, views: i * 10 });
  }
  h.goto('selfmedia');
  const pts = h.window.document.querySelector('svg.mini-line polyline').getAttribute('points').split(' ').length;
  assert.equal(pts, 5, '超过 5 篇只取最近 5 个点');
  const labels = Array.from(h.window.document.querySelectorAll('svg.mini-line text')).map(t => Number(t.textContent));
  assert.equal(labels.length, 5, '每个数据点有数值标签');
  assert.deepEqual(labels, [150, 140, 130, 120, 110], '标签为最近 5 篇阅读量（新→旧）');
});