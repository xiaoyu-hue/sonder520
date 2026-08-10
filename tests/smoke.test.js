'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const S = require('../js/store.js');

const PAGES = ['home', 'today', 'memo', 'selfmedia', 'dev', 'consulting', 'reading', 'news', 'design', 'game', 'settings'];

function fullSeed() {
  const seed = S.defaultState();
  seed.tasks = [
    { id: 't1', title: '任务一', note: '多行\n备注', date: S.todayStr(), priority: '高', done: false, order: 0 },
    { id: 't2', title: '过期任务', date: '2020-01-01', priority: '低', done: false, order: 1 },
    { id: 't3', title: '已完成', date: '2026-08-09', priority: '中', done: true, doneAt: '', order: 2 }
  ];
  seed.memos = [
    { id: 'm1', text: '备忘内容', time: '2026-08-10T01:00:00.000Z', archived: false },
    { id: 'm2', text: '归档的', time: '2026-08-09T01:00:00.000Z', archived: true }
  ];
  seed.posts = [
    { id: 'p1', title: '选题A', platform: 'B站', tags: ['技术', 'AI'], status: 'published', note: '', date: '2026-08-01', views: 100, likes: 5, comments: 2, favorites: 1 },
    { id: 'p2', title: '草稿', platform: '', tags: [], status: 'draft', note: '', date: '', views: 0, likes: 0, comments: 0, favorites: 0 }
  ];
  seed.devProjects = [
    { id: 'd1', name: '项目A', note: '', tasks: [
      { id: 'dt1', title: '任务X', note: '', done: true },
      { id: 'dt2', title: '任务Y', note: '', done: false }
    ], createdAt: '' }
  ];
  seed.clients = [
    { id: 'c1', name: '客户一', contact: 'tel', note: '备注', projects: [{ name: '子项目', note: '' }],
      followups: [{ text: '跟进', time: '', done: false }], income: [{ amount: 100, time: '', note: '' }] }
  ];
  seed.books = [
    { id: 'b1', title: '书一', author: '作者', status: '在读', progress: 40, notes: [{ id: 'n1', text: '笔记', time: '' }] },
    { id: 'b2', title: '读完', author: '', status: '已读完', progress: 100, notes: [] }
  ];
  seed.news = [
    { id: 'n1', title: '新闻A', url: 'https://x.com', source: '源', tags: ['标签'], status: 'unread', time: '' },
    { id: 'n2', title: '收藏', url: '', source: '', tags: [], status: 'favorite', time: '' }
  ];
  seed.designs = [
    { id: 'x1', type: 'idea', title: '灵感A', link: '', category: '平面', note: '', stage: '', time: '' },
    { id: 'x2', type: 'project', title: '项目B', link: 'https://y.com', category: '', note: '', stage: '进行中', time: '' }
  ];
  seed.gameRecords = [
    { id: 'g1', kind: 'gomoku', mode: 'ai', player: 'X', winner: 'X', byResign: false, difficulty: 'hard', date: '2026-08-09', time: '' },
    { id: 'g2', kind: 'tictactoe', mode: 'pvp', player: 'X', winner: 'O', byResign: true, difficulty: null, date: '2026-08-08', time: '' }
  ];
  seed.settings = S.defaultState().settings;
  return seed;
}

function walkAll(h) {
  for (const p of PAGES) {
    h.goto(p);
    const c = h.window.document.getElementById('content');
    assert.ok(c && c.textContent.length > 0, p + ' 页面应有渲染内容');
  }
}

test('冒烟：空数据遍历全部 11 个页面无异常', () => {
  walkAll(boot());
});

test('冒烟：满数据遍历全部页面 + 关键交互点击不崩溃', async () => {
  const h = boot({ seed: fullSeed() });
  const w = h.window, doc = w.document;
  walkAll(h);

  /* 今日：编辑任务弹窗打开并保存 */
  h.goto('today');
  doc.querySelector('[data-act="edit"]').click();
  assert.ok(doc.querySelector('.overlay'), '应打开编辑弹窗');
  doc.querySelector('[data-act="ok"]').click();
  assert.equal(h.store.state.tasks[0].title, '任务一', '保存后数据不变');

  /* 今日：任务上移/下移交换顺序 */
  const idsBefore = h.store.state.tasks.map(t => t.id);
  doc.querySelector('[data-act="down"]').click();
  assert.notDeepEqual(h.store.state.tasks.map(t => t.id), idsBefore, '下移应交换任务顺序');
  doc.querySelector('[data-act="up"]').click();
  assert.deepEqual(h.store.state.tasks.map(t => t.id), idsBefore, '上移应还原任务顺序');

  /* 弹窗取消按钮关闭而保存 */
  doc.querySelector('[data-act="edit"]').click();
  doc.querySelector('[data-act="cancel"]').click();
  assert.equal(doc.querySelector('.overlay'), null, '取消应关闭弹窗且不改数据');
  assert.equal(h.store.state.tasks[0].title, '任务一');

  /* 备忘：归档交互 */
  h.goto('memo');
  doc.querySelector('[data-act="archive"]').click();
  assert.equal(h.store.state.memos[0].archived, true, '归档生效');

  /* 自媒体：状态筛选切换 */
  h.goto('selfmedia');
  const filter = doc.querySelector('#smFilter');
  if (filter) {
    filter.value = 'published';
    filter.dispatchEvent(new w.Event('change', { bubbles: true }));
  }
  assert.ok(doc.querySelector('.list-item, .empty'), '筛选后仍有渲染');

  /* 开发：编辑项目弹窗 */
  h.goto('dev');
  const devEdit = doc.querySelector('[data-pedit]');
  if (devEdit) { devEdit.click(); assert.ok(doc.querySelector('.overlay'), '项目编辑弹窗打开'); doc.querySelector('[data-act="ok"]').click(); }

  /* 咨询：展开客户卡片 */
  h.goto('consulting');
  const cx = doc.querySelector('[data-cx]');
  assert.ok(cx, '客户卡片含展开按钮');
  cx.click();
  assert.equal(doc.querySelector('[data-call]').style.display, 'block', '展开后详情可见');

  /* 阅读：进度条拖动事件 */
  h.goto('reading');
  const slider = doc.querySelector('input[type="range"]');
  if (slider) {
    slider.value = '60';
    slider.dispatchEvent(new w.Event('input', { bubbles: true }));
    assert.ok(h.store.state.books[0].progress >= 0, '进度更新不崩溃');
  }

  /* 新闻：标已读 */
  h.goto('news');
  const mark = doc.querySelector('[data-act="mark"]');
  if (mark) { mark.click(); assert.equal(h.store.state.news[0].status, 'read', '标已读生效'); }

  /* 设计：编辑灵感 */
  h.goto('design');
  const dEdit = doc.querySelector('[data-act="edit"]');
  if (dEdit) { dEdit.click(); assert.ok(doc.querySelector('.overlay')); doc.querySelector('[data-act="ok"]').click(); }

  /* 游戏：开局-落子-认输 全流程 */
  h.goto('game');
  doc.querySelector('[data-pick="tictactoe"]').click();
  const cell = (r, c) => doc.querySelector('.cell[data-r="' + r + '"][data-c="' + c + '"]');
  cell(0, 0).click();
  await new Promise(r => setTimeout(r, 30));
  doc.querySelector('[data-act="resign"]').click();
  await new Promise(r => setTimeout(r, 20));
  doc.querySelector('[data-act="yes"]').click();
  await new Promise(r => setTimeout(r, 60));
  assert.equal(h.store.state.gameRecords.length, 3, '认输应产生新记录');

  /* 游戏：返回选游戏页（有走子需确认） */
  doc.querySelector('[data-act="back"]').click();
  await new Promise(r => setTimeout(r, 20));
  doc.querySelector('[data-act="yes"]').click();
  await new Promise(r => setTimeout(r, 20));
  assert.ok(doc.querySelector('[data-pick]'), '应回到选游戏界面');

  /* 设置：主题切换与迁移按钮点击 */
  h.goto('settings');
  const themeBtn = doc.querySelector('#thDark, [data-theme="dark"]');
  if (themeBtn) themeBtn.click();
  const migrate = doc.querySelector('#btnMigrateIdb');
  if (migrate) migrate.click(); // 无 IDB 环境应 toast 报错而非崩溃

  /* 全局搜索：输入触发索引 */
  const gs = doc.querySelector('#globalSearch');
  gs.value = '任务';
  gs.dispatchEvent(new w.Event('input', { bubbles: true }));
  assert.ok(doc.querySelector('#gsearchPanel').textContent.includes('任务'), '搜索应命中');
});