'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./harness.js');

test('error-guard: 加载后 __sonderErrors 存在且初始为空', () => {
  const { window } = boot({});
  assert.ok(window.__sonderErrors, '__sonderErrors 应存在');
  assert.ok(Array.isArray(window.__sonderErrors.list));
  assert.equal(window.__sonderErrors.total, 0);
});

test('error-guard: 捕获未处理脚本错误并生成 toast', () => {
  const { window, $ } = boot({});
  const ev = new window.ErrorEvent('error', {
    message: 'boom-guard',
    filename: 'fake.js',
    lineno: 7,
    colno: 3,
    error: new window.Error('boom-guard')
  });
  window.dispatchEvent(ev);
  assert.equal(window.__sonderErrors.total, 1);
  const last = window.__sonderErrors.list[0];
  assert.equal(last.type, 'error');
  assert.equal(last.message, 'boom-guard');
  assert.ok(last.stack && last.stack.length > 0, '应记录错误堆栈');
  assert.ok($('#toastWrap .toast'), '应弹出错误 toast');
  assert.ok($('#toastWrap .toast').className.indexOf('err') >= 0, 'toast 应为错误样式');
});

test('error-guard: 3 秒内多条错误合并提示，不刷屏', () => {
  const { window, $$ } = boot({});
  for (let i = 0; i < 5; i++) {
    const ev = new window.ErrorEvent('error', { message: 'boom-' + i, error: new window.Error('boom-' + i) });
    window.dispatchEvent(ev);
  }
  assert.equal(window.__sonderErrors.total, 5, '记录应累计 5 条');
  assert.equal($$('#toastWrap .toast').length, 1, '3 秒窗口内应只弹 1 个 toast');
  assert.ok(window.__sonderErrors.list[4].message.indexOf('boom-4') >= 0, '最近一条是最后一次');
});

test('error-guard: 捕获未处理的 Promise 拒绝', () => {
  const { window } = boot({});
  const ev = new window.Event('unhandledrejection');
  ev.reason = new window.Error('promise-boom');
  window.dispatchEvent(ev);
  assert.equal(window.__sonderErrors.total, 1);
  const last = window.__sonderErrors.list[0];
  assert.equal(last.type, 'unhandledrejection');
  assert.equal(last.message, 'promise-boom');
  assert.ok(last.stack.indexOf('promise-boom') >= 0, '应带堆栈');
});

test('error-guard: 非 Error 的拒绝原因也能记录', () => {
  const { window } = boot({});
  const ev = new window.Event('unhandledrejection');
  ev.reason = 'just a string reason';
  window.dispatchEvent(ev);
  assert.equal(window.__sonderErrors.list[0].message, 'just a string reason');
});

test('error-guard: 捕获资源加载失败（img 不冒泡的错误事件）', () => {
  const { window } = boot({});
  const img = window.document.createElement('img');
  img.src = 'img/never-exists.jpg';
  window.document.body.appendChild(img);
  img.dispatchEvent(new window.Event('error'));
  assert.equal(window.__sonderErrors.total, 1);
  const last = window.__sonderErrors.list[0];
  assert.equal(last.type, 'resource');
  assert.ok(last.message.indexOf('never-exists.jpg') >= 0, '消息应含资源地址');
});

test('error-guard: clear 可重置统计', () => {
  const { window } = boot({});
  const ev = new window.ErrorEvent('error', { message: 'x', error: new window.Error('x') });
  window.dispatchEvent(ev);
  window.__sonderErrors.clear();
  assert.equal(window.__sonderErrors.total, 0);
  assert.equal(window.__sonderErrors.list.length, 0);
});