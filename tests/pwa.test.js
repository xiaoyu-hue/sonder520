'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

function exists(p) { return fs.existsSync(path.join(root, p)); }

test('PWA：manifest.json 配置正确（应用名/主题色/图标）', () => {
  assert.equal(manifest.name, 'Sonder');
  assert.equal(manifest.short_name, 'Sonder');
  assert.equal(manifest.theme_color, '#2b1a10', '主题色应为墨色系');
  assert.equal(manifest.background_color, '#2b1a10', '背景色应为墨色系');
  assert.equal(manifest.display, 'standalone');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, '应有图标');
  manifest.icons.forEach(icon => {
    assert.ok(exists(icon.src), '图标文件必须存在: ' + icon.src);
  });
});

test('PWA：首页引用 manifest 并注册 Service Worker（相对路径）', () => {
  assert.ok(/<link[^>]*rel="manifest"[^>]*href="manifest\.json"/.test(html), '应引用本地 manifest.json');
  assert.ok(/serviceWorker\.register\(['"]\.\/sw\.js['"]\)/.test(html), '应注册 sw.js（相对路径）');
  assert.ok(exists('sw.js'), 'sw.js 文件必须存在');
});

test('PWA：Service Worker 采用 Cache First 且离线可回退首页', () => {
  assert.ok(sw.includes('caches.match(e.request)'), '应先查缓存（Cache First）');
  assert.ok(sw.includes('fetch(e.request)'), '未命中应回源');
  assert.ok(sw.includes('caches.match(\'./index.html\')'), '离线导航应回退首页缓存');
  assert.ok(sw.includes('caches.open(CACHE)'), '应有缓存写入');
  assert.ok(sw.includes('skipWaiting') && sw.includes('clients.claim'), '更新后应尽快接管');
});

test('PWA：导航请求走 Network First（刷新即拿新版，离线回退缓存首页）', () => {
  assert.ok(sw.includes("e.request.mode === 'navigate'"), '应区分导航请求');
  assert.ok(sw.includes('fetch(e.request).then(function (res) {'), '导航应优先回源');
  assert.ok(sw.includes("caches.match('./index.html').then"), '导航离线应回退首页缓存');
  assert.ok(sw.includes('Response.error()'), '兜底错误响应');
});

test('PWA：旧版本缓存会被自动清理', () => {
  assert.ok(sw.includes('filter(function (k) { return k !== CACHE; })'), '应过滤并清理旧版本缓存');
  assert.ok(sw.includes('caches.delete(k)'), '应删除旧缓存');
});

test('PWA：全部静态资源列入预缓存清单', () => {
  ['index.html', 'css/style.css', 'img/wallpaper.jpg', 'assets/icon.svg'].forEach(p => {
    assert.ok(sw.includes("'./" + p + "'"), '预缓存清单缺 ' + p);
  });
  const jsFiles = fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js'));
  jsFiles.forEach(f => {
    assert.ok(sw.includes("'./js/" + f + "'"), '预缓存清单缺 js/' + f);
  });
});

test('PWA：页脚显示离线就绪提示', () => {
  assert.ok(html.includes('已准备就绪，断网亦可使用。'), '页脚应有离线提示文案');
});