'use strict';
/* DesignsRepository 边界测试（v6.x Phase 5 提炼）
 * 验证：薄包装层委托工厂模块行为一致（select 净化/默认值/事件/undo），
 * 且 design.js 不再直连工厂。 */
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

/* 与 js/design.js CONFIG 一致的契约（页面单源，此处镜像用于注入） */
const CONFIG = {
  id: 'designs', displayName: '设计计划', storageKey: 'sonder_data_v1', schemaVersion: 1,
  prepend: true, timeField: 'time',
  fields: [
    { key: 'type', type: 'select', label: '类型', options: ['idea', 'project'] },
    { key: 'title', type: 'text', label: '标题', required: true },
    { key: 'category', type: 'text', label: '分类' },
    { key: 'link', type: 'text', label: '链接' },
    { key: 'note', type: 'textarea', label: '备注' },
    { key: 'stage', type: 'select', label: '阶段', options: ['构想', '进行', '定稿'] }
  ]
};

function repoOf(h) {
  const Repo = h.window.SonderDesignsRepository;
  assert.ok(Repo && Repo.createDesignsRepository, '浏览器应暴露 SonderDesignsRepository');
  return Repo.createDesignsRepository(h.store, CONFIG);
}

test('DesignsRepository：create 默认 idea/构想，select 非法值回落白名单', () => {
  const h = boot();
  const repo = repoOf(h);
  const d = repo.create({ title: '  新灵感  ', type: 'hacked', stage: 'x' });
  assert.equal(d.title, '新灵感', 'title trim');
  assert.equal(d.type, 'idea', 'type 非法回落 idea');
  assert.equal(d.stage, '构想', 'stage 非法回落首项');
  assert.equal(repo.get(d.id).title, '新灵感');
});

test('DesignsRepository：update 推进阶段生效；remove 可撤销恢复', () => {
  const h = boot();
  const repo = repoOf(h);
  const d = repo.create({ title: '项目A', type: 'project' });
  repo.update(d.id, { stage: '进行' });
  assert.equal(h.store.state.designs[0].stage, '进行');
  repo.remove(d.id);
  assert.equal(h.store.state.designs.length, 0);
  assert.equal(h.store.undoRemove().title, '项目A', 'undoRemove 恢复整条记录');
});

test('DesignsRepository：create/update/remove 均广播 /data/designs', () => {
  const h = boot();
  const bus = h.window.SonderBus.bus;
  let seen = 0;
  const off = bus.on('/data/designs', function () { seen++; });
  const repo = repoOf(h);
  const d = repo.create({ title: '事件' });
  repo.update(d.id, { stage: '进行' });
  repo.remove(d.id);
  assert.ok(seen >= 3, '三次写操作各广播一次，实际=' + seen);
  off();
});

/* Phase 5 门禁：design.js 数据访问必须经 DesignsRepository，不得回退直连工厂 */
test('DesignsRepository：design.js 已迁移至边界（不再直连 SonderModuleFactory.createModule）', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'design.js'), 'utf8');
  assert.ok(!/SonderModuleFactory\.createModule/.test(src), 'design.js 不应再直连工厂');
  assert.ok(/SonderDesignsRepository/.test(src) && /createDesignsRepository/.test(src), 'design.js 应经 DesignsRepository 创建');
});
