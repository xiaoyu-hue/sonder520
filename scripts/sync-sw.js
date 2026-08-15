/* sync-sw.js - 从 index.html 自动同步 sw.js 的 ASSETS 预缓存清单
 * 用法：node scripts/sync-sw.js（或 npm run sync-sw）
 * 附加：--force 强制递增一次 CACHE 版本（清单未变化时也递增，用于主动刷新旧缓存）
 * 附加：内容指纹 ASSET_SIG —— 任一清单文件内容变化（sha256 前 12 位）即自动递增 CACHE 版本，
 *       避免"只改代码忘了升版 → 老用户永远命中旧缓存"。
 * index.html 是脚本/样式清单的唯一真源；本脚本检测到清单或内容变化时自动递增 CACHE 版本。 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const force = process.argv.includes('--force');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const swPath = path.join(root, 'sw.js');

/* 运行时按需加载、不进 index.html script 列表的资产（如 Web Worker），仍须预缓存 */
const EXTRA = ['./js/game-worker.js'];

const html = fs.readFileSync(indexPath, 'utf8');
const sw = fs.readFileSync(swPath, 'utf8');

function parseAssets() {
  const files = ['./', './index.html'];
  const re = /(?:href="(css\/[^"]+\.css)"|<script src="([^"]+)"[^>]*>)/g;
  let m;
  while ((m = re.exec(html))) files.push('./' + (m[2] || m[1]));
  files.push('./manifest.json', './img/wallpaper.jpg', './assets/icon.svg');
  EXTRA.forEach(f => files.push(f));
  return [...new Set(files)];
}

/* 内容指纹：对清单内每个文件内容做 sha256 前 12 位，排序拼接后整体再取 12 位。
 * './' 是目录缓存键（无文件内容），跳过。文件缺失记 MISSING（保证指纹对缺失敏感）。 */
function computeSig(files) {
  const h = crypto.createHash('sha256');
  files.filter(f => f !== './').sort().forEach(f => {
    h.update(f + ':');
    try {
      const c = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f.replace(/^\.\//, '')))).digest('hex').slice(0, 12);
      h.update(c);
    } catch (e) {
      h.update('MISSING');
    }
  });
  return h.digest('hex').slice(0, 12);
}

const list = parseAssets();
const sig = computeSig(list);

const start = sw.indexOf('var ASSETS = [');
const end = sw.indexOf('];', start);
if (start < 0 || end < 0) {
  console.error('sw.js: 找不到 ASSETS 数组，中止');
  process.exit(1);
}
const curBlock = sw.slice(start, end + 2);
const newBlock = 'var ASSETS = [\n' + list.map(f => "  '" + f + "'").join(',\n') + '\n];';

const sigRe = /var ASSET_SIG = '([0-9a-f]*)'/;
const curSigMatch = sigRe.exec(sw);
const curSig = curSigMatch ? curSigMatch[1] : '';
const sigLine = "var ASSET_SIG = '" + sig + "';";

const listChanged = curBlock !== newBlock;
const sigChanged = curSig !== sig;

if (!listChanged && !sigChanged && !force) {
  console.log('sw.js ASSETS 与内容指纹均最新（共 ' + list.length + ' 项），无需改动');
  process.exit(0);
}

let next = sw;
if (curSigMatch) {
  next = next.replace(sigRe, sigLine);
} else {
  next = next.slice(0, end + 2) + '\n' + sigLine + next.slice(end + 2);
}
next = next.slice(0, start) + newBlock + next.slice(end + 2);

const verRe = /var CACHE = 'sonder-v(\d+)'/;
const vm = verRe.exec(next);
if (vm && (listChanged || sigChanged || force)) {
  next = next.replace(verRe, 'var CACHE = \'sonder-v' + (Number(vm[1]) + 1) + '\'');
  console.log('CACHE 版本已递增 sonder-v' + vm[1] + ' -> sonder-v' + (Number(vm[1]) + 1)
    + (sigChanged ? '（内容指纹变化' + (force ? '，--force' : '') + '）' : '')
    + (!sigChanged && !force && listChanged ? '（新增: ' + list.filter(f => curBlock.indexOf("'" + f + "'") < 0).join(', ') + '）' : ''));
}
fs.writeFileSync(swPath, next);
console.log('sw.js ASSETS 已同步（共 ' + list.length + ' 项）');
console.log('ASSET_SIG: ' + curSig + ' -> ' + sig);
console.log('本次新增: ' + list.filter(f => curBlock.indexOf("'" + f + "'") < 0).join(', ') || '（无）');
console.log('本次移除: ' + ['', './index.html'].concat(curBlock.match(/'([^']+)'/g) || []).map(s => s.replace(/^'|'$/g, '')).filter(f => list.indexOf(f) < 0).join(', ') || '（无）');