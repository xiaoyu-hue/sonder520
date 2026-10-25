/* SW 注册（自 CSP 内联脚本外置，Commit 3 安全加固）：
 * index.html 不再保留任何内联 <script>，CSP 可收敛为 script-src 'self'
 * （静态 nonce "sw" 随开源仓库公开，形同虚设——见审计 P1）。
 * 注册时机保持 window load 后，失败静默（非 HTTPS/file:// 环境无 SW 属正常）。
 * 阶段 2：检测新版本就绪后，显示「立即更新」提示横幅（点击刷新以应用新资源）。 */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      if (reg.waiting) showUpdate();
      reg.addEventListener('updatefound', function () {
        var installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', function () {
          /* 新版本已安装就绪，且本页此前由旧 SW 控制时才提示（避免首次安装误弹） */
          if (installing.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
        });
      });
    }).catch(function () { /* 无 SW 环境：静默 */ });
  });

  function showUpdate() {
    var banner = document.getElementById('updateBanner');
    if (!banner || banner.hasAttribute('data-shown')) return;
    banner.setAttribute('data-shown', '1');
    banner.hidden = false;
    var btn = document.getElementById('updateBtn');
    var close = document.getElementById('updateClose');
    if (btn) btn.addEventListener('click', function () { window.location.reload(); });
    if (close) close.addEventListener('click', function () { banner.hidden = true; });
  }
})();
