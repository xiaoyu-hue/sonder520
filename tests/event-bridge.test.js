'use strict';
/* EventBridge v0.1 事件契约测试：EVENT 常量表 + payload 契约 + store 广播收编
 * 覆盖：常量表冻结/静态值、生成器与字面量恒等、store 广播经常量表（收编生效）、
 *       Node 独立加载回落字面量（路径等价）、让位事件经常量表、/data 广播 detail 契约。 */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const B = require('../js/event-bus.js');
const S = require('../js/store.js');

beforeEach(() => { B.reset(); });

function memStorage(initial = {}) {
  const m = { ...initial };
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem(k, v) { m[k] = String(v); },
    removeItem(k) { delete m[k]; }
  };
}

/* 临时注入/恢复全局 SonderBus（收编后的假总线可携带 EVENT） */
function withBus(fake, fn) {
  const original = globalThis.SonderBus;
  globalThis.SonderBus = fake;
  try { return fn(); } finally {
    if (original) globalThis.SonderBus = original; else delete globalThis.SonderBus;
  }
}

test('EVENT：常量表冻结；静态事件名与既有广播字面量恒等', () => {
  assert.ok(Object.isFrozen(B.EVENT), '常量表冻结');
  assert.equal(B.EVENT.DATA_ALL, '/data/all');
  assert.equal(B.EVENT.STORE_YIELDED, '/store/yielded', '与 store-write-lock 既有断言字面量双向锁死');
});

test('EVENT：data 生成器与 /data/<集合> 字面量等价（string/number key）', () => {
  assert.equal(B.EVENT.data('memos'), '/data/memos');
  assert.equal(B.EVENT.data('tasks'), '/data/tasks');
  assert.equal(B.EVENT.data('devProjects'), '/data/devProjects');
  assert.equal(B.EVENT.data('miniRecords'), '/data/miniRecords');
  assert.equal(B.EVENT.data(7), '/data/7');
  assert.equal(B.EVENT.data(''), '/data/');
});

test('EVENT：store 广播路径经常量表生成（收编生效：改表即改广播）', () => {
  const emitted = [];
  const fake = {
    bus: { emit: (p) => emitted.push(p) },
    EVENT: { DATA_ALL: '/data/all', STORE_YIELDED: '/store/yielded', data: (k) => '/data/x-' + k }
  };
  withBus(fake, () => {
    const s = S.createStore(memStorage());
    s.addMemo('A');
    s.addMemo('B');
  });
  assert.deepEqual(emitted, ['/data/x-memos', '/data/x-memos'], '广播源是常量表而非字面量');
});

test('EVENT：无 EVENT 全局（Node 独立加载）回落等价字面量，路径不变', () => {
  const emitted = [];
  const fake = { bus: { emit: (p) => emitted.push(p) } }; /* 无 EVENT：收编前形态 */
  withBus(fake, () => {
    const s = S.createStore(memStorage());
    s.addTask({ title: 'T' });
  });
  assert.deepEqual(emitted, ['/data/tasks'], '回落字面量与常量表输出恒等');
});

test('EVENT：让位事件经常量表（改表即改让位广播）', () => {
  const emitted = [];
  const fake = {
    bus: { emit: (p) => emitted.push(p) },
    EVENT: { DATA_ALL: '/data/all', STORE_YIELDED: '/store/yielded-2', data: (k) => '/data/' + k }
  };
  withBus(fake, () => {
    const s = S.createStore(memStorage());
    s._absorbNewer(); /* 空存储：emit 后即返回，无异步解析 */
  });
  assert.deepEqual(emitted, ['/store/yielded-2'], '让位事件经 EVENT.STORE_YIELDED');
});

test('EVENT：/data 广播 payload 契约——detail 恒为 undefined，订阅者只依赖 path', () => {
  const got = [];
  B.on('/data/*', (p, d) => got.push([p, d]));
  const fake = { bus: { emit: (p) => B.emit(p) } }; /* 模拟 store 广播（不携带 detail） */
  withBus(fake, () => {
    const s = S.createStore(memStorage());
    s.addMemo('契约');
  });
  assert.equal(got.length, 1);
  assert.equal(got[0][0], '/data/memos');
  assert.strictEqual(got[0][1], undefined, '缺字段语义：detail 恒 undefined，订阅者不得读取');
});

test('EVENT：SonderBus.on 返回 unsubscribe，重复取消幂等', () => {
  const got = [];
  const un = B.on('/data/memos', (p) => got.push(p));
  B.emit('/data/memos');
  assert.equal(typeof un, 'function', 'on 返回取消函数');
  un();
  un(); /* 幂等 */
  B.emit('/data/memos');
  assert.equal(got.length, 1, '取消后不再触发');
});

test('EVENT：DATA_ALL 语义——全量变更广播 /data/all（导入/清空入口）', () => {
  const got = [];
  B.on(B.EVENT.DATA_ALL, (p) => got.push(p));
  const fake = { bus: { emit: (p) => B.emit(p) } };
  withBus(fake, () => {
    const s = S.createStore(memStorage());
    s.clearAll();
  });
  assert.deepEqual(got, ['/data/all'], 'clearAll 全量广播与常量表一致');
});
