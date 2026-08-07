/* app.js - 入口：初始化 store、构建侧边栏导航、hash 路由、主题、全局新建 */
(function () {
  'use strict';
  var store = SonderStore.createStore();
  var Pages = window.Pages = window.Pages || {};
  var UI = window.UI;

  /* 导航顺序；可被"数据与设置"开关隐藏的为业务模块 */
  var TOGGLEABLE = { today: 1, memo: 1, selfmedia: 1, dev: 1, consulting: 1, reading: 1, news: 1, design: 1 };
  var NAV = ['home', 'today', 'memo', 'selfmedia', 'dev', 'consulting', 'reading', 'news', 'design', 'settings'];
  var ICONS = {
    home: '🏠', today: '📅', memo: '📝', selfmedia: '📣', dev: '💻',
    consulting: '🤝', reading: '📚', news: '📰', design: '🎨', settings: '⚙️'
  };

  var ctx = {
    store: store,
    UI: UI,
    S: SonderStore,
    theme: function () { return store.state.settings.theme; },
    navigate: function (route) { location.hash = route; }
  };

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', store.state.settings.theme);
  }

  function applyWallpaper() {
    var v = store.state.settings.wallpaperOpacity;
    document.documentElement.style.setProperty('--wallpaper-opacity', String(Number(v) / 100));
  }

  function currentPageKey() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var clean = h.split('/')[0];
    return NAV.indexOf(clean) >= 0 ? clean : 'home';
  }

  function buildNav() {
    var nav = document.getElementById('nav');
    nav.innerHTML = '';
    var active = currentPageKey();
    NAV.forEach(function (key) {
      if (key !== 'home' && key !== 'settings' && TOGGLEABLE[key] && !store.state.settings.modules[key]) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.route = key;
      b.className = key === active ? 'active' : '';
      b.innerHTML = '<span class="ico">' + (ICONS[key] || '') + '</span>' + UI.esc(Pages[key].title);
      b.onclick = function () { ctx.navigate(key); };
      nav.appendChild(b);
    });
  }

  function render() {
    var key = currentPageKey();
    var container = document.getElementById('content');
    container.innerHTML = '';
    var page = Pages[key] || Pages.home;
    document.getElementById('pageTitle').textContent = page.title;
    buildNav();
    applyTheme();
    applyWallpaper();
    page.render(container, ctx);
  }

  function onHash() { render(); }

  /* 测试钩子（对正常运行无害） */
  window.__sonderHooks = {
    store: store,
    ctx: ctx,
    Pages: Pages,
    render: function (route) { location.hash = route; render(); },
    applyTheme: applyTheme,
    applyWallpaper: applyWallpaper,
    todayLine: todayLine
  };

  /* 顶栏全局“＋”新建：调用当前页面的 openAdd() */
  document.getElementById('btnQuickMemo').addEventListener('click', function () {
    var key = currentPageKey();
    var page = Pages[key];
    if (page && typeof page.add === 'function') { page.add(ctx); }
    else openQuickMemoModal();
  });

  function openQuickMemoModal() {
    UI.formModal({
      title: '快速备忘',
      confirmText: '保存',
      fields: [{ key: 'text', label: '内容', type: 'textarea', required: true, placeholder: '随手记点什么…' }],
      onSubmit: function (v) {
        store.addMemo(v.text);
        UI.toast('已保存备忘');
        return true;
      }
    });
  }
  ctx.openQuickMemoModal = openQuickMemoModal;

  function todayLine() {
    var d = new Date();
    var week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    document.getElementById('topDate').textContent =
      d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · 周' + week;
  }

  applyTheme();
  applyWallpaper();
  buildNav();
  todayLine();
  window.addEventListener('hashchange', onHash);
  window.addEventListener('load', render);
})();