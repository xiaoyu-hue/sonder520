'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

function fillModal(doc, pairs) {
  for (const [k, v] of Object.entries(pairs)) doc.querySelector(`[data-k="${k}"]`).value = v;
}
function okModal(doc) { doc.querySelector('[data-act="ok"]').click(); }
function box(h) { return h.window.document.body.textContent; }

test('自媒体：新增、状态筛选、标签筛选项生成', () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('selfmedia');
  doc.querySelector('#smAdd').click();
  fillModal(doc, { title: '选题A', platform: 'B站', tags: '技术,AI' });
  okModal(doc);
  assert.equal(h.store.state.posts.length, 1);
  assert.deepEqual(h.store.state.posts[0].tags, ['技术', 'AI']);
  assert.ok(box(h).includes('选题A'));
  // 导出 CSV 按钮存在
  assert.ok(doc.querySelector('#smCsv'), '缺少导出按钮');
});

test('开发工作：建项目 → 加任务 → 勾选后进度变化', () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('dev');
  doc.querySelector('#devAdd').click();
  fillModal(doc, { name: 'Sonder项目' });
  okModal(doc);
  assert.equal(h.store.state.devProjects.length, 1);
  // 添加两个任务
  doc.querySelector('[data-tadd]').click();
  fillModal(doc, { title: '写数据层' });
  okModal(doc);
  doc.querySelector('[data-tadd]').click();
  fillModal(doc, { title: '写界面' });
  okModal(doc);
  let p = h.store.state.devProjects[0];
  assert.equal(p.tasks.length, 2);
  assert.equal(box(h).includes('0%'), true);
  doc.querySelector('[data-tcheck]').click(); // 勾选第一个任务
  p = h.store.state.devProjects[0];
  assert.equal(p.tasks[0].done, true);
  assert.ok(h.window.document.body.textContent.includes('50%'), '进度应为 50%');
});

test('开发工作：删除项目有二次确认', async () => {
  const h = boot({ seed: { version: 1, settings: {}, tasks: [], memos: [], posts: [], devProjects: [{ id: 'p1', name: 'P', note: '', tasks: [] }], clients: [], books: [], news: [], designs: [] } });
const doc = h.window.document;
  h.goto('dev');
  doc.querySelector('[data-pdel]').click();
  // 先取消
  doc.querySelector('[data-act="no"]').click();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(h.store.state.devProjects.length, 1);
  // 再确认
  doc.querySelector('[data-pdel]').click();
  await new Promise(r => setTimeout(r, 10));
  doc.querySelector('[data-act="yes"]').click();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(h.store.state.devProjects.length, 0);
});

test('咨询工作：客户 → 项目/跟进/收入 全流程', () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('consulting');
  doc.querySelector('#csAdd').click();
  fillModal(doc, { name: '客户X', contact: 'email@x.com' });
  okModal(doc);
  assert.equal(h.store.state.clients.length, 1);
  // 展开
  doc.querySelector('[data-cx]').click();
  doc.querySelector('[data-spadd]').click();
  fillModal(doc, { name: '品牌官网' });
  okModal(doc);
  assert.equal(h.store.state.clients[0].projects.length, 1);
  // 收入
  doc.querySelector('[data-inadd]').click();
  fillModal(doc, { amount: '5000', note: '首付' });
  okModal(doc);
  assert.equal(h.store.state.clients[0].income[0].amount, 5000);
  // 跟进
  doc.querySelector('[data-fuadd]').click();
  fillModal(doc, { note: '约了下周电话' });
  okModal(doc);
  assert.equal(h.store.state.clients[0].followups.length, 1);
  assert.ok(box(h).includes('¥5000'));
});

test('阅读：新增书 → 改状态进度 → 加笔记', () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('reading');
  doc.querySelector('#rdAdd').click();
  fillModal(doc, { title: '代码整洁之道', author: 'Robert', status: '在读', progress: '30' });
  okModal(doc);
  assert.equal(h.store.state.books.length, 1);
  assert.ok(box(h).includes('30%'));
  doc.querySelector('[data-act="note"]').click();
  fillModal(doc, { text: '原则可用' });
  okModal(doc);
  assert.equal(h.store.state.books[0].notes.length, 1);
  assert.ok(box(h).includes('原则可用'));
});

test('看新闻：新增、标已读、收藏、链接', () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('news');
  doc.querySelector('#nwAdd').click();
  fillModal(doc, { title: '某技术新闻', url: 'https://example.com', source: 'HackerNews', tags: '前端' });
  okModal(doc);
  const n = h.store.state.news[0];
  assert.equal(n.status, 'unread');
  assert.ok(box(h).includes('待读'));
  doc.querySelector('[data-act="fav"]').click();
  assert.equal(h.store.state.news[0].status, 'favorite');
  assert.ok(box(h).includes('收藏'));
  doc.querySelector('[data-act="unfav"]').click();
  assert.equal(h.store.state.news[0].status, 'unread');
  doc.querySelector('[data-act="mark"]').click();
  assert.equal(h.store.state.news[0].status, 'read');
  // 链接为新标签
  const a = doc.querySelector('[data-id] a[target="_blank"]');
  assert.ok(a && a.getAttribute('href') === 'https://example.com');
});

test('设计计划：灵感 + 项目分离、阶段推进', () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('design');
  doc.querySelector('[data-dadd="idea"]').click();
  fillModal(doc, { title: '插画灵感', category: '载体' });
  okModal(doc);
  doc.querySelector('[data-dadd="project"]').click();
  fillModal(doc, { title: 'Logo重设计', stage: '构想' });
  okModal(doc);
  assert.equal(h.store.state.designs.filter(d => d.type === 'idea').length, 1);
  assert.equal(h.store.state.designs.filter(d => d.type === 'project').length, 1);
  assert.ok(box(h).includes('构想'));
  // 编辑项目推进到定稿
  const proj = h.store.state.designs.find(d => d.type === 'project');
  doc.querySelector(`[data-id="${proj.id}"] [data-act="edit"]`).click();
  fillModal(doc, { stage: '定稿' });
  okModal(doc);
  assert.equal(h.store.state.designs.find(d => d.id === proj.id).stage, '定稿');
});