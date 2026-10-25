/* SW 注册（自 CSP 内联脚本外置，Commit 3 安全加固）：
 * index.html 不再保留任何内联 <script>，CSP 可收敛为 script-src 'self'
 * （静态 nonce "sw" 随开源仓库公开，形同虚设——见审计 P1）。
 * 注册时机保持 window load 后，失败静默（非 HTTPS/file:// 环境无 SW 属正常）。
 * 阶段 2：检测新版本就绪后，显示「立即更新」提示横幅（点击刷新以应用新资源）。 */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  /* SW 把自己版本号广播给页面，存到 window.__SW_VERSION，供「设置-检查更新」显示/比较 */
  navigator.serviceWorker.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'SW_VERSION') window.__SW_VERSION = e.data.v;
  });

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

  /* 手动「检查更新」：去服务器拉取最新 sw.js，比对版本。
   * 返回 Promise<{state}>：found=有新版本(将刷新应用) / latest=已最新 /
   * refresh=无法判定版本(直接刷新页面拿新版) / no-sw=无SW环境(刷新即可) /
   * unsupported=环境不支持 / neterr=网络错误 */
  function fetchServerVersion() {
    return fetch('./sw.js', { cache: 'no-store' })
      .then(function (res) { return res.text(); })
      .then(function (txt) {
        var m = txt.match(/var CACHE\s*=\s*'([^']+)'/);
        return m ? m[1] : null;
      })
      .catch(function () { return null; });
  }
  /**
   * 手动检查更新：去服务器比对最新 sw.js 版本。
   * @returns {Promise<SonderSWCheckResult>}
   */
  function checkUpdate() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(/** @type {SonderSWCheckResult} */ ({ state: 'unsupported' }));
    return navigator.serviceWorker.getRegistration().then(function (reg) {
      if (!reg) return { state: 'no-sw' };
      return fetchServerVersion().then(function (server) {
        if (server === null) return { state: 'neterr' };
        var running = window.__SW_VERSION || null;
        if (running === null || running !== server) {
          if (reg.update) { try { reg.update(); } catch (e) { /* 忽略 */ } }
          return { state: running === null ? 'refresh' : 'found', run: running, server: server };
        }
        return { state: 'latest', ver: server };
      });
    });
  }
  window.SonderSW = { check: checkUpdate, getVersion: function () { return window.__SW_VERSION || null; } };
})();
