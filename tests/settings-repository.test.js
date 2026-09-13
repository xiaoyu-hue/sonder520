'use strict';
/* SettingsRepository 边界测试（v6.x 架构升级 · Repository 第四刀）
 * 验证：settings 集合读写与旧 Store 行为完全一致（主题/帧率白名单、透明度钳制、
 * 模块开关、提醒、难度、壁纸校验、桌面玩偶白名单合并），
 * 且 settings.js / games-battle.js 不再直连 settings 写。 */
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

function repoOf(h) {
  const Repo = h.window.SonderSettingsRepository;
  assert.ok(Repo && Repo.createSettingsRepository, '浏览器应暴露 SonderSettingsRepository');
  return Repo.createSettingsRepository(h.store);
}

test('SettingsRepository：getSettings 返回状态引用（渲染读用）', () => {
  const h = boot();
  const repo = repoOf(h);
  assert.equal(repo.getSettings(), h.store.state.settings, '应返回同一 settings 引用');
});

test('SettingsRepository：setTheme/setFrameRate 白名单语义与旧 Store 一致', () => {
  const h = boot();
  const repo = repoOf(h);
  repo.setTheme('dark');
  assert.equal(repo.getSettings().theme, 'dark');
  repo.setTheme('invalid');
  assert.equal(repo.getSettings().theme, 'light', '非法主题回落 light');

  repo.setFrameRate(60);
  assert.equal(repo.getSettings().frameRate, 60);
  repo.setFrameRate(75);
  assert.equal(repo.getSettings().frameRate, 120, '非 60/90 回落 120');
});

test('SettingsRepository：setWallpaperOpacity 钳制', () => {
  const h = boot();
  const repo = repoOf(h);
  repo.setWallpaperOpacity(150);
  assert.ok(repo.getSettings().wallpaperOpacity <= 100, '透明度应钳制到上限');
  repo.setWallpaperOpacity(-10);
  assert.ok(repo.getSettings().wallpaperOpacity >= 0, '透明度应钳制到下限');
});

test('SettingsRepository：setModuleEnabled / setTaskReminder 语义', () => {
  const h = boot();
  const repo = repoOf(h);
  const firstKey = Object.keys(repo.getSettings().modules)[0];
  assert.ok(firstKey, '应有模块开关集合');
  repo.setModuleEnabled(firstKey, false);
  assert.equal(repo.getSettings().modules[firstKey], false);
  repo.setModuleEnabled('no-such-module', true);
  assert.ok(!('no-such-module' in repo.getSettings().modules), '非法 key 忽略');

  repo.setTaskReminder(1);
  assert.equal(repo.getSettings().taskReminder, true, '提醒应布尔化');
});

test('SettingsRepository：setGameDifficulty 白名单（easy/hard/normal）', () => {
  const h = boot();
  const repo = repoOf(h);
  assert.equal(repo.setGameDifficulty('easy'), 'easy');
  assert.equal(repo.setGameDifficulty('hard'), 'hard');
  assert.equal(repo.setGameDifficulty('insane'), 'normal', '非法难度回落 normal');
});

test('SettingsRepository：自定义壁纸 data URL 校验 + 清除（与旧 Store 一致）', () => {
  const h = boot();
  const repo = repoOf(h);
  assert.equal(repo.setCustomWallpaper('javascript:alert(1)'), false, '非 data:image 前缀拒绝');
  assert.equal(repo.setCustomWallpaper('data:image/png;base64,AAA'), true, '合法 data URL 接受');
  assert.equal(repo.getCustomWallpaper(), 'data:image/png;base64,AAA');

  repo.clearCustomWallpaper();
  assert.equal(repo.getCustomWallpaper(), null, '清除后为 null');
});

test('SettingsRepository：setDesktopPet 白名单浅合并（与旧 Store 一致）', () => {
  const h = boot();
  const repo = repoOf(h);
  repo.setDesktopPet({ coins: 5, notAKey: 'ignored' });
  assert.equal(repo.getSettings().desktopPet.coins, 5, '白名单 key 生效');
  assert.equal(repo.getSettings().desktopPet.notAKey, undefined, '非白名单 key 忽略');
  assert.equal(repo.setDesktopPet(null), undefined, '非法 patch 忽略');
});

/* Phase 4 续门禁：settings 页与游戏难度不得回退直连 settings 写 */
test('SettingsRepository：settings.js / games-battle.js 已迁移至边界', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'settings.js'), 'utf8');
  const direct = /store\.(setTheme|setFrameRate|setWallpaperOpacity|setModuleEnabled|setTaskReminder|setCustomWallpaper|clearCustomWallpaper|getCustomWallpaper)\(/;
  assert.ok(!direct.test(src), 'settings.js 不应直连 settings 写');
  assert.ok(!/store\.state\.settings/.test(src), 'settings.js 不应直读 state.settings');

  const gb = fs.readFileSync(path.join(__dirname, '..', 'js', 'games-battle.js'), 'utf8');
  assert.ok(!/ctx\.store\.setGameDifficulty\(/.test(gb), 'games-battle.js 不应直连 setGameDifficulty');
});
