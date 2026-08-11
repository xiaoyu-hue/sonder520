'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const S = require('../js/store.js');

function memStorage(initial = {}) {
  const m = { ...initial };
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem(k, v) { m[k] = String(v); },
    removeItem(k) { delete m[k]; }
  };
}
function newStore(initial) { return S.createStore(memStorage(initial)); }

test('默认结构：空列表 + 有效设置 + 模块全开', () => {
  const s = newStore();
  assert.equal(s.state.version, 1);
  assert.equal(s.state.memos.length, 0);
  assert.equal(s.state.tasks.length, 0);
  ['today', 'memo', 'selfmedia', 'dev', 'consulting', 'reading', 'news', 'design']
    .forEach(k => assert.equal(s.state.settings.modules[k], true));
  assert.equal(s.state.settings.theme, 'auto');
});

test('持久化：同一 storage 两个实例数据不丢（模拟刷新/重启）', () => {
  const storage = memStorage();
  const a = S.createStore(storage);
  a.addMemo('第一条备忘');
  a.addTask({ title: 'A', date: '2030-01-01' });
  const b = S.createStore(storage); // 重新读取
  assert.equal(b.state.memos.length, 1);
  assert.equal(b.state.memos[0].text, '第一条备忘');
  assert.equal(b.state.tasks.length, 1);
});

test('快速备忘：新增/按时间倒序/归档/删除', () => {
  const s = newStore();
  const m1 = s.addMemo('一');
  const m2 = s.addMemo('二');
  assert.equal(s.state.memos[0].id, m2.id); // 最新的在最前
  s.updateMemo(m1.id, { archived: true });
  assert.equal(s.state.memos.find(m => m.id === m1.id).archived, true);
  s.removeMemo(m2.id);
  assert.equal(s.state.memos.length, 1);
});

test('今日计划：groupTasks 分组正确（排序与分组）', () => {
  const t0 = '2030-06-10';
  const done = { id: 'd1', date: t0, done: true, doneAt: 'x', order: 0 };
  const now = { id: 'n1', date: t0, done: false, order: 2 };
  const now2 = { id: 'n2', date: t0, done: false, order: 1 };
  const overdue = { id: 'o1', date: '2030-06-01', done: false, order: 3 };
  const upcoming = { id: 'u1', date: '2030-06-20', done: false, order: 4 };
  const g = S.groupTasks([overdue, upcoming, done, now, now2], t0);
  assert.deepEqual(g.now.map(x => x.id), ['n2', 'n1']);
  assert.deepEqual(g.overdue.map(x => x.id), ['o1']);
  assert.deepEqual(g.upcoming.map(x => x.id), ['u1']);
  assert.deepEqual(g.done.map(x => x.id), ['d1']);
});

test('今日计划：CRUD 与勾选、完成时间、越界排序不报错', () => {
  const s = newStore();
  const t = s.addTask({ title: '写周报', priority: '高', note: 'n' });
  assert.equal(s.state.tasks[0].title, '写周报');
  assert.equal(s.state.tasks[0].priority, 'p1', '旧版 高 应迁移为 p1（紧急重要）');
  const before = s.state.tasks[0].doneAt;
  s.updateTask(t.id, { done: true });
  assert.equal(s.state.tasks[0].done, true);
  assert.ok(s.state.tasks[0].doneAt && s.state.tasks[0].doneAt !== before);
  s.updateTask(t.id, { done: false });
  assert.equal(s.state.tasks[0].doneAt, null);
  assert.equal(s.reorderTask(t.id, 'up'), false); // 已是第一个
  s.reorderTask(t.id, 'down'); // 不报错
  s.removeTask(t.id);
  assert.equal(s.state.tasks.length, 0);
});

test('自媒体：add/update/filter/collectTags/CSV 含转义', () => {
  const s = newStore();
  s.addPost({ title: '选题一', platform: 'B站', account: '甲', tags: ['技术', 'A'], status: 'draft' });
  const p2 = s.addPost({ title: '选题二', platform: '公众号', tags: ['生活'], status: 'queue', publishDate: '2030-01-01' });
  assert.equal(S.filterPosts(s.state.posts, { tag: '技术' }).length, 1);
  assert.equal(S.filterPosts(s.state.posts, { status: 'queue' }).length, 1);
  assert.deepEqual(S.collectTags(s.state.posts), ['A', '技术', '生活']);
  s.updatePost(p2.id, { status: 'published' });
  assert.equal(s.state.posts.find(p => p.id === p2.id).status, 'published');
  const csv = S.toCSV(s.state.posts);
  assert.ok(csv.startsWith('标题,平台'));
  assert.ok(csv.includes('选题一'));
});

test('CSV 特殊字符转义', () => {
  const s = newStore();
  s.addPost({ title: '带,逗号', note: '含"引号"\n和换行' });
  const csv = S.toCSV(s.state.posts);
  assert.ok(csv.includes('"带,逗号"'));
  assert.ok(csv.includes('"含""引号""'));
  assert.ok(csv.includes('和换行'));
});

test('开发工作：项目 + 子任务 + 进度计算', () => {
  const s = newStore();
  const p = s.addDevProject({ name: 'Sonder', note: '备注' });
  s.addDevTask(p.id, { title: 't1' });
  s.addDevTask(p.id, { title: 't2' });
  const tasks = s.state.devProjects[0].tasks;
  s.updateDevTask(p.id, tasks[0].id, { done: true });
  const prog = S.devProgress(s.state.devProjects[0]);
  assert.deepEqual(prog, { total: 2, done: 1, percent: 50 });
  s.removeDevTask(p.id, tasks[1].id);
  assert.equal(s.state.devProjects[0].tasks.length, 1);
  s.removeDevProject(p.id);
  assert.equal(s.state.devProjects.length, 0);
});

test('咨询工作：客户/子项目/跟进/收入 CRUD', () => {
  const s = newStore();
  const c = s.addClient({ name: '客户A', contact: '邮箱' });
  const pr = s.addClientProject(c.id, { name: '官网' });
  assert.equal(s.state.clients[0].projects.length, 1);
  s.updateClientProject(c.id, pr.id, { stage: '完结' });
  assert.equal(s.state.clients[0].projects[0].stage, '完结');
  const fu = s.addClientFollowup(c.id, { date: '2030-06-01', note: '电话' });
  assert.equal(s.state.clients[0].followups.length, 1);
  s.updateClientFollowup(c.id, fu.id, { done: true });
  assert.equal(s.state.clients[0].followups[0].done, true);
  const inc = s.addClientIncome(c.id, { amount: '5000', note: '首付' });
  assert.equal(s.state.clients[0].income[0].amount, 5000);
  s.updateClientIncome(c.id, inc.id, { amount: '9999' });
  assert.equal(s.state.clients[0].income[0].amount, 9999);
  s.removeClientIncome(c.id, inc.id);
  s.removeClientFollowup(c.id, fu.id);
  s.removeClientProject(c.id, pr.id);
  s.removeClient(c.id);
  assert.equal(s.state.clients.length, 0);
});

test('阅读计划：新增书接受进度并夹紧边界', () => {
  const s = newStore();
  s.addBook({ title: '书', status: '在读', progress: '250' });
  assert.equal(s.state.books[0].progress, 100, '超出上限应夹到100');
});

test('阅读计划：progress 边界、状态、笔记', () => {
  const s = newStore();
  const b = s.addBook({ title: '书', status: '在读' });
  s.updateBook(b.id, { progress: 150 });
  assert.equal(s.state.books[0].progress, 100);
  s.updateBook(b.id, { progress: -5 });
  assert.equal(s.state.books[0].progress, 0);
  s.addBookNote(b.id, '金句');
  assert.equal(s.state.books[0].notes.length, 1);
  assert.equal(s.state.books[0].notes[0].text, '金句');
  s.removeBookNote(b.id, s.state.books[0].notes[0].id);
  assert.equal(s.state.books[0].notes.length, 0);
  const by = S.booksByStatus(s.state.books);
  assert.ok(Array.isArray(by['在读']));
});

test('看新闻：CRUD + 状态流转', () => {
  const s = newStore();
  const n = s.addNews({ title: 'N', url: 'https://example.com', tags: ['AI'], status: 'unread' });
  assert.equal(s.state.news[0].status, 'unread');
  s.updateNews(n.id, { status: 'read' });
  assert.equal(s.state.news[0].status, 'read');
  s.removeNews(n.id);
  assert.equal(s.state.news.length, 0);
});

test('设计计划：idea 与 project 区分 + 阶段推进', () => {
  const s = newStore();
  s.addDesign({ title: '灵感1', type: 'idea', category: '海报' });
  const pr = s.addDesign({ title: 'Logo', type: 'project', stage: '构想' });
  assert.equal(s.state.designs.filter(d => d.type === 'project').length, 1);
  s.updateDesign(pr.id, { stage: '定稿' });
  assert.equal(s.state.designs.find(d => d.id === pr.id).stage, '定稿');
});

test('设置：主题与模块开关', () => {
  const s = newStore();
  s.setTheme('dark');
  assert.equal(s.state.settings.theme, 'dark');
  s.setModuleEnabled('selfmedia', false);
  assert.equal(s.state.settings.modules.selfmedia, false);
  s.setModuleEnabled('nonexist', false); // 无效 key 忽略
  assert.equal(s.state.settings.modules.dev, true);
});

test('导出/导入：roundtrip 一致，非法文件报错', async () => {
  const s = newStore();
  s.addTask({ title: 'A', priority: '低' });
  s.addBook({ title: 'B' });
  const json = s.exportBackup();
  const s2 = newStore();
  const r = await s2.importBackup(json);
  assert.equal(r.ok, true);
  assert.equal(s2.state.tasks.length, 1);
  assert.equal(s2.state.tasks[0].title, 'A');
  assert.equal(s2.state.books.length, 1);
  const bad = await s2.importBackup('not json');
  assert.equal(bad.ok, false);
  assert.equal(bad.error, '文件不是有效的 JSON');
  const noVer = await s2.importBackup(JSON.stringify({ foo: 1 }));
  assert.equal(noVer.ok, false);
});

test('summarize：统计与各模块数据一致', () => {
  const s = newStore();
  s.addTask({ title: '今', date: S.todayStr() });
  s.addTask({ title: '过', date: '2000-01-01' });
  s.addTask({ title: '完', date: S.todayStr() });
  s.updateTask(s.state.tasks[s.state.tasks.length - 1].id, { done: true });
  s.addPost({ title: 'p' });
  const sum = s.summarize();
  assert.equal(sum.tasks.total, 3);
  assert.equal(sum.tasks.current, 1);
  assert.equal(sum.tasks.overdue, 1);
  assert.equal(sum.tasks.doneToday, 1);
  assert.equal(sum.selfmedia.total, 1);
});

test('clearAll 清空', () => {
  const s = newStore();
  s.addMemo('x');
  s.clearAll();
  assert.equal(s.state.memos.length, 0);
  assert.equal(s.state.tasks.length, 0);
  assert.equal(s.state.settings.modules.selfmedia, true);
});

test('normalize：缺失字段用默认补齐', () => {
  const n = S.normalize({ version: 1, tasks: [{ id: 'x', title: 't', date: 'y' }] });
  assert.equal(n.memos.length, 0);
  assert.equal(n.books.length, 0);
  assert.equal(n.tasks.length, 1);
  assert.equal(n.settings.theme, 'auto');
  const n2 = S.normalize(null);
  assert.equal(n2.tasks.length, 0);
  assert.equal(n2.settings.modules.design, true);
});

test('P3e：miniRecords 并入统一 state——读写/合并/持久化', () => {
  const s = newStore();
  assert.deepEqual(s.getMiniRecord('guessnum'), {}, '未写入时返回空对象');
  s.updateMiniRecord('guessnum', { best: 3 });
  s.updateMiniRecord('guessnum', { right: 7 });
  const rec = s.getMiniRecord('guessnum');
  assert.equal(rec.best, 3, '首次写入应生效');
  assert.equal(rec.right, 7, '后续写入应合并而非覆盖');
  assert.equal(s.state.miniRecords.guessnum.best, 3, '应落到 state.miniRecords');
  const s2 = newStore({ sonder_data_v1: JSON.stringify({ version: 1, miniRecords: { idiom: { right: 5 } } }) });
  assert.equal(s2.state.miniRecords.idiom.right, 5, '持久化数据重启后仍在');
  const n = S.normalize({ version: 1, miniRecords: { brainteaser: { wrong: 2 } } });
  assert.equal(n.miniRecords.brainteaser.wrong, 2, 'normalize 应保留 miniRecords');
  const n2 = S.normalize({ version: 1 });
  assert.deepEqual(n2.miniRecords, {}, '缺失时默认空对象');
});