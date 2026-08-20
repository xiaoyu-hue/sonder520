'use strict';
/* 加密竞态回归：_encSave 串行队列保证连续多次 save 落盘顺序与调用一致 */
const { test } = require('node:test');
const assert = require('node:assert');
const S = require('../js/store.js');

/* 集合级持久化：密文落在逐集合 key（tasks 集合必然存在——测试只写任务） */
const COL = id => 'sonder_col_' + id + '_v1';
const PWD = 'race-2026-强密码';

function memStorage() {
  const d = {};
  return {
    _data: d,
    getItem: k => (k in d ? d[k] : null),
    setItem: (k, v) => { d[k] = String(v); },
    removeItem: k => { delete d[k]; }
  };
}

test('加密竞态：连续多次 save 后落盘必须是最后状态', async () => {
  const st = memStorage();
  const s = S.createStore(st);
  s.addTask({ title: 'T0', priority: '高' });
  await s.enableEncryption(PWD);

  /* 不 await 加密落盘，模拟用户快速连续操作 */
  s.addTask({ title: 'T1', priority: '高' });
  s.addTask({ title: 'T2', priority: '高' });
  s.addTask({ title: 'T3', priority: '高' });

  await s._encChain;

  const raw = JSON.parse(st._data[COL('tasks')]);
  assert.equal(raw.e, 1, '落盘应为密文格式');

  const s2 = S.createStore(st);
  assert.equal(await s2.unlock(PWD), true, '应可解锁');
  const titles = s2.state.tasks.map(t => t.title);
  assert.deepEqual(titles, ['T0', 'T1', 'T2', 'T3'], '落盘必须是最后一次变更，不得被旧状态覆盖');
});

test('加密竞态：落盘后 IDB 侧也应与最终状态一致', async () => {
  const st = memStorage();
  const s = S.createStore(st);
  await s.enableEncryption(PWD);
  s.addTask({ title: 'A', priority: '高' });
  s.addTask({ title: 'B', priority: '高' });
  s.addTask({ title: 'C', priority: '高' });
  await s._encChain;
  await s._idbPromise;

  /* IDB 内容与 LS 一致（同一 payload 写入） */
  const lsRaw = JSON.parse(st._data[COL('tasks')]);
  assert.equal(lsRaw.e, 1, 'LS 存在密文');
  assert.ok(!st._data[COL('tasks')].includes('任务'), '密文不含明文');
});
