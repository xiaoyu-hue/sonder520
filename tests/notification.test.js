'use strict';
/* Step 1 v2.5：桌面通知提醒（今日任务） */
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function seed(tasks, extra) {
  return Object.assign({
    settings: { theme: 'light', frameRate: 60, modules: { today: true, memo: true, selfmedia: true, dev: true, consulting: true, reading: true, news: true, design: true, game: true }, taskReminder: true },
    tasks: tasks,
    memos: [],
    version: 1
  }, extra || {});
}

/* mock Notification：记录所有实例，permission 与 requestPermission 可控 */
function mockNotification(window, opts) {
  opts = opts || {};
  const calls = [];
  function Notification(title, o) {
    this.title = title;
    this.body = o && o.body;
    calls.push({ title: title, body: this.body });
  }
  Notification.permission = opts.permission || 'granted';
  Notification.requestPermission = function (cb) {
    if (opts.onAsk) opts.onAsk();
    if (typeof cb === 'function') cb(opts.grantTo || 'granted');
  };
  window.Notification = Notification;
  return calls;
}

const wait = (ms) => new Promise(r => setTimeout(r, ms || 60));

test('默认开关关闭：打开页面不发送任何通知', async () => {
  const { window } = boot({ seed: seed([{ id: 'a', title: '未完成A', date: todayStr(), done: false }], { settings: Object.assign({}, seed([], {}).settings, { taskReminder: false }) }) });
  const calls = mockNotification(window);
  await wait(120);
  assert.equal(calls.length, 0, '开关关闭时不得通知');
});

test('存在未完成今日任务：发送提醒通知并列出任务名', async () => {
  const { window } = boot({ seed: seed([
    { id: 'a', title: '写周报', date: todayStr(), done: false },
    { id: 'b', title: '回复邮件', date: todayStr(), done: false }
  ]) });
  const calls = mockNotification(window);
  await wait(150);
  assert.equal(calls.length, 1, '应恰好发送一条通知');
  assert.equal(calls[0].title, '🌿 今日尚有未竟之事');
  assert.ok(calls[0].body.includes('写周报'), '应包含任务名1');
  assert.ok(calls[0].body.includes('回复邮件'), '应包含任务名2');
});

test('通知只列前 3 条未完成任务，多余部分提示数量', async () => {
  const { window } = boot({ seed: seed([
    { id: '1', title: '任务一', date: todayStr(), done: false },
    { id: '2', title: '任务二', date: todayStr(), done: false },
    { id: '3', title: '任务三', date: todayStr(), done: false },
    { id: '4', title: '任务四', date: todayStr(), done: false },
    { id: '5', title: '任务五', date: todayStr(), done: false }
  ]) });
  const calls = mockNotification(window);
  await wait(150);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].body.includes('任务一') && calls[0].body.includes('任务二') && calls[0].body.includes('任务三'));
  assert.ok(!calls[0].body.includes('任务四'), '不得列出第 4 条任务名');
  assert.ok(/等 5 项/.test(calls[0].body), '应提示共 5 项未完成');
});

test('今日任务全部完成：发送表扬通知', async () => {
  const { window } = boot({ seed: seed([
    { id: 'a', title: '已完成1', date: todayStr(), done: true },
    { id: 'b', title: '已完成2', date: todayStr(), done: true }
  ]) });
  const calls = mockNotification(window);
  await wait(150);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].title, '🌿 今日事今日毕，了不起！');
});

test('今日没有任务：不发送任何通知', async () => {
  const { window } = boot({ seed: seed([
    { id: 'a', title: '明天的事', date: '2099-01-01', done: false }
  ]) });
  const calls = mockNotification(window);
  await wait(150);
  assert.equal(calls.length, 0, '无今日任务不得打扰');
});

test('权限 default：先请求授权，授权通过后发送通知', async () => {
  const { window } = boot({ seed: seed([{ id: 'a', title: '需授权任务', date: todayStr(), done: false }]) });
  let asked = 0;
  const calls = mockNotification(window, { permission: 'default', onAsk: () => { asked++; } });
  await wait(150);
  assert.equal(asked, 1, '应发起一次授权请求');
  assert.equal(calls.length, 1, '授权通过后应发送通知');
});

test('权限已拒绝：不请求也不通知', async () => {
  const { window } = boot({ seed: seed([{ id: 'a', title: '被拒任务', date: todayStr(), done: false }]) });
  let asked = 0;
  const calls = mockNotification(window, { permission: 'denied', onAsk: () => { asked++; } });
  await wait(150);
  assert.equal(asked, 0, '已拒绝时不得再请求');
  assert.equal(calls.length, 0);
});

test('设置页：提醒开关存在，切换后持久化到存储', async () => {
  const { window, hooks, $ } = boot({ seed: seed([], { settings: Object.assign({}, seed([], {}).settings, { taskReminder: false }) }) });
  hooks.render('settings');
  const cb = $('#taskReminder');
  assert.ok(cb, '应渲染提醒开关');
  assert.equal(cb.checked, false, '默认应为关');
  cb.click();
  assert.equal(hooks.store.state.settings.taskReminder, true, '开启后应写入存储');
  const settingsCol = JSON.parse(window.localStorage.getItem('sonder_col_settings_v1'));
  const rel = boot({ seed: { version: settingsCol.version || 1, settings: settingsCol.settings, tasks: hooks.store.state.tasks, memos: [] } });
  assert.equal(rel.hooks.store.state.settings.taskReminder, true, '刷新后选择应保留');
});