'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const S = require('../js/store.js');
const wait = ms => new Promise(r => setTimeout(r, ms));

function newStore() {
  return S.createStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
}

/* ================= 数据层：优先级四档与迁移 ================= */

test('优先级：旧值 高/中/低 自动迁移为 p1/p2/p4，未知值回落 p2', () => {
  assert.equal(S.normalizePriority('高'), 'p1');
  assert.equal(S.normalizePriority('中'), 'p2');
  assert.equal(S.normalizePriority('低'), 'p4');
  assert.equal(S.normalizePriority('p1'), 'p1');
  assert.equal(S.normalizePriority('p3'), 'p3');
  assert.equal(S.normalizePriority('随便'), 'p2');
  assert.equal(S.normalizePriority(''), 'p2');
  assert.equal(S.normalizePriority(undefined), 'p2');
});

test('优先级：addTask 默认 p2，updateTask 写入时同样迁移', () => {
  const s = newStore();
  const t = s.addTask({ title: '旧任务', priority: '高' });
  assert.equal(s.state.tasks[0].priority, 'p1');
  const t2 = s.addTask({ title: '无优先级' });
  assert.equal(s.state.tasks.find(x => x.id === t2.id).priority, 'p2');
  s.updateTask(t.id, { priority: '低' });
  assert.equal(s.state.tasks[0].priority, 'p4');
  s.updateTask(t.id, { priority: 'p3' });
  assert.equal(s.state.tasks[0].priority, 'p3');
});

test('优先级：normalize 从持久化数据加载时也执行迁移', () => {
  const st = { getItem: () => JSON.stringify({
    version: 1, settings: {},
    tasks: [{ id: 'x', title: 'a', date: '2026-08-10', priority: '中', done: false }]
  }), setItem: () => {}, removeItem: () => {} };
  const s = S.createStore(st);
  assert.equal(s.state.tasks[0].priority, 'p2');
});

/* ================= 数据层：今日完成率 ================= */

test('今日完成率：按日期统计完成占比', () => {
  const base = [
    { id: 'a', title: 'A', date: '2026-08-10', priority: 'p1', done: true },
    { id: 'b', title: 'B', date: '2026-08-10', priority: 'p2', done: false },
    { id: 'c', title: 'C', date: '2026-08-10', priority: 'p3', done: false },
    { id: 'd', title: '昨天', date: '2026-08-09', priority: 'p4', done: true }
  ];
  const r = S.todayProgress(base, '2026-08-10');
  assert.deepEqual(r, { done: 1, total: 3, pct: 33 }, '只统计当天的任务');
  assert.deepEqual(S.todayProgress([], '2026-08-10'), { done: 0, total: 0, pct: 0 }, '无任务为 0%');
  assert.deepEqual(S.todayProgress(base.map(t => ({ ...t, done: true })), '2026-08-10').pct, 100);
});

/* ================= UI：今日计划页 ================= */

function addSeedTask(h, title, priority) {
  return h.store.addTask({ title, date: S.todayStr(), priority });
}

test('今日页：顶部环形进度条展示今日完成率', () => {
  const h = boot();
  const day = S.todayStr();
  h.store.addTask({ title: 'A', date: day, priority: 'p1' });
  h.store.addTask({ title: 'B', date: day, priority: 'p2', done: true });
  h.store.addTask({ title: 'C', date: day, priority: 'p3' });
  h.store.addTask({ title: 'D', date: day, priority: 'p4', done: true });
  h.goto('today');
  const donut = h.window.document.querySelector('.tp-donut');
  assert.ok(donut, '应有环形进度容器');
  assert.ok(donut.style.background.includes('conic-gradient'), '应使用 conic-gradient 环形');
  assert.ok(donut.style.background.includes('50%'), '完成率 2/4 应为 50%');
  assert.equal(h.window.document.querySelector('.tp-hole b').textContent, '50%', '中间应显示百分比');
  assert.ok(h.window.document.querySelector('.tp-card').textContent.includes('已完成 2 / 4'), '应显示完成/总数');
});

test('今日页：无任务时环形 0%', () => {
  const h = boot();
  h.goto('today');
  assert.equal(h.window.document.querySelector('.tp-hole b').textContent, '0%');
});

test('今日页：四档优先级任务各渲染对应颜色圆点与中文标签', () => {
  const h = boot();
  addSeedTask(h, 'A', 'p1');
  addSeedTask(h, 'B', 'p2');
  addSeedTask(h, 'C', 'p3');
  addSeedTask(h, 'D', 'p4');
  h.goto('today');
  ['p1', 'p2', 'p3', 'p4'].forEach(p => {
    assert.ok(h.window.document.querySelector('.prio-dot[data-p="' + p + '"]'), '缺少圆点 ' + p);
  });
  const css = require('node:fs').readFileSync(require('node:path').join(require('node:path').dirname(__dirname), 'css', 'style.css'), 'utf8');
  assert.ok(/\.prio-dot\[data-p="p1"\]\s*\{\s*background:\s*var\(--accent\)/.test(css), 'p1 圆点应为朱砂红变量色');
  const tags = Array.from(h.window.document.querySelectorAll('.prio-tag')).map(x => x.textContent.trim());
  assert.ok(tags.includes('紧急重要'), '应显示标签 紧急重要');
  assert.ok(tags.includes('重要不紧急') && tags.includes('紧急不重要') && tags.includes('不紧急不重要'), '四种中文标签齐备');
});

test('今日页：旧数据（高/中/低）渲染为迁移后的圆点标签', () => {
  const h = boot({ seed: {
    version: 1, settings: {},
    tasks: [{ id: 't1', title: '旧任务', date: S.todayStr(), priority: '高', done: false }],
    memos: [], posts: [], devProjects: [], clients: [], books: [], news: [], designs: []
  } });
  h.goto('today');
  assert.ok(h.window.document.querySelector('.prio-dot[data-p="p1"]'), '旧 高 应渲染为 p1 圆点');
  assert.ok(h.window.document.querySelector('.prio-tag').textContent.includes('紧急重要'));
});

/* ================= UI：🍅 专注倒计时 ================= */

test('专注：开始后出现悬浮窗并进入倒计时，到时浏览器通知且窗口关闭', async () => {
  const h = boot();
  const calls = [];
  class FakeNotification {
    constructor(title, opts) { calls.push({ title, body: opts && opts.body }); }
  }
  FakeNotification.permission = 'granted';
  h.window.Notification = FakeNotification;
  h.goto('today');
  const t = addSeedTask(h, '写方案', 'p1');
  const dbg = h.window.__todayDbg;
  dbg.startFocus(h.window.__sonderHooks.ctx, t.id, 1);
  const float = h.window.document.querySelector('#focusFloat');
  assert.ok(float, '应出现专注悬浮窗');
  assert.ok(float.textContent.includes('写方案'), '悬浮窗应显示任务标题');
  assert.ok(float.textContent.includes('🍅 专注中'), '应有专注状态头');
  assert.ok(h.window.document.querySelector('#ffTime'), '应有倒计时');
  await wait(1500);
  assert.equal(h.window.__todayDbg.focusOpen(), false, '时间到后悬浮窗应关闭');
  assert.equal(calls.length, 1, '应发出浏览器通知');
  assert.ok(calls[0].title.includes('专注完成'), '通知标题应为专注完成');
  assert.ok(String(calls[0].body).includes('分钟专注'), '通知应说明时长');
  assert.ok(h.window.document.body.textContent.includes('专注完成'), '应有 toast 提醒');
});

test('专注：进行中再次点击任务提示已有专注，结束后可重开', async () => {
  const h = boot();
  h.goto('today');
  const t1 = addSeedTask(h, '任务1', 'p1');
  const t2 = addSeedTask(h, '任务2', 'p2');
  const dbg = h.window.__todayDbg;
  const ctx = h.window.__sonderHooks.ctx;
  dbg.startFocus(ctx, t1.id, 60);
  assert.ok(h.window.document.querySelector('#focusFloat'));
  dbg.startFocus(ctx, t2.id, 60);
  assert.equal(h.window.document.querySelectorAll('#focusFloat').length, 1, '不应叠加第二个悬浮窗');
  assert.ok(h.window.document.body.textContent.includes('已有专注在进行中'), '应提示已有专注');
  dbg.stopFocus();
  assert.equal(dbg.focusOpen(), false, '手动结束应关闭悬浮窗');
  dbg.startFocus(ctx, t2.id, 60);
  assert.ok(h.window.document.querySelector('#focusFloat'), '结束后应可重新开启');
  dbg.stopFocus();
});

test('专注：🍅 按钮出现在未完成任务右侧，已完成任务不显示', () => {
  const h = boot();
  addSeedTask(h, '未完成', 'p2');
  h.store.addTask({ title: '已完成', date: S.todayStr(), priority: 'p1', done: true });
  h.goto('today');
  const btns = Array.from(h.window.document.querySelectorAll('.focus-btn')).map(b => b.closest('[data-id]'));
  assert.equal(btns.length, 1, '只有一个未完成任务有 🍅 按钮');
  assert.ok(btns[0].textContent.includes('未完成'));
});