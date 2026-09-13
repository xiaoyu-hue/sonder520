'use strict';
/* TaskRepository 边界测试（v6.x 架构升级 · Repository 第一版）
 * 验证：读（get/getAll）、写（create/update/remove/reorder）与旧 Store 行为完全一致，
 * 且不改变事件/undo/持久化语义。 */
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

function repoOf(h) {
  const Repo = h.window.SonderTaskRepository;
  assert.ok(Repo && Repo.createTaskRepository, '浏览器应暴露 SonderTaskRepository');
  return Repo.createTaskRepository(h.store);
}

test('TaskRepository：create 后 get/getAll 可见，字段与旧 Store 完全一致', () => {
  const h = boot();
  const repo = repoOf(h);
  const direct = h.store.addTask({ title: '直接写', priority: 'p1' });
  const viaRepo = repo.create({ title: '仓库写', priority: 'p3' });

  const got = repo.get(viaRepo.id);
  assert.equal(got.title, '仓库写');
  assert.equal(got.priority, 'p3');
  assert.equal(got.date, direct.date, 'date 默认今天（与 store.addTask 一致）');
  assert.equal(got.done, false);

  const all = repo.getAll();
  assert.equal(all.length, 2, '两条任务都应可见');
  assert.equal(all[0].id, direct.id, '顺序与 store.state.tasks 一致');
});

test('TaskRepository：get 未命中返回 null，getAll 是快照不改 state', () => {
  const h = boot();
  const repo = repoOf(h);
  assert.equal(repo.get('no-such-id'), null);

  repo.create({ title: 'A' });
  const snapshot = repo.getAll();
  snapshot.push({ id: 'fake', title: '污染' });
  assert.equal(h.store.state.tasks.length, 1, '改动快照不应影响 store.state');
});

test('TaskRepository：update 字段语义与旧 Store 一致（含 done→doneAt）', () => {
  const h = boot();
  const repo = repoOf(h);
  const t = repo.create({ title: '改我', priority: 'p2' });

  repo.update(t.id, { title: '已改', priority: 'p1', done: true });
  const after = repo.get(t.id);
  assert.equal(after.title, '已改');
  assert.equal(after.priority, 'p1');
  assert.equal(after.done, true);
  assert.ok(after.doneAt, 'done=true 应写 doneAt');
  assert.ok(typeof after.doneAt === 'string' && after.doneAt.length > 0);

  repo.update(t.id, { done: false });
  assert.equal(repo.get(t.id).doneAt, null, 'done=false 应清 doneAt');

  assert.equal(repo.update('no-such-id', { title: 'x' }), null, '未命中 update 返回 null');
});

test('TaskRepository：remove 与旧 Store 等价，undoRemove 可恢复', () => {
  const h = boot();
  const repo = repoOf(h);
  const t = repo.create({ title: '待删' });
  repo.remove(t.id);
  assert.equal(repo.get(t.id), null, 'remove 后不可见');

  h.store.undoRemove();
  assert.equal(repo.get(t.id).title, '待删', 'undoRemove 应恢复（undo 语义不变）');
});

test('TaskRepository：reorder up/down 与边界语义一致', () => {
  const h = boot();
  const repo = repoOf(h);
  const a = repo.create({ title: 'A' });
  repo.create({ title: 'B' });
  const c = repo.create({ title: 'C' });

  assert.equal(repo.reorder(a.id, 'down'), true);
  assert.deepEqual(repo.getAll().map(x => x.title), ['B', 'A', 'C'], 'A 下移一格');
  assert.equal(repo.getAll()[0].order, 0, 'order 应重新编号');

  assert.equal(repo.reorder(a.id, 'up'), true);
  assert.deepEqual(repo.getAll().map(x => x.title), ['A', 'B', 'C']);

  assert.equal(repo.reorder(a.id, 'up'), false, '首元素再上移返回 false');
  assert.equal(repo.reorder(c.id, 'down'), false, '末元素再下移返回 false');
  assert.equal(repo.reorder('no-such-id', 'up'), false, '未命中 reorder 返回 false');
});

test('TaskRepository：写操作触发 /data/tasks 事件（事件语义不变）', () => {
  const h = boot();
  const repo = repoOf(h);
  const bus = h.window.SonderBus.bus; /* store._emitChange 用的实例（SonderBus.bus） */
  assert.ok(bus, '应有 SonderBus 实例');

  let events = 0;
  const off = bus.on('/data/tasks', () => { events++; });
  repo.create({ title: '事件验证' });
  assert.ok(events >= 1, 'create 应触发 /data/tasks');
  const afterCreate = events;
  repo.update(repo.getAll()[0].id, { title: '改' });
  assert.ok(events > afterCreate, 'update 应触发 /data/tasks');

  off();
  const before = events;
  repo.remove(repo.getAll()[0].id);
  assert.equal(events, before, '取消订阅后 remove 不再触发（事件语义不变）');
});

test('TaskRepository：create 无 title 时默认“未命名任务”（与 store.addTask 一致）', () => {
  const h = boot();
  const repo = repoOf(h);
  const t = repo.create({});
  assert.equal(t.title, '未命名任务');
  assert.equal(t.priority, 'p2', '默认优先级 p2');
});
