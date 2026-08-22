'use strict';
const { test } = require('node:test');
const { readAllCss } = require('./css-helper');
const assert = require('node:assert/strict');
const path = require('node:path');
const { root } = require('./harness.js');

/* CSS 变量契约：所有 var(--x) 引用必须有定义。
 * 例外白名单：--cols 由 games.js 运行时动态 setProperty。 */

test('css: 所有 var(--x) 引用的变量都有定义', () => {
  const root = path.join(__dirname, '..');
const css = readAllCss(root);
  const defs = new Set([...css.matchAll(/--([\w-]+)\s*:/g)].map(m => m[1]));
  const refs = [...css.matchAll(/var\(--([\w-]+)/g)].map(m => m[1]);
  const missing = [...new Set(refs.filter(r => !defs.has(r)))].filter(r => r !== 'cols');
  assert.deepEqual(missing, [], 'CSS 引用了未定义变量: ' + missing.join(', '));
});

test('css: 引用最多的常用变量存在（防误删核心色板）', () => {
  const css = readAllCss(root);
  ['--bg', '--text', '--accent', '--glass-2', '--border', '--danger', '--ok', '--warn'].forEach(v => {
    assert.ok(css.includes(v + ':'), '缺少核心变量定义: ' + v);
  });
});