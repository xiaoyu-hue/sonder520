/* settings.js - 数据与设置：主题、模块开关、统计、备份/恢复 */
(function () {
  'use strict';
  var Pages = window.Pages = window.Pages || {};
  var S = window.SonderStore;
  var currentEl = null, currentCtx = null;

  function render(ctx) {
    var container = currentEl, store = ctx.store, UI = ctx.UI;
    var hooks = window.__sonderHooks;
    container.innerHTML = '';
    container.appendChild(UI.el('<div class="section-title" style="margin-top:0">外观</div>'));
    container.appendChild(UI.el(
      '<div class="card"><div class="row">' +
      '<label class="toggle"><input type="radio" name="theme" value="light" ' + (store.state.settings.theme === 'light' ? 'checked' : '') + '> 浅色</label>' +
      '<label class="toggle"><input type="radio" name="theme" value="dark" ' + (store.state.settings.theme === 'dark' ? 'checked' : '') + '> 深色</label>' +
      '</div></div>'
    ));
    container.querySelectorAll('input[name="theme"]').forEach(function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        store.setTheme(r.value);
        document.documentElement.setAttribute('data-theme', r.value);
        UI.toast('主题已切换');
        hooks.render('settings');
      });
    });

    var fr = store.state.settings.frameRate;
    var frCard = UI.el(
      '<div class="card" style="margin-top:10px">' +
      '<div class="row">' +
      '<label class="small muted" style="margin-right:12px;white-space:nowrap">动画帧率</label>' +
      '<label class="toggle"><input type="radio" name="frame" value="60" ' + (fr === 60 ? 'checked' : '') + '> 60</label>' +
      '<label class="toggle"><input type="radio" name="frame" value="90" ' + (fr === 90 ? 'checked' : '') + '> 90</label>' +
      '<label class="toggle"><input type="radio" name="frame" value="120" ' + (fr === 120 ? 'checked' : '') + '> 120</label>' +
      '<span class="muted small" style="margin-left:auto">数值越低动画越省资源</span>' +
      '</div></div>'
    );
    container.appendChild(frCard);
    container.querySelectorAll('input[name="frame"]').forEach(function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        var f = store.setFrameRate(Number(r.value));
        document.documentElement.setAttribute('data-frame', String(f));
        UI.toast(f === 60 ? '已切换为省电模式（60）' : '动画帧率已设为 ' + f);
        hooks.render('settings');
      });
    });

    var wp = store.state.settings.wallpaperOpacity;
    var wpCard = UI.el(
      '<div class="card" style="margin-top:10px">' +
      '<div class="row">' +
      '<label class="small muted" for="wallOpacity">背景图片透明度</label>' +
      '<input type="range" id="wallOpacity" min="0" max="100" step="5" value="' + wp + '" style="flex:1;max-width:220px">' +
      '<span class="small" id="wallOpacityVal">' + wp + '%</span>' +
      '<span class="muted small">默认 40%</span>' +
      '</div></div>'
    );
    container.appendChild(wpCard);
    var wpInput = wpCard.querySelector('#wallOpacity');
    var wpVal = wpCard.querySelector('#wallOpacityVal');
    wpInput.addEventListener('input', function () {
      var v = Number(wpInput.value);
      store.setWallpaperOpacity(v);
      document.documentElement.style.setProperty('--wallpaper-opacity', String(v / 100));
      wpVal.textContent = v + '%';
    });
    wpInput.addEventListener('change', function () { hooks.render('settings'); });

    container.appendChild(UI.el('<div class="section-title">模块开关</div>'));
    var modBox = UI.el('<div class="card"></div>');
    S.moduleList.forEach(function (m) {
      var on = store.state.settings.modules[m.key];
      var label = UI.el('<label class="toggle" style="margin:6px 16px 6px 0;display:inline-flex"><input type="checkbox" data-mod="' + m.key + '" ' + (on ? 'checked' : '') + '> ' + m.label + '</label>');
      modBox.appendChild(label);
    });
    container.appendChild(modBox);
    container.querySelectorAll('[data-mod]').forEach(function (c) {
      c.addEventListener('change', function () {
        store.setModuleEnabled(c.dataset.mod, c.checked);
        hooks.render('settings');
      });
    });

    container.appendChild(UI.el('<div class="section-title">数据统计</div>'));
    container.appendChild(statsCard(store, UI));

    container.appendChild(UI.el('<div class="section-title">加密存储</div>'));
    var encMode = store.encryptionMode();
    var encCard = UI.el(
      '<div class="card">' +
      '<div class="row">' +
      '<span class="small' + (encMode !== 'off' ? ' enc-on' : '') + '">' +
      (encMode === 'off' ? '未启用 — 数据明文存于本机' : (encMode === 'locked' ? '已启用 · 当前锁定' : '已启用 · 已解锁')) +
      '</span>' +
      (encMode === 'off'
        ? '<button class="btn primary" id="encEnable">启用加密</button>'
        : '<button class="btn" id="encLock">锁定</button><button class="btn danger" id="encDisable">停用加密</button>') +
      '</div>' +
      '<div class="sub muted" style="margin-top:8px;line-height:1.7">' +
      (encMode === 'off'
        ? '启用后全部数据将以 AES-256 加密存于本机，每次打开应用需要密码解锁，导出备份也将加密。请务必牢记密码：<b>忘记密码将无法恢复任何数据</b>，建议启用前先导出一份明文备份。'
        : (encMode === 'locked' ? '应用已锁定，解锁后即可使用。' : '本标签页会话已解锁，关闭标签页后再次打开需要输入密码。') + '停用加密需要验证密码，且会把数据转为明文存储。') +
      '</div></div>'
    );
    container.appendChild(encCard);
    if (encMode === 'off') {
      container.querySelector('#encEnable').addEventListener('click', function () { openEnableEnc(ctx); });
    } else {
      if (encMode === 'unlocked') {
        container.querySelector('#encLock').addEventListener('click', function () {
          store.lock();
          hooks.lockNow();
        });
      }
      container.querySelector('#encDisable').addEventListener('click', function () { openDisableEnc(ctx); });
    }

    container.appendChild(UI.el('<div class="section-title">备份与恢复</div>'));
    container.appendChild(UI.el(
      '<div class="card">' +
      '<div class="row">' +
      '<button class="btn primary" id="bkExport">' + (encMode !== 'off' ? '导出加密备份' : '导出备份') + '</button>' +
      '<button class="btn" id="bkImport">导入恢复…</button>' +
      '<input type="file" id="bkFile" accept=".json,application/json" style="display:none">' +
      '<span class="muted small">备份保存在本地 JSON 文件，可随时导入恢复</span>' +
      '</div></div>'
    ));
    container.querySelector('#bkExport').addEventListener('click', function () { exportBackup(ctx); });
    container.querySelector('#bkImport').addEventListener('click', function () { container.querySelector('#bkFile').click(); });
    container.querySelector('#bkFile').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      UI.confirmBox('导入将覆盖当前全部数据，确定继续？').then(function (ok) {
        if (!ok) { e.target.value = ''; return; }
        var reader = new FileReader();
        reader.onload = function () {
          var text = String(reader.result);
          var pkg = null;
          try { pkg = JSON.parse(text); } catch (err) { pkg = null; }
          if (pkg && pkg.format === 'sonder-enc-backup-v1') {
            UI.formModal({
              title: '导入加密备份',
              confirmText: '解密导入',
              fields: [{ key: 'pwd', label: '备份密码', type: 'password', required: true, placeholder: '导出加密备份时设置的密码' }],
              onSubmit: function (v) {
                return store.importBackup(text, v.pwd).then(function (r) {
                  if (!r.ok) { throw new Error(r.error); }
                  UI.toast('加密备份已恢复');
                  hooks.render('settings');
                  return true;
                });
              }
            });
            return;
          }
          store.importBackup(text).then(function (res) {
            if (res.ok) { UI.toast('备份已恢复'); hooks.render('settings'); }
            else { UI.toast(res.error, 'err'); e.target.value = ''; }
          });
        };
        reader.readAsText(file);
      });
    });

    container.appendChild(UI.el('<div class="section-title">数据迁移</div>'));
    var migCard = UI.el(
      '<div class="card">' +
      '<div class="row">' +
      '<button class="btn" id="btnMigrateIdb">迁移至 IndexedDB</button>' +
      '<span class="muted small">IndexedDB 容量远大于 localStorage（约 5MB 上限）。Sonder 始终双写双存，迁移后数据更保险。</span>' +
      '</div></div>'
    );
    container.appendChild(migCard);
    container.querySelector('#btnMigrateIdb').addEventListener('click', function () {
      store.migrateToIdb().then(function (ok) {
        UI.toast(ok ? '已迁移至 IndexedDB' : '当前环境不支持 IndexedDB', ok ? '' : 'err');
      });
    });
  }

  function statsCard(store, UI) {
    var s = store.summarize();
    var total = s.tasks.total;
    var rate = total ? Math.round((s.tasks.doneToday / total) * 100) : 0;
    var html = '<div class="card"><div class="grid cols-3">' +
      statBox('今日计划', s.tasks.doneToday + '/' + s.tasks.total, '完成率 ' + rate + '%') +
      statBox('自媒体', s.selfmedia.total, '待发布 ' + s.selfmedia.pending) +
      statBox('开发工作', s.dev.total, '进行中 ' + s.dev.active) +
      statBox('咨询工作', s.consulting.total, '待跟进 ' + s.consulting.followups) +
      statBox('阅读计划', s.reading.total, '在读 ' + s.reading.reading) +
      statBox('看新闻计划', s.news.total, '待读 ' + s.news.unread) +
      statBox('设计计划', s.design.total, '进行中 ' + s.design.active) +
      statBox('娱乐游戏', s.game.total, '胜 ' + s.game.wins + ' 平 ' + s.game.draws) +
      '</div>' +
      '<div class="row" style="margin-top:14px"><span class="small muted">今日任务完成率</span>' +
      '<div class="progress grow"><i style="width:' + rate + '%"></i></div>' +
      '<span class="small">' + rate + '%</span></div></div>';
    return UI.el(html);
  }
  function statBox(label, num, sub) {
    return '<div class="rank-card"><div class="num">' + window.UI.esc(num) + '</div>' +
      '<div class="lab">' + window.UI.esc(label) + '</div><div class="sub">' + window.UI.esc(sub) + '</div></div>';
  }

  function openEnableEnc(ctx) {
    var store = ctx.store, UI = window.UI, hooks = window.__sonderHooks;
    UI.formModal({
      title: '启用加密',
      confirmText: '启用加密',
      fields: [
        { key: 'pwd', label: '设置密码（至少 4 位，请牢记）', type: 'password', required: true, placeholder: '用于解锁本应用与加密备份导入' },
        { key: 'pwd2', label: '确认密码', type: 'password', required: true }
      ],
      onSubmit: function (v) {
        if (v.pwd.length < 4) return '密码至少 4 位';
        if (v.pwd !== v.pwd2) return '两次输入的密码不一致';
        return store.enableEncryption(v.pwd).then(function () {
          UI.toast('已启用加密，全部数据已加密存储');
          hooks.render('settings');
          return true;
        });
      }
    });
  }
  function openDisableEnc(ctx) {
    var store = ctx.store, UI = window.UI, hooks = window.__sonderHooks;
    UI.formModal({
      title: '停用加密',
      confirmText: '停用加密',
      fields: [{ key: 'pwd', label: '输入当前密码', type: 'password', required: true }],
      onSubmit: function (v) {
        return store.disableEncryption(v.pwd).then(function () {
          UI.toast('已停用加密，数据已转为明文存储');
          hooks.render('settings');
          return true;
        });
      }
    });
  }

  function exportBackup(ctx) {
    var UI = window.UI;
    var out = ctx.store.exportBackup();
    if (out && typeof out.then === 'function') {
      UI.toast('正在生成加密备份…');
      out.then(function (json) {
        download(json, 'sonder-backup-enc-' + S.todayStr() + '.json');
        UI.toast('已导出加密备份（导入需密码）');
      }).catch(function (err) {
        UI.toast(err && err.message ? err.message : '导出失败');
      });
      return;
    }
    download(out, 'sonder-backup-' + S.todayStr() + '.json');
  }
  function download(json, name) {
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  Pages.settings = {
    title: '数据与设置',
    render: function (container, ctx) { currentEl = container; currentCtx = ctx; render(ctx); }
  };
})();