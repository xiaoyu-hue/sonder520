'use strict';
/* MemosRepository 边界测试（v6.x Phase 5 提炼）
 * 验证：薄包装层（get/getAll/create/update/remove）委托工厂模块行为一致
 * （净化/默认值/事件/undo 语义不变），且 memo.js 不再直连工厂。 */
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

/* 与 js/memo.js CONFIG 一致的契约（页面单源，此处镜像用于注入） */
const CONFIG = {
  id: 'memos', displayName: '快速备忘', storageKey: 'sonder_data_v1', schemaVersion: 1,
  prepend: true, timeField: 'time',
  fields: [
    { key: 'text', type: 'textarea', label: '内容', required: true },
    { key: 'archived', type: 'boolean', label: '已归档' }
  ]
};

function repoOf(h) {
  const Repo = h.window.SonderMemosRepository;
  assert.ok(Repo && Repo.createMemosRepository, '浏览器应暴露 SonderMemosRepository');
  return Repo.createMemosRepository(h.store, CONFIG);
}

test('MemosRepository：create 后 get/getAll 可见，字段净化与工厂一致', () => {
  const h = boot();
  const repo = repoOf(h);
  const m = repo.create({ text: '  第一条备忘  ', archived: 'true' });
  assert.equal(m.text, '第一条备忘', 'text 应 trim');
  assert.equal(m.archived, true, '布尔净化');
  assert.equal(m.time.slice(0, 4), String(new Date().getFullYear()), 'timeField 写入时间戳');
  assert.equal(repo.get(m.id).text, '第一条备忘');
  const all = repo.getAll();
  assert.equal(all.length, 1);
  assert.equal(h.store.state.memos[0].id, m.id, '数据落 store.state.memos');
});

test('MemosRepository：update 生效且不新增记录；remove 进撤销栈可恢复', () => {
  const h = boot();
  const repo = repoOf(h);
  const m = repo.create({ text: '待编辑' });
  const upd = repo.update(m.id, { text: '编辑后', archived: true });
  assert.equal(upd.text, '编辑后');
  assert.equal(h.store.state.memos.length, 1, 'update 不新增');
  repo.remove(m.id);
  assert.equal(h.store.state.memos.length, 0);
  assert.equal(h.store.undoRemove().text, '编辑后', 'remove 经工厂 _undoPush，undoRemove 可恢复');
});

test('MemosRepository：写操作经 /data/memos 事件广播（bus 契约不变）', () => {
  const h = boot();
  const bus = h.window.SonderBus.bus;
  let seen = 0;
  const off = bus.on('/data/memos', function () { seen++; });
  const repo = repoOf(h);
  const m = repo.create({ text: '事件' });
  repo.update(m.id, { archived: true });
  repo.remove(m.id);
  assert.ok(seen >= 3, 'create/update/remove 各广播一次，实际=' + seen);
  off();
});

/* Phase 5 门禁：memo.js 数据访问必须经 MemosRepository，不得回退直连工厂 */
test('MemosRepository：memo.js 已迁移至边界（不再直连 SonderModuleFactory.createModule）', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'memo.js'), 'utf8');
  assert.ok(!/SonderModuleFactory\.createModule/.test(src), 'memo.js 不应再直连工厂');
  assert.ok(/SonderMemosRepository/.test(src) && /createMemosRepository/.test(src), 'memo.js 应经 MemosRepository 创建');
});
