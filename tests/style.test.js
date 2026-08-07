'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
const storeJs = fs.readFileSync(path.join(root, 'js', 'store.js'), 'utf8');
const selfmediaJs = fs.readFileSync(path.join(root, 'js', 'selfmedia.js'), 'utf8');

test('主题：浅色(宣纸)与深色(墨黑)双主题变量齐备', () => {
  assert.ok(css.includes(':root'), '缺少 :root 浅色主题');
  assert.ok(css.includes('[data-theme="dark"]'), '缺少深色主题');
  assert.notEqual(css.match(/background-color: var\(--bg\)/g)?.length, 0, 'body 应使用 --bg');
  const darkBlk = css.split('[data-theme="dark"]')[1].split('}')[0];
  assert.ok(darkBlk.includes('--bg: #171410'), '深色应为墨黑纸底');
  const lightBlk = css.split(':root')[1].split('}')[0];
  assert.ok(lightBlk.includes('--bg: #f2efe6'), '浅色应为宣纸米白');
});

test('液态玻璃核心：backdrop-filter blur + saturate + 亮度，含 -webkit 前缀', () => {
  ['.glass', '.sidebar', '.topbar', '.card', '.list-item', '.rank-card', '.modal'].forEach(sel => {
    assert.ok(css.includes(sel), '缺少玻璃选择器 ' + sel);
  });
  const need = css.includes('backdrop-filter: blur(16px) saturate(1.5) brightness(1.04)')
    && css.includes('-webkit-backdrop-filter: blur(16px) saturate(1.5) brightness(1.04)');
  assert.ok(need, 'glass 需带 saturate/brightness 的标准与 -webkit 前缀');
  assert.ok(css.includes('-webkit-backdrop-filter') && css.includes('backdrop-filter'), '两侧前缀均需要');
});

test('不支持 backdrop-filter 的浏览器有降级 @supports', () => {
  assert.ok(css.includes('@supports not'), '缺少降级 @supports');
  assert.ok(/@supports not\s*\(\(backdrop-filter/.test(css), '降级条件应包含 backdrop-filter');
});

test('朱砂红强调色在双主题下均有定义', () => {
  assert.ok(css.includes('--accent: #c23b2e'), '浅色应为朱砂红 #c23b2e');
  assert.ok(css.includes('--accent: #e0643f'), '深色应为亮朱砂红');
});

test('水墨背景：双主题均有淡墨 radial-gradient 云雾', () => {
  assert.ok(css.includes('radial-gradient'), '需要水墨云雾背景');
  const lightBlk = css.split('/* ---------- 侧边栏')[0];
  assert.ok(lightBlk.includes('ink-blob-1'), '浅色缺淡墨层次1');
  assert.ok(lightBlk.includes('ink-blob-2'), '浅色缺淡墨层次2');
  assert.ok(lightBlk.split('[data-theme="dark"]')[1].includes('radial-gradient'), '深色缺水墨背景');
});

test('图表配色使用国画颜料色系（花青/朱砂/赭石/石绿）', () => {
  ['#3b4a6b', '#c23b2e', '#b0723f', '#2e7d63'].forEach(c => {
    assert.ok(selfmediaJs.includes(c), 'selfmedia 缺色 ' + c);
  });
  ['#3b4a6b', '#b0723f', '#2e7d63', '#a8a297'].forEach(c => {
    assert.ok(storeJs.includes(c), 'store 缺色 ' + c);
  });
});

test('进度条滑块为朱砂红液体感', () => {
  assert.ok(css.includes('input[type="range"]'), '应定义滑块样式');
  const slider = css.slice(css.indexOf('::-webkit-slider-thumb'));
  assert.ok(slider.includes('var(--accent)'), '滑块应使用主题强调色');
  assert.ok(slider.includes('transition'), '滑块应有过渡(液体感)');
});