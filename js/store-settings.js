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
    this.save();
    this._emitChange('settings');
  };
  Store.prototype.setWallpaperOpacity = function (v) {
    this.state.settings.wallpaperOpacity = h.clampOpacity(v);
    this.save();
    this._emitChange('settings');
    return this.state.settings.wallpaperOpacity;
  };
  /* 自定义壁纸：data URL 存取，不进持久化快照（返回是否成功，配额写满返回 false） */
  Store.prototype.getCustomWallpaper = function () {
    try { return this._storage ? this._storage.getItem(h.STORAGE_WALLPAPER_KEY) : null; } catch (e) { return null; }
  };
  Store.prototype.setCustomWallpaper = function (dataUrl) {
    if (typeof dataUrl !== 'string' || dataUrl.indexOf('data:image/') !== 0) return false;
    try {
      this._storage.setItem(h.STORAGE_WALLPAPER_KEY, dataUrl);
      this._emitChange('settings'); /* 壁纸即时生效，各页重绘 */
      return true;
    } catch (e) { return false; }
  };
  Store.prototype.clearCustomWallpaper = function () {
    try { if (this._storage) this._storage.removeItem(h.STORAGE_WALLPAPER_KEY); } catch (e) { /* 忽略 */ }
    this._emitChange('settings');
  };
  Store.prototype.setTaskReminder = function (on) {
    this.state.settings.taskReminder = !!on;
    this.save();
    this._emitChange('settings');
    return this.state.settings.taskReminder;
  };
  Store.prototype.setModuleEnabled = function (key, on) {
    if (!(key in this.state.settings.modules)) return;
    this.state.settings.modules[key] = !!on;
    this.save();
    this._emitChange('settings');
  };
  Store.prototype.setGameDifficulty = function (d) {
    var v = d === 'easy' || d === 'hard' ? d : 'normal';
    this.state.settings.gameDifficulty = v;
    this.save();
    this._emitChange('settings');
    return v;
  };
  Store.prototype.setFrameRate = function (f) {
    var v = f === 60 || f === 90 ? f : 120;
    this.state.settings.frameRate = v;
    this.save();
    this._emitChange('settings');
    return v;
  };
});