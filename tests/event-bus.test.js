'use strict';
/* SonderBus 事件总线 + store 数据变更广播集成测试 */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const B = require('../js/event-bus.js');
const S = require('../js/store.js');

beforeEach(() => { B.reset(); });

function memStorage(initial = {}) {
  const m = { ...initial };
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem(k, v) { m[k] = String(v); },
    removeItem(k) { delete m[k]; }
  };
}

test('总线：matches 路径匹配规则（精确/尾部通配/中部通配/不匹配）', () => {
  assert.ok(B.matches('/data/memos', '/data/memos'));
  assert.ok(B.matches('/data/*', '/data/memos'));
  assert.ok(B.matches('/data/*', '/data/dev/projects'), '尾部 * 跨层吞段');
  assert.ok(B.matches('/data/dev/*', '/data/dev/projects'));
  assert.ok(B.matches('/data/dev/*', '/data/dev/notes'));
  assert.ok(B.matches('/dev/*/list', '/dev/projects/list'), '中部 * 跨层匹配');
  assert.ok(!B.matches('/data/memos', '/data/tasks'));
  assert.ok(!B.matches('/data/*', '/settings/theme'), '前缀不同不匹');
  assert.ok(!B.matches('/data/dev/*', '/data/projects'), '中部固定段须存在');
  assert.ok(!B.matches('', '/data/memos'));
  assert.ok(B.matches('/data/*', '/data'));
});

test('总线：on/emit 触发与 off 取消；emit 携带路径与 detail', () => {
  const got = [];
  const un1 = B.on('/data/memos', (p, d) => got.push(['m1', p, d]));
  B.on('/data/memos', (p, d) => got.push(['m2', p, d]));
  B.emit('/data/memos', { x: 1 });
  assert.equal(got.length, 2);
  assert.deepEqual(got[0], ['m1', '/data/memos', { x: 1 }]);
  un1(); /* 取消订阅 */
  B.emit('/data/memos', { x: 2 });
  assert.equal(got.length, 3, '取消后仅剩 m2 收到');
});

test('总线：通配订阅接收子路径事件；单订阅者异常不拖垮广播', () => {
  const got = [];
  B.on('/data/*', p => got.push(p));
  B.on('/data/memos', () => { throw new Error('boom'); });
  B.emit('/data/memos');
  B.emit('/data/dev/projects');
  B.emit('/data/all');
  assert.deepEqual(got, ['/data/memos', '/data/dev/projects', '/data/all']);
});

test('总线：open 数据链：createStore → 变更 → 广播对应路径', () => {
  const original = globalThis.SonderBus;
  const emitted = [];
  globalThis.SonderBus = { bus: { emit: (p) => emitted.push(p) } };
  try {
    const s = S.createStore(memStorage());
    s.addMemo('备忘');
    s.addTask({ title: '任务' });
    s.addPost({ title: '内容' });
    s.addDevProject({ name: '项目' });
    s.addDevNote({ title: '笔记' });
    s.addDevSnippet({ title: '片段' });
    s.addClient({ name: '客户' });
    s.addBook({ title: '书' });
    s.addExcerpt({ bookId: '', text: '摘录', bookTitle: '未知' });
    s.addNews({ title: '新闻' });
    s.addDesign({ title: '设计' });
    s.addGameRecord({ kind: 'tictactoe', winner: 'X' });
    s.updateMiniRecord('guessnum', { best: 3 });
    s.setTheme('dark');
    s.clearAll();
    assert.deepEqual(emitted, [
      '/data/memos', '/data/tasks', '/data/posts', '/data/devProjects', '/data/devNotes',
      '/data/devSnippets', '/data/clients', '/data/books', '/data/excerpts', '/data/news',
      '/data/designs', '/data/gameRecords', '/data/miniRecords', '/data/settings', '/data/all'
    ]);
  } finally {
    if (original) globalThis.SonderBus = original; else delete globalThis.SonderBus;
  }
});

test('总线：无 SonderBus 环境 store 正常工作且不抛错', () => {
  const original = globalThis.SonderBus;
  delete globalThis.SonderBus;
  try {
    const s = S.createStore(memStorage());
    const m = s.addMemo('数据');
    assert.equal(m.text, '数据');
    s.updateMemo(m.id, { text: '改' });
    s.removeMemo(m.id);
    s.undoRemove(); /* 撤销恢复也应静默 */
    s.setTheme('light');
    assert.equal(s.state.memos[0].text, '改');
  } finally {
    if (original) globalThis.SonderBus = original;
  }
});

test('总线：嵌套变更（子任务/子跟进）也广播父级路径，供页面整体重绘', () => {
  const original = globalThis.SonderBus;
  const emitted = [];
  globalThis.SonderBus = { bus: { emit: (p) => emitted.push(p) } };
  try {
    const s = S.createStore(memStorage());
    const c = s.addClient({ name: '客户' });
    const pr = s.addClientProject(c.id, { name: '子项目' });
    s.updateClientProject(c.id, pr.id, { stage: '完成' });
    s.removeClientProject(c.id, pr.id);
    const book = s.addBook({ title: '书' });
    s.addReadingSession(book.id, 25);
    s.addBookNote(book.id, '笔记');
    s.updateDevTask('0', '0', { done: true }); /* 不存在的项目：无广播 */
    assert.ok(emitted.filter(p => p === '/data/clients').length === 4, 'clients 全部子操作广播');
    assert.ok(emitted.filter(p => p === '/data/books').length === 3, 'books 子操作广播');
    assert.ok(!emitted.includes('/data/devProjects') || emitted.filter(p => p === '/data/devProjects').length === 0, '无效操作不广播');
  } finally {
    if (original) globalThis.SonderBus = original;
  }
});