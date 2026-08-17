'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { boot, waitFor } = require('./harness.js');

/* ================= 标准模块工厂（Sonder-Frame v0.1） =================
 * 契约层：UMD 形态 / createModule 校验与冻结 / store 实例要求
 * 行为层：add/update/remove/getById/query/render/destroy
 */

function makeConfig(overrides = {}) {
  return Object.assign({
    id: 'testmod',
    displayName: '测试模块',
    storageKey: 'sonder_testmod_v1',
    schemaVersion: 1,
    fields: [
      { key: 'title', type: 'text', label: '标题', required: true },
      { key: 'note', type: 'textarea', label: '备注' },
      { key: 'due', type: 'date', label: '截止' },
      { key: 'done', type: 'boolean', label: '完成' },
      { key: 'count', type: 'number', label: '次数' },
      { key: 'tags', type: 'array', label: '标签' },
      { key: 'status', type: 'select', label: '状态', options: ['todo', 'done'] }
    ]
  }, overrides);
}

/* 内存版 localStorage（真实读写，跨实例共享以验证持久化） */
function memStorage() {
  const map = {};
  return {
    getItem: k => (k in map ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: k => { delete map[k]; }
  };
}

function makeModule() {
  const S = require('../js/store.js');
  const F = require('../js/framework/ModuleFactory.js');
  const store = S.createStore(memStorage());
  return { F, store, m: F.createModule(store, makeConfig()) };
}

/* ================= 契约：UMD 形态 ================= */

test('契约: Node require 直出 api（createModule + FIELD_TYPES）', () => {
  const F = require('../js/framework/ModuleFactory.js');
  assert.equal(typeof F.createModule, 'function');
  assert.deepEqual(F.FIELD_TYPES, ['text', 'textarea', 'date', 'boolean', 'number', 'select', 'array']);
});

test('契约: 浏览器路径暴露 window.SonderModuleFactory 且与 store 实例协作', () => {
  const { window, store } = boot({});
  assert.equal(typeof window.SonderModuleFactory.createModule, 'function');
  const m = window.SonderModuleFactory.createModule(store, makeConfig({ id: 'browmod' }));
  assert.equal(m.id, 'browmod');
  const r = m.add({ title: '浏览器路径' });
  assert.ok(r.id, 'add 应生成记录');
  assert.equal(store.state.browmod.length, 1);
});

/* ================= 契约：createModule 校验 ================= */

test('契约: store 实例不合法时立即失败', () => {
  const F = require('../js/framework/ModuleFactory.js');
  assert.throws(() => F.createModule(null, makeConfig()), TypeError);
  assert.throws(() => F.createModule({}, makeConfig()), TypeError);
  assert.throws(() => F.createModule({ save() { }, state: {} }, makeConfig()), TypeError);
});

test('契约: config 必填项缺失逐一拒绝（id/displayName/storageKey/schemaVersion/fields）', () => {
  const { F, store } = makeModule();
  const base = makeConfig();
  [
    { id: '' },
    { id: '   ' },
    { displayName: '' },
    { storageKey: '' },
    { schemaVersion: 0 },
    { schemaVersion: 1.5 },
    { schemaVersion: '1' },
    { fields: [] },
    { fields: 'x' }
  ].forEach(bad => {
    assert.throws(() => F.createModule(store, Object.assign({}, base, bad)), TypeError, JSON.stringify(bad));
  });
  assert.throws(() => F.createModule(store, null), TypeError);
  assert.throws(() => F.createModule(store, 'x'), TypeError);
  assert.throws(() => F.createModule(store, []), TypeError);
});

test('契约: 字段声明逐一拒绝（保留键/重复键/类型非法/缺 label/select 无 options/required 非布尔）', () => {
  const { F, store } = makeModule();
  const base = makeConfig();
  [
    [{ key: 'id', type: 'text', label: 'x' }],
    [{ key: 'createdAt', type: 'text', label: 'x' }],
    [{ key: 'order', type: 'text', label: 'x' }],
    [{ key: 't', type: 'text', label: 'x' }, { key: 't', type: 'text', label: 'y' }],
    [{ key: 't', type: 'rich', label: 'x' }],
    [{ key: 't', type: 'text', label: '' }],
    [{ key: 't', type: 'select', label: 'x' }],
    [{ key: 't', type: 'select', label: 'x', options: [] }],
    [{ key: 't', type: 'text', label: 'x', required: 'yes' }],
    [null],
    [{ type: 'text', label: 'x' }]
  ].forEach(fields => {
    assert.throws(() => F.createModule(store, Object.assign({}, base, { fields })), TypeError, JSON.stringify(fields));
  });
});

test('契约: 合法 config 通过且被完全冻结', () => {
  const { F, store } = makeModule();
  const m = F.createModule(store, makeConfig());
  assert.equal(m.config.id, 'testmod');
  assert.ok(Object.isFrozen(m.config));
  assert.ok(Object.isFrozen(m.config.fields));
  assert.ok(Object.isFrozen(m.config.fieldMap));
  assert.ok(Object.isFrozen(m.config.fieldMap.title));
  assert.throws(() => { m.config.fields[0].label = 'hack'; }, TypeError);
  assert.throws(() => { m.config.fieldMap.title.options = ['x']; }, TypeError);
});

/* ================= 行为：add ================= */

test('add: 生成 id/createdAt/updatedAt，记录入 state 并持久化', async () => {
  const S = require('../js/store.js');
  const F = require('../js/framework/ModuleFactory.js');
  const storage = memStorage();
  const s1 = S.createStore(storage);
  const m1 = F.createModule(s1, makeConfig());
  const r = m1.add({ title: '第一条', count: '42', done: 1 });
  assert.ok(r.id && typeof r.id === 'string');
  assert.ok(r.createdAt && typeof r.createdAt === 'string');
  assert.ok(r.updatedAt && typeof r.updatedAt === 'string');
  assert.equal(s1.state.testmod.length, 1);
  assert.equal(s1.state.testmod[0].title, '第一条');
  const s2 = S.createStore(storage);
  await waitFor(() => s2.state.testmod && s2.state.testmod.length === 1, '跨实例读到持久化记录');
  assert.equal(s2.state.testmod[0].id, r.id);
});

test('add: 字段按声明净化（trim/数字/布尔/数组拷贝/select 白名单/缺省值）', () => {
  const { m, store } = makeModule();
  const tagsInput = ['a', 'b'];
  const r = m.add({
    title: '  净 化  ',
    note: null,
    due: 123,
    done: 'true',
    count: 'abc',
    tags: tagsInput,
    status: 'paused'
  });
  assert.equal(r.title, '净 化');
  assert.equal(r.note, '');
  assert.equal(r.due, '123');
  assert.equal(r.done, true);
  assert.equal(r.count, 0);
  assert.deepEqual(r.tags, ['a', 'b']);
  assert.equal(r.status, 'todo');
  tagsInput.push('hack');
  assert.equal(store.state.testmod[0].tags.length, 2, '输入数组应拷贝，不得外泄引用');
});

test('add: required 缺失抛错且不落盘', () => {
  const { m, store } = makeModule();
  assert.throws(() => m.add({}), TypeError);
  assert.throws(() => m.add({ title: '   ' }), TypeError);
  assert.deepEqual(store.state.testmod, [], '失败的 add 不得产生记录（集合为空数组）');
  assert.equal(m.query().length, 0);
});

test('add: 触发 _emitChange 与 renderer', () => {
  const { m, store } = makeModule();
  const calls = [];
  const orig = store._emitChange;
  store._emitChange = k => calls.push(k);
  m.render(() => { calls.push('render'); });
  m.add({ title: 't' });
  store._emitChange = orig;
  assert.deepEqual(calls, ['testmod', 'render']);
});

/* ================= v0.1.1 扩展：prepend + timeField（迁移试点前置） ================= */

test('契约: prepend/timeField 非法配置逐一拒绝', () => {
  const { F, store } = makeModule();
  const base = makeConfig();
  [
    { prepend: 'yes' },
    { prepend: 1 },
    { timeField: '' },
    { timeField: '   ' },
    { timeField: 7 },
    { timeField: 'id' },
    { timeField: 'createdAt' },
    { timeField: 'title' } /* 与字段 key 冲突 */
  ].forEach(bad => {
    assert.throws(() => F.createModule(store, Object.assign({}, base, bad)), TypeError, JSON.stringify(bad));
  });
});

test('prepend: true 时新增记录在最前（unshift）；配置冻结', () => {
  const { F, store } = makeModule();
  const m = F.createModule(store, makeConfig({ prepend: true }));
  assert.equal(m.config.prepend, true);
  m.add({ title: '一' });
  m.add({ title: '二' });
  assert.deepEqual(store.state.testmod.map(x => x.title), ['二', '一'], '最新在前');
});

test('timeField: 新增写入该字段、不生成默认时间字段；编辑不刷新 time', () => {
  const { F, store } = makeModule();
  const m = F.createModule(store, makeConfig({ timeField: 'time' }));
  assert.equal(m.config.timeField, 'time');
  const r = m.add({ title: 'A', done: true });
  assert.ok(r.time && typeof r.time === 'string', '写入 time');
  assert.ok(!('createdAt' in r), '不生成 createdAt');
  assert.ok(!('updatedAt' in r), '不生成 updatedAt');
  const before = r.time;
  m.update(r.id, { title: 'B' });
  assert.equal(r.time, before, '编辑不刷新 time（显示创建时间）');
  assert.ok(!('updatedAt' in r), '编辑不产生 updatedAt 脏字段');
});

test('timeField + prepend 组合（memo 形态）：最新在前 + time 字段，跨实例持久化保留', async () => {
  const S = require('../js/store.js');
  const F = require('../js/framework/ModuleFactory.js');
  const storage = memStorage();
  const cfg = makeConfig({ prepend: true, timeField: 'time' });
  const s1 = S.createStore(storage);
  const m1 = F.createModule(s1, cfg);
  m1.add({ title: '一' });
  m1.add({ title: '二', done: true });
  assert.equal(s1.state.testmod[0].title, '二');
  assert.equal(s1.state.testmod[0].done, true, 'boolean 字段仍净化');
  const s2 = S.createStore(storage);
  await waitFor(() => s2.state.testmod && s2.state.testmod.length === 2, '跨实例读到持久化记录');
  assert.deepEqual(s2.state.testmod.map(x => x.title), ['二', '一'], '顺序与字段形状跨实例保留');
  assert.ok(s2.state.testmod[0].time, 'time 字段持久化');
});

/* ================= v0.1.2 扩展：orderField + move（迁移试点二前置） ================= */

test('契约: orderField 非法值拒绝；与 prepend 互斥', () => {
  const { F, store } = makeModule();
  const base = makeConfig();
  [
    { orderField: 'seq' },
    { orderField: '' },
    { orderField: 7 },
    { orderField: 'order', prepend: true }
  ].forEach(bad => {
    assert.throws(() => F.createModule(store, Object.assign({}, base, bad)), TypeError, JSON.stringify(bad));
  });
});

test('orderField: add 自动分配 order（0,1,2…），未配置时记录无 order 字段', () => {
  const S = require('../js/store.js');
  const F = require('../js/framework/ModuleFactory.js');
  const plainStore = S.createStore(memStorage());
  const plain = F.createModule(plainStore, makeConfig());
  const p1 = plain.add({ title: '无序' });
  assert.ok(!('order' in p1), '未配置 orderField 不生成 order（v0.1.1 回归）');
  const m = F.createModule(plainStore, makeConfig({ orderField: 'order' }));
  assert.equal(m.config.orderField, 'order');
  const a = m.add({ title: '一' });
  const b = m.add({ title: '二' });
  const c = m.add({ title: '三' });
  assert.equal(a.order, 1, 'order 从集合当前长度续编（与既有记录不冲突）');
  assert.equal(b.order, 2);
  assert.equal(c.order, 3);
  assert.equal(plainStore.state.testmod[3].order, 3, '数组序与 order 一致（append）');
});

test('move: 上移/下移交换相邻并重写全集合 order，越界与未知 id 返回 false 无副作用', () => {
  const { F, store } = makeModule();
  const m = F.createModule(store, makeConfig({ orderField: 'order' }));
  const r = m.add({ title: '一' });
  const s = m.add({ title: '二' });
  m.add({ title: '三' });
  assert.equal(m.move(s.id, 'up'), true);
  assert.deepEqual(store.state.testmod.map(x => x.title), ['二', '一', '三']);
  assert.deepEqual(store.state.testmod.map(x => x.order), [0, 1, 2], 'order 重写为连续');
  assert.equal(m.move(r.id, 'down'), true);
  assert.deepEqual(store.state.testmod.map(x => x.title), ['二', '三', '一']);
  assert.equal(m.move(r.id, 'down'), false, '末位下移越界');
  assert.equal(m.move('ghost', 'up'), false, '未知 id');
  assert.deepEqual(store.state.testmod.map(x => x.title), ['二', '三', '一'], '失败无副作用');
});

test('move: 未配置 orderField 的模块调用 move 抛错；move 触发 _emitChange 与 renderer', () => {
  const { m, store } = makeModule();
  assert.throws(() => m.move('x', 'up'), /orderField/);
  const om = require('../js/framework/ModuleFactory.js').createModule(store, makeConfig({ orderField: 'order' }));
  const calls = [];
  const orig = store._emitChange;
  store._emitChange = k => calls.push(k);
  om.render(() => { calls.push('render'); });
  om.add({ title: '一' });
  const b = om.add({ title: '二' });
  calls.length = 0;
  om.move(b.id, 'up');
  store._emitChange = orig;
  assert.deepEqual(calls, ['testmod', 'render']);
});

test('orderField: 跨实例持久化保留 order 与数组序（today 形态）', async () => {
  const S = require('../js/store.js');
  const F = require('../js/framework/ModuleFactory.js');
  const storage = memStorage();
  const cfg = makeConfig({ orderField: 'order' });
  const s1 = S.createStore(storage);
  const m1 = F.createModule(s1, cfg);
  m1.add({ title: '一', done: true });
  m1.add({ title: '二' });
  const r3 = m1.add({ title: '三' });
  m1.move(r3.id, 'up');
  const s2 = S.createStore(storage);
  await waitFor(() => s2.state.testmod && s2.state.testmod.length === 3, '跨实例读到持久化记录');
  assert.deepEqual(s2.state.testmod.map(x => x.title), ['一', '三', '二']);
  assert.deepEqual(s2.state.testmod.map(x => x.order), [0, 1, 2]);
});

/* ================= 行为：update ================= */

test('update: 按 id 精确匹配，未命中返回 null', () => {
  const { m } = makeModule();
  m.add({ title: 'a' });
  assert.equal(m.update('nope', { title: 'b' }), null);
  assert.equal(m.update(undefined, { title: 'b' }), null);
});

test('update: 局部 patch 只改命中字段，更新 updatedAt，字段同样净化', () => {
  const { m } = makeModule();
  const r = m.add({ title: 'a', count: '5', status: 'todo' });
  const before = r.updatedAt;
  const out = m.update(r.id, { count: '7' });
  assert.equal(out, r, '返回原记录引用');
  assert.equal(out.count, 7);
  assert.equal(out.title, 'a');
  assert.equal(out.status, 'todo');
  assert.ok(new Date(out.updatedAt) >= new Date(before));
  m.update(r.id, null);
  assert.equal(r.count, 7, 'null patch 应原样返回');
});

test('update: required 被清空时抛错且不落盘', () => {
  const { m } = makeModule();
  const r = m.add({ title: 'a' });
  assert.throws(() => m.update(r.id, { title: '' }), TypeError);
  assert.equal(m.getById(r.id).title, 'a');
});

/* ================= 行为：remove ================= */

test('remove: 删除记录进撤销栈，undoRemove 原位置恢复', () => {
  const { m, store } = makeModule();
  m.add({ title: '一' });
  const r2 = m.add({ title: '二' });
  m.add({ title: '三' });
  m.remove(r2.id);
  assert.deepEqual(store.state.testmod.map(x => x.title), ['一', '三']);
  const undone = store.undoRemove();
  assert.ok(undone, '撤销应成功');
  assert.deepEqual(store.state.testmod.map(x => x.title), ['一', '二', '三'], '恢复后位置不变');
  assert.equal(m.getById(r2.id).id, r2.id);
});

test('remove: 未知 id 为无副作用 no-op；未命中不产生撤销条目', () => {
  const { m, store } = makeModule();
  const r = m.add({ title: 'x' });
  const before = store._undo.length;
  m.remove('nope');
  assert.equal(store.state.testmod.length, 1);
  assert.equal(store._undo.length, before);
  m.remove(r.id);
  m.remove(r.id);
});

test('remove: 触发 _emitChange 与 renderer', () => {
  const { m, store } = makeModule();
  const calls = [];
  const orig = store._emitChange;
  store._emitChange = k => calls.push(k);
  m.render(() => { calls.push('render'); });
  const r = m.add({ title: 't' });
  m.remove(r.id);
  store._emitChange = orig;
  assert.deepEqual(calls, ['testmod', 'render', 'testmod', 'render']);
});

/* ================= 行为：getById / query ================= */

test('getById: 命中返回记录，未命中返回 null', () => {
  const { m } = makeModule();
  assert.equal(m.getById('x'), null);
  const r = m.add({ title: 'a' });
  assert.equal(m.getById(r.id), r);
  assert.equal(m.getById(r.id).title, 'a');
});

test('query: 返回浅拷贝数组，修改副本不影响 state，记录为副本', () => {
  const { m, store } = makeModule();
  const r = m.add({ title: 'a' });
  const list = m.query();
  assert.equal(list.length, 1);
  assert.notEqual(list[0], r, '不得外泄可变引用');
  assert.equal(list[0].title, 'a');
  list[0].title = '篡改';
  list.push({ id: 'fake' });
  assert.equal(store.state.testmod[0].title, 'a');
  assert.equal(store.state.testmod.length, 1);
});

test('query: filter 与 sort 生效，且不改动 state', () => {
  const { m, store } = makeModule();
  const r1 = m.add({ title: 'b', count: 2 });
  const r2 = m.add({ title: 'a', count: 1 });
  const r3 = m.add({ title: 'c', count: 3 });
  const got = m.query(x => x.count >= 2, (x, y) => x.title.localeCompare(y.title));
  assert.deepEqual(got.map(x => x.title), ['b', 'c']);
  assert.equal(store.state.testmod.length, 3);
  assert.deepEqual(store.state.testmod.map(x => x.id), [r1.id, r2.id, r3.id], 'query 不得重排/改动原数组');
});

/* ================= 行为：render / destroy ================= */

test('render: getById/query 不触发 renderer；render(null) 解除', () => {
  const { m } = makeModule();
  let n = 0;
  m.render(() => { n += 1; });
  const r = m.add({ title: 'x' });
  m.getById(r.id);
  m.query();
  m.update(r.id, { title: 'y' });
  assert.equal(n, 2, '仅 add/update 触发');
  m.render(null);
  m.update(r.id, { title: 'z' });
  assert.equal(n, 2, '解除后不再触发');
});

test('destroy: 销毁后所有操作立即失败，state 与持久化不受影响', async () => {
  const S = require('../js/store.js');
  const F = require('../js/framework/ModuleFactory.js');
  const storage = memStorage();
  const store = S.createStore(storage);
  const m = F.createModule(store, makeConfig());
  const r = m.add({ title: '前' });
  m.destroy();
  assert.throws(() => m.add({ title: '后' }), /已销毁/);
  assert.throws(() => m.update(r.id, { title: 'x' }), /已销毁/);
  assert.throws(() => m.remove(r.id), /已销毁/);
  assert.throws(() => m.getById(r.id), /已销毁/);
  assert.throws(() => m.query(), /已销毁/);
  const s2 = S.createStore(storage);
  await waitFor(() => s2.state.testmod && s2.state.testmod.length === 1, '销毁仅使模块失效，不碰数据');
});

/* ================= 行为：业务字段互斥 ================= */

test('备份导出/导入保留工厂模块数据（normalize 白名单）', async () => {
  const { window, store } = boot({});
  const m = window.SonderModuleFactory.createModule(store, makeConfig({ id: 'backupmod' }));
  m.add({ title: '备份里' });
  const out = store.exportBackup();
  const parsed = JSON.parse(out);
  assert.equal(parsed.backupmod.length, 1, '导出应含工厂集合');
  await store.importBackup(out);
  assert.equal(store.state.backupmod.length, 1, '导入 re-normalize 后数据仍在');
});

test('业务字段与保留字段 id 互不干扰（record.id 为工厂生成）', () => {
  const { m } = makeModule();
  const r = m.add({ title: 'a' });
  assert.ok(r.id, 'record.id 应由工厂生成');
  assert.equal(typeof r.createdAt, 'string');
  assert.equal(typeof r.updatedAt, 'string');
  assert.equal(r.title, 'a');
});
