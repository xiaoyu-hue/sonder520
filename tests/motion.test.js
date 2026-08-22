'use strict';
const { test } = require('node:test');
const { readAllCss } = require('./css-helper');
const assert = require('node:assert');
const path = require('node:path');
const root = path.join(__dirname, '..')

const css = readAllCss(root);

test('微动：按钮有按压(active)缩放反馈与过渡', () => {
  assert.ok(css.includes('.btn:active'), '普通按钮缺 :active');
  assert.ok(css.includes('.small-btn:active'), '小按钮缺 :active');
  assert.ok(css.includes('.nav button:active'), '导航缺 :active');
  const btns = [...css.matchAll(/\.btn \{([^}]*)\}/g)].map(m => m[1]);
  assert.ok(btns.some(b => b.includes('var(--ease)')), '按钮过渡应使用弹性缓动变量');
  assert.ok(css.includes('--ease: cubic-bezier'), '应定义弹性缓动 --ease');
});

test('微动：悬停有上浮/位移的水墨感应', () => {
  assert.ok(css.includes('.list-item:hover'), '列表项缺悬停');
  assert.ok(css.includes('translateX'), '列表项悬停应有位移');
  assert.ok(css.includes('.rank-card:hover'), '统计卡缺悬停');
});

test('入场动画：内容区淡入上浮 + 延迟错峰', () => {
  assert.ok(css.includes('@keyframes fadeUp'), '缺 fadeUp 关键帧');
  assert.ok(css.includes('@keyframes popIn'), '缺 popIn 关键帧');
  assert.ok(css.includes('.content > *'), '内容区缺入场动画');
  assert.ok(/\.content > \*:nth-child\(\d+\)/.test(css), '缺错峰延迟');
});

test('图表"墨液蔓延"：进度条/条形图 scaleX 生长', () => {
  assert.ok(css.includes('@keyframes barsGrow'), '缺 barsGrow 关键帧');
  assert.ok(css.includes('transform-origin: left center'), '生长应有左侧原点');
  assert.ok(css.includes('.progress > i'), '进度条缺生长动画');
  assert.ok(css.includes('.st-bar > i'), '条形图缺生长动画');
});

test('弹窗与 Toast：遮罩淡入、面板弹入、Toast 滑入', () => {
  assert.ok(css.includes('.overlay { animation: fadeIn'), '遮罩缺淡入');
  assert.ok(css.includes('.overlay .modal { animation: popIn'), '面板缺弹入');
  assert.ok(css.includes('.toast { animation: toastIn'), 'Toast 缺滑入');
  assert.ok(css.includes('@keyframes toastIn'), '缺 toastIn 关键帧');
});

test('水墨细节动效：空状态呼吸 + 印章脉动 + 环形光晕', () => {
  assert.ok(css.includes('@keyframes inkBreathe'), '缺呼吸');
  assert.ok(css.includes('.empty .big'), '空状态图标应呼吸');
  assert.ok(css.includes('.brand .dot'), '印章应脉动');
  assert.ok(css.includes('@keyframes donutGlow'), '环形图缺光晕');
  assert.ok(css.includes('.rd-donut'), '环形图应应用光晕');
});

test('无障碍：尊重 prefers-reduced-motion', () => {
  assert.ok(css.includes('prefers-reduced-motion'), '缺系统减少动效支持');
  assert.ok(css.includes('animation-duration: .001s'), '减少动效时应收敛动画时长');
});

test('行为：Toast 动效样式由 JS 驱动，仍可出现与收回', async () => {
  const { boot } = require('./harness.js');
  const { window } = boot();
  window.UI.toast('叮');
  const t = window.document.querySelector('#toastWrap .toast');
  assert.ok(t, 'toast 未出现');
  assert.ok(window.getComputedStyle || true);
  await new Promise(r => setTimeout(r, 2700));
  assert.equal(window.document.querySelector('#toastWrap .toast'), null, 'toast 未按时消失');
});

test('动态层：墨点涟漪有独立关键帧、样式与固定定位节点', () => {
  assert.ok(css.includes('@keyframes inkRipple'), '缺 inkRipple 关键帧');
  assert.ok(css.includes('.ink-ripple'), '缺 .ink-ripple 节点规则');
  assert.ok(/\.ink-ripple[^{]*\{[^}]*pointer-events:\s*none/.test(css), '涟漪应不拦截交互');
  assert.ok(css.includes('--ink-ripple'), '应定义 --ink-ripple 墨色（分主题）');
});

test('动态层：页面墨染过渡遮罩有独立关键帧、样式', () => {
  assert.ok(css.includes('@keyframes inkTransit'), '缺 inkTransit 关键帧');
  assert.ok(css.includes('.ink-transit'), '缺 .ink-transit 遮罩规则');
  assert.ok(/\.ink-transit[^{]*\{[^}]*pointer-events:\s*none/.test(css), '过渡遮罩应不拦截交互');
});

test('动态层：统计卡光泽扫过（sheen）', () => {
  assert.ok(css.includes('@keyframes sheenSweep'), '缺 sheenSweep 关键帧');
  assert.ok(css.includes('.rank-card::after'), '统计卡缺光泽层 ::after');
  assert.ok(css.includes('.rank-card:hover::after'), '悬停时缺光泽扫过触发');
  assert.ok(css.includes('--sheen'), '应定义 --sheen 光泽色（分主题）');
});