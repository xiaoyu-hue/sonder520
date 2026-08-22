'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const swRegister = fs.readFileSync(path.join(root, 'js', 'sw-register.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

function exists(p) { return fs.existsSync(path.join(root, p)); }

test('PWA：manifest.json 配置正确（应用名/主题色/图标）', () => {
  assert.equal(manifest.name, 'Sonder');
  assert.equal(manifest.short_name, 'Sonder');
  /* Commit 5 统一：manifest 主题/背景与 meta theme-color（宣纸 #f2efe6）一致，
   * 消除"浏览器内宣纸浅色 vs 安装态深棕闪屏"割裂 */
  assert.equal(manifest.theme_color, '#f2efe6', '主题色应与页面 meta theme-color 一致（宣纸）');
  assert.equal(manifest.background_color, '#f2efe6', '背景色应为宣纸系');
  assert.equal(manifest.display, 'standalone');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, '应有图标');
  manifest.icons.forEach(icon => {
    assert.ok(exists(icon.src), '图标文件必须存在: ' + icon.src);
  });
  const purposes = manifest.icons.map(i => i.purpose);
  assert.ok(purposes.includes('maskable'), '应含 maskable 图标（Android 自适应防裁切）');
  assert.ok(purposes.includes('any') && manifest.icons.some(i => String(i.src).endsWith('.png')), '应含 PNG 位图图标（部分启动器不支持 SVG）');
});

test('PWA：iOS apple-touch-icon 存在且被引用', () => {
  assert.ok(/<link[^>]*rel="apple-touch-icon"[^>]*href="assets\/apple-touch-icon\.png"/.test(html), 'index.html 应引用 apple-touch-icon');
  assert.ok(exists('assets/apple-touch-icon.png'), 'apple-touch-icon 文件必须存在');
});

test('PWA：首页引用 manifest 并注册 Service Worker（相对路径）', () => {
  assert.ok(/<link[^>]*rel="manifest"[^>]*href="manifest\.json"/.test(html), '应引用本地 manifest.json');
  /* Commit 3 安全加固：注册脚本自 index.html 内联外置为 js/sw-register.js（CSP 收敛 script-src 'self'） */
  assert.ok(/serviceWorker\.register\(['"]\.\/sw\.js['"]\)/.test(swRegister), 'sw-register.js 应注册 sw.js（相对路径）');
  assert.ok(html.includes('js/sw-register.js'), 'index.html 应加载外置注册脚本');
  assert.ok(!/<script[^>]*>(?!\s*<)/.test(html.replace(/<script[^>]*><\/script>/g, '')), 'index.html 不得残留内联脚本内容');
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
  ['index.html', 'css/style-base.css', 'css/style-responsive.css', 'css/style-animations.css', 'css/style-modules.css', 'img/wallpaper.jpg', 'assets/icon.svg'].forEach(p => {
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