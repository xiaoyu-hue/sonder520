'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');

test('viewport：含 width=device-width 与 viewport-fit=cover（刘海屏）', () => {
  assert.ok(html.includes('viewport'), '缺 viewport');
  assert.ok(/name="viewport"[^>]*width=device-width/.test(html), '应自适应宽度');
  assert.ok(html.includes('viewport-fit=cover'), '应适配刘海屏安全区');
  assert.ok(html.includes('theme-color'), '应有主题色');
  assert.ok(html.includes('apple-mobile-web-app-capable'), '支持添加到主屏幕');
});

test('移动端导航：≤720px 时侧栏变为底部玻璃导航栏', () => {
  const mobile = css.slice(css.indexOf('手机适配'), css.indexOf('触控细节'));
  assert.ok(/@media \(max-width: 720px\)/.test(mobile), '缺 720px 断点');
  const md = mobile.split('@media (max-width: 720px)')[1];
  assert.ok(md.includes('flex-direction: row'), '侧栏应横向');
  assert.ok(md.includes('order: 2') || md.includes('flex: 0 0 auto'), '主区域在上、导航在下');
  assert.ok(md.includes('env(safe-area-inset-bottom'), '底部应适配安全区');
  assert.ok(md.includes('min-height: 44px'), '触控目标 ≥44px');
  assert.ok(md.includes('.sidebar'), '应复用侧栏结构');
  assert.ok(!css.includes('.sidebar { display: none; }'), '旧版隐藏侧栏逻辑应移除');
});

test('移动端触控：防 iOS 聚焦缩放、取消点按高亮', () => {
  assert.ok(css.includes('input, select, textarea, button { font-size: 16px; }'), '输入控件应 16px 防聚焦缩放');
  assert.ok(css.includes('hover: hover'), '桌面端应还原字号');
  assert.ok(css.includes('-webkit-tap-highlight-color: transparent'), '应关闭点按高亮');
  const mobile = css.split('@media (max-width: 720px)')[1].split('@keyframes')[0];
  assert.ok(mobile.includes('.field input, .field select, .field textarea { font-size: 16px; }'), '表单输入移动端 16px');
});

test('部署就绪：静态资源全部使用相对路径（可放任意子路径）', () => {
  const refs = html.match(/(?:src|href)="[^"]+"/g) || [];
  assert.ok(refs.length > 0);
  refs.forEach(r => {
    assert.ok(!/https?:\/\//.test(r) && !r.startsWith('src="/') && !r.startsWith('href="/'),
      '存在绝对路径资源，将无法在子路径托管部署: ' + r);
  });
});

test('手机端弹窗为底部抽屉（overlay 底部对齐 + 底部弹入动画）', () => {
  const mobile = css.split('@media (max-width: 720px)')[1].split('@keyframes')[0];
  assert.ok(mobile.includes('align-items: flex-end'), '弹窗应底部弹出');
  assert.ok(mobile.includes('.overlay .modal { animation: popUpIn'), '应有底部弹入动画');
  assert.ok(css.includes('@keyframes popUpIn'), '缺 popUpIn 关键帧');
});