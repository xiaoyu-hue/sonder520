/* settings-repository.js - 设置场景的数据访问边界（v6.x 架构升级 · Repository 第四刀）
 *
 * 覆盖 settings 集合：主题/帧率/壁纸透明度/自定义壁纸（IDB 主存 + LS 降级）/
 * 任务提醒/模块开关/游戏难度/桌面玩偶。
 * 本版为过渡形态——内部直接委托旧 Store 的领域方法（store-settings.js），行为完全一致
 * （含 commit/事件；壁纸的 IDB 异步落盘为 Store 内部机制，Repository 不掺和）。
 *
 * 边界规则（执行方案 §11）：只负责数据访问，不掺 UI/页面状态/Toast/DOM。
 *
 * 浏览器：<script src="js/repositories/settings-repository.js">（在 store-settings.js 之后加载）
 * Node：module.exports 返回工厂 createSettingsRepository(store)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.SonderSettingsRepository = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function createSettingsRepository(store) {
    if (!store || typeof store.setTheme !== 'function' || !store.state ||
        typeof store.state.settings === 'undefined') {
      throw new TypeError('SettingsRepository: store 必须为 SonderStore 实例（settings 集合齐备）');
    }

    return {
      /* ---------- 读 ---------- */
      /* 返回 settings 状态引用（渲染读用；写请走下方方法，不要直接改对象） */
      getSettings: function () {
        return store.state.settings;
      },

      /* ---------- 写（委托旧 Store，行为完全一致） ---------- */
      setTheme: function (t) {
        return store.setTheme(t);
      },
      setWallpaperOpacity: function (v) {
        return store.setWallpaperOpacity(v);
      },
      /* 自定义壁纸：IDB 主存 + LS 降级（Store 内部机制） */
      getCustomWallpaper: function () {
        return store.getCustomWallpaper();
      },
      setCustomWallpaper: function (dataUrl) {
        return store.setCustomWallpaper(dataUrl);
      },
      clearCustomWallpaper: function () {
        return store.clearCustomWallpaper();
      },
      setTaskReminder: function (on) {
        return store.setTaskReminder(on);
      },
      setModuleEnabled: function (key, on) {
        return store.setModuleEnabled(key, on);
      },
      setGameDifficulty: function (d) {
        return store.setGameDifficulty(d);
      },
      setFrameRate: function (f) {
        return store.setFrameRate(f);
      },
      setDesktopPet: function (patch) {
        return store.setDesktopPet(patch);
      }
    };
  }

  return { createSettingsRepository: createSettingsRepository };
});
