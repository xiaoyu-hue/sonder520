'use strict';
const { test } = require('node:test');
const { readAllCss } = require('./css-helper');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..')

const jsDir = path.join(root, 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

test('js 目录含所有必要模块文件', () => {
  const expected = ['store.js', 'ui.js', 'quotes.js', 'app.js', 'home.js', 'today.js', 'memo.js', 'selfmedia.js',
    'dev.js', 'consulting.js', 'reading.js', 'news.js', 'design.js', 'settings.js', 'games-logic.js', 'games.js'];
  expected.forEach(f => assert.ok(files.includes(f), '缺少 ' + f));
});

test('每个 JS 文件均非空且语法有效（可编译）', () => {
  files.forEach(f => {
    const code = fs.readFileSync(path.join(jsDir, f), 'utf8');
    assert.ok(code.trim().length > 0, f + ' 为空');
    assert.doesNotThrow(() => new Function(code), f + ' 语法错误');
  });
});

test('index.html 顺序引入所有 js 且路径正确', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const order = ['store.js', 'ui.js', 'quotes.js', 'home.js', 'today.js', 'memo.js', 'selfmedia.js',
    'dev.js', 'consulting.js', 'reading.js', 'news.js', 'design.js', 'games-logic.js', 'games.js',
    'settings.js', 'app.js'];
  order.forEach(f => {
    const tag = '<script src="js/' + f + '" defer></script>';
    assert.ok(html.includes(tag), '缺少引入: ' + f);
  });
});

test('store.js 在浏览器全局模式与 Node 模式均可加载', () => {
  const code = fs.readFileSync(path.join(jsDir, 'store.js'), 'utf8');
  assert.ok(code.includes('module.exports'));
  assert.ok(code.includes('root.SonderStore'));
  const S = require(path.join(jsDir, 'store.js'));
  assert.ok(typeof S.createStore === 'function');
});

test('index.html 包含外壳结构元素', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  ['id="nav"', 'id="content"', 'id="pageTitle"', 'topbar', 'class="sidebar"'].forEach(sel => {
    assert.ok(html.includes(sel), '缺少外壳元素: ' + sel);
  });
});

test('开源合规：页脚 GitHub 链接与社区文件齐备（Netlify 声明随迁移 CF Pages/GH Pages 移除）', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.includes('https://github.com/xiaoyu-hue/sonder520'), '缺 GitHub 仓库链接');
  /* Commit 6：实际部署为 CF Pages + GH Pages，Netlify 开源计划归属声明已过时移除 */
  assert.ok(!html.includes('netlify.com'), '陈旧 Netlify 声明不应残留');
  const css = readAllCss(root);
  assert.ok(css.includes('.site-footer'), '缺页脚样式');
  assert.ok(fs.existsSync(path.join(root, 'LICENSE')), '仓库缺 LICENSE');
  assert.ok(fs.existsSync(path.join(root, 'CODE_OF_CONDUCT.md')), '仓库缺 CODE_OF_CONDUCT.md');
});