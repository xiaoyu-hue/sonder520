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

test('error-guard: file:// 直开时资源加载失败仅记录不弹 toast（manifest CORS 噪音）', () => {
  const { window, $ } = boot({ url: 'file:///D:/Sonder/index.html' });
  const img = window.document.createElement('img');
  img.src = 'manifest.json';
  window.document.body.appendChild(img);
  img.dispatchEvent(new window.Event('error'));
  assert.equal(window.__sonderErrors.total, 1, '仍应记录到 __sonderErrors');
  assert.equal(window.__sonderErrors.list[0].type, 'resource');
  assert.ok(!$('#toastWrap .toast'), 'file:// 下资源类错误不应弹 toast');
});

test('error-guard: file:// 直开时脚本错误仍弹 toast（不掩盖真故障）', () => {
  const { window, $ } = boot({ url: 'file:///D:/Sonder/index.html' });
  const ev = new window.ErrorEvent('error', {
    message: 'boom-file-js',
    filename: 'app.js',
    lineno: 1,
    colno: 1,
    error: new window.Error('boom-file-js')
  });
  window.dispatchEvent(ev);
  assert.equal(window.__sonderErrors.total, 1);
  assert.ok($('#toastWrap .toast'), 'file:// 下脚本错误应照常弹 toast');
});

test('error-guard: clear 可重置统计', () => {
  const { window } = boot({});
  const ev = new window.ErrorEvent('error', { message: 'x', error: new window.Error('x') });
  window.dispatchEvent(ev);
  window.__sonderErrors.clear();
  assert.equal(window.__sonderErrors.total, 0);
  assert.equal(window.__sonderErrors.list.length, 0);
});

test('error-guard: 公开 report API 记录字符串错误', () => {
  const { window } = boot({});
  assert.equal(typeof window.__sonderErrors.report, 'function', 'report 应为公开函数');
  window.__sonderErrors.report('降级异常：壁纸加载失败');
  assert.equal(window.__sonderErrors.total, 1);
  const last = window.__sonderErrors.list[0];
  assert.equal(last.type, 'reported');
  assert.equal(last.message, '降级异常：壁纸加载失败');
  assert.equal(last.stack, null);
});

test('error-guard: report API 支持 Error 实例与自定义类型', () => {
  const { window } = boot({});
  window.__sonderErrors.report(new window.Error('io-fail'), 'storage');
  const last = window.__sonderErrors.list[0];
  assert.equal(last.type, 'storage');
  assert.equal(last.message, 'io-fail');
  assert.ok(last.stack && last.stack.length > 0, 'Error 实例应提取堆栈');
});

/* ---------- 静默失败守卫（静态审计） ---------- */

test('error-guard: 无注释的空 catch 块禁止（吞错必须说明降级理由）', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = path.join(__dirname, '..', 'js');
  const offenders = [];
  fs.readdirSync(dir).filter(f => f.endsWith('.js')).forEach(f => {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
    let inCatch = false;
    let block = '';
    let start = 0;
    lines.forEach((line, i) => {
      const t = line.trim();
      const m = t.match(/catch\s*\([^)]*\)/);
      if (!inCatch && m) {
        inCatch = true;
        start = i + 1;
        const openIdx = t.indexOf('{', m.index);
        if (openIdx < 0) { inCatch = false; return; }
        const closeIdx = t.indexOf('}', openIdx);
        if (closeIdx >= 0) {
          inCatch = false;
          check(t.slice(openIdx + 1, closeIdx));
        } else {
          block = t.slice(openIdx + 1);
        }
        return;
      }
      if (inCatch) {
        if (t.indexOf('}') >= 0 && t.indexOf('{') < 0) {
          block += ' ' + t.slice(0, t.indexOf('}'));
          inCatch = false;
          check(block);
        } else {
          block += ' ' + t;
        }
      }
    });
    function check(body) {
      const hasContent = body.split(/\n/).some(l => l.trim());
      if (!hasContent) offenders.push(f + ':' + start);
    }
  });
  assert.deepEqual(offenders, [], '以下空 catch 块无任何说明注释，吞错必须写明降级理由: ' + offenders.join(', '));
});

test('error-guard: Promise 链静默空回调禁止（.catch(function () {})）', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = path.join(__dirname, '..', 'js');
  const offenders = [];
  fs.readdirSync(dir).filter(f => f.endsWith('.js')).forEach(f => {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      if (/\.catch\(\s*function\s*\(\s*\)\s*\{\s*\}\s*\)/.test(line)) {
        offenders.push(f + ':' + (i + 1));
      }
    });
  });
  assert.deepEqual(offenders, [], '以下静默空回调必须带 err 参数并说明原因: ' + offenders.join(', '));
});