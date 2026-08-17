'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

function netState(h) {
  const doc = h.window.document;
  return {
    onlineHidden: doc.querySelector('#netOnline').hidden,
    offlineHidden: doc.querySelector('#netOffline').hidden
  };
}

function setOnline(h, v) {
  Object.defineProperty(h.window.navigator, 'onLine', {
    value: !!v, configurable: true, writable: true
  });
}

/* 浏览器真实语义：先更新 navigator.onLine，再派发对应事件 */
function fire(h, type, online) {
  setOnline(h, online);
  h.window.dispatchEvent(new h.window.Event(type));
}

test('离线指示：初始在线时显示在线提示、隐藏离线提示', () => {
  const h = boot();
  const s = netState(h);
  assert.equal(s.onlineHidden, false, '在线提示应可见');
  assert.equal(s.offlineHidden, true, '离线提示应隐藏');
});

test('离线指示：派发 offline 事件后切换为离线提示', () => {
  const h = boot();
  fire(h, 'offline', false);
  const s = netState(h);
  assert.equal(s.onlineHidden, true, '在线提示应隐藏');
  assert.equal(s.offlineHidden, false, '离线提示应可见（红色高亮）');
});

test('离线指示：派发 online 事件后恢复在线提示', () => {
  const h = boot();
  fire(h, 'offline', false);
  fire(h, 'online', true);
  const s = netState(h);
  assert.equal(s.onlineHidden, false, '在线提示应恢复可见');
  assert.equal(s.offlineHidden, true, '离线提示应隐藏');
});

test('离线指示：初始离线（navigator.onLine=false）直接显示离线提示', () => {
  const h = boot({ online: false });
  const s = netState(h);
  assert.equal(s.onlineHidden, true, '在线提示应隐藏');
  assert.equal(s.offlineHidden, false, '离线提示应可见');
  /* 恢复联网后应切回 */
  fire(h, 'online', true);
  const after = netState(h);
  assert.equal(after.onlineHidden, false, '恢复后在线提示应可见');
  assert.equal(after.offlineHidden, true, '恢复后离线提示应隐藏');
});

test('离线指示：切换不影响其他页脚元素', () => {
  const h = boot();
  const footerBefore = h.window.document.querySelector('.site-footer').textContent;
  fire(h, 'offline', false);
  const footerAfter = h.window.document.querySelector('.site-footer').textContent;
  assert.ok(footerBefore.includes('Sonder 开源'), '页脚应有品牌文案');
  assert.ok(footerAfter.includes('Sonder 开源'), '切换后品牌文案不应丢失');
  assert.ok(footerAfter.includes('Netlify'), 'Netlify 链接不应受影响');
});
