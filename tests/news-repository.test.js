'use strict';
/* NewsRepository 边界测试（v6.x Phase 5 提炼）
 * 验证：薄包装层委托工厂模块行为一致（select 净化/默认值/事件/undo），
 * 且 news.js 不再直连工厂。 */
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

/* 与 js/news.js CONFIG 一致的契约（页面单源，此处镜像用于注入） */
const CONFIG = {
  id: 'news', displayName: '看新闻计划', storageKey: 'sonder_data_v1', schemaVersion: 1,
  prepend: true, timeField: 'time',
  fields: [
    { key: 'title', type: 'text', label: '标题', required: true },
    { key: 'url', type: 'text', label: '链接' },
    { key: 'source', type: 'text', label: '来源' },
    { key: 'tags', type: 'array', label: '标签' },
    { key: 'status', type: 'select', label: '状态', options: [{ value: 'unread', label: '待读' }, { value: 'read', label: '已读' }, { value: 'favorite', label: '收藏' }] },
    { key: 'note', type: 'text', label: '备注' }
  ]
};

function repoOf(h) {
  const Repo = h.window.SonderNewsRepository;
  assert.ok(Repo && Repo.createNewsRepository, '浏览器应暴露 SonderNewsRepository');
  return Repo.createNewsRepository(h.store, CONFIG);
}

test('NewsRepository：create 默认状态 unread，select 非法值回落白名单首项', () => {
  const h = boot();
  const repo = repoOf(h);
  const n = repo.create({ title: '  资讯  ', status: 'hacked' });
  assert.equal(n.title, '资讯', 'title trim');
  assert.equal(n.status, 'unread', '非法 status 回落默认 unread');
  assert.deepEqual(n.tags, [], 'tags 缺省空数组');
  assert.equal(repo.get(n.id).title, '资讯');
});

test('NewsRepository：update 状态迁移生效（待读→已读→收藏），remove 可撤销', () => {
  const h = boot();
  const repo = repoOf(h);
  const n = repo.create({ title: '状态测试' });
  repo.update(n.id, { status: 'read' });
  assert.equal(h.store.state.news[0].status, 'read');
  repo.update(n.id, { status: 'favorite' });
  assert.equal(h.store.state.news[0].status, 'favorite');
  repo.remove(n.id);
  assert.equal(h.store.state.news.length, 0);
  assert.equal(h.store.undoRemove().title, '状态测试', 'undoRemove 恢复整条记录');
});

test('NewsRepository：create/update/remove 均广播 /data/news', () => {
  const h = boot();
  const bus = h.window.SonderBus.bus;
  let seen = 0;
  const off = bus.on('/data/news', function () { seen++; });
  const repo = repoOf(h);
  const n = repo.create({ title: '事件' });
  repo.update(n.id, { status: 'read' });
  repo.remove(n.id);
  assert.ok(seen >= 3, '三次写操作各广播一次，实际=' + seen);
  off();
});

/* Phase 5 门禁：news.js 数据访问必须经 NewsRepository，不得回退直连工厂 */
test('NewsRepository：news.js 已迁移至边界（不再直连 SonderModuleFactory.createModule）', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'news.js'), 'utf8');
  assert.ok(!/SonderModuleFactory\.createModule/.test(src), 'news.js 不应再直连工厂');
  assert.ok(/SonderNewsRepository/.test(src) && /createNewsRepository/.test(src), 'news.js 应经 NewsRepository 创建');
});
