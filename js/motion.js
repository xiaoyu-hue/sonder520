/* motion.js - 动态交互层：墨点涟漪 / 页面墨染过渡 / 统计数字滚数
 * 零依赖，纯原生 DOM。水磨风格"动态感"增强：
 *  - 涟漪：点击可交互元素（按钮/卡片）时在点击处晕开一枚墨点（body 级 fixed，不侵入目标元素）
 *  - 墨染过渡：页面切换时一瞬墨晕拂过内容区（pointer-events: none，纯视觉）
 *  - 滚数：渲染后扫描纯数字文本（.rank-card .num / .rate-num），从 0 滚至终值；组合文本（如 2/5）原样保留
 * 门控（motionDisabled）：prefers-reduced-motion 或 html[data-frame="60"] 下全部静默降级，
 * 不注入节点、不留中间态——与样式层 [data-frame="60"] 全局覆盖构成双保险。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MOTION = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 触发涟漪的目标选择器：按钮、卡片、列表项、工具钮 */
  var RIPPLE_SELECTOR = '.btn, .small-btn, .nav button, .lg-pick, .rank-card, .list-item, .tool';
  var TRANSIT_REMOVE_MS = 600;   /* 略长于 inkTransit 动画，防动画未播完被移除 */
  var RIPPLE_REMOVE_MS = 600;
  var COUNT_DURATION_MS = 600;

  function motionDisabled() {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    } catch (e) { /* 忽略 */ }
    var doc = document.documentElement;
    return !!(doc && doc.getAttribute('data-frame') === '60');
  }

  /* body 级墨点：fixed 定位在点击坐标，无依赖目标元素盒模型，不出错不穿帮 */
  function rippleAt(clientX, clientY) {
    var s = document.createElement('span');
    s.className = 'ink-ripple';
    s.setAttribute('aria-hidden', 'true');
    s.style.left = clientX + 'px';
    s.style.top = clientY + 'px';
    document.body.appendChild(s);
    setTimeout(function () {
      if (s.parentNode) s.parentNode.removeChild(s);
    }, RIPPLE_REMOVE_MS);
  }

  function onDocClick(e) {
    if (motionDisabled()) return;
    var t = e.target;
    if (!t || t.nodeType !== 1) return;
    var hit = t.closest ? t.closest(RIPPLE_SELECTOR) : null;
    if (!hit) return;
    rippleAt(e.clientX, e.clientY);
  }

  var inited = false;
  /* 幂等：模块双载/热重入时防重复注册点击监听 */
  function init() {
    if (inited) return;
    inited = true;
    document.addEventListener('click', onDocClick, false);
  }

  var transitTimer = null;

  /* 墨染过渡：内容切换时拂过一瞬墨晕。重复调用先清残留再注入（防堆积） */
  function transit() {
    if (motionDisabled()) return;
    var old = document.querySelector('.ink-transit');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var s = document.createElement('div');
    s.className = 'ink-transit';
    s.setAttribute('aria-hidden', 'true');
    document.body.appendChild(s);
    clearTimeout(transitTimer);
    transitTimer = setTimeout(function () {
      if (s.parentNode) s.parentNode.removeChild(s);
    }, TRANSIT_REMOVE_MS);
  }

  function raf(cb) {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(cb);
    else setTimeout(function () { cb(Date.now()); }, 16);
  }

  /* 单个数字滚数：ease-out 三次方，600ms 从 0 滚至 target；门控时直接落终值 */
  function countUp(el, target, suffix) {
    if (motionDisabled()) {
      el.textContent = String(target) + (suffix || '');
      return;
    }
    var t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / COUNT_DURATION_MS);
      var v = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * v)) + (suffix || '');
      if (p < 1) raf(step);
    }
    raf(step);
  }

  /* 渲染后扫描：仅处理纯数字文本（可带 % 后缀）；组合文本（如 2/5）跳过。
   * 调用时机在页面渲染完成后的同一任务内（浏览器未绘制），因此无 0 → 目标 的闪烁。 */
  function afterRender(container) {
    if (motionDisabled()) return;
    var scope = container || document;
    if (!scope.querySelectorAll) return;
    var nums = scope.querySelectorAll('.rank-card .num, .module-stat-num, .rate-num');
    Array.prototype.forEach.call(nums, function (el) {
      var txt = (el.textContent || '').trim();
      var m = /^(\d+(?:\.\d+)?)(%?)$/.exec(txt);
      if (!m) return;
      countUp(el, Number(m[1]), m[2] || '');
    });
  }

  init();

  /* 总线联动：store 数据变更经 SonderBus 广播后，页面模块走私有 render 直写终值
   * （不经 app.render 管道），数字不会自动滚数。此处订阅 /data/* 补一轮滚数，
   * 节流 60ms 合并密集变更（如批量记录），命中整页内容区。 */
  var busTimer = null;
  (function () {
    var bus = globalThis.SonderBus && globalThis.SonderBus.bus;
    if (!bus) return;
    bus.on('/data/*', function () {
      if (motionDisabled()) return;
      clearTimeout(busTimer);
      busTimer = setTimeout(function () {
        var c = document.getElementById('content');
        if (c) afterRender(c);
      }, 60);
    });
  })();

  return { transit: transit, afterRender: afterRender, countUp: countUp, motionDisabled: motionDisabled, init: init };
});