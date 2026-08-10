'use strict';
/* Step 3 v2.5：上传自定义壁纸（base64 持久化 / 缩略图 / 恢复默认 / 大小限制） */
const { test } = require('node:test');
const assert = require('node:assert');
const S = require('../js/store.js');
const { boot } = require('./harness.js');

const WALL_KEY = 'sonder_wallpaper_v1';
const BASE = {
  settings: { theme: 'light', wallpaperOpacity: 40, frameRate: 60, modules: { today: true, memo: true } },
  tasks: [], memos: [], version: 1
};
const DATAURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function wait(ms) { return new Promise(r => setTimeout(r, ms || 80)); }

function uploadFile(window, input, opts) {
  opts = opts || {};
  const file = new window.File([opts.content || 'FAKEIMG'], opts.name || 'wall.jpg', { type: opts.type || 'image/jpeg' });
  Object.defineProperty(file, 'size', { value: opts.size !== undefined ? opts.size : 10, configurable: true });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new window.Event('change'));
  return file;
}

function memStorage() {
  const d = {};
  return {
    _data: d,
    getItem: k => (k in d ? d[k] : null),
    setItem: (k, v) => { d[k] = String(v); },
    removeItem: k => { delete d[k]; }
  };
}

test('store 层：壁纸存取与校验（非 data:image 拒绝，配额写满返回 false）', () => {
  const st = memStorage();
  const s = S.createStore(st);
  assert.equal(s.getCustomWallpaper(), null, '初始无自定义壁纸');
  assert.equal(s.setCustomWallpaper('http://x.jpg'), false, '非法 data URL 应拒绝');
  assert.equal(s.setCustomWallpaper(DATAURL), true, '合法 data URL 应保存');
  assert.equal(s.getCustomWallpaper(), DATAURL);
  const s2 = S.createStore(st);
  assert.equal(s2.getCustomWallpaper(), DATAURL, '新实例可读回');
  s2.clearCustomWallpaper();
  assert.equal(s.getCustomWallpaper(), null, '清除后应为空');
  /* 配额写满：setItem 抛错 → 返回 false */
  const full = {
    _data: {},
    getItem: k => (k in full._data ? full._data[k] : null),
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: k => { delete full._data[k]; }
  };
  const sf = S.createStore(full);
  assert.equal(sf.setCustomWallpaper(DATAURL), false, '配额写满应返回 false');
});

test('设置页：默认显示默认壁纸缩略图与上传按钮，无恢复默认', () => {
  const { window, $ } = boot({ seed: BASE });
  window.__sonderHooks.render('settings');
  const thumb = $('#wallThumb');
  assert.ok(thumb, '应显示当前壁纸缩略图');
  assert.ok(/wallpaper\.jpg$/.test(thumb.getAttribute('src')), '默认应为项目壁纸小图');
  assert.ok($('#wallUpload'), '应有上传壁纸按钮');
  assert.match($('#wallUpload').textContent, /🖼️ 上传壁纸/);
  assert.equal($('#wallReset'), null, '默认状态不应有恢复默认按钮');
});

test('上传成功：立即预览、背景实时更换、base64 存入 localStorage', async () => {
  const { window, hooks, $ } = boot({ seed: BASE });
  hooks.render('settings');
  uploadFile(window, $('#wallFile'));
  await wait(150);
  assert.equal(hooks.store.getCustomWallpaper(), localStorageGet(window), '应存入 localStorage');
  assert.ok(window.localStorage.getItem(WALL_KEY).startsWith('data:image/'), '应为 base64 data URL');
  assert.ok($('#wallThumb').getAttribute('src').startsWith('data:image/'), '缩略图应预览新图');
  const url = window.document.documentElement.style.getPropertyValue('--wallpaper-url');
  assert.ok(url.includes('data:image/'), '背景应实时切换为自定义图');
  assert.ok($('#wallReset'), '上传后应出现恢复默认按钮');
  function localStorageGet(w) {
    return w.localStorage.getItem(WALL_KEY);
  }
});

test('刷新后：自定义壁纸仍在（缩略图 + 背景）', async () => {
  const a = boot({ seed: BASE });
  a.hooks.render('settings');
  uploadFile(a.window, a.$('#wallFile'));
  await wait(150);
  const raw = a.window.localStorage.getItem(WALL_KEY);
  assert.ok(raw, '应先保存成功');

  const b = boot({ rawLS: { sonder_data_v1: JSON.stringify(BASE), [WALL_KEY]: raw } });
  b.hooks.applyWallpaper();
  b.hooks.render('settings');
  const url = b.window.document.documentElement.style.getPropertyValue('--wallpaper-url');
  assert.ok(url.includes('data:image/'), '刷新后背景应仍为自定义图');
  assert.equal(b.$('#wallThumb').getAttribute('src'), raw, '刷新后缩略图应仍为自定义图');
  assert.ok(b.$('#wallReset'), '刷新后仍有恢复默认');
});

test('超过 2MB：弹窗提示且不应用', async () => {
  const { window, hooks, $ } = boot({ seed: BASE });
  hooks.render('settings');
  uploadFile(window, $('#wallFile'), { size: 2 * 1024 * 1024 + 1 });
  await wait(150);
  const ov = window.document.querySelector('#overlayRoot .modal');
  assert.ok(ov && /图片过大，请压缩后上传/.test(ov.textContent), '应弹出大小提示');
  assert.equal(window.localStorage.getItem(WALL_KEY), null, '不得存储超大图');
  assert.equal(window.document.documentElement.style.getPropertyValue('--wallpaper-url'), '', '不得应用超大图');
  assert.equal(hooks.store.getCustomWallpaper(), null);
});

test('非图片类型：拒绝应用', async () => {
  const { window, $ } = boot({ seed: BASE });
  window.__sonderHooks.render('settings');
  uploadFile(window, $('#wallFile'), { type: 'application/pdf', name: 'doc.pdf' });
  await wait(150);
  const ov = window.document.querySelector('#overlayRoot .modal');
  assert.ok(ov && /仅支持/.test(ov.textContent), '非图片应提示');
  assert.equal(window.localStorage.getItem(WALL_KEY), null);
});

test('恢复默认：清除存储、背景回默认图、缩略图回默认', async () => {
  const { window, hooks, $ } = boot({ seed: BASE });
  hooks.render('settings');
  uploadFile(window, $('#wallFile'));
  await wait(150);
  assert.ok(hooks.store.getCustomWallpaper(), '先上传成功');
  $('#wallReset').click();
  await wait(80);
  assert.equal(window.localStorage.getItem(WALL_KEY), null, '存储应清除');
  assert.equal(window.document.documentElement.style.getPropertyValue('--wallpaper-url'), '', '背景应移除自定义 URL');
  assert.ok(/wallpaper\.jpg$/.test($('#wallThumb').getAttribute('src')), '缩略图应回默认');
});

test('透明度滑块：自定义壁纸下仍联动 opacity 变量', async () => {
  const { window, hooks, $ } = boot({ seed: BASE });
  hooks.render('settings');
  uploadFile(window, $('#wallFile'));
  await wait(150);
  const slider = $('#wallOpacity');
  slider.value = '70';
  slider.dispatchEvent(new window.Event('input', { bubbles: true }));
  await wait(50);
  assert.equal(window.document.documentElement.style.getPropertyValue('--wallpaper-opacity'), '0.7', '透明度应联动');
  assert.equal(hooks.store.state.settings.wallpaperOpacity, 70);
  assert.ok(window.document.documentElement.style.getPropertyValue('--wallpaper-url'), '自定义背景仍在');
});

test('CSS：壁纸层支持动态 URL 且 cover/居中（移动端适配）', () => {
  const { root } = require('./harness.js');
  const fs = require('node:fs');
  const path = require('node:path');
  const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
  assert.ok(css.includes('var(--wallpaper-url, url("../img/wallpaper.jpg"))'), '背景应支持动态 URL 并回退默认图');
  const blk = css.split('body::before')[1].split('}')[0];
  assert.ok(/background-size:\s*cover/.test(blk), '应 cover 铺满不拉伸');
  assert.ok(/background-position:\s*center/.test(blk), '应居中显示（移动端适配）');
  assert.ok(/opacity:\s*var\(--wallpaper-opacity/.test(blk), '透明度应继续由滑块控制');
});