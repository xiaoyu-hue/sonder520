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
  const EXTERNAL_LINKS = [
    'href="https://github.com/xiaoyu-hue/sonder520"',
    'href="https://www.netlify.com"'
  ];
  refs.forEach(r => {
    const isExternalLink = EXTERNAL_LINKS.includes(r);
    const isRelative = !/https?:\/\//.test(r) && !r.startsWith('src="/') && !r.startsWith('href="/');
    const isInlineData = /data:/.test(r);
    assert.ok(isExternalLink || isRelative || isInlineData,
      '存在绝对路径资源，将无法在子路径托管部署: ' + r);
  });
});

test('手机端弹窗为底部抽屉（overlay 底部对齐 + 底部弹入动画）', () => {
  const mobile = css.split('@media (max-width: 720px)')[1].split('@keyframes')[0];
  assert.ok(mobile.includes('align-items: flex-end'), '弹窗应底部弹出');
  assert.ok(mobile.includes('.overlay .modal { animation: popUpIn'), '应有底部弹入动画');
  assert.ok(css.includes('@keyframes popUpIn'), '缺 popUpIn 关键帧');
});

test('全平台高度：100dvh 带 100vh 回退（老 iOS/安卓）', () => {
  assert.ok(css.includes('height: 100vh; height: 100dvh'), '.app 缺 vh→dvh 回退');
  const mobile = css.split('@media (max-width: 720px)')[1].split('@keyframes')[0];
  assert.ok(mobile.includes('height: 100vh; height: 100dvh'), '移动端缺 vh→dvh 回退');
});

test('色域声明：浅色 light / 深色 dark（表单与滚动条跟随主题）', () => {
  assert.ok(css.includes('color-scheme: light'), ':root 缺浅色 color-scheme');
  const darkBlk = css.split('[data-theme="dark"]')[1].split('}')[0];
  assert.ok(darkBlk.includes('color-scheme: dark'), '深色缺 color-scheme');
});

test('平板（721–960px）：侧栏折叠为图标栏', () => {
  const tablet = css.split('@media (min-width: 721px) and (max-width: 960px)')[1].split('@media')[0];
  assert.ok(tablet, '缺平板断点');
  assert.ok(tablet.includes('width: 70px'), '图标栏应 70px 宽');
  assert.ok(tablet.includes('font-size: 0'), '按钮文字应隐藏（仅图标）');
  assert.ok(tablet.includes('.nav button .ico { font-size: 20px; }'), '图标应放大');
  assert.ok(tablet.includes('inset 0 0 0 2px var(--accent)'), '激活态应有朱砂描边');
});

test('超小屏（≤360px）与手机横屏有专门适配', () => {
  assert.ok(css.includes('@media (max-width: 360px)'), '缺超小屏断点');
  assert.ok(css.includes('@media (max-width: 900px) and (max-height: 480px)'), '缺横屏断点');
});

test('五子棋大棋盘手机端：压缩边距保持方正且不溢出', () => {
  assert.ok(css.includes('.game-board.big .cell { min-height: 0; }'), '大棋盘格子不应被旧浏览器 min-height 拉成竖条');
  const mobile = css.split('@media (max-width: 720px)')[1].split('@keyframes')[0];
  assert.ok(mobile.includes('.game-board.big'), '720px 断点内应有五子棋棋盘适配');
  assert.ok(/width: min\(97vw, 480px\)/.test(mobile), '手机大棋盘应限定在可视宽度内');
  assert.ok(mobile.includes('gap: 2px'), '手机大棋盘应压缩格距');
  assert.ok(css.includes('.game-board.small'), '井字棋小棋盘适配仍应保留');
});

test('窄屏防溢出：.row 允许换行（咨询卡行内容多，320px 下不应横向溢出）', () => {
  const row = css.split('.row {')[1].split('}')[0];
  assert.ok(row.includes('flex-wrap: wrap'), '.row 应支持换行');
  const pill = css.split('.pill {')[1].split('}')[0];
  assert.ok(pill.includes('white-space: nowrap'), '徽标不应内部换行');
  assert.ok(css.includes('.hbar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }'), '工具栏应保留 wrap');
});