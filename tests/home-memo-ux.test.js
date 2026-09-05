'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const S = require('../js/store.js');

const okBtn = (doc) => doc.querySelector('.overlay [data-act="ok"]');
const yesBtn = (doc) => doc.querySelector('.overlay [data-act="yes"]');

/* ================= 首页总览（home.js） ================= */

test('首页：空数据渲染问候/金句/空态卡片', () => {
  const h = boot();
  h.goto('home');
  const doc = h.window.document;
  assert.ok(doc.querySelector('.section-title'), '有区块标题');
  assert.ok(doc.querySelector('.quote-card'), '有金句区');
  assert.ok(doc.body.textContent.includes('今天暂无待办'), '无任务提示');
  assert.ok(doc.body.textContent.includes('暂无备忘'), '无备忘提示');
  assert.ok(doc.querySelector('#hmSave'), '有快速备忘保存按钮');
});

test('首页：无摘抄时金句来自金句库（quoteOfDay）', () => {
  const h = boot();
  h.goto('home');
  const q = h.window.document.querySelector('.quote-card');
  assert.ok(q && q.textContent.length > 0, '金句区非空');
  assert.ok(q.textContent.includes('「'), '金句带书名号');
});

test('首页：有摘抄时金句区优先展示书摘（含书名页码）', () => {
  const h = boot();
  const b = h.store.addBook({ title: '测试之书' });
  h.store.addExcerpt({ bookId: b.id, text: '今日一句', page: 3 });
  h.goto('home');
  const q = h.window.document.querySelector('.quote-card');
  assert.ok(q.textContent.includes('今日一句'), '展示书摘文本');
  assert.ok(q.textContent.includes('来自《测试之书》'), '附书名');
  assert.ok(q.textContent.includes('第3页'), '附页码');
});

test('首页：快速备忘保存 → 入库/清空输入/展示最近一条', () => {
  const h = boot();
  h.goto('home');
  const doc = h.window.document;
  const ta = doc.querySelector('#hmMemo');
  ta.value = '随手记一笔';
  doc.querySelector('#hmSave').click();
  assert.equal(h.store.state.memos[0].text, '随手记一笔', '备忘入库');
  assert.equal(doc.querySelector('#hmMemo').value, '', '输入框已清空');
  const notes = doc.querySelector('.notes-area');
  assert.ok(notes && notes.textContent.includes('随手记一笔'), '展示为最近一条');
});

test('首页：快速备忘空内容被拦截', () => {
  const h = boot();
  h.goto('home');
  h.window.document.querySelector('#hmSave').click();
  assert.equal(h.store.state.memos.length, 0, '空备忘不入库');
});

test('首页：今日任务勾选完成 → 落库并从今日列表移除', () => {
  const h = boot();
  const t = h.store.addTask({ title: '今天的事', date: S.todayStr() });
  h.goto('home');
  const row = h.window.document.querySelector('[data-tid="' + t.id + '"]');
  assert.ok(row, '今日任务展示在首页');
  const cb = row.querySelector('.hm-done');
  cb.checked = true;
  cb.dispatchEvent(new h.window.Event('change', { bubbles: true }));
  assert.equal(h.store.state.tasks.find(x => x.id === t.id).done, true, '勾选落库');
  assert.equal(h.window.document.querySelector('[data-tid="' + t.id + '"]'), null, '已完成任务移出今日列表');
});

test('首页：概览区渲染 7 张模块卡且可跳转', () => {
  const h = boot();
  h.goto('home');
  const cards = h.window.document.querySelectorAll('.module-card[data-go]:not([data-go="home"])');
  assert.equal(cards.length, 7, '7 个模块概览卡');
  assert.ok(h.window.document.querySelector('[data-go="today"]'), '有进入今日计划按钮');
  const go = h.window.document.querySelector('.module-card[data-go="news"]');
  assert.ok(go, '新闻卡存在');
  go.dispatchEvent(new h.window.MouseEvent('click', { bubbles: true }));
  assert.ok(h.window.location.hash.indexOf('news') >= 0, '点击卡片切换路由');
});

/* ================= 快速备忘（memo.js） ================= */

test('备忘：空状态提示', () => {
  const h = boot();
  h.goto('memo');
  assert.ok(h.window.document.body.textContent.includes('还没有备忘'), '空态文案');
  assert.ok(h.window.document.querySelector('#memoAdd'), '有新建按钮');
});

test('备忘：新建 → 列表出现并计数', () => {
  const h = boot();
  h.goto('memo');
  h.window.document.querySelector('#memoAdd').click();
  const doc = h.window.document;
  doc.querySelector('textarea[data-k="text"]').value = '第一条备忘';
  okBtn(doc).click();
  assert.equal(h.store.state.memos[0].text, '第一条备忘', '入库');
  assert.ok(doc.body.textContent.includes('备忘 1'), '计数更新');
  const item = doc.querySelector('.list-item[data-id="' + h.store.state.memos[0].id + '"]');
  assert.ok(item, '列表项渲染');
});

test('备忘：归档/取消归档', () => {
  const h = boot();
  h.store.addMemo('要归档的');
  h.goto('memo');
  const doc = h.window.document;
  doc.querySelector('[data-act="archive"]').click();
  assert.equal(h.store.state.memos[0].archived, true, '归档落库');
  assert.ok(doc.body.textContent.includes('已归档 1'), '归档分组出现');
  doc.querySelector('[data-act="archive"]').click();
  assert.equal(h.store.state.memos[0].archived, false, '取消归档');
});

test('备忘：编辑预填并可保存', () => {
  const h = boot();
  h.store.addMemo('旧内容');
  h.goto('memo');
  const doc = h.window.document;
  doc.querySelector('[data-act="edit"]').click();
  const ta = doc.querySelector('textarea[data-k="text"]');
  assert.equal(ta.value, '旧内容', '编辑框预填');
  ta.value = '新内容';
  okBtn(doc).click();
  assert.equal(h.store.state.memos[0].text, '新内容', '更新入库');
});

test('备忘：删除需确认，确认后移除且可撤销', async () => {
  const h = boot();
  h.store.addMemo('要删的');
  h.goto('memo');
  const doc = h.window.document;
  doc.querySelector('[data-act="del"]').click();
  assert.ok(yesBtn(doc), '弹出确认框');
  yesBtn(doc).click();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(h.store.state.memos.length, 0, '已删除');
  const undo = doc.querySelector('.toast-act');
  assert.ok(undo, '出现撤销按钮');
  undo.click();
  assert.equal(h.store.state.memos.length, 1, '撤销恢复');
});
