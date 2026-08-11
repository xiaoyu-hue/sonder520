'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const { boot } = require('./harness.js');
const S = require(path.join(root, 'js', 'store.js'));

function memStorage() { const m = {}; return { getItem: k => k in m ? m[k] : null, setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } }; }

test('壁纸透明度：默认 40、更新夹紧 0-100、持久化', () => {
  const s = S.createStore(memStorage());
  assert.equal(s.state.settings.wallpaperOpacity, 40, '默认 40%');
  s.setWallpaperOpacity(75);
  assert.equal(s.state.settings.wallpaperOpacity, 75);
  s.setWallpaperOpacity(220);
  assert.equal(s.state.settings.wallpaperOpacity, 100, '上限夹 100');
  s.setWallpaperOpacity(-9);
  assert.equal(s.state.settings.wallpaperOpacity, 0, '下限夹 0');
  s.setWallpaperOpacity('abc');
  assert.equal(s.state.settings.wallpaperOpacity, 40, '非法值回退到 40');
});

test('normalize：旧数据无该字段时补默认，非法值夹紧', () => {
  const a = S.createStore(memStorage());
  a.setWallpaperOpacity(30);
  const s = S.createStore(memStorage());
  let restored;
  (() => { const st = S.createStore(memStorage()); st.importBackup(JSON.stringify(a.state)); restored = st; })();
  assert.equal(restored.state.settings.wallpaperOpacity, 30, '备份恢复保留透明度');
  assert.equal(s.state.settings.wallpaperOpacity, 40, '空数据用默认 40');
});

test('UI：设置页有透明度滑块，拖动更新存储与 CSS 变量', () => {
  const h = boot({ seed: {
    version: 1,
    settings: { theme: 'light', wallpaperOpacity: 40, modules: { today: true, memo: true, selfmedia: true, dev: true, consulting: true, reading: true, news: true, design: true } },
    tasks: [], memos: [], posts: [], devProjects: [], clients: [], books: [], news: [], designs: []
  } });
  h.goto('settings');
  const doc = h.window.document;
  const slider = doc.querySelector('#wallOpacity');
  assert.ok(slider, '应有透明度滑块');
  assert.equal(slider.value, '40');
  assert.equal(doc.querySelector('#wallOpacityVal').textContent, '40%');
  slider.value = '70';
  slider.dispatchEvent(new h.window.Event('input', { bubbles: true }));
  assert.equal(h.store.state.settings.wallpaperOpacity, 70, '拖动后 store 应为 70');
  const applied = doc.documentElement.style.getPropertyValue('--wallpaper-opacity');
  assert.equal(parseFloat(applied), 0.7, 'CSS 变量应为 0.7');
  assert.equal(doc.querySelector('#wallOpacityVal').textContent, '70%', '标签应同步');
});

test('CSS：壁纸层覆盖视口且透明度走 var(--wallpaper-opacity) 默认 0.4', () => {
  const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
  assert.ok(app.includes("'img/wallpaper.jpg'") || app.includes('"img/wallpaper.jpg"'), '默认壁纸应引用 img/wallpaper.jpg');
  const layer = css.split('#wallpaperLayer img')[1].split('}')[0];
  assert.ok(layer.includes('object-fit: cover'), '应 cover 铺满');
  assert.ok(layer.includes('object-position: center'), '应居中（所有机型）');
  const layerBox = css.split('#wallpaperLayer')[1].split('}')[0];
  assert.ok(layerBox.includes('opacity: var(--wallpaper-opacity, 0.4)'), '应使用透明度变量');
  assert.ok(css.includes('--wallpaper-opacity: 0.4'), '默认透明度 0.4');
});

test('图片文件已内置到项目 img/ 且已优化（≤300KB）', () => {
  const p = path.join(root, 'img', 'wallpaper.jpg');
  assert.ok(fs.existsSync(p), '缺少 img/wallpaper.jpg');
  assert.ok(fs.statSync(p).size > 1000, '图片过小无效');
  assert.ok(fs.statSync(p).size < 300 * 1024, '壁纸应压缩优化（移动端首屏提速）');
});