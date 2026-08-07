'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

test('性能：壁纸预加载 + 站点图标内联（首次绘制提速，无 404）', () => {
  assert.ok(html.includes('<link rel="preload" as="image" href="img/wallpaper.png">'), '应预加载壁纸');
  assert.ok(html.includes('<link rel="icon" href="data:image/svg+xml'), '应有内联 favicon');
});

test('性能：不再使用 background-attachment: fixed（滚动重绘开销）', () => {
  assert.ok(!/background-attachment:\s*fixed/.test(css), 'body 不应再 fixed 背景');
  assert.ok(css.includes('url("../img/wallpaper.png")') && css.includes('position: fixed'), '壁纸仍由固定层承载');
});

test('性能：玻璃磨砂降档（移动端低端机不卡），双侧前缀一致', () => {
  ['20px) saturate(1.6) brightness(1.05)', '18px) saturate(1.5) brightness(1.04)', '12px) saturate(1.5) brightness(1.02)'].forEach(s => {
    assert.ok(css.includes('backdrop-filter: blur(' + s), '缺标准磨砂 ' + s);
    assert.ok(css.includes('-webkit-backdrop-filter: blur(' + s), '缺 -webkit 磨砂 ' + s);
  });
});

test('无障碍：导航激活项带 aria-current，主题色随主题切换', () => {
  const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
  assert.ok(app.includes("setAttribute('aria-current', 'page')"), '缺 aria-current');
  assert.ok(app.includes('meta[name="theme-color"]'), '主题色应随主题更新');
});

test('清理：JS 中无已废弃的 --panel 变量引用', () => {
  const jsDir = path.join(root, 'js');
  const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
  jsFiles.forEach(f => {
    const code = fs.readFileSync(path.join(jsDir, f), 'utf8');
    assert.ok(!/var\(--panel[^)-]*\)/.test(code), f + ' 引用了废弃变量 --panel');
  });
});

test('动效成本：入场/图表动画时长收敛', () => {
  assert.ok(css.includes('animation: fadeUp .32s var(--ease) both'), '入场应轻量');
  assert.ok(css.includes('animation: barsGrow .65s var(--ease) both'), '图表生长应轻量');
});