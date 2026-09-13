'use strict';
/* ClientsRepository 边界测试（v6.x 架构升级 · Repository 第五刀）
 * 验证：clients/projects/followups/income 读写与旧 Store 行为完全一致
 * （未命名默认、缺 client 返回 null、金额 NaN 归零、子项删除闭包 undo），
 * 且 consulting.js 不再直连 Store 子操作。 */
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

function repoOf(h) {
  const Repo = h.window.SonderClientsRepository;
  assert.ok(Repo && Repo.createClientsRepository, '浏览器应暴露 SonderClientsRepository');
  return Repo.createClientsRepository(h.store);
}

test('ClientsRepository：createClient/getClient/getClients，未命名默认一致', () => {
  const h = boot();
  const repo = repoOf(h);
  const direct = h.store.addClient({ name: '直接客户', contact: 'a@b.c' });
  const via = repo.createClient({ contact: 'x@y.z' });

  assert.equal(via.name, '未命名客户', '缺 name 默认未命名客户');
  assert.equal(via.projects.length, 0, '嵌套数组初始为空');
  assert.equal(repo.getClient(direct.id).contact, 'a@b.c');
  assert.equal(repo.getClients().length, 2);
  assert.equal(repo.getClient('no-such'), null);
});

test('ClientsRepository：addProject/updateProject/removeProject + 撤销（闭包恢复）', () => {
  const h = boot();
  const repo = repoOf(h);
  assert.equal(repo.addProject('no-such', { name: 'p' }), null, '缺 client 返回 null');

  const c = repo.createClient({ name: '客户甲' });
  const pr = repo.addProject(c.id, { name: '项目一', stage: '进行中' });
  assert.equal(pr.name, '项目一');
  assert.equal(repo.getClient(c.id).projects.length, 1);

  repo.updateProject(c.id, pr.id, { stage: '已完结' });
  assert.equal(repo.getClient(c.id).projects[0].stage, '已完结');

  repo.removeProject(c.id, pr.id);
  assert.equal(repo.getClient(c.id).projects.length, 0);
  h.store.undoRemove();
  assert.equal(repo.getClient(c.id).projects.length, 1, '子项删除应可撤销');
  assert.equal(repo.getClient(c.id).projects[0].name, '项目一');
});

test('ClientsRepository：addFollowup/updateFollowup/removeFollowup + 撤销', () => {
  const h = boot();
  const repo = repoOf(h);
  const c = repo.createClient({ name: '客户乙' });
  const f = repo.addFollowup(c.id, { note: '首轮沟通', date: '2026-09-01' });
  assert.equal(f.date, '2026-09-01');

  repo.updateFollowup(c.id, f.id, { done: true });
  assert.equal(repo.getClient(c.id).followups[0].done, true);

  repo.removeFollowup(c.id, f.id);
  assert.equal(repo.getClient(c.id).followups.length, 0);
  h.store.undoRemove();
  assert.equal(repo.getClient(c.id).followups.length, 1, '跟进删除应可撤销');
});

test('ClientsRepository：addIncome 金额 NaN 归零 + updateIncome/removeIncome + 撤销', () => {
  const h = boot();
  const repo = repoOf(h);
  const c = repo.createClient({ name: '客户丙' });
  const inc = repo.addIncome(c.id, { amount: 'abc', date: '2026-09-02' });
  assert.equal(inc.amount, 0, 'NaN 金额归零');

  repo.updateIncome(c.id, inc.id, { amount: 120.5 });
  assert.equal(repo.getClient(c.id).income[0].amount, 120.5);

  repo.removeIncome(c.id, inc.id);
  assert.equal(repo.getClient(c.id).income.length, 0);
  h.store.undoRemove();
  assert.equal(repo.getClient(c.id).income.length, 1, '收入删除应可撤销');
});

/* Phase 4 续门禁：consulting.js 的子操作必须经 ClientsRepository */
test('ClientsRepository：consulting.js 已迁移至边界（不再直连 Store 子操作）', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'consulting.js'), 'utf8');
  const direct = /store\.(addClientProject|updateClientProject|removeClientProject|addClientFollowup|updateClientFollowup|removeClientFollowup|addClientIncome|updateClientIncome|removeClientIncome)\(/;
  assert.ok(!direct.test(src), 'consulting.js 不应直连 clients 子操作');
  assert.ok(!/store\.state\.clients/.test(src), 'consulting.js 不应直读 clients');
  assert.ok(/repoOf\(/.test(src), 'consulting.js 应经 ClientsRepository');
});
