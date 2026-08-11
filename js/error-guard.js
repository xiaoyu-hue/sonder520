/* error-guard.js - 全局错误安全网
 * 捕获未处理的脚本错误、Promise 拒绝与资源加载失败：
 * 1) 出错立即提示 toast（3 秒内合并，防刷屏）
 * 2) 完整堆栈输出到控制台
 * 3) 保留最近记录到 window.__sonderErrors 供测试与调试
 * 依赖 UI（toast）；须在 ui.js 之后、app.js 之前加载。 */
(function () {
  'use strict';

  var MAX_KEEP = 20;        /* 内存中保留的最近错误数 */
  var TOAST_GAP_MS = 3000;  /* 两次错误提示的最小间隔 */

  var list = [];
  var total = 0;
  var lastToastAt = 0;

  function record(entry) {
    list.push(entry);
    if (list.length > MAX_KEEP) list.shift();
    total++;
  }

  function notify() {
    try {
      if (!window.UI || typeof window.UI.toast !== 'function') return;
      var now = Date.now();
      if (now - lastToastAt <= TOAST_GAP_MS) return;
      lastToastAt = now;
      window.UI.toast('⚠ 页面发生错误，详见控制台', 'err');
    } catch (e) { /* 提示本身出错时静默，防止递归 */ }
  }

  function report(entry) {
    record(entry);
    try {
      console.error('[Sonder] ' + entry.type + ': ' + entry.message, entry.stack || '');
    } catch (e) { /* 忽略 */ }
    notify();
  }

  /* 捕获阶段监听，才能收到不冒泡的资源 error（img/script/link） */
  window.addEventListener('error', function (e) {
    if (e && e.target) {
      var t = /** @type {any} */ (e.target);
      if (t !== window && t.tagName) {
        var src = String(t.currentSrc || t.src || t.href || '');
        report({ time: new Date().toISOString(), type: 'resource', message: '资源加载失败: ' + src, stack: null });
        return;
      }
    }
    report({
      time: new Date().toISOString(),
      type: 'error',
      message: (e && e.message) ? String(e.message) : '未知脚本错误',
      stack: (e && e.error && e.error.stack) ? String(e.error.stack)
        : ((e && e.filename) ? e.filename + ':' + e.lineno + ':' + e.colno : '')
    });
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var reason = e && e.reason ? e.reason : null;
    report({
      time: new Date().toISOString(),
      type: 'unhandledrejection',
      message: reason && reason.message ? String(reason.message) : String(reason),
      stack: reason && reason.stack ? String(reason.stack) : null
    });
  });

  window.__sonderErrors = {
    list: list,
    get total() { return total; },
    clear: function () { list.length = 0; total = 0; },
    /* 公开上报：业务代码捕获到「非预期但已降级」的错误时主动上报。
     * 参数可以是 Error 实例（自动提取 message/stack）或字符串。
     * 与全局 error 事件共用记录/控制台/toast 节流，不额外打扰用户。 */
    report: function (errOrMsg, type) {
      var message = (errOrMsg instanceof Error) ? errOrMsg.message : String(errOrMsg);
      var stack = (errOrMsg instanceof Error) ? String(errOrMsg.stack || '') : null;
      report({ time: new Date().toISOString(), type: type || 'reported', message: message, stack: stack });
    }
  };
})();