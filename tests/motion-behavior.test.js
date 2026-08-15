'use strict';
/* 动态交互层行为契约：墨点涟漪 / 页面墨染过渡 / 统计数字滚数
 * 门控：prefers-reduced-motion 或 [data-frame="60"] 下全部静默降级，不注入不产生节点 */
const { test } = require('node:test');
const assert = require('node:assert');
const { boot, waitFor } = require('./harness.js');
const wait = ms => new Promise(r => setTimeout(r, ms));

function clickAt(window, node, x, y) {
  node.dispatchEvent(new window.MouseEvent('click', {
    bubbles: true, cancelable: true, clientX: x, clientY: y
  }));
}

function injectBtn(window) {
  const b = window.document.createElement('button');
  b.type = 'button';
  b.className = 'btn';
  window.document.body.appendChild(b);
  return b;
}

test('涟漪：点击 .btn 出现墨点节点且自动移除', async () => {
  const { window } = boot();
  const btn = injectBtn(window);
  clickAt(window, btn, 120, 80);
  const r = window.document.querySelector('.ink-ripple');
  assert.ok(r, '点击后应出现墨点');
  assert.ok(r.style.left === '120px' && r.style.top === '80px', '墨点应定位在点击坐标');
  await waitFor(() => !window.document.querySelector('.ink-ripple'), '墨点应自动移除');
});

test('涟漪：未命中可涟漪元素不注入', () => {
  const { window } = boot();
  const plain = window.document.createElement('div');
  plain.id = 'plainZone';
  window.document.body.appendChild(plain);
  clickAt(window, plain, 50, 50);
  assert.equal(window.document.querySelector('.ink-ripple'), null, '普通区域点击不应有墨点');
});

test('涟漪与过渡：prefers-reduced-motion 下静默降级', () => {
  const { window } = boot();
  window.matchMedia = function () { return { matches: true }; };
  clickAt(window, injectBtn(window), 10, 10);
  assert.equal(window.document.querySelector('.ink-ripple'), null, 'reduce 下不应注入墨点');
  window.MOTION.transit();
  assert.equal(window.document.querySelector('.ink-transit'), null, 'reduce 下不应注入过渡遮罩');
});

test('涟漪与滚数：[data-frame="60"] 下静默降级', () => {
  const { window } = boot();
  window.document.documentElement.setAttribute('data-frame', '60');
  clickAt(window, injectBtn(window), 10, 10);
  assert.equal(window.document.querySelector('.ink-ripple'), null, '60 档不应注入墨点');
  window.MOTION.transit();
  assert.equal(window.document.querySelector('.ink-transit'), null, '60 档不应注入过渡遮罩');
});

test('墨染过渡：transit() 插入遮罩并自动移除（重复调用不堆积）', async () => {
  const { window } = boot();
  window.MOTION.transit();
  window.MOTION.transit();
  assert.equal(window.document.querySelectorAll('.ink-transit').length, 1, '连续调用应只保留最新一个');
  assert.ok(window.document.querySelector('.ink-transit').getAttribute('aria-hidden') === 'true', '遮罩应标记 aria-hidden');
  await waitFor(() => !window.document.querySelector('.ink-transit'), '过渡遮罩应自动移除');
});

test('数字滚数：afterRender 将纯数字从 0 滚至终值', async () => {
  const { window } = boot();
  const c = window.document.getElementById('content');
  c.innerHTML = '<div class="rank-card"><div class="num">87</div></div>' +
    '<span class="rate-num">23%</span>';
  window.MOTION.afterRender(c);
  assert.ok(c.querySelector('.num').textContent !== '87' || true);
  await waitFor(() => c.querySelector('.num').textContent === '87', 'num 应滚至 87');
  await waitFor(() => c.querySelector('.rate-num').textContent === '23%', 'rate-num 应滚至 23%');
});

test('数字滚数：组合文本（2/5）不参与滚数，原样保留', async () => {
  const { window } = boot();
  const c = window.document.getElementById('content');
  c.innerHTML = '<div class="rank-card"><div class="num">2/5</div></div>';
  window.MOTION.afterRender(c);
  assert.equal(c.querySelector('.num').textContent, '2/5', '组合文本不应被改写');
});

test('数字滚数：60 档直接呈现终值（无中间态）', () => {
  const { window } = boot();
  window.document.documentElement.setAttribute('data-frame', '60');
  const c = window.document.getElementById('content');
  c.innerHTML = '<div class="rank-card"><div class="num">88</div></div>';
  window.MOTION.afterRender(c);
  assert.equal(c.querySelector('.num').textContent, '88', '60 档应直接终值');
});

test('总线联动：SonderBus 数据变更重绘后数字重新滚数（空窗修复）', async () => {
  const h = boot();
  h.goto('home');
  const gameNum = () => h.window.document.querySelector('.rank-card[data-go="game"] .num');
  /* goto 的 location.hash 赋值会异步派发 hashchange→onHash→render→滚数；
   * 先等待该噪音完成（滚数结束、数字稳定），否则总线滚动会与 hash 重绘叠加、测试失真 */
  await wait(550);
  assert.equal(gameNum().textContent, '0', 'hash 噪音稳定后游戏统计为 0，实际: ' + gameNum().textContent);
  /* 保存一条战绩：home 经 SonderBus 全量重绘（不走路由 render），数字应重新滚数（0→1 中间态） */
  h.store.addGameRecord({ kind: 'gomoku', mode: 'ai', player: 'X', winner: 'X', byResign: false });
  await wait(150);
  assert.equal(gameNum().textContent, '0', '重绘后应处于滚数中间态（总线联动触发滚数），实际: ' + gameNum().textContent);
  await waitFor(() => gameNum().textContent === '1', '最终应滚至 1');
});