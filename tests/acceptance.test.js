'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const S = require('../js/store.js');
const TODAY = S.todayStr();

test('首页卡片点击跳转到对应模块', () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('home');
  doc.querySelector('.rank-card[data-go="dev"]').click();
  assert.match(h.window.location.hash, /dev/);
  h.window.dispatchEvent(new h.window.HashChangeEvent('hashchange'));
  assert.ok(h.window.document.querySelector('#devAdd'), '应进入开发工作页面');
});

test('空状态引导出现在无数据的模块', () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('reading');
  assert.ok(doc.querySelector('.empty'), '阅读模块应有空状态');
  assert.ok(doc.querySelector('.empty .btn'), '空状态应有操作按钮');
});

test('统一删除均有二次确认（自媒体为例）', async () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('selfmedia');
  doc.querySelector('#smAdd').click();
  doc.querySelector('[data-k="title"]').value = 'X';
  doc.querySelector('[data-act="ok"]').click();
  doc.querySelector('[data-act="del"]').click();
  await new Promise(r => setTimeout(r, 10));
  doc.querySelector('[data-act="yes"]').click();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(h.store.state.posts.length, 0);
});

test('持久化：UI 操作后，同存储重新加载数据仍在（模拟刷新/重启）', () => {
  const storage = {};
  const store = S.createStore({ getItem: k => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = v; } });
  store.addTask({ title: '任务', note: 'n', date: TODAY, priority: '高' });
  store.addMemo('备忘');
  store.addPost({ title: '内容', tags: ['A'] });
  // 模拟浏览器重启：用同 storage 新建实例
  const store2 = S.createStore({ getItem: k => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = v; } });
  assert.equal(store2.state.tasks.length, 1);
  assert.equal(store2.state.memos.length, 1);
  assert.equal(store2.state.posts.length, 1);
});

test('顶栏全局＋：在今日计划页打开新建任务', () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('today');
  doc.querySelector('#btnQuickMemo').click();
  assert.ok(doc.querySelector('[data-k="title"]'), '应弹出任务表单');
  doc.querySelector('[data-k="title"]').value = '从这里新建';
  doc.querySelector('[data-act="ok"]').click();
  assert.equal(h.store.state.tasks.length, 1);
});

test('顶栏全局＋：在首页打开快速备忘', () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('home');
  doc.querySelector('#btnQuickMemo').click();
  assert.ok(doc.querySelector('[data-k="text"]'), '应弹出备忘输入框');
  doc.querySelector('[data-k="text"]').value = '顶栏备忘';
  doc.querySelector('[data-act="ok"]').click();
  assert.equal(h.store.state.memos.length, 1);
  assert.equal(h.store.state.memos[0].text, '顶栏备忘');
});