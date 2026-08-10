'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { boot } = require('./harness.js');

const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

test('帧率：默认 120，旧数据缺字段时归一化补默认', () => {
  const h = boot();
  assert.equal(h.store.state.settings.frameRate, 120, '默认 120');
  const h2 = boot({ seed: { version: 1, settings: {}, tasks: [] } });
  assert.equal(h2.store.state.settings.frameRate, 120, '旧数据应补默认 120');
});

test('帧率：setFrameRate 持久化且非法值回退 120', () => {
  const h = boot();
  h.store.setFrameRate(60);
  assert.equal(h.store.state.settings.frameRate, 60);
  h.store.setFrameRate(90);
  assert.equal(h.store.state.settings.frameRate, 90);
  h.store.setFrameRate(999);
  assert.equal(h.store.state.settings.frameRate, 120, '非法值应回退 120');
});

test('帧率：设置页可选 60/90/120 并即时生效到 data-frame', () => {
  const h = boot();
  h.goto('settings');
  const radios = Array.from(h.window.document.querySelectorAll('input[name="frame"]'));
  assert.equal(radios.length, 3, '应有三档');
  assert.deepEqual(radios.map(r => r.value), ['60', '90', '120']);
  assert.equal(radios.find(r => r.checked).value, '120', '默认选中 120');
  const r60 = radios.find(r => r.value === '60');
  r60.checked = true;
  r60.dispatchEvent(new h.window.Event('change', { bubbles: true }));
  assert.equal(h.store.state.settings.frameRate, 60, '应持久化 60');
  assert.equal(h.window.document.documentElement.getAttribute('data-frame'), '60', '根元素应标记 data-frame=60');
  h.goto('home');
  assert.equal(h.window.document.documentElement.getAttribute('data-frame'), '60', '切页后仍保持');
});

test('帧率：90 档与 60 档有 CSS 覆盖规则，120 档保持原速', () => {
  assert.ok(css.includes('[data-frame="90"]'), '90 档应有覆盖规则');
  assert.ok(css.includes('[data-frame="90"] .rd-donut'), '90 档应降频装饰动画');
  assert.ok(css.includes('[data-frame="60"]'), '60 档应有覆盖规则');
  assert.ok(/\[data-frame="60"\][^\{]*\*[,.{]?/.test(css), '60 档应全局压制动画');
  assert.ok(!css.includes('[data-frame="120"]'), '120 档不应有覆盖规则（保持满速原版）');
});