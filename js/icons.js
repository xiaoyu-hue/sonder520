/* icons.js - 线性 SVG 图标（Lucide 风格路径，内联输出，零运行时依赖）
 * 背景：原导航/卡片使用 emoji（🏠📅…），跨设备字形不一致且显廉价。
 * 用法：SonderIcons.icon('home') → '<svg ...>…</svg>'
 * 兼容：浏览器挂 window/globalThis.SonderIcons；Node 走 module.exports（供 tsc 与测试）。
 * 约束：只输出 <svg>，不含脚本，符合现有 CSP（script-src 'self'）。 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SonderIcons = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* 24×24 视口，1.8 描边；路径均来自 Lucide（ISC）风格，按项目需要微调 */
  var PATHS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 11h18"/><path d="M8 15h3"/>',
    note: '<path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
    mega: '<path d="M4 10v4l10 5V5z"/><path d="M14 8.5c2 .6 3 1.8 3 3.5s-1 2.9-3 3.5"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 6.5a3 3 0 0 1 0 5.5"/><path d="M18 20a5.5 5.5 0 0 0-3-4.9"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5z"/><path d="M8 6.5h8M8 10.5h8"/>',
    bookmark: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>',
    news: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h7M7 13h10M7 16h6"/>',
    pen: '<path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14.5 5.5l3 3"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    more: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    back: '<path d="M15 5 8 12l7 7"/>',
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><path d="M12 15v1.5"/>'
  };

  function icon(name) {
    var body = PATHS[name];
    if (!body) return '';
    return '<svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      body + '</svg>';
  }

  return { icon: icon, names: Object.keys(PATHS) };
});
