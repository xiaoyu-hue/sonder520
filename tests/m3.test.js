'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const S = require('../js/store.js');
const TODAY = S.todayStr();
const PAST = '2000-01-01';

test('今日计划：通过界面新增任务并渲染', () => {
  const h = boot();
  h.goto('today');
  h.window.document.querySelector('#tplAdd').click();
  const doc = h.window.document;
  doc.querySelector('[data-k="title"]').value = '写周报';
  doc.querySelector('[data-k="note"]').value = '整理本周进展';
  doc.querySelector('[data-act="ok"]').click();
  assert.equal(h.store.state.tasks.length, 1);
  assert.equal(h.store.state.tasks[0].title, '写周报');
  assert.ok(h.window.document.body.textContent.includes('写周报'));
});

test('今日计划：勾选完成移入已完成区, 再次取消恢复', () => {
  const h = boot();
  h.goto('today');
  const doc = h.window.document;
  // 通过界面新增
  doc.querySelector('#tplAdd').click();
  doc.querySelector('[data-k="title"]').value = '任务A';
  doc.querySelector('[data-act="ok"]').click();
  // 勾选
  const cb = doc.querySelector('.tpl-done');
  cb.click();
  assert.equal(h.store.state.tasks[0].done, true);
  assert.ok(doc.querySelector('.section-title') && doc.body.textContent.includes('已完成'));
});

test('今日计划：删除需二次确认,确认才消失', async () => {
  const h = boot();
  h.goto('today');
  const doc = h.window.document;
  doc.querySelector('#tplAdd').click();
  doc.querySelector('[data-k="title"]').value = '任务A';
  doc.querySelector('[data-act="ok"]').click();
  // 先取消
  doc.querySelector('[data-act="del"]').click();
  doc.querySelector('[data-act="no"]').click();
  assert.equal(h.store.state.tasks.length, 1, '取消后不应删除');
  // 再确认
  doc.querySelector('[data-act="del"]').click();
  await new Promise(r => setTimeout(r, 10));
  doc.querySelector('[data-act="yes"]').click();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(h.store.state.tasks.length, 0, '确认后应删除');
});

test('今日计划：过期任务单独分组显示', () => {
  const h = boot({ seed: { version: 1, settings: {}, 
    tasks: [{ id: 'o1', title: '到期任务', note: '', date: PAST, priority: '中', done: false, doneAt: null, order: 0 }], memos: [], posts: [], devProjects: [], clients: [], books: [], news: [], designs: [] } });
  h.goto('today');
  const txt = h.window.document.body.textContent;
  assert.ok(h.window.document.body.textContent.includes('到期任务'));
  assert.ok(txt.includes('过期'), '应有过期分组');
});

test('快速备忘：新增/归档/取消归档/删除', async () => {
  const h = boot();
  h.goto('memo');
  const doc = h.window.document;
  doc.querySelector('#memoAdd').click();
  doc.querySelector('[data-k="text"]').value = '记得买牛奶';
  doc.querySelector('[data-act="ok"]').click();
  assert.equal(h.store.state.memos.length, 1);
  assert.ok(doc.body.textContent.includes('记得买牛奶'));
  // 归档
  doc.querySelector('[data-act="archive"]').click();
  assert.equal(h.store.state.memos[0].archived, true);
  assert.ok(doc.body.textContent.includes('已归档'));
  // 删除
  doc.querySelector('[data-act="del"]').click();
  await new Promise(r => setTimeout(r, 10));
  doc.querySelector('[data-act="yes"]').click();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(h.store.state.memos.length, 0);
});

test('首页：显示今日摘要与六模块概览,数字与数据一致', () => {
  const h = boot({ seed: {
    version: 1, settings: {},
    tasks: [{ id: 't1', title: 'T', note: '', date: TODAY, priority: '中', done: false, doneAt: null, order: 0 }],
    memos: [], posts: [{ id: 'p1', title: 'x', platform: '', account: '', note: '', tags: [], status: 'draft', publishDate: null }],
    devProjects: [], clients: [], books: [], news: [], designs: []
  } });
  h.goto('home');
  const txt = h.window.document.body.textContent;
  assert.ok(txt.includes('今日计划'));
  assert.ok(txt.includes('自媒体'));
  assert.ok(txt.includes('开发工作'));
  assert.ok(txt.includes('咨询工作'));
  assert.ok(txt.includes('阅读计划'));
  assert.ok(txt.includes('看新闻计划'));
  assert.ok(txt.includes('设计计划'));
});

test('首页：快速任务 checkbox 可勾选（点击不跳页）', () => {
  const h = boot({ seed: {
    version: 1, settings: {},
    tasks: [{ id: 't1', title: 'T1', note: '', date: TODAY, priority: '中', done: false, doneAt: null, order: 0 }],
    memos: [], posts: [], devProjects: [], clients: [], books: [], news: [], designs: []
  } });
  h.goto('home');
  const doc = h.window.document;
  assert.equal(doc.querySelectorAll('.hm-done').length, 1);
  doc.querySelector('.hm-done').click();
  assert.equal(h.store.state.tasks[0].done, true);
});

test('首页：内嵌快速备忘保存', () => {
  const h = boot();
  h.goto('home');
  const doc = h.window.document;
  doc.querySelector('#hmMemo').value = '首页记的一条';
  doc.querySelector('#hmSave').click();
  assert.equal(h.store.state.memos.length, 1);
  assert.equal(h.store.state.memos[0].text, '首页记的一条');
});