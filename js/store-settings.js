/* store-settings.js - SonderStore 领域扩展：设置类方法（主题/壁纸/提醒/模块开关/难度/帧率）
 * 浏览器：在 store.js 之后加载（接收 root.SonderStore.Store 与 _h）
 * Node：由 store.js 的 UMD 分支 require 并注入 (Store, _h) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else factory(root.SonderStore.Store, root.SonderStore._h);
})(typeof self !== 'undefined' ? self : this, function (Store, h) {
  'use strict';

  /* ====== 设置 ====== */
  Store.prototype.setTheme = function (t) {
    this.state.settings.theme = (t === 'auto' || t === 'dark') ? t : 'light';
    this._commit('settings');
    this._emitChange('settings');
  };
  Store.prototype.setWallpaperOpacity = function (v) {
    this.state.settings.wallpaperOpacity = h.clampOpacity(v);
    this._commit('settings');
    this._emitChange('settings');
    return this.state.settings.wallpaperOpacity;
  };
  /* ====== 自定义壁纸（C-7：IndexedDB 独立 entry 为主存，localStorage 仅作
   * 同步副本/降级/遗留迁移源；不进 state 快照、不进备份——装饰性数据） ====== */
  Store.prototype.getCustomWallpaper = function () {
    var ls = null;
    try { ls = this._storage ? this._storage.getItem(h.STORAGE_WALLPAPER_KEY) : null; } catch (e) { ls = null; }
    if (ls) { this._wallpaperCache = ls; return ls; }
    /* LS 存空串 = 显式清除标记（clearCustomWallpaper 写入，跨实例可感知） */
    if (ls === '') { this._wallpaperCache = null; return null; }
    /* LS 无值且缓存有值：IDB 落盘成功后 LS 已被移走的模式，回退缓存 */
    return this._wallpaperCache || null;
  };
  Store.prototype.setCustomWallpaper = function (dataUrl) {
    if (typeof dataUrl !== 'string' || dataUrl.indexOf('data:image/') !== 0) return false;
    var self = this;
    /* 先同步写 LS（设置后立即刷新也不丢）；LS 写失败（配额满等）视为保存失败，
     * 保持旧契约语义；IDB 落盘成功后移除 LS——避免 base64 长期占用 5MB 配额 */
    try {
      if (this._storage) this._storage.setItem(h.STORAGE_WALLPAPER_KEY, dataUrl);
    } catch (e) { return false; }
    this._wallpaperCache = dataUrl;
    this._emitChange('settings'); /* 壁纸即时生效，各页重绘 */
    if (h.idbPut && h.idbReady) {
      h.idbReady().then(function (db) {
        return h.idbPut(db, h.STORAGE_WALLPAPER_KEY, { savedAt: h.nowISO(), data: dataUrl });
      }).then(function () {
        try { if (self._storage) self._storage.removeItem(h.STORAGE_WALLPAPER_KEY); } catch (e) { /* 忽略 */ }
      }).catch(function () { /* IDB 不可用：保留 LS 副本（降级模式，行为同旧版） */ });
    }
    return true;
  };
  Store.prototype.clearCustomWallpaper = function () {
    this._wallpaperCache = null;
    /* 写空串标记而非 removeItem：getCustomWallpaper 可区分"已清除"与
     * "IDB 落盘后 LS 被移走"，跨实例（同存储不同 Store 实例）也能感知清除 */
    try { if (this._storage) this._storage.setItem(h.STORAGE_WALLPAPER_KEY, ''); } catch (e) { /* 忽略 */ }
    if (h.idbDel && h.idbReady) {
      h.idbReady().then(function (db) { return h.idbDel(db, h.STORAGE_WALLPAPER_KEY); }).catch(function () { /* 忽略 */ });
    }
    this._emitChange('settings');
  };
  /* 启动恢复：IDB entry 优先；缺失时若 LS 有遗留（旧版本数据）则迁入 IDB
   * 并在落盘成功后移除 LS。由 store.js loadIdb 尾部调用（挂接 openIdb 的 db）。 */
  Store.prototype._restoreCustomWallpaper = function (db) {
    var self = this;
    if (!db || !h.idbGet) return Promise.resolve(false);
    return h.idbGet(db, h.STORAGE_WALLPAPER_KEY).then(function (entry) {
      if (entry && typeof entry === 'object' && typeof entry.data === 'string' && entry.data.indexOf('data:image/') === 0) {
        self._wallpaperCache = entry.data;
        self._emitChange('settings');
        return true;
      }
      var legacy = null;
      try { legacy = self._storage ? self._storage.getItem(h.STORAGE_WALLPAPER_KEY) : null; } catch (e) { legacy = null; }
      if (!legacy || legacy.indexOf('data:image/') !== 0) return false;
      self._wallpaperCache = legacy;
      if (h.idbPut) {
        return h.idbPut(db, h.STORAGE_WALLPAPER_KEY, { savedAt: h.nowISO(), data: legacy }).then(function () {
          try { if (self._storage) self._storage.removeItem(h.STORAGE_WALLPAPER_KEY); } catch (e) { /* 忽略 */ }
          self._emitChange('settings');
          return true;
        }).catch(function () {
          self._emitChange('settings'); /* IDB 写入失败：本会话用 LS 值，保留 LS 不删 */
          return true;
        });
      }
      self._emitChange('settings');
      return true;
    }).catch(function () { return false; });
  };
  Store.prototype.setTaskReminder = function (on) {
    this.state.settings.taskReminder = !!on;
    this._commit('settings');
    this._emitChange('settings');
    return this.state.settings.taskReminder;
  };
  Store.prototype.setModuleEnabled = function (key, on) {
    if (!(key in this.state.settings.modules)) return;
    this.state.settings.modules[key] = !!on;
    this._commit('settings');
    this._emitChange('settings');
  };
  Store.prototype.setGameDifficulty = function (d) {
    var v = d === 'easy' || d === 'hard' ? d : 'normal';
    this.state.settings.gameDifficulty = v;
    this._commit('settings');
    this._emitChange('settings');
    return v;
  };
  Store.prototype.setFrameRate = function (f) {
    var v = f === 60 || f === 90 ? f : 120;
    this.state.settings.frameRate = v;
    this._commit('settings');
    this._emitChange('settings');
    return v;
  };

  /* ====== 桌面玩偶：泛型持久化网关（per-key 白名单校验 + 浅合并） ====== */
  var DP_WHITELIST = {
    enabled: true, mode: true, resident: true, size: true, layout: true,
    positions: true, coins: true, affection: true, inventory: true,
    totalFed: true, rewardedTaskIds: true, achievements: true
  };

  Store.prototype.setDesktopPet = function (patch) {
    if (!patch || typeof patch !== 'object') return;
    var dp = this.state.settings.desktopPet;
    if (!dp) return;
    var keys = Object.keys(patch);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!DP_WHITELIST[k]) continue;
      var v = patch[k];
      if (v !== null && typeof v === 'object' && !Array.isArray(v)
          && dp[k] && typeof dp[k] === 'object' && !Array.isArray(dp[k])) {
        var subKeys = Object.keys(v);
        for (var j = 0; j < subKeys.length; j++) {
          dp[k][subKeys[j]] = v[subKeys[j]];
        }
      } else {
        dp[k] = v;
      }
    }
    this._commit('settings');
    this._emitChange('settings');
  };
});