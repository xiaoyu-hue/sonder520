'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { boot } = require('./harness.js');

const root = path.join(__dirname, '..')
const S = require(path.join(root, 'js', 'store.js'));
const wait = ms => new Promise(r => setTimeout(r, ms));

test('QA：今日计划刷新/保存不重复渲染且不崩溃', () => {
  const h = boot();
  h.goto('today');
  h.store.addTask({ title: '任务1', date: S.todayStr() });
  const doc = h.window.document;
  for (let i = 0; i < 3; i++) {
    assert.doesNotThrow(() => doc.querySelector('#tplRefresh').click(), '刷新应不抛异常');
  }
  assert.equal(doc.querySelectorAll('#content .hbar').length, 1, '重复点击不应堆叠工具栏');
  assert.equal(doc.querySelectorAll('#tplList .list-item').length, 1, '任务列表不应重复');
  assert.ok(doc.querySelector('.list-item[data-id="' + h.store.state.tasks[0].id + '"]'), '任务应存在');
});

test('今日计划：已完成任务仍可删除', () => {
  const h = boot();
  h.store.addTask({ title: '做完的事', done: true, date: '2026-08-09' });
  h.goto('today');
  const item = h.window.document.querySelector('.list-item[data-id="' + h.store.state.tasks[0].id + '"]');
  const del = item.querySelector('[data-act="del"]');
  assert.ok(del, '已完成任务应保留删除按钮');
  del.click();
  h.window.document.querySelector('[data-act="yes"]').click();
  return wait(20).then(function () {
    assert.equal(h.store.state.tasks.length, 0, '应已删除');
  });
});

test('QA：备忘保存/归档后页面不重复叠加', () => {
  const h = boot();
  h.goto('memo');
  h.store.addMemo('第一条');
  const doc = h.window.document;
  doc.querySelector('#memoAdd').click();
  const input = doc.querySelector('.modal textarea');
  input.value = '第二条';
  doc.querySelector('.modal [data-act="ok"]').click();
  assert.equal(doc.querySelectorAll('#content .hbar').length, 1, '保存后不应堆叠工具栏');
  const archiveBtn = doc.querySelector('[data-act="archive"]');
  assert.ok(archiveBtn, '应有归档按钮');
  archiveBtn.click();
  assert.equal(doc.querySelectorAll('#content .hbar').length, 1, '归档后不应堆叠');
  assert.equal(h.store.state.memos.filter(m => m.archived).length, 1, '应已归档');
});

test('QA：咨询收入行点击行体不误删，删除需确认', async () => {
  const h = boot();
  h.goto('consulting');
  h.store.addClient({ name: '客户A' });
  h.store.addClientIncome(h.store.state.clients[0].id, { amount: 100, note: '第一笔' });
  h.goto('consulting');
  const doc = h.window.document;
  doc.querySelector('[data-cx]').click();
  const rows = doc.querySelectorAll('[data-call] .cs-item');
  const row = rows[rows.length - 1];
  assert.equal(row.querySelector('.title').textContent, '¥100', '应为收入行');
  row.querySelector('.grow').click();
  assert.equal(h.store.state.clients[0].income.length, 1, '点击行体不应删除收入');
  const delBtn = row.querySelector('[data-idel]');
  assert.ok(delBtn, '收入行应有独立删除按钮');
  delBtn.click();
  const yes = doc.querySelector('[data-act="yes"]');
  assert.ok(yes, '删除收入应弹确认框');
  yes.click();
  return wait(20).then(function () {
    assert.equal(h.store.state.clients[0].income.length, 0, '确认后应删除');
  });
});

test('QA：确认框 Esc/点背景关闭会回执 false（不挂死）', async () => {
  const h = boot();
  const doc = h.window.document;
  let resolved = false;
  h.window.UI.confirmBox('测试').then(ok => { resolved = true; assert.equal(ok, false, 'Esc 应回 false'); });
  doc.body.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(10);
  assert.equal(resolved, true, 'Esc 关闭确认框后 Promise 应被 resolve');

  let resolved2 = false;
  h.window.UI.confirmBox('测试2').then(ok => { resolved2 = true; assert.equal(ok, false, '背景点击应回 false'); });
  const ov = doc.querySelector('.overlay');
  ov.dispatchEvent(new h.window.MouseEvent('mousedown', { bubbles: true }));
  await wait(10);
  assert.equal(resolved2, true, '背景点击关闭后 Promise 应被 resolve');
  assert.equal(doc.querySelectorAll('.overlay').length, 0, '弹窗应已关闭');
});

test('QA：overlay 关闭后 document keydown 监听器全部移除（无泄漏）', async () => {
  const h = boot();
  const doc = h.window.document;
  const added = new Set();
  const origAdd = doc.addEventListener.bind(doc);
  const origRemove = doc.removeEventListener.bind(doc);
  doc.addEventListener = (t, fn, ...a) => { if (t === 'keydown') added.add(fn); origAdd(t, fn, ...a); };
  doc.removeEventListener = (t, fn, ...a) => { if (t === 'keydown') added.delete(fn); origRemove(t, fn, ...a); };
  for (let i = 0; i < 3; i++) {
    h.window.UI.confirmBox('第' + i + '个').then(() => {});
    doc.querySelector('.overlay [data-act="yes"]').click();
    assert.equal(doc.querySelectorAll('.overlay').length, 0, '按钮关闭后无残留节点');
  }
  assert.equal(added.size, 0, '按钮路径关闭后 keydown 监听器应全部移除');
  h.window.UI.alertBox('提示');
  doc.querySelector('.overlay [data-act="ok"]').click();
  h.window.UI.formModal({ title: '表单', fields: [{ key: 'a', label: 'A' }], onSubmit: () => true });
  doc.querySelector('.overlay [data-act="ok"]').click();
  h.window.UI.formModal({ title: '表单2', fields: [{ key: 'b', label: 'B' }], onSubmit: () => true });
  doc.querySelector('.overlay [data-act="cancel"]').click();
  assert.equal(added.size, 0, 'alertBox/formModal 关闭路径同样清理监听器');
  h.window.UI.confirmBox('Esc 路径').then(() => {});
  doc.body.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(added.size, 0, 'Esc 关闭路径清理监听器');
  assert.equal(doc.querySelectorAll('.overlay').length, 0, 'Esc 关闭无残留');
});

test('QA：overlay 焦点管理——打开落入、Tab 循环、关闭归还触发元素（P4b）', () => {
  const h = boot();
  const doc = h.window.document;
  const trigger = h.$('#nav button');
  trigger.focus();
  assert.equal(doc.activeElement, trigger, '前置：焦点在触发按钮上');
  h.window.UI.confirmBox('确认？').then(() => {});
  const ov = doc.querySelector('.overlay');
  assert.ok(ov, '弹层已打开');
  const btns = ov.querySelectorAll('button');
  assert.equal(doc.activeElement, btns[0], '打开后焦点落入弹层第一个按钮（取消）');
  btns[btns.length - 1].focus();
  doc.body.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  assert.equal(doc.activeElement, btns[0], 'Tab 在最后一个元素上循环回第一个');
  btns[0].focus();
  doc.body.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
  assert.equal(doc.activeElement, btns[btns.length - 1], 'Shift+Tab 在第一个元素上循环到最后一个');
  const outside = h.$('#nav button');
  outside.focus();
  doc.body.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  assert.ok(ov.contains(doc.activeElement), '焦点逃逸到背景时 Tab 被拉回弹层');
  doc.body.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(doc.querySelectorAll('.overlay').length, 0, 'Esc 已关闭');
  assert.equal(doc.activeElement, trigger, '关闭后焦点归还触发元素');
});

test('QA：标签选项已转义（防属性注入）', () => {
  const h = boot();
  const bad = '"><img src=x>';
  h.store.addNews({ title: '注入测试', tags: [bad], status: 'unread' });
  h.store.addPost({ title: '注入测试2', tags: [bad], status: 'draft' });
  h.goto('news');
  const opts = h.window.document.querySelectorAll('#nwTag option');
  assert.ok(opts.length >= 2, '标签选项应存在');
  assert.equal(h.window.document.querySelectorAll('#nwTag option img').length, 0, '不应有注入元素');
  assert.equal(opts[1].value, bad, '选项值应保持原义');
  h.goto('selfmedia');
  const opts2 = h.window.document.querySelectorAll('#smTag option');
  assert.equal(h.window.document.querySelectorAll('#smTag img').length, 0, '选项目标签不应注入');
  assert.equal(opts2[1].value, bad);
});

test('QA：每日金句按日期稳定、当天唯一、次日刷新', () => {
  const Q = require(path.join(root, 'js', 'quotes.js'));
  assert.ok(Q.quotes.length >= 30, '金句库应不小于 30 条');
  const a = Q.quoteOfDay('2026-08-09');
  assert.ok(Q.quotes.includes(a), '金句应来自库内');
  assert.equal(Q.quoteOfDay('2026-08-09'), a, '同一天应稳定不变');
  assert.equal(Q.quoteOfDay('2026-08-09'), Q.quoteOfDay('2026-08-09'), '幂等');
  assert.ok(Q.quoteOfDay('2026-08-10') !== undefined, '次日应有金句');
});

test('QA：首页问候语下方显示当日金句', () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('home');
  const quote = doc.querySelector('.quote-card');
  assert.ok(quote, '首页应有金句元素');
  const text = quote.textContent.trim();
  assert.ok(/「.+」/.test(text), '金句应为引号包裹的非空内容: ' + text);
  assert.ok(h.window.SonderQuotes.quotes.includes(text.replace(/「|」/g, '')), '内容应来自金句库');
  const t1 = doc.querySelector('.quote-card').textContent;
  h.goto('today');
  h.goto('home');
  assert.equal(doc.querySelector('.quote-card').textContent, t1, '同日刷新应保持同一句');
});
