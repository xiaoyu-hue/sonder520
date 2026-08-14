'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { root, parseIndexScripts } = require('./harness.js');

const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const INDEX = read('index.html');
const SW = read('sw.js');

/* 用与 scripts/sync-sw.js 相同的解析逻辑提取 sw.js 的 ASSETS（不依赖行尾，兼容 CRLF/LF） */
function swAssets() {
  const start = SW.indexOf('var ASSETS = [');
  const end = SW.indexOf('];', start);
  return SW.slice(start, end)
    .split('\n')
    .slice(1)
    .map(l => l.trim().replace(/^'|'?,?$/g, ''))
    .filter(Boolean);
}

test('scripts: harness 脚本顺序与 index.html 完全一致', () => {
  const idx = [];
  const re = /<script src="js\/([^"]+)"><\/script>/g;
  let m;
  while ((m = re.exec(INDEX))) idx.push(m[1]);
  assert.deepEqual(parseIndexScripts(), idx, 'parseIndexScripts 应解析出全部 js 脚本');
  assert.ok(idx.length >= 15, '脚本数量不应少于 15');
  assert.equal(idx[idx.length - 1], 'app.js', 'app.js 必须是最后一个脚本');
  assert.equal(idx[0], 'encryption.js', 'encryption.js 必须最先加载');
});

test('scripts: sw.js ASSETS 与 index.html 静态资源一致（无新增无移除）', () => {
  const expect = ['./', './index.html'];
  const re = /(?:<script src="([^"]+)">|href="(css\/[^"]+\.css)")/g;
  let m;
  while ((m = re.exec(INDEX))) expect.push('./' + (m[1] || m[2]));
  expect.push('./manifest.json', './img/wallpaper.jpg', './assets/icon.svg');
  /* 与 scripts/sync-sw.js 的 EXTRA 保持一致的拷贝（运行时按需加载、不进 index.html 的资产） */
  expect.push('./js/game-worker.js');
  const expectUnique = [...new Set(expect)];
  const actual = swAssets();
  assert.deepEqual(actual, expectUnique, 'sw.js ASSETS 应与 index.html 同步（改动后请运行 npm run sync-sw）');
});

test('scripts: sw.js 缓存版本合法且匹配 sonder-vN 格式', () => {
  const m = /var CACHE = 'sonder-v(\d+)'/.exec(SW);
  assert.ok(m, 'CACHE 应为 sonder-vN 格式');
  assert.ok(Number(m[1]) >= 1);
});

test('scripts: index.html 引用的每个 js/css 文件都存在', () => {
  const files = [];
  const re = /(?:<script src="([^"]+)">|href="([^"]+\.css)")/g;
  let m;
  while ((m = re.exec(INDEX))) files.push(m[1] || m[2]);
  files.forEach(f => {
    assert.ok(fs.existsSync(path.join(root, f)), '缺失文件: ' + f);
  });
});

test('scripts: sync-sw 脚本存在且可运行（只读校验不生效）', () => {
  assert.ok(fs.existsSync(path.join(root, 'scripts', 'sync-sw.js')), 'scripts/sync-sw.js 应存在');
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['sync-sw'], 'node scripts/sync-sw.js', 'npm run sync-sw 应指向同步脚本');
});