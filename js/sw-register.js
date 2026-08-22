/* SW 注册（自 CSP 内联脚本外置，Commit 3 安全加固）：
 * index.html 不再保留任何内联 <script>，CSP 可收敛为 script-src 'self'
 * （静态 nonce "sw" 随开源仓库公开，形同虚设——见审计 P1）。
 * 注册时机保持 window load 后，失败静默（非 HTTPS/file:// 环境无 SW 属正常）。 */
(function () {
  'use strict';
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* 无 SW 环境：静默 */ });
    });
  }
})();
