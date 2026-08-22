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
  const re = /<script src="js\/([^"]+)"[^>]*><\/script>/g;
  let m;
  while ((m = re.exec(INDEX))) idx.push(m[1]);
  assert.deepEqual(parseIndexScripts(), idx, 'parseIndexScripts 应解析出全部 js 脚本');
  assert.ok(idx.length >= 15, '脚本数量不应少于 15');
  assert.equal(idx[idx.length - 1], 'app.js', 'app.js 必须是最后一个脚本');
  assert.equal(idx[0], 'encryption.js', 'encryption.js 必须最先加载');
});

test('scripts: sw.js ASSETS 与 index.html 静态资源一致（无新增无移除）', () => {
  const expect = ['./', './index.html'];
  const re = /(?:href="(css\/[^"]+\.css)"|<script src="([^"]+)"[^>]*>)/g;
  let m;
  while ((m = re.exec(INDEX))) expect.push('./' + (m[2] || m[1]));
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
  const re = /(?:href="([^"]+\.css)"|<script src="([^"]+)"[^>]*>)/g;
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

test('scripts: sync-sw 支持 --force 强制递增（清单未变时也可刷新旧缓存）', () => {
  const src = read('scripts/sync-sw.js');
  assert.ok(src.includes("'--force'"), 'sync-sw 应解析 --force 参数');
  assert.ok(src.includes('!listChanged && !sigChanged && !force'), '清单与指纹均未变且无 --force 时才跳过');
  assert.ok(src.includes('listChanged || sigChanged || force'), '--force 应在无变化时也递增 CACHE 版本');
});

test('scripts: sync-sw --check 只读校验当前仓库一致性（CI 门禁依赖）', () => {
  const src = read('scripts/sync-sw.js');
  assert.ok(src.includes("'--check'"), 'sync-sw 应解析 --check 参数');
  const { execFileSync } = require('node:child_process');
  const out = execFileSync(process.execPath, [path.join(root, 'scripts', 'sync-sw.js'), '--check'], { encoding: 'utf8' });
  assert.match(out, /校验通过/, '当前仓库应通过 --check（改动文件后请运行 npm run sync-sw）');
});

test('scripts: 指纹计算行尾归一化（防 autocrlf 平台间漂移）', () => {
  const src = read('scripts/sync-sw.js');
  assert.ok(src.includes("replace(/\\r\\n/g, '\\n')"), 'computeSig 应将 \\r\\n 归一为 \\n 再哈希');
});

test('scripts: sw.js 含内容指纹 ASSET_SIG（sha256 前 12 位）', () => {
  const m = /var ASSET_SIG = '([0-9a-f]{12})'/.exec(SW);
  assert.ok(m, 'sw.js 应含 12 位十六进制 ASSET_SIG（改动后请运行 npm run sync-sw）');
});

test('scripts: sync-sw 对清单文件内容计算指纹（任一文件内容变化即升版）', () => {
  const src = read('scripts/sync-sw.js');
  assert.ok(src.includes('createHash'), 'sync-sw 应使用 crypto 哈希');
  assert.ok(src.includes('ASSET_SIG'), 'sync-sw 应写入 ASSET_SIG');
  assert.ok(src.includes('sigChanged'), '内容指纹变化应参与升版判定');
  assert.ok(src.includes('listChanged'), '清单变化应参与升版判定');
  assert.ok(src.includes("f.replace(/^\\.\\//, '')"), '指纹应基于文件实际内容而非路径');
});

test('scripts: CSP meta 存在且与当前资源形态兼容', () => {
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(INDEX);
  assert.ok(csp, 'index.html 应含 CSP meta');
  assert.ok(csp[1].includes("default-src 'self'"), 'default-src 应为 self');
  /* Commit 3 安全加固：SW 注册外置后无任何内联脚本，script-src 收敛为纯 'self'
   * （静态 nonce "sw" 随仓库公开形同虚设，已移除） */
  assert.ok(csp[1].includes("script-src 'self'"), 'script-src 应为 self');
  assert.ok(!csp[1].includes('nonce'), '不得再保留静态 nonce（公开仓库可猜）');
  assert.ok(csp[1].includes("style-src 'self' 'unsafe-inline'"), 'style-src 应含 unsafe-inline（UI 内联 style 属性）');
  assert.ok(csp[1].includes("img-src 'self' data: blob:"), 'img-src 应允许 data/blob（favicon/预览）');
  assert.ok(csp[1].includes("object-src 'none'"), '应禁 object/embed');
  assert.ok(csp[1].includes("base-uri 'self'"), 'base-uri 应限制为 self');
});

test('scripts: 已部署响应头 _headers（CF Pages 生效，GH Pages 无害）', () => {
  const h = read('_headers');
  assert.ok(h.includes('X-Frame-Options: DENY'), '应禁 iframe 嵌入（点击劫持）');
  assert.ok(h.includes('X-Content-Type-Options: nosniff'), '应开启 MIME 嗅探防护');
  assert.ok(h.includes('Referrer-Policy: strict-origin-when-cross-origin'), '应限制 Referrer 泄露');
});

test('scripts: 外部脚本统一 defer 且 index.html 零内联脚本（CSP 收敛前提）', () => {
  const tags = INDEX.match(/<script[^>]*>/g) || [];
  assert.ok(tags.length >= 16, '应有足够数量的 script 标签');
  tags.forEach(t => {
    assert.ok(/src="js\//.test(t), '所有脚本均须外置（不得内联）: ' + t);
    assert.ok(/defer/.test(t), '外部脚本应 defer: ' + t);
  });
  /* sw-register.js 为 SW 注册外置文件（原 nonce="sw" 内联脚本，Commit 3 移除） */
  assert.ok(INDEX.includes('js/sw-register.js'), 'SW 注册脚本应外置加载');
});