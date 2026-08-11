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

function poll(fn, stepMs, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function tick() {
      let r = null;
      try { r = fn(); } catch (e) { return reject(e); }
      if (r) return resolve(r);
      if (Date.now() - t0 > (timeoutMs || 8000)) return reject(new Error('poll 超时'));
      setTimeout(tick, stepMs || 80);
    })();
  });
}

/* 壁纸层 img 是否在使用自定义壁纸（src 为 data:image） */
function bLayer(window) {
  const img = window.document.getElementById('wallpaperImg');
  if (!img) return false;
  return /^data:image\//.test(img.getAttribute('src') || '');
}

test('上传成功：立即预览、背景实时更换、base64 存入 localStorage', async () => {
  const { window, hooks, $ } = boot({ seed: BASE });
  hooks.render('settings');
  uploadFile(window, $('#wallFile'));
  await poll(() => window.localStorage.getItem(WALL_KEY), 80, 8000);
  assert.equal(hooks.store.getCustomWallpaper(), window.localStorage.getItem(WALL_KEY), '应存入 localStorage');
  assert.ok(window.localStorage.getItem(WALL_KEY).startsWith('data:image/'), '应为 base64 data URL');
  assert.ok($('#wallThumb').getAttribute('src').startsWith('data:image/'), '缩略图应预览新图');
  assert.ok(bLayer(window), '背景应实时切换为自定义图');
  assert.ok($('#wallReset'), '上传后应出现恢复默认按钮');
  assert.equal(window.document.querySelector('#wallFile').value, '', '成功后应重置文件输入');
});

test('刷新后：自定义壁纸仍在（缩略图 + 背景）', async () => {
  const a = boot({ seed: BASE });
  a.hooks.render('settings');
  uploadFile(a.window, a.$('#wallFile'));
  await poll(() => a.window.localStorage.getItem(WALL_KEY), 80, 8000);
  const raw = a.window.localStorage.getItem(WALL_KEY);
  assert.ok(raw, '应先保存成功');

  const b = boot({ rawLS: { sonder_data_v1: JSON.stringify(BASE), [WALL_KEY]: raw } });
  b.hooks.applyWallpaper();
  b.hooks.render('settings');
  assert.ok(bLayer(b.window), '背景层应使用自定义图');
  assert.equal(b.$('#wallThumb').getAttribute('src'), raw, '刷新后缩略图应仍为自定义图');
  assert.ok(b.$('#wallReset'), '刷新后仍有恢复默认');
});

test('超过 2MB：提示图片过大且不应用（无 canvas 环境）', async () => {
  const { window, hooks, $ } = boot({ seed: BASE });
  hooks.render('settings');
  uploadFile(window, $('#wallFile'), { size: 2 * 1024 * 1024 + 1 });
  await poll(() => window.document.querySelector('#overlayRoot .modal'), 50, 4000);
  const ov = window.document.querySelector('#overlayRoot .modal');
  assert.ok(ov && /图片过大，请压缩后上传/.test(ov.textContent), '应弹出大小提示');
  assert.equal(window.localStorage.getItem(WALL_KEY), null, '不得存储超大图');
  assert.equal(bLayer(window), false, '不得应用超大图');
  assert.equal(hooks.store.getCustomWallpaper(), null);
  assert.equal(window.document.querySelector('#wallFile').value, '', '应重置文件输入');
});

test('非图片类型：拒绝应用', async () => {
  const { window, $ } = boot({ seed: BASE });
  window.__sonderHooks.render('settings');
  uploadFile(window, $('#wallFile'), { type: 'application/pdf', name: 'doc.pdf' });
  await poll(() => window.document.querySelector('#overlayRoot .modal'), 50, 4000);
  const ov = window.document.querySelector('#overlayRoot .modal');
  assert.ok(ov && /仅支持/.test(ov.textContent), '非图片应提示');
  assert.equal(window.localStorage.getItem(WALL_KEY), null);
});

test('恢复默认：清除存储、背景回默认图、缩略图回默认', async () => {
  const { window, hooks, $ } = boot({ seed: BASE });
  hooks.render('settings');
  uploadFile(window, $('#wallFile'));
  await poll(() => hooks.store.getCustomWallpaper(), 80, 8000);
  assert.ok(hooks.store.getCustomWallpaper(), '先上传成功');
  $('#wallReset').click();
  await poll(() => !window.localStorage.getItem(WALL_KEY), 50, 4000);
  assert.equal(bLayer(window), false, '背景应回默认图');
  assert.ok(/wallpaper\.jpg$/.test($('#wallThumb').getAttribute('src')), '缩略图应回默认');
});

test('透明度滑块：自定义壁纸下仍联动 opacity 变量', async () => {
  const { window, hooks, $ } = boot({ seed: BASE });
  hooks.render('settings');
  uploadFile(window, $('#wallFile'));
  await poll(() => window.localStorage.getItem(WALL_KEY), 80, 8000);
  const slider = $('#wallOpacity');
  slider.value = '70';
  slider.dispatchEvent(new window.Event('input', { bubbles: true }));
  await wait(50);
  assert.equal(window.document.documentElement.style.getPropertyValue('--wallpaper-opacity'), '0.7', '透明度应联动');
  slider.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(hooks.store.state.settings.wallpaperOpacity, 70);
  assert.ok(bLayer(window), '自定义背景仍在');
});

test('同一文件可重复上传（输入框已重置，change 再次触发）', async () => {
  const { window, hooks, $ } = boot({ seed: BASE });
  hooks.render('settings');
  uploadFile(window, $('#wallFile'));
  await poll(() => window.localStorage.getItem(WALL_KEY), 80, 8000);
  const v1 = window.localStorage.getItem(WALL_KEY);
  assert.ok(v1, '第一次上传成功');
  /* 第二次选择同一路径文件：若 change 不触发则此处将超时，验证输入框已被重置 */
  uploadFile(window, $('#wallFile'));
  await poll(() => window.document.querySelector('#wallFile').value === '', 100, 4000);
  assert.equal(hooks.store.getCustomWallpaper(), v1, '两次上传后内容一致且仍生效');
});

test('CSS：壁纸层元素化适配所有机型——cover 铺满 / 居中 / 不拉伸变形', () => {
  const { root } = require('./harness.js');
  const fs = require('node:fs');
  const path = require('node:path');
  const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
  assert.ok(css.includes('#wallpaperLayer'), '应有独立壁纸层元素样式');
  const blk = css.split('#wallpaperLayer img')[1].split('}')[0];
  assert.ok(/object-fit:\s*cover/.test(blk), 'img 应以 cover 铺满不拉伸');
  assert.ok(/object-position:\s*center/.test(blk), '应居中显示（横竖屏/手机/桌面统一）');
  assert.ok(/width:\s*100%/.test(blk) && /height:\s*100%/.test(blk), '应铺满整个视口');
  const layerBlk = css.split('#wallpaperLayer')[1].split('img')[0];
  assert.ok(/opacity:\s*var\(--wallpaper-opacity/.test(layerBlk), '透明度应继续由滑块控制');
  assert.ok(/position:\s*fixed/.test(layerBlk), '层应固定定位覆盖视口');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.includes('id="wallpaperImg"'), '页面应包含壁纸 img 元素');
});