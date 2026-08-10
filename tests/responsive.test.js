'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

test('响应式：桌面超宽屏内容限宽居中', () => {
  assert.ok(/\.content > \* \{[^}]*max-width:\s*1240px/s.test(CSS), '内容区限宽 1240px');
  assert.ok(/\.content > \* \{[^}]*margin-left:\s*auto/s.test(CSS), '内容区居中');
});

test('响应式：手机底栏导航（≤720px）', () => {
  assert.ok(/@media \(max-width:\s*720px\)\s*\{[^@]*?\.sidebar\s*\{[^}]*order:\s*2/s.test(CSS), '720 下侧栏变底栏');
  assert.ok(/@media \(max-width:\s*720px\)\s*\{[^@]*?\.nav\s*\{[^}]*flex-direction:\s*row/s.test(CSS), '导航横向排列');
  assert.ok(/\.brand\s*\{\s*display:\s*none/s.test(CSS), '手机隐藏品牌区');
});

test('响应式：网格在各断点降列', () => {
  assert.ok(/@media \(max-width:\s*1000px\)\s*\{[^@]*?repeat\(2,\s*1fr\)/s.test(CSS), '≤1000px 网格两列');
  assert.ok(/@media \(max-width:\s*640px\)\s*\{[^@]*?grid-template-columns:\s*1fr/s.test(CSS), '≤640px 网格单列');
});

test('响应式：平板图标栏（721-960px）', () => {
  assert.ok(/@media \(min-width:\s*721px\) and \(max-width:\s*960px\)\s*\{[^@]*?\.sidebar\s*\{[^}]*width:\s*70px/s.test(CSS), '平板侧栏折叠为图标栏');
});

test('响应式：棋盘与格子适配', () => {
  assert.ok(/\.game-board\s*\{[^}]*width:\s*min\(92vw,\s*480px\)/s.test(CSS), '五子棋盘自适应宽度');
  assert.ok(/\.game-board\.small\s*\{[^}]*repeat\(3,\s*1fr\)/s.test(CSS), '井字棋盘三列');
  assert.ok(/\.game-board\.big \.cell\s*\{[^}]*min-height:\s*0/s.test(CSS), '大棋盘格子不受固定格高限制');
  assert.ok(/\.ms-board\s*\{[^}]*max-width:\s*min\(100%,\s*540px\)/s.test(CSS), '扫雷棋盘限宽');
  assert.ok(/\.ms-cell\s*\{[^}]*min-height:\s*clamp\(16px,\s*6vw,\s*32px\)/s.test(CSS), '扫雷格自适应');
  assert.ok(/\.cell\s*\{[^}]*aspect-ratio:\s*1\/1/s.test(CSS), '对弈格子保持正方形');
});

test('响应式：超小屏与横屏兜底', () => {
  assert.ok(/@media \(max-width:\s*360px\)/, '360px 超小屏段存在');
  assert.ok(/@media \(max-width:\s*900px\) and \(max-height:\s*480px\)/, '手机横屏段存在');
  assert.ok(/@media \(max-width:\s*720px\)\s*\{[^@]*?\.gsearch-panel\s*\{[^}]*position:\s*fixed/s.test(CSS), '手机搜索浮层全宽');
  assert.ok(/@media \(max-width:\s*720px\)\s*\{[^@]*?\.tp-card\s*\{[^}]*flex-wrap:\s*wrap/s.test(CSS), '今日计划卡片手机可换行');
});

test('响应式：媒体特性细节（触控字号/减弱动效）', () => {
  assert.ok(/@media \(hover:\s*hover\) and \(pointer:\s*fine\)/, '桌面端字号还原');
  assert.ok(/input,\s*select,\s*textarea,\s*button\s*\{\s*font-size:\s*16px/, '触屏防聚焦缩放字号');
  assert.ok(/@media \(prefers-reduced-motion:\s*reduce\)/, '尊重减少动效');
});