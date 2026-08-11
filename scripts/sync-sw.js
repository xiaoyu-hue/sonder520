/* sync-sw.js - 从 index.html 自动同步 sw.js 的 ASSETS 预缓存清单
 * 用法：node scripts/sync-sw.js（或 npm run sync-sw）
 * index.html 是脚本/样式清单的唯一真源；本脚本检测到清单变化时自动递增 CACHE 版本。 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const swPath = path.join(root, 'sw.js');

const html = fs.readFileSync(indexPath, 'utf8');
const sw = fs.readFileSync(swPath, 'utf8');

function parseAssets() {
  const files = ['./', './index.html'];
  const re = /(?:<script src="([^"]+)">|href="(css\/[^"]+\.css)")/g;
  let m;
  while ((m = re.exec(html))) files.push('./' + (m[1] || m[2]));
  files.push('./manifest.json', './img/wallpaper.jpg', './assets/icon.svg');
  return [...new Set(files)];
}

const list = parseAssets();

const start = sw.indexOf('var ASSETS = [');
const end = sw.indexOf('];', start);
if (start < 0 || end < 0) {
  console.error('sw.js: 找不到 ASSETS 数组，中止');
  process.exit(1);
}
const curBlock = sw.slice(start, end + 2);
const newBlock = 'var ASSETS = [\n' + list.map(f => "  '" + f + "'").join(',\n') + '\n];';

if (curBlock === newBlock) {
  console.log('sw.js ASSETS 已是最新（共 ' + list.length + ' 项），无需改动');
  process.exit(0);
}

let next = sw.slice(0, start) + newBlock + sw.slice(end + 2);
const verRe = /var CACHE = 'sonder-v(\d+)'/;
const vm = verRe.exec(next);
if (vm) {
  const bumps = list.filter(f => curBlock.indexOf("'" + f + "'") < 0);
  if (bumps.length) {
    next = next.replace(verRe, 'var CACHE = \'sonder-v' + (Number(vm[1]) + 1) + '\'');
    console.log('CACHE 版本已递增 sonder-v' + vm[1] + ' -> sonder-v' + (Number(vm[1]) + 1) + '（新增: ' + bumps.join(', ') + '）');
  }
}
fs.writeFileSync(swPath, next);
console.log('sw.js ASSETS 已同步（共 ' + list.length + ' 项）');
console.log('本次新增: ' + list.filter(f => curBlock.indexOf("'" + f + "'") < 0).join(', ') || '（无）');
console.log('本次移除: ' + ['', './index.html'].concat(curBlock.match(/'([^']+)'/g) || []).map(s => s.replace(/^'|'$/g, '')).filter(f => list.indexOf(f) < 0).join(', ') || '（无）');