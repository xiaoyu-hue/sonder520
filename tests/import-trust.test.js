'use strict';
/* 导入信任边界契约测试（Commit 3 XSS 攻击链切断）：
 * 恶意备份文件（属性逃逸 id / 越界 progress）经 normalize 后必须被收口——
 * 全应用 24 处 data-* 属性位裸插值的安全前提由导入路径根上保证。 */
const { test } = require('node:test');
const assert = require('node:assert');
const S = require('../js/store.js');
const { boot } = require('./harness.js');

function memStorage() {
  const m = {};
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem(k, v) { m[k] = String(v); },
    removeItem(k) { delete m[k]; }
  };
}

/* 属性逃逸 id：闭合 data-id=" 后注入标签/事件 */
const EVIL_ID = '"><script nonce="sw">alert(1)</script>';
const EVIL_PROGRESS = '50"><img src=x onerror=alert(2)>';

function evilSeed() {
  return {
    version: 1,
    settings: {},
    tasks: [{ id: EVIL_ID, title: '正常标题', date: '', priority: 'p2', done: false }],
    memos: [{ id: EVIL_ID, text: '正常备忘', time: '', archived: false }],
    posts: [{ id: 'ok-post-1', title: '合法id保留', tags: [], status: 'draft' }],
    books: [{ id: 'ok-book-1', title: '书', author: '', status: 'reading', progress: EVIL_PROGRESS, notes: [] }],
    devProjects: [{
      id: EVIL_ID, name: '嵌套注入', note: '', createdAt: '',
      tasks: [{ id: EVIL_ID, title: '子任务', done: false }]
    }],
    clients: [{
      id: 'ok-client-1', name: '客户', contact: '', note: '',
      projects: [], followups: [], income: []
    }]
  };
}

const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

test('导入信任：恶意 id 被 uid 重生，合法 id 原样保留', async () => {
  const s = S.createStore(memStorage());
  const r = await s.importBackup(JSON.stringify(evilSeed()));
  assert.ok(r && r.ok, '备份格式本身合法，导入应成功');

  assert.notEqual(s.state.tasks[0].id, EVIL_ID, '逃逸 id 必须被替换');
  assert.match(s.state.tasks[0].id, SAFE_ID_RE, '重生 id 符合白名单形态');
  assert.match(s.state.memos[0].id, SAFE_ID_RE, '备忘 id 同样收口');
  assert.match(s.state.devProjects[0].id, SAFE_ID_RE, '项目顶层 id 收口');
  assert.match(s.state.devProjects[0].tasks[0].id, SAFE_ID_RE, '嵌套 devTasks id 收口');
  assert.equal(s.state.posts[0].id, 'ok-post-1', '合法 id 不被误重生');
  assert.equal(s.state.clients[0].id, 'ok-client-1', '合法 client id 保留');
  /* 同批多条非法 id 各自独立重生（不共享同一 uid） */
  assert.notEqual(s.state.tasks[0].id, s.state.memos[0].id, '逐条独立生成');
});

test('导入信任：book.progress 数值夹紧（字符串注入/越界值）', async () => {
  const s = S.createStore(memStorage());
  await s.importBackup(JSON.stringify(evilSeed()));
  assert.equal(s.state.books[0].progress, 0, '非数字注入串归零');
});

test('导入信任：progress 越界数字夹紧到 [0,100]', async () => {
  const seed = evilSeed();
  seed.books[0].progress = 250;
  const s = S.createStore(memStorage());
  await s.importBackup(JSON.stringify(seed));
  assert.equal(s.state.books[0].progress, 100, '>100 夹到 100');

  const seed2 = evilSeed();
  seed2.books[0].progress = -5;
  const s2 = S.createStore(memStorage());
  await s2.importBackup(JSON.stringify(seed2));
  assert.equal(s2.state.books[0].progress, 0, '<0 夹到 0');

  const seed3 = evilSeed();
  seed3.books[0].progress = 42.5;
  const s3 = S.createStore(memStorage());
  await s3.importBackup(JSON.stringify(seed3));
  assert.equal(s3.state.books[0].progress, 42.5, '合法数值原样保留');
});

test('端到端：恶意 id 种子经 normalize 渲染后 DOM 无属性逃逸', () => {
  const h = boot({ seed: evilSeed() });
  const c = h.window.document.getElementById('content');
  h.goto('today');
  const html = c.innerHTML;
  assert.ok(!html.includes('<script'), '不得出现原始 script 标签');
  assert.ok(!html.includes('<img'), '不得出现注入 img 元素');
  assert.ok(!/[a-z-]+\s*=\s*"[^"]*"\s*(onerror|onclick|onload)\s*=/i.test(html), '不得出现事件属性注入');
  assert.ok(html.includes('正常标题'), '任务标题文本正常显示');
});
