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

test('搜索：Escape 关闭面板', () => {
  const h = boot({ seed: seed() });
  type(h, '水墨');
  assert.ok(!h.$('#gsearchPanel').hidden, '面板应打开');
  const input = h.$('#globalSearch');
  input.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.ok(h.$('#gsearchPanel').hidden, 'Esc 应关闭面板');
});