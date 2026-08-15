'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

const wait = ms => new Promise(r => setTimeout(r, ms));

function seed() {
  return {
    version: 1,
    settings: { modules: {} },
    tasks: [
      { id: 't1', title: '写水墨风插件', note: '方案一', date: '2026-08-10', priority: '高', done: false },
      { id: 't2', title: '买菜', note: '', date: '2026-08-10', priority: '中', done: false }
    ],
    memos: [{ id: 'm1', text: '水墨滤镜参数：颗粒 20', time: '2026-08-10T08:00:00.000Z', archived: false }],
    posts: [{ id: 'p1', title: '水墨风视频第二期', tags: ['设计'], status: 'draft' }],
    devProjects: [{
      id: 'd1', name: 'Sonder', note: '个人工具',
      tasks: [{ id: 'dt1', title: '实现全局搜索', note: '分组展示', done: false }], createdAt: ''
    }],
    clients: [{ id: 'c1', name: '水墨工坊', contact: '', note: '', projects: [], followups: [], income: [] }],
    books: [{ id: 'b1', title: '水墨画入门', author: '周某', status: 'reading', progress: 30, notes: [] }],
    news: [{ id: 'n1', title: '水墨动画新作发布', url: '', source: '设计周刊', tags: [], status: 'unread', time: '' }],
    designs: [{ id: 'x1', type: 'idea', title: '水墨动效灵感', link: '', category: '动效', note: '', stage: '', time: '' }],
    gameRecords: []
  };
}

function type(h, q) {
  const input = h.$('#globalSearch');
  input.value = q;
  input.dispatchEvent(new h.window.Event('input', { bubbles: true }));
  return input;
}

test('搜索：输入即分组展示（组头含模块名与条数）', () => {
  const h = boot({ seed: seed() });
  type(h, '水墨');
  const panel = h.$('#gsearchPanel');
  assert.ok(!panel.hidden, '面板应显示');
  const txt = panel.textContent;
  assert.ok(txt.includes('在【今日计划】中找到 1 条'), '缺今日组头: ' + txt);
  assert.ok(txt.includes('在【快速备忘】中找到 1 条'), '缺备忘组头');
  assert.ok(txt.includes('在【阅读计划】中找到 1 条'), '缺阅读组头');
  assert.ok(txt.includes('在【设计计划】中找到 1 条'), '缺设计组头');
  assert.ok(txt.includes('写水墨风插件'), '应列出命中条目');
});

test('搜索：开发工作命中项目名与任务笔记', () => {
  const h = boot({ seed: seed() });
  type(h, '全局搜索');
  const txt = h.$('#gsearchPanel').textContent;
  assert.ok(txt.includes('在【开发工作】中找到 1 条'), '缺开发组头');
  assert.ok(txt.includes('Sonder · 实现全局搜索'), '应显示项目名·任务名');
  type(h, '个人工具');
  assert.ok(h.$('#gsearchPanel').textContent.includes('开发工作'), '项目备注也应命中');
});

test('搜索：无结果显示水墨风空提示', () => {
  const h = boot({ seed: seed() });
  type(h, '绝对不存在的关键词xyz');
  assert.ok(h.$('#gsearchPanel').textContent.includes('空谷无音，换个词试试吧'), '应有温柔空提示');
});

test('搜索：大小写不敏感', () => {
  const h = boot({ seed: seed() });
  type(h, 'SONDER');
  assert.ok(h.$('#gsearchPanel').textContent.includes('开发工作'), '大写应命中小写数据');
});

test('搜索：点击结果跳转对应模块并高亮该条目', async () => {
  const h = boot({ seed: seed() });
  type(h, '水墨');
  const item = h.$('#gsearchPanel .gsearch-item[data-module="reading"]');
  assert.ok(item, '应有阅读模块结果');
  item.click();
  await wait(150);
  assert.ok(h.window.location.hash.indexOf('reading') >= 0, '应跳转到阅读计划');
  const flash = h.$('#content .search-flash');
  assert.ok(flash, '条目应被高亮标记');
  assert.ok(flash.textContent.indexOf('水墨画入门') >= 0, '高亮的应是命中条目');
});

test('搜索：多词查询跳转后任一词命中即高亮（原整串匹配常落空）', async () => {
  const h = boot({ seed: seed() });
  type(h, '入门 周某');
  const item = h.$('#gsearchPanel .gsearch-item[data-module="reading"]');
  assert.ok(item, '多词 AND 应命中阅读条目');
  item.click();
  await wait(150);
  const flash = h.$('#content .search-flash');
  assert.ok(flash, '多词查询跳转后应高亮命中条目');
  assert.ok(flash.textContent.indexOf('水墨画入门') >= 0, '高亮完整条目');
});

test('搜索：连续点击两个结果，最终只高亮后一次跳转的条目', async () => {
  const h = boot({ seed: seed() });
  type(h, '水墨');
  const first = h.$('#gsearchPanel .gsearch-item[data-module="reading"]');
  const second = h.$('#gsearchPanel .gsearch-item[data-module="today"]');
  first.click();
  await wait(30);
  second.click();
  await wait(200);
  assert.ok(h.window.location.hash.indexOf('today') >= 0, '最终应停在最后点击的模块');
  const flash = h.$('#content .search-flash');
  assert.ok(flash, '应存在高亮条目');
  assert.ok(flash.textContent.indexOf('写水墨风插件') >= 0, '高亮的应是最后跳转的目标');
});

test('搜索：Escape 关闭面板', () => {
  const h = boot({ seed: seed() });
  type(h, '水墨');
  assert.ok(!h.$('#gsearchPanel').hidden, '面板应打开');
  const input = h.$('#globalSearch');
  input.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.ok(h.$('#gsearchPanel').hidden, 'Esc 应关闭面板');
});

test('搜索：同查询重复触发不重建面板（结果缓存，_rev 未变直接复用；数据变化后自动失效）', () => {
  const h = boot({ seed: seed() });
  type(h, '水墨');
  const item = h.$('#gsearchPanel .gsearch-item');
  assert.ok(item, '首轮应有结果');
  type(h, '水墨');
  assert.strictEqual(h.$('#gsearchPanel .gsearch-item'), item, '同查询同版本重复输入不应重建面板节点');
  const hooks = h.window.__sonderHooks;
  hooks.store.addTask({ title: '再写一篇水墨教程', note: '', date: '2026-08-10', priority: '低' });
  type(h, '水墨');
  const items = h.$('#gsearchPanel').querySelectorAll('.gsearch-item');
  assert.ok(items.length >= 2, '数据版本变化后同查询应重新过滤并含新增条目');
});

test('搜索：书摘与游戏战绩同样可检索、可跳转', () => {
  const sd = seed();
  sd.excerpts = [
    { id: 'e1', bookId: 'b1', bookTitle: '水墨画入门', text: '留白不是没有，而是给想象留位', page: 5, time: '2026-08-10T08:00:00.000Z' }
  ];
  sd.gameRecords = [
    { id: 'g1', kind: 'minesweeper', mode: 'solo', player: 'player', winner: 'player', note: '经典 9x9 首胜', date: '2026-08-10', time: '', byResign: false }
  ];
  const h = boot({ seed: sd });
  type(h, '留白');
  let panel = h.$('#gsearchPanel');
  assert.ok(panel.textContent.includes('在【我的书摘】中找到 1 条'), '书摘应被索引');
  assert.ok(h.$('#gsearchPanel .gsearch-item[data-module="excerpts"]'), '书摘条目应带 excerpts 模块');
  type(h, '首胜');
  panel = h.$('#gsearchPanel');
  assert.ok(panel.textContent.includes('在【娱乐游戏】中找到 1 条'), '游戏战绩应被索引');
  assert.ok(h.$('#gsearchPanel .gsearch-item[data-module="game"]'), '游戏条目应带 game 模块');
  type(h, '扫雷');
  panel = h.$('#gsearchPanel');
  assert.ok(panel.textContent.includes('娱乐游戏'), '游戏类别名（扫雷）也应能命中');
});