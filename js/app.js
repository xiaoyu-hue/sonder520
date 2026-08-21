/* app.js - 入口：初始化 store、构建侧边栏导航、hash 路由、主题、全局新建 */
(function () {
  'use strict';
  var store = SonderStore.createStore();
  var Pages = window.Pages = window.Pages || {};
  var UI = window.UI;

  /* 导航顺序；可被"数据与设置"开关隐藏的为业务模块 */
  var TOGGLEABLE = { today: 1, memo: 1, selfmedia: 1, dev: 1, consulting: 1, reading: 1, news: 1, design: 1, game: 1, excerpts: 1, 'desktop-pet': 1 };
  var NAV = ['home', 'today', 'memo', 'selfmedia', 'dev', 'consulting', 'reading', 'excerpts', 'news', 'design', 'game', 'desktop-pet', 'settings'];
  var ICONS = {
    home: '🏠', today: '📅', memo: '📝', selfmedia: '📣', dev: '💻',
    consulting: '🤝', reading: '📚', excerpts: '📖', news: '📰', design: '🎨', game: '🎮', 'desktop-pet': '🐾', settings: '⚙️'
  };

  var ctx = {
    store: store,
    UI: UI,
    S: SonderStore,
    theme: function () { return store.state.settings.theme; },
    navigate: function (route) { location.hash = route; }
  };

  function applyTheme() {
    var t = store.state.settings.theme;
    if (t === 'auto') {
      var mq = window.matchMedia;
      var resolved = (mq && mq('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      setThemeAttr(resolved);
    } else {
      setThemeAttr(t);
    }
  }
  function setThemeAttr(t) {
    document.documentElement.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#171410' : '#f2efe6');
  }
  /* 跟随系统：监听系统深浅切换，仅 auto 模式下实时更新 */
  (function watchSystemTheme() {
    var mq = window.matchMedia;
    if (typeof mq !== 'function') return;
    var q = mq('(prefers-color-scheme: dark)');
    if (!q || typeof q.addEventListener !== 'function') return;
    q.addEventListener('change', function () {
      if (store.state.settings.theme === 'auto') applyTheme();
    });
  })();

  /* 动画帧率档位：60=极省（关循环动效）、90=折中（循环动效降频）、120=满速原版 */
  function applyFrame() {
    var f = store.state.settings.frameRate;
    document.documentElement.setAttribute('data-frame', String(f));
  }

  function applyWallpaper() {
    var v = store.state.settings.wallpaperOpacity;
    document.documentElement.style.setProperty('--wallpaper-opacity', String(Number(v) / 100));
    var img = /** @type {HTMLImageElement|null} */ (document.getElementById('wallpaperImg'));
    if (!img) return;
    var custom = store.getCustomWallpaper();
    img.src = custom || 'img/wallpaper.jpg';
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
      try {
        if (key !== 'home' && key !== 'settings') {
          var modKey = key === 'excerpts' ? 'reading' : key; /* 我的书摘跟随阅读模块开关 */
          if (TOGGLEABLE[key] && !store.state.settings.modules[modKey]) return;
        }
        var b = document.createElement('button');
        b.type = 'button';
        b.dataset.route = key;
        b.className = key === active ? 'active' : '';
        if (key === active) b.setAttribute('aria-current', 'page');
        b.innerHTML = '<span class="ico">' + (ICONS[key] || '') + '</span>' + UI.esc(Pages[key].title);
        b.onclick = function () { ctx.navigate(key); };
        nav.appendChild(b);
      } catch (e) {
        /* 单模块缺失/报错不拖垮整壳：跳过该导航项并上报（如 SW 陈旧缓存致 js 404） */
        try { console.error('[Sonder] 导航模块不可用', key, e); } catch (x) { /* 忽略 */ }
      }
    });
  }

  function render() {
    var key = currentPageKey();
    var container = document.getElementById('content');
    container.innerHTML = '';
    var page = Pages[key] || Pages.home;
    document.getElementById('pageTitle').textContent = page.title;
    document.title = page.title + ' · Sonder';
    buildNav();
    applyTheme();
    applyWallpaper();
    applyFrame();
    page.render(container, ctx);
    if (window.MOTION) window.MOTION.afterRender(container);
    quotaCheck();
  }

  /* 存储接近上限（约 5MB）时顶部显示警示条：导出备份 / 迁移至 IndexedDB。
   * 持久化危机（LS 副本与 IDB 主快照同时不可用，数据只存在内存）时升级为红色危机条：
   * 只留导出入口，不写入 dismiss（无法一键永久关闭），任一侧恢复后自动消失。 */
  function quotaCheck() {
    var bar = document.getElementById('quotaBar');
    if (!bar) return;
    var warn = /** @type {HTMLElement} */ (bar.querySelector('#qbWarn'));
    var failMsg = /** @type {HTMLElement} */ (bar.querySelector('#qbFail'));
    var orEl = /** @type {HTMLElement} */ (bar.querySelector('#qbOr'));
    var migrate = /** @type {HTMLElement} */ (bar.querySelector('#qMigrate'));
    var fail = store.hasPersistIssue();
    if (fail || (!store.state.settings.quotaNoticeDismissed && store.isNearQuota())) {
      if (fail) {
        warn.hidden = true;
        failMsg.hidden = false;
        orEl.hidden = true;
        migrate.hidden = true; /* 双失败危机时迁移无意义（IDB 主快照已不可用） */
        bar.classList.add('qb-fail');
      } else {
        warn.hidden = false;
        failMsg.hidden = true;
        orEl.hidden = false;
        migrate.hidden = false;
        bar.classList.remove('qb-fail');
        bar.querySelector('.qb-usage').textContent = (store.storageUsage() / 1048576).toFixed(1) + 'MB';
      }
      bar.hidden = false;
      return;
    }
    /* 恢复常态：还原切换过的元素状态 */
    warn.hidden = false;
    failMsg.hidden = true;
    orEl.hidden = false;
    migrate.hidden = false;
    bar.classList.remove('qb-fail');
    bar.hidden = true;
  }

  function bindQuotaBar() {
    var bar = document.getElementById('quotaBar');
    if (!bar) return;
    bar.querySelector('#qExport').addEventListener('click', function (e) {
      e.preventDefault();
      ctx.navigate('settings');
    });
    bar.querySelector('#qMigrate').addEventListener('click', function (e) {
      e.preventDefault();
      store.migrateToIdb().then(function (ok) {
        if (ok) {
          store.setQuotaNoticeDismissed(true);
          UI.toast('已迁移至 IndexedDB');
        } else {
          UI.toast('当前环境不支持 IndexedDB，请导出备份', 'err');
        }
        render();
      });
    });
    bar.querySelector('#qClose').addEventListener('click', function () {
      if (store.hasPersistIssue()) {
        /* 写入失败是持续危机：不允许一键永久关闭（dismiss 不写入），仅此轮隐藏，下次渲染重现 */
        bar.hidden = true;
        return;
      }
      store.dismissQuotaNotice();
      render();
    });
  }

  function onHash() { render(); if (window.MOTION) window.MOTION.transit(); }

  /* 测试钩子（对正常运行无害）。生产必需字段常驻；仅测试用字段置于 __SONDER_TEST__ 门闩后，
   * 正常访问无法取到内部实例（ctx/Pages 等），杜绝误用与注入面。 */
  window.__sonderHooks = {
    store: store,
    render: function (route) { location.hash = route; render(); },
    /* 启动时尝试从 IndexedDB 恢复（数据更大、更稳）；若采用则重绘当前页 */
    idbReady: store.loadIdb().then(function (applied) {
      if (applied) onHash();
      return applied;
    })
  };
  if (window.__SONDER_TEST__) {
    window.__sonderHooks.ctx = ctx;
    window.__sonderHooks.Pages = Pages;
    window.__sonderHooks.applyTheme = applyTheme;
    window.__sonderHooks.applyWallpaper = applyWallpaper;
    window.__sonderHooks.applyFrame = applyFrame;
    window.__sonderHooks.todayLine = todayLine;
  }
  window.__sonderHooks.idbReady.then(function () {
    if (store.needsUnlock()) { autoUnlockOnce(); }
    else { todayReminder(); }

    /* 桌面玩偶自动初始化（Task 3 autoInit 接入，idbReady 后确保 store 就绪） */
    if (window.DesktopPetCore && typeof window.DesktopPetCore.autoInit === 'function') {
      try { window.DesktopPetCore.autoInit(); } catch (e) { /* autoInit 异常不阻断页面 */ }
    }
  });

  /* ---------- 今日任务桌面提醒（设置页开关，每次打开/刷新页面触发一次） ---------- */
  function todayReminder() {
    var s = store.state.settings;
    if (!s.taskReminder) return;
    if (!('Notification' in window) || typeof window.Notification !== 'function') return;
    var today = SonderStore.todayStr();
    var todays = store.state.tasks.filter(function (t) { return t.date === today; });
    if (todays.length === 0) return;
    var undone = todays.filter(function (t) { return !t.done; });
    if (undone.length === 0) {
      notify('🌿 今日事今日毕，了不起！', '今天的所有计划都已完成，真是充实的一天。');
      return;
    }
    var names = undone.slice(0, 3).map(function (t) { return t.title; });
    notify('🌿 今日尚有未竟之事', names.join('、') + (undone.length > 3 ? ' 等 ' + undone.length + ' 项未完成' : ''));
  }
  function notify(title, body) {
    var N = window.Notification;
    function show() {
      try { new N(title, { body: body, tag: 'sonder-daily' }); } catch (e) { /* 忽略构造失败 */ }
    }
    if (N.permission === 'granted') { show(); return; }
    if (N.permission === 'denied') return;
    /* default：先弹窗询问授权，授权通过后才通知 */
    if (typeof N.requestPermission === 'function') {
      try { N.requestPermission(function (p) { if (p === 'granted') show(); }); } catch (e) { /* 忽略 */ }
    }
  }
  window.__sonderHooks.todayReminder = todayReminder;

  /* ---------- 加密锁屏 ---------- */
  var lockScreenEl = null, lockPwdEl = null, lockErrEl = null, lockRememberEl = null;

  function showLockScreen() {
    if (lockScreenEl) { lockScreenEl.style.display = 'flex'; lockPwdEl.focus(); return; }
    lockScreenEl = UI.el(
      '<div id="lockScreen" style="position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:var(--bg);backdrop-filter:blur(6px)">' +
      '<div style="width:min(92vw,360px);text-align:center;padding:28px 24px;border:1px solid var(--border);border-radius:16px;background:var(--glass-2)">' +
      '<div style="font-size:34px;line-height:1">🔒</div>' +
      '<h2 style="margin:10px 0 2px;color:var(--text)">Sonder 已锁定</h2>' +
      '<p class="muted small" style="margin:0 0 16px">数据已加密存储于本机</p>' +
      '<input type="password" id="lockPwd" placeholder="输入密码解锁" autocomplete="off" style="width:100%;padding:11px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg);color:var(--text);font-size:16px;box-sizing:border-box">' +
      '<div class="small" id="lockErr" style="color:var(--danger, #e5484d);min-height:20px;margin-top:8px"></div>' +
      '<button class="btn primary" id="lockBtn" style="width:100%;margin-top:2px">解锁</button>' +
      '<label class="toggle small" style="margin-top:14px;display:flex;align-items:center;justify-content:center;gap:6px">' +
      '<input type="checkbox" id="lockRemember"> 本浏览器标签页会话内免密（关闭标签页即失效）</label>' +
      '<p class="muted small" style="margin:14px 0 0">请牢记密码；遗忘后将无法恢复任何数据。</p>' +
      '</div></div>'
    );
    document.body.appendChild(lockScreenEl);
    lockPwdEl = lockScreenEl.querySelector('#lockPwd');
    lockErrEl = lockScreenEl.querySelector('#lockErr');
    lockRememberEl = lockScreenEl.querySelector('#lockRemember');
    var btn = lockScreenEl.querySelector('#lockBtn');
    var busy = false;
    function tryUnlock() {
      if (busy) return;
      var pwd = lockPwdEl.value;
      if (!pwd) { lockErrEl.textContent = '请输入密码'; return; }
      busy = true;
      btn.disabled = true;
      store.unlock(pwd).then(function (ok) {
        busy = false;
        btn.disabled = false;
        if (!ok) {
          lockErrEl.textContent = '密码不正确，请重试';
          lockPwdEl.value = '';
          lockPwdEl.focus();
          return;
        }
        if (lockRememberEl.checked) {
          try { sessionStorage.setItem('sonder_session_pwd', pwd); } catch (e) { /* 隐私模式忽略 */ }
        }
        /* 内联 display:flex 会覆盖 UA 的 [hidden] 规则，必须直接改 display */
        lockScreenEl.style.display = 'none';
        lockErrEl.textContent = '';
        lockPwdEl.value = '';
        onHash();
        todayReminder();
      });
    }
    btn.onclick = tryUnlock;
    lockPwdEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); tryUnlock(); }
    });
    lockPwdEl.focus();
  }

  function autoUnlockOnce() {
    var pwd = null;
    try { pwd = sessionStorage.getItem('sonder_session_pwd'); } catch (e) { pwd = null; }
    if (!pwd) { showLockScreen(); return; }
    store.unlock(pwd).then(function (ok) {
      if (ok) { onHash(); todayReminder(); }
      else {
        try { sessionStorage.removeItem('sonder_session_pwd'); } catch (e) { /* ignore */ }
        showLockScreen();
      }
    });
  }

  window.__sonderHooks.lockNow = function () { showLockScreen(); };

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

  /* 离线状态指示：按 navigator.onLine 切换页脚 #netOnline / #netOffline。
   * 只切 hidden 属性，不动其他元素；DOM 骨架与样式早已就位，这里补上缺失的 JS 逻辑。 */
  var netOnlineEl = document.getElementById('netOnline');
  var netOfflineEl = document.getElementById('netOffline');
  function applyNetState() {
    if (!netOnlineEl || !netOfflineEl) return;
    var online = typeof navigator !== 'undefined' && !!navigator.onLine;
    netOnlineEl.hidden = !online;
    netOfflineEl.hidden = online;
  }
  window.addEventListener('online', applyNetState);
  window.addEventListener('offline', applyNetState);

  applyTheme();
  applyWallpaper();
  applyFrame();
  buildNav();
  todayLine();
  applyNetState();
  bindQuotaBar();
  /* 另一标签已接管编辑（多标签让位协议）：本页未保存的输入已被放弃，即时提示用户 */
  var yieldBus = globalThis.SonderBus && globalThis.SonderBus.bus;
  if (yieldBus && typeof yieldBus.on === 'function') {
    yieldBus.on('/store/yielded', function () {
      UI.toast('另一标签已更新数据，本页已同步到最新版本（未保存的修改已被放弃）', 'err');
    });
  }
  window.addEventListener('hashchange', onHash);
  window.addEventListener('load', render);
})();