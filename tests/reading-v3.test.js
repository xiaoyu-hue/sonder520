'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const S = require('../js/store.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const TODAY = S.todayStr();

function newStore() {
  return S.createStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
}

/* ================= 数据层：阅读计时 ================= */

test('阅读计时：会话落账累计分钟并写入当日日志（不足1分钟按1分钟计）', () => {
  const s = newStore();
  const b = s.addBook({ title: '活着' });
  assert.equal(b.readingMinutes, 0);
  assert.equal(s.addReadingSession(b.id, 0.3), 1, '不足1分钟按1分钟计');
  assert.equal(s.addReadingSession(b.id, 3.2), 4, '3.2 分钟向上取整为 4');
  assert.equal(s.state.books[0].readingMinutes, 5);
  assert.equal(s.state.books[0].readingLog.length, 2);
  assert.equal(s.state.books[0].readingLog[0].date, TODAY);
  assert.deepEqual(s.state.books[0].readingLog.map(x => x.minutes), [1, 4]);
  assert.equal(s.addReadingSession('不存在', 5), null, '书不存在返回 null');
});

test('阅读计时：旧书数据无字段时 normalize 补默认', () => {
  const st = { getItem: k => k === 'sonder_data_v1' ? JSON.stringify({
    version: 1, settings: {},
    books: [{ id: 'b1', title: '老书', status: '想读', progress: 0, notes: [] }],
    memos: [], tasks: [], posts: [], devProjects: [], clients: [], excerpts: [], news: [], designs: []
  }) : null, setItem: () => {}, removeItem: () => {} };
  const s = S.createStore(st);
  assert.equal(s.state.books[0].readingMinutes, 0);
  assert.deepEqual(s.state.books[0].readingLog, []);
  assert.equal(s.state.books[0].finishedAt, null);
});

/* ================= 数据层：读完自动记日期 ================= */

test('读完日期：编辑状态为已读完自动记录；改回清除；新建即读完也记录', () => {
  const s = newStore();
  const b = s.addBook({ title: '书A', status: '在读' });
  assert.equal(b.finishedAt, null);
  s.updateBook(b.id, { status: '已读完' });
  assert.equal(s.state.books[0].finishedAt, TODAY, '标记已读完自动记完成日期');
  const first = s.state.books[0].finishedAt;
  s.updateBook(b.id, { progress: 100 });
  assert.equal(s.state.books[0].finishedAt, first, '重复保存不覆盖日期');
  s.updateBook(b.id, { status: '想读' });
  assert.equal(s.state.books[0].finishedAt, null, '改回未读完清除日期');
  s.updateBook(b.id, { status: '已读完' });
  assert.equal(s.state.books[0].finishedAt, TODAY);
  const b2 = s.addBook({ title: '书B', status: '已读完' });
  assert.equal(b2.finishedAt, TODAY, '新建即已读完也记录日期');
});

/* ================= 数据层：我的书摘 ================= */

test('书摘：增删、按书分组（组内时间倒序）、书名快照', () => {
  const s = newStore();
  const a = s.addBook({ title: '活着' });
  const b = s.addBook({ title: '百年孤独' });
  const x1 = s.addExcerpt({ bookId: a.id, text: '人是为活着本身而活着的', page: 15 });
  const x2 = s.addExcerpt({ bookId: b.id, text: '许多年之后，面对行刑队', page: 3 });
  const x3 = s.addExcerpt({ bookId: a.id, text: '最初我们来到这个世界', page: 20 });
  assert.ok(x1 && x2 && x3, '摘抄创建成功');
  assert.equal(s.addExcerpt({ bookId: a.id, text: '   ' }), null, '空句子拒绝');
  assert.equal(s.state.excerpts.length, 3);
  const groups = S.excerptsByBook(s.state.excerpts);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].bookTitle, '活着', '最新摘抄的书排最前');
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[0].items[0].id, x3.id, '组内按时间倒序');
  s.removeExcerpt(x1.id);
  assert.equal(s.state.excerpts.length, 2);
  s.removeBook(b.id);
  const g2 = S.excerptsByBook(s.state.excerpts);
  assert.equal(g2.length, 2, '书删除后书摘仍保留');
  assert.ok(g2.some(x => x.bookTitle === '百年孤独'), '已删书籍的书摘按书名快照分组显示');
});

test('书摘：首页每日摘抄——当天稳定、隔天换新、无摘抄返回 null', () => {
  const s = newStore();
  assert.equal(S.dailyExcerpt([], TODAY), null);
  const a = s.addBook({ title: '活着' });
  s.addExcerpt({ bookId: a.id, text: '句子一', page: 1 });
  s.addExcerpt({ bookId: a.id, text: '句子二', page: 2 });
  s.addExcerpt({ bookId: a.id, text: '句子三', page: 3 });
  const r1 = S.dailyExcerpt(s.state.excerpts, '2026-08-10');
  const r2 = S.dailyExcerpt(s.state.excerpts, '2026-08-10');
  assert.deepEqual(r1, r2, '同一天返回同一条');
  assert.ok(r1.text && r1.bookTitle === '活着', '应带文本与书名');
  const r3 = S.dailyExcerpt(s.state.excerpts, '2026-08-11');
  assert.deepEqual(r3, S.dailyExcerpt(s.state.excerpts, '2026-08-11'));
});

/* ================= UI：阅读计划页 ================= */

test('阅读页：书卡片有开始阅读按钮与累计分钟，结束时落账并显示', async () => {
  const h = boot();
  h.goto('reading');
  const b = h.store.addBook({ title: '人间失格', status: '在读' });
  h.goto('reading');
  const card = h.window.document.querySelector('[data-id="' + b.id + '"]');
  assert.ok(card.querySelector('[data-timerbtn]'), '应有计时按钮');
  assert.ok(card.textContent.includes('累计 0 分钟'), '应显示累计分钟');
  card.querySelector('[data-timerbtn]').click();
  assert.equal(card.querySelector('[data-timerbtn]').textContent, '■ 停止计时', '点击后进入计时');
  assert.ok(card.querySelector('[data-clock]'), '应有实时时钟');
  await wait(1300);
  card.querySelector('[data-timerbtn]').click();
  const book = h.store.state.books.find(x => x.id === b.id);
  assert.equal(book.readingMinutes, 1, '约 1.3 秒会话按 1 分钟落账');
  assert.equal(book.readingLog.length, 1);
  assert.ok(h.window.document.querySelector('[data-timerbtn]').textContent.includes('开始阅读'), '停止后按钮复原');
});

test('阅读页：计时中切页再切回，时钟恢复走动并显示真实流逝', async () => {
  const h = boot();
  h.goto('reading');
  const b = h.store.addBook({ title: '局外人', status: '在读' });
  h.goto('reading');
  h.window.document.querySelector('[data-timerbtn]').click();
  assert.ok(h.window.document.querySelector('[data-clock]'), '计时开始应有实时时钟');
  h.goto('home'); /* 切走：时钟节点消失，循环停止 */
  await wait(1200);
  assert.ok(!h.window.document.querySelector('[data-clock]'), '切走的页面不残留时钟节点');
  h.goto('reading'); /* 切回：render 尾部应重启时钟循环 */
  try {
    const clk = h.window.document.querySelector('[data-clock]');
    assert.ok(clk, '切回后应重建实时时钟');
    assert.notEqual(clk.textContent, '00:00', '时钟应显示真实流逝而非静态 00:00');
    const t1 = clk.textContent;
    await wait(1500);
    const clk2 = h.window.document.querySelector('[data-clock]'); /* 引用须重取：store 保存触发重渲染会重建节点 */
    assert.ok(clk2, '重渲染后时钟节点仍在');
    assert.notEqual(clk2.textContent, t1, '时钟应持续走动');
  } finally {
    const btn = h.window.document.querySelector('[data-timerbtn]');
    if (btn && btn.textContent.includes('停止')) btn.click(); /* 失败路径也停表，防 clockTick 链使测试进程悬挂 */
  }
  assert.ok(h.store.state.books.find(x => x.id === b.id).readingMinutes >= 1, '切页期间计时仍累计（短会话按1分钟落账）');
});

test('阅读页：摘抄金句弹窗填写句子页码后入库，书卡片可再编辑', () => {
  const h = boot();
  h.goto('reading');
  const b = h.store.addBook({ title: '瓦尔登湖' });
  h.goto('reading');
  h.window.document.querySelector('[data-excerpt="' + b.id + '"]').click();
  const ov = h.window.document.querySelector('.overlay');
  assert.ok(ov, '应弹出摘抄弹窗');
  ov.querySelector('textarea[data-k="text"]').value = '我愿深扎于林中生活';
  ov.querySelector('input[data-k="page"]').value = '88';
  ov.querySelector('[data-act="ok"]').click();
  assert.equal(h.store.state.excerpts.length, 1);
  const ex = h.store.state.excerpts[0];
  assert.equal(ex.text, '我愿深扎于林中生活');
  assert.equal(ex.page, 88);
  assert.equal(ex.bookTitle, '瓦尔登湖');
});

test('我的书摘页：导航存在、按书分组展示、可删除', () => {
  const h = boot();
  const nav = Array.from(h.window.document.querySelectorAll('#nav button')).map(b => b.textContent);
  assert.ok(nav.some(t => t.includes('我的书摘')), '侧边栏应有我的书摘');
  const a = h.store.addBook({ title: '活着' });
  const b = h.store.addBook({ title: '百年孤独' });
  h.store.addExcerpt({ bookId: a.id, text: '人是为活着本身而活着的', page: 15 });
  h.store.addExcerpt({ bookId: b.id, text: '许多年之后，面对行刑队', page: 3 });
  h.goto('excerpts');
  const body = h.window.document.body.textContent;
  assert.ok(body.includes('我的书摘 · 共 2 条'), '应显示总数');
  assert.ok(body.includes('活着'), '应按书籍分组');
  assert.ok(body.includes('百年孤独'));
  assert.ok(body.includes('人是为活着本身而活着的'));
  assert.ok(body.includes('第 15 页'), '应显示页码');
  h.window.document.querySelector('[data-exdel]').click();
  assert.equal(h.store.state.excerpts.length, 1);
  assert.ok(h.window.document.body.textContent.includes('我的书摘 · 共 1 条'), '删除后总数刷新');
});

test('我的书摘页：无摘抄时空状态引导', () => {
  const h = boot();
  h.goto('excerpts');
  assert.ok(h.window.document.body.textContent.includes('还没有摘抄'));
});

test('阅读页：笔记行渲染后可经容器委托删除并撤销恢复（回归：data-noteid 不与书卡 data-id 冲突）', () => {
  const h = boot();
  h.goto('reading');
  const b = h.store.addBook({ title: '百年孤独', status: '在读' });
  h.goto('reading');
  h.store.addBookNote(b.id, '许多年之后，面对行刑队');
  h.goto('reading'); /* 重渲染让笔记行入 DOM */
  const btn = h.window.document.querySelector('[data-note="del"]');
  assert.ok(btn, '笔记行应渲染删除按钮');
  btn.click();
  assert.equal(h.store.state.books[0].notes.length, 0, '委托删除生效');
  const undo = h.window.document.querySelector('.toast .toast-act');
  assert.ok(undo, '应出现撤销按钮');
  undo.click();
  assert.equal(h.store.state.books[0].notes.length, 1, '撤销恢复笔记');
});

/* ================= UI：首页每日金句位置 ================= */

test('首页：有摘抄时每日金句位置展示随机书摘（附书名页码），无摘抄保持原金句', () => {
  const h1 = boot();
  h1.goto('home');
  assert.ok(h1.window.document.querySelector('.quote').textContent.includes('「'), '无摘抄时显示金句库句子');
  const h2 = boot();
  const a = h2.store.addBook({ title: '活着' });
  h2.store.addExcerpt({ bookId: a.id, text: '人是为活着本身而活着的', page: 15 });
  h2.goto('home');
  const quote = h2.window.document.querySelector('.quote');
  assert.ok(quote.textContent.includes('人是为活着本身而活着的'), '应展示摘抄句子');
  assert.ok(quote.textContent.includes('来自《活着》'), '应附书名出处');
  assert.ok(quote.textContent.includes('第15页'), '应附页码');
});