'use strict';
/* Step 2 v2.5：主题自动跟随系统（prefers-color-scheme + 手动覆盖） */
const { test } = require('node:test');
const assert = require('node:assert');
const S = require('../js/store.js');
const { boot } = require('./harness.js');

const BASE = {
  settings: { theme: 'auto', frameRate: 60, modules: { today: true, memo: true } },
  tasks: [], memos: [], version: 1
};

function memStorage() {
  const d = {};
  return {
    _data: d,
    getItem: k => (k in d ? d[k] : null),
    setItem: (k, v) => { d[k] = String(v); },
    removeItem: k => { delete d[k]; }
  };
}

test('默认 auto：系统浅色 → 加载浅色宣纸主题', () => {
  const { window, hooks } = boot({ seed: BASE, matchMedia: true });
  hooks.applyTheme();
  assert.equal(window.document.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(window.__mm.dark, false);
});

test('默认 auto：系统深色 → 加载深色墨黑主题', async () => {
  const { window, hooks } = boot({ seed: BASE, matchMedia: true, systemDark: true });
  hooks.applyTheme();
  assert.equal(window.document.documentElement.getAttribute('data-theme'), 'dark');
  const meta = window.document.querySelector('meta[name="theme-color"]');
  assert.equal(meta.getAttribute('content'), '#171410', '主题色应随深色更新');
});

test('系统切换：auto 模式下系统由浅变深，页面实时跟随', async () => {
  const { window, hooks } = boot({ seed: BASE, matchMedia: true });
  const mm = window.__mm;
  hooks.applyTheme();
  assert.equal(window.document.documentElement.getAttribute('data-theme'), 'light');
  mm._setDark(true); /* 模拟系统切到深色 */
  await new Promise(r => setTimeout(r, 30));
  assert.equal(window.document.documentElement.getAttribute('data-theme'), 'dark', '应实时跟随系统切换');
  mm._setDark(false);
  await new Promise(r => setTimeout(r, 30));
  assert.equal(window.document.documentElement.getAttribute('data-theme'), 'light', '系统切回浅色应实时还原');
});

test('手动选择浅色/深色：记住选择并覆盖系统跟随', async () => {
  const { window, hooks } = boot({ seed: BASE, matchMedia: true, systemDark: true });
  const mm = window.__mm;
  hooks.applyTheme();
  assert.equal(window.document.documentElement.getAttribute('data-theme'), 'dark');
  hooks.render('settings');
  window.document.querySelector('input[name="theme"][value="light"]').click();
  assert.equal(hooks.store.state.settings.theme, 'light', '选择应持久化到存储');
  assert.equal(window.document.documentElement.getAttribute('data-theme'), 'light', '手动浅色覆盖深色系统');
  /* 系统切换不应再影响手动选择 */
  mm._setDark(false);
  await new Promise(r => setTimeout(r, 30));
  assert.equal(window.document.documentElement.getAttribute('data-theme'), 'light', '手动选择后不再跟随系统');
});

test('设置页：跟随系统选项默认勾选，三态渲染正确', async () => {
  const { window, hooks, $ } = boot({ seed: BASE });
  hooks.render('settings');
  const radios = window.document.querySelectorAll('input[name="theme"]');
  assert.equal(radios.length, 3, '应有三态主题选项');
  assert.equal($('input[name="theme"][value="auto"]').checked, true, '默认应勾选跟随系统');
});

test('旧数据兼容：既有 light/dark 手动值保留，不重置为 auto', async () => {
  const st = memStorage();
  st.setItem('sonder_data_v1', JSON.stringify({ settings: { theme: 'dark', frameRate: 60, modules: {} }, tasks: [], memos: [], version: 1 }));
  const s = S.createStore(st);
  assert.equal(s.state.settings.theme, 'dark', '旧手动值应保留');
});

test('setTheme 校验：非法值回落 light，auto/dark/light 合法', () => {
  const st = memStorage();
  const s = S.createStore(st);
  s.setTheme('dark');
  assert.equal(s.state.settings.theme, 'dark');
  s.setTheme('auto');
  assert.equal(s.state.settings.theme, 'auto');
  s.setTheme('garbage');
  assert.equal(s.state.settings.theme, 'light');
  const s2 = S.createStore(st);
  assert.equal(s2.state.settings.theme, 'light', '存储值应已持久化');
});

test('刷新后：手动选择仍生效（data-theme 保留）', async () => {
  const a = boot({ seed: BASE, matchMedia: true });
  a.hooks.applyTheme();
  a.hooks.render('settings');
  a.window.document.querySelector('input[name="theme"][value="dark"]').click();
  const raw = JSON.parse(a.window.localStorage.getItem('sonder_col_settings_v1'));
  assert.equal(raw.settings.theme, 'dark');
  const b = boot({ seed: { version: raw.version || 1, settings: raw.settings, tasks: [], memos: [], posts: [], clients: [], books: [], news: [], designs: [], gameRecords: [] }, matchMedia: true });
  b.hooks.applyTheme();
  assert.equal(b.window.document.documentElement.getAttribute('data-theme'), 'dark', '刷新后应沿用手动深色');
});