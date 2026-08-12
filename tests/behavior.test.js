'use strict';
/* 缺点2 行为契约：参数归一化 / 更新语义 / 删除语义
 * 契约即实现规范：非法输入回退默认、patch 只影响声明字段、id 不可变、
 * 未知 id 操作返回 null 且不写盘。修改实现时须同步更新本契约。 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./harness.js');
const S = require('../js/store.js');

/* ---------- 输入归一化 ---------- */

test('行为: addTask 缺省字段回退默认（标题/日期/优先级/完成态/顺序）', () => {
  const { store } = boot({});
  const t = store.addTask({});
  assert.equal(t.title, '未命名任务');
  assert.equal(t.date, S.todayStr());
  assert.equal(t.priority, 'p2');
  assert.equal(t.done, false);
  assert.equal(t.order, 0);
  const t2 = store.addTask({ title: '   ' });
  assert.equal(t2.title, '未命名任务', '空白标题同样回退');
  assert.equal(t2.order, 1, 'order 递增');
});

test('行为: addTask 优先级归一化（旧中文/未知值 → 规范档位）', () => {
  const { store } = boot({});
  assert.equal(store.addTask({ priority: '高' }).priority, 'p1');
  assert.equal(store.addTask({ priority: '中' }).priority, 'p2');
  assert.equal(store.addTask({ priority: '低' }).priority, 'p4');
  assert.equal(store.addTask({ priority: 'p3' }).priority, 'p3');
  assert.equal(store.addTask({ priority: 'p9' }).priority, 'p2', '未知值回落 p2');
  assert.equal(store.addTask({ priority: '' }).priority, 'p2');
});

test('行为: addPost 缺省与越界归一化', () => {
  const { store } = boot({});
  const p = store.addPost({});
  assert.equal(p.title, '未命名内容');
  assert.equal(p.status, 'draft');
  assert.equal(p.tags.length, 0);
  assert.equal(p.views, 0);
  assert.equal(p.progress, 0);
  assert.equal(store.addPost({ title: 'x', views: -5 }).views, 0, '负数指标归零');
  assert.equal(store.addPost({ title: 'x', progress: 150 }).progress, 100, '进度夹紧到 100');
  assert.equal(store.addPost({ title: 'x', tags: 'not-array' }).tags.length, 0, '非数组 tags 忽略');
});

test('行为: addBook 缺省与越界归一化', () => {
  const { store } = boot({});
  const b = store.addBook({});
  assert.equal(b.title, '未命名书籍');
  assert.equal(b.status, '想读');
  assert.equal(b.progress, 0);
  assert.equal(b.readingMinutes, 0);
  assert.equal(b.notes.length, 0);
  assert.equal(store.addBook({ title: 'x', progress: 250 }).progress, 100);
  assert.equal(store.addBook({ title: 'x', progress: -10 }).progress, 0);
});

test('行为: addNews/addDesign 缺省归一化', () => {
  const { store } = boot({});
  const n = store.addNews({});
  assert.equal(n.title, '未命名资讯');
  assert.equal(n.status, 'unread');
  assert.equal(n.tags.length, 0);
  const d = store.addDesign({});
  assert.equal(d.title, '未命名');
  assert.equal(d.type, 'idea');
  assert.equal(d.stage, '构想');
});

test('行为: addDesign type 白名单（非 project 一律 idea）', () => {
  const { store } = boot({});
  assert.equal(store.addDesign({ type: 'project' }).type, 'project');
  assert.equal(store.addDesign({ type: 'whatever' }).type, 'idea');
});

/* ---------- 更新语义 ---------- */

test('行为: updateTask patch 只影响声明字段，未知 id 返回 null 且不写盘', () => {
  const { store } = boot({});
  const t = store.addTask({ title: '原标题', note: '原备注' });
  const before = store.exportBackup();
  assert.equal(store.updateTask('ghost-id', { title: 'x' }), null);
  assert.equal(store.exportBackup(), before, '未知 id 不触发写盘');
  const r = store.updateTask(t.id, { title: '新标题' });
  assert.equal(r, t, 'update 返回更新后的同一对象');
  assert.equal(t.title, '新标题');
  assert.equal(t.note, '原备注', '未 patch 字段保留');
  assert.equal(store.updateTask(t.id, {}), t, '空 patch 幂等');
});

test('行为: id 不可变（update 的 id 字段被忽略）', () => {
  const { store } = boot({});
  const t = store.addTask({ title: 'x' });
  const id = t.id;
  store.updateTask(id, { id: 'hacked' });
  assert.equal(t.id, id, 'update 不能改写 id');
});

test('行为: updateBook 完成状态联动 finishedAt', () => {
  const { store } = boot({});
  const b = store.addBook({ title: 'x' });
  assert.equal(b.finishedAt, null);
  store.updateBook(b.id, { status: '已读完' });
  assert.equal(b.finishedAt, S.todayStr(), '标记已读完自动记录完成日期');
  store.updateBook(b.id, { status: '在读' });
  assert.equal(b.finishedAt, null, '改回其他状态清除完成日期');
});

test('行为: updateTask done 联动 doneAt 时间戳', () => {
  const { store } = boot({});
  const t = store.addTask({ title: 'x' });
  store.updateTask(t.id, { done: true });
  assert.equal(t.done, true);
  assert.ok(t.doneAt, 'done=true 记录 doneAt');
  store.updateTask(t.id, { done: false });
  assert.equal(t.doneAt, null, 'done=false 清空 doneAt');
});

/* ---------- 删除语义 ---------- */

test('行为: remove 后记录消失且重复删除幂等', () => {
  const { store } = boot({});
  const t = store.addTask({ title: 'x' });
  const p = store.addPost({ title: 'y' });
  store.removeTask(t.id);
  assert.equal(store.state.tasks.find(x => x.id === t.id), undefined);
  store.removeTask(t.id);
  assert.equal(store.state.tasks.length, 0, '重复删除幂等');
  store.removePost(p.id);
  assert.equal(store.state.posts.find(x => x.id === p.id), undefined);
});

test('行为(P4c): 删除可撤销——顶级条目恢复原位、子项闭包恢复、无可撤销返回 null', () => {
  const { store } = boot({});
  /* 顶级条目：任务删除后 undoRemove 恢复原位置与字段 */
  const t = store.addTask({ title: '甲', date: '2030-01-01', priority: 'p1' });
  const t2 = store.addTask({ title: '乙' });
  store.removeTask(t.id);
  assert.equal(store.state.tasks.length, 1);
  const back = store.undoRemove();
  assert.equal(back.id, t.id, '返回被恢复的数据');
  assert.equal(store.state.tasks[0].id, t.id, '恢复到原索引位置');
  assert.equal(store.state.tasks[0].priority, 'p1', '字段完整恢复');
  /* 子项删除（客户项目）走闭包恢复 */
  const c = store.addClient({ name: '客户' });
  const pr = store.addClientProject(c.id, { name: '项目A' });
  store.removeClientProject(c.id, pr.id);
  assert.equal(store.state.clients[0].projects.length, 0);
  store.undoRemove();
  assert.equal(store.state.clients[0].projects.length, 1, '子项目恢复');
  assert.equal(store.state.clients[0].projects[0].id, pr.id);
  /* 撤销栈空时返回 null */
  assert.equal(store.undoRemove(), null);
  assert.equal(store.undoRemove(), null);
});

test('行为: updateMemo 支持 text 与 archived 白名单字段', () => {
  const { store } = boot({});
  const m = store.addMemo('原文');
  store.updateMemo(m.id, { text: '  新文  ' });
  assert.equal(m.text, '新文', 'text 去除首尾空白');
  store.updateMemo(m.id, { archived: true });
  assert.equal(m.archived, true);
  store.updateMemo(m.id, { archived: false });
  assert.equal(m.archived, false);
  assert.equal(store.updateMemo('ghost', { text: 'x' }), null);
});

/* ---------- 旧数据字段迁移 ---------- */

test('normalize: 旧数据缺数组字段自动补默认，首页 summarize 与各页渲染不崩', () => {
  const seed = {
    version: 1,
    settings: { modules: {} },
    tasks: [],
    memos: [],
    posts: [{ id: 'p1', title: '旧选题' }],
    clients: [{ id: 'c1', name: '旧客户' }],
    news: [{ id: 'n1', title: '旧新闻' }],
    devProjects: [{ id: 'd1', name: '旧项目' }],
    designs: [{ id: 'x1', type: 'idea' }],
    books: [], excerpts: [], gameRecords: []
  };
  const { store, goto } = boot({ seed });
  assert.doesNotThrow(() => store.summarize(), '旧数据 summarize 不得崩溃');
  assert.equal(store.state.clients[0].followups.length, 0, 'clients.followups 补默认数组');
  assert.equal(store.state.clients[0].projects.length, 0);
  assert.equal(store.state.clients[0].income.length, 0);
  assert.equal(store.state.posts[0].tags.length, 0, 'posts.tags 补默认数组');
  assert.equal(store.state.news[0].tags.length, 0, 'news.tags 补默认数组');
  assert.equal(store.state.devProjects[0].tasks.length, 0, 'devProjects.tasks 补默认数组');
  assert.equal(store.state.designs[0].title, '', 'designs.title 补默认');
  assert.doesNotThrow(() => {
    goto('home'); goto('consulting'); goto('news'); goto('dev'); goto('selfmedia');
  }, '旧数据各页面渲染不得崩溃');
});
