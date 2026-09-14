'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert');
const TaskDomain = require('../js/domain/task-domain.js');

describe('TaskDomain.complete（完成规则）', () => {
  test('未完成任务 → 返回完成 patch（done + doneAt=now）', () => {
    const patch = TaskDomain.complete({ id: 'a', done: false }, '2026-09-14T08:00:00.000Z');
    assert.deepEqual(patch, { done: true, doneAt: '2026-09-14T08:00:00.000Z' });
  });

  test('已完成任务 → null（不可重复完成，不覆盖原 doneAt）', () => {
    const task = { id: 'a', done: true, doneAt: '2026-09-13T10:00:00.000Z' };
    assert.equal(TaskDomain.complete(task, '2026-09-14T08:00:00.000Z'), null);
  });

  test('纯函数：不修改入参任务', () => {
    const task = { id: 'a', done: false, doneAt: null };
    const snapshot = JSON.stringify(task);
    TaskDomain.complete(task, '2026-09-14T08:00:00.000Z');
    assert.equal(JSON.stringify(task), snapshot);
  });

  test('now 缺省时 doneAt 置 null（调用方应总是传时间）', () => {
    const patch = TaskDomain.complete({ id: 'a', done: false }, undefined);
    assert.deepEqual(patch, { done: true, doneAt: null });
  });

  test('非法入参 → null', () => {
    assert.equal(TaskDomain.complete(null, 't'), null);
    assert.equal(TaskDomain.complete(undefined, 't'), null);
    assert.equal(TaskDomain.complete('x', 't'), null);
  });
});

describe('TaskDomain.reopen（重开规则）', () => {
  test('已完成任务 → 返回重开 patch（done=false, doneAt=null）', () => {
    const patch = TaskDomain.reopen({ id: 'a', done: true, doneAt: '2026-09-13T10:00:00.000Z' });
    assert.deepEqual(patch, { done: false, doneAt: null });
  });

  test('未完成任务 → null（无可重开）', () => {
    assert.equal(TaskDomain.reopen({ id: 'a', done: false }), null);
  });

  test('纯函数：不修改入参任务', () => {
    const task = { id: 'a', done: true, doneAt: 't' };
    const snapshot = JSON.stringify(task);
    TaskDomain.reopen(task);
    assert.equal(JSON.stringify(task), snapshot);
  });

  test('非法入参 → null', () => {
    assert.equal(TaskDomain.reopen(null), null);
    assert.equal(TaskDomain.reopen(undefined), null);
    assert.equal(TaskDomain.reopen('x'), null);
  });
});

describe('TaskDomain 模块形态', () => {
  test('导出 complete/reopen 两个纯函数', () => {
    assert.equal(typeof TaskDomain.complete, 'function');
    assert.equal(typeof TaskDomain.reopen, 'function');
    assert.deepEqual(Object.keys(TaskDomain).sort(), ['complete', 'reopen']);
  });
});
