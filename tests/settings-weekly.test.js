'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const S = require('../js/store.js');

test('周报：返回本周周一到周日边界', () => {
  const s = S.createStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
  const r = s.buildWeeklyReport('2026-08-11T10:00:00+08:00'); /* 2026-08-11 是周二 */
  assert.equal(r.start, '2026-08-10');
  assert.equal(r.end, '2026-08-16');
  const r2 = s.buildWeeklyReport('2026-08-09T10:00:00+08:00'); /* 周日 → 本周从周一 08-03 起 */
  assert.equal(r2.start, '2026-08-03');
  assert.equal(r2.end, '2026-08-09');
  const r3 = s.buildWeeklyReport('2026-08-10T10:00:00+08:00'); /* 周一 */
  assert.equal(r3.start, '2026-08-10');
  assert.equal(r3.end, '2026-08-16');
});

test('周报：本周任务/阅读/随手记/选题统计与完成率', () => {
  const s = S.createStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
  s.state.tasks = [
    { id: 't1', date: '2026-08-10', done: true, priority: 'p1' },
    { id: 't2', date: '2026-08-12', done: false, priority: 'p2' },
    { id: 't3', date: '2026-08-15', done: true, priority: 'p3' },
    { id: 't4', date: '2026-08-09', done: true, priority: 'p4' } /* 上周日，不计 */
  ];
  s.state.books = [
    /* 真实写入形态：addReadingSession 追加 {date, minutes} 会话条目 */
    { id: 'b1', title: 'A', status: '在读', readingLog: [
      { date: '2026-08-11', minutes: 30 }, { date: '2026-08-13', minutes: 25 }, { date: '2026-08-11', minutes: 0 }
    ] },
    { id: 'b2', title: 'B', status: '在读', readingLog: [{ date: '2026-08-09', minutes: 90 }] } /* 上周日，不计 */
  ];
  s.state.memos = [
    { id: 'm1', time: '2026-08-10T09:00:00+08:00', text: '灵感' },
    { id: 'm2', time: '2026-08-17T09:00:00+08:00', text: '下周' } /* 下周一，不计 */
  ];
  s.state.posts = [
    { id: 'p1', title: 'A篇', platform: '公众号', publishDate: '2026-08-11' },
    { id: 'p2', title: 'B篇', platform: '小红书', date: '2026-08-14' } /* 全平台请用 publishDate，date 兜底 */
  ];
  const r = s.buildWeeklyReport('2026-08-11T10:00:00+08:00');
  assert.equal(r.tasksTotal, 3);
  assert.equal(r.tasksDone, 2);
  assert.equal(r.rate, 67);
  assert.equal(r.readingMinutes, 55);
  assert.equal(r.memos, 1);
  assert.equal(r.topics, 2);
  assert.equal(r.text, ['本周周报（2026-08-10 ~ 2026-08-16）', '',
    '• 本周计划任务 3 条，完成 2 条（完成率 67%）',
    '• 阅读 55 分钟', '• 随手记 1 条', '• 新增自媒体选题 2 个', '',
    '—— Sonder 自动生成'].join('\n'));
});

test('周报：空数据周返回全零不报错', () => {
  const s = S.createStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
  const r = s.buildWeeklyReport('2026-08-13T10:00:00+08:00');
  assert.equal(r.tasksTotal, 0);
  assert.equal(r.rate, 0);
  assert.equal(r.readingMinutes, 0);
  assert.ok(r.text.includes('完成率 0%'));
});

test('周报：addReadingSession 真实写入路径可被统计（防假绿回归）', () => {
  const s = S.createStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
  s.state.books = [{ id: 'b1', title: 'A', status: 'reading', progress: 0, notes: [], readingLog: [] }];
  s.addReadingSession('b1', 30); /* 真实 API：写入 {date, minutes} 会话条目 */
  s.addReadingSession('b1', 25); /* 同日两次会话应累加 */
  const r = s.buildWeeklyReport(new Date().toISOString());
  assert.equal(r.readingMinutes, 55, '真实写入的会话应被周报累加统计');
});

test('设置页：生成本周报告按钮 → 展示文本并可复制', () => {
  const h = boot();
  h.store.state.tasks = [
    { id: 't1', date: '2026-08-10', done: true, priority: 'p1' },
    { id: 't2', date: '2026-08-12', done: false, priority: 'p2' }
  ];
  h.goto('settings');
  const btn = h.window.document.querySelector('#btnWeekly');
  assert.ok(btn, '设置页应有生成本周报告按钮');
  assert.equal(h.window.document.querySelector('#weeklyOut').style.display, 'none', '初始隐藏');
  btn.click();
  const pre = h.window.document.querySelector('.weekly-text');
  assert.notEqual(pre.textContent.length, 0, '报告文本已填充');
  assert.ok(pre.textContent.includes('本周周报'), '含周报标题');
  assert.ok(pre.textContent.includes('完成率'), '含完成率');
  assert.notEqual(h.window.document.querySelector('#weeklyOut').style.display, 'none', '展示报告区');
  let copied = '';
  h.window.navigator.clipboard = { writeText: t => Promise.resolve(copied = t) };
  h.window.document.querySelector('#weeklyCopy').click();
  return Promise.resolve().then(() => {
    assert.ok(copied.includes('本周周报'), '一键复制获得报告全文');
  });
});

test('设置页统计：完成率分母为今日到期任务而非全量历史', () => {
  const day = S.todayStr();
  const seed = S.defaultState();
  seed.tasks = [
    { id: 'h1', title: '历史任务A', date: '2026-01-05', priority: '中', done: true, doneAt: '2026-01-05T10:00:00.000Z' },
    { id: 'h2', title: '历史任务B', date: '2026-01-06', priority: '中', done: true, doneAt: '2026-01-06T10:00:00.000Z' },
    { id: 'a1', title: '今日已办', date: day, priority: '中', done: true, doneAt: new Date().toISOString() },
    { id: 'a2', title: '今日待办', date: day, priority: '中', done: false }
  ];
  const h = boot({ seed });
  h.goto('settings');
  const txt = h.$('#content').textContent;
  assert.ok(txt.includes('1/4'), '今日计划框为 今日完成/全量任务：1/4');
  assert.ok(txt.includes('完成率 50%'), '完成率分母应为今日到期任务（1 完成 + 1 待办 = 1/2），而非全量（1/4）');
});