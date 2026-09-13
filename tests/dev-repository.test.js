'use strict';
/* DevRepository 边界测试（v6.x 架构升级 · Repository 第三刀）
 * 验证：devProjects/devTasks/devNotes/devSnippets 读写与旧 Store 行为完全一致
 * （含未命名默认、缺项目 null、任务删除无撤销、笔记/片段撤销），
 * 且 dev.js 不再直连 Store 子操作。 */
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

function repoOf(h) {
  const Repo = h.window.SonderDevRepository;
  assert.ok(Repo && Repo.createDevRepository, '浏览器应暴露 SonderDevRepository');
  return Repo.createDevRepository(h.store);
}

test('DevRepository：createProject/getProject/getProjects，未命名默认与旧 Store 一致', () => {
  const h = boot();
  const repo = repoOf(h);
  const direct = h.store.addDevProject({ name: '直接项目', note: 'a' });
  const via = repo.createProject({ note: '无名' });

  assert.equal(via.name, '未命名项目', '缺 name 默认未命名项目');
  assert.equal(via.tasks.length, 0);
  assert.equal(repo.getProject(direct.id).name, '直接项目');
  assert.equal(repo.getProjects().length, 2);
  assert.equal(repo.getProject('no-such'), null);
});

test('DevRepository：updateProject 字段语义一致', () => {
  const h = boot();
  const repo = repoOf(h);
  const p = repo.createProject({ name: '改我' });
  repo.updateProject(p.id, { name: '已改', note: '备注' });
  assert.equal(repo.getProject(p.id).name, '已改');
  assert.equal(repo.getProject(p.id).note, '备注');
  assert.equal(repo.updateProject('no-such', { name: 'x' }), null);
});

test('DevRepository：addTask/updateTask/removeTask 语义（缺项目 null、删除无撤销）', () => {
  const h = boot();
  const repo = repoOf(h);
  assert.equal(repo.addTask('no-such', { title: 't' }), null, '缺项目返回 null');

  const p = repo.createProject({ name: '带任务' });
  const t = repo.addTask(p.id, { title: '任务一' });
  assert.equal(t.title, '任务一');
  assert.equal(repo.getProject(p.id).tasks.length, 1);

  repo.updateTask(p.id, t.id, { done: true, title: '完成' });
  const after = repo.getProject(p.id).tasks[0];
  assert.equal(after.done, true);
  assert.equal(after.title, '完成');
  assert.equal(repo.updateTask('no-such', t.id, { done: true }), null, '缺项目 update 返回 null');
  assert.equal(repo.updateTask(p.id, 'no-such', { done: true }), null, '缺任务 update 返回 null');

  repo.removeTask(p.id, t.id);
  assert.equal(repo.getProject(p.id).tasks.length, 0, '任务删除后为空');
  h.store.undoRemove();
  assert.equal(repo.getProject(p.id).tasks.length, 0, '任务删除无撤销（历史行为保留）');
});

test('DevRepository：addNote/updateNote/removeNote + 撤销（与旧 Store 一致）', () => {
  const h = boot();
  const repo = repoOf(h);
  const n = repo.addNote({ title: '笔记', content: '内容' });
  assert.equal(n.title, '笔记');

  repo.updateNote(n.id, { content: '改后' });
  assert.equal(h.store.state.devNotes[0].content, '改后');
  assert.ok(h.store.state.devNotes[0].updatedAt >= h.store.state.devNotes[0].createdAt, 'update 应刷新 updatedAt');

  repo.removeNote(n.id);
  assert.equal(h.store.state.devNotes.length, 0);
  h.store.undoRemove();
  assert.equal(h.store.state.devNotes.length, 1, '笔记删除可撤销');
});

test('DevRepository：addSnippet/updateSnippet/removeSnippet + 撤销（与旧 Store 一致）', () => {
  const h = boot();
  const repo = repoOf(h);
  const s = repo.addSnippet({ code: 'const a = 1;' });
  assert.equal(s.title, '未命名片段', '缺 title 默认未命名片段');

  repo.updateSnippet(s.id, { title: '片段', code: 'let b = 2;' });
  assert.equal(h.store.state.devSnippets[0].title, '片段');
  assert.equal(h.store.state.devSnippets[0].code, 'let b = 2;');

  repo.removeSnippet(s.id);
  assert.equal(h.store.state.devSnippets.length, 0);
  h.store.undoRemove();
  assert.equal(h.store.state.devSnippets.length, 1, '片段删除可撤销');
});

/* Phase 4 续门禁：dev.js 的子操作必须经 DevRepository，不得回退直连 */
test('DevRepository：dev.js 已迁移至边界（不再直连 Store 子操作）', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'dev.js'), 'utf8');
  const direct = /store\.(addDevTask|updateDevTask|removeDevTask)\(|ctx\.store\.(addDevTask|updateDevTask)\(/;
  assert.ok(!direct.test(src), 'dev.js 不应直连 devTasks 子操作');
  assert.ok(/repoDev\(/.test(src), 'dev.js 应经 DevRepository');
});
