#!/usr/bin/env node
/* build-static.mjs — 为「零构建」的静态站点生成可部署产物 dist/
 *
 * sonder520 本身不需要打包：index.html 直接引用 js/ 与 css/，因此本地开发与
 * GitHub Pages 都是「仓库根目录即站点」。但 Cloudflare Pages 的 Git 集成会执行
 * 项目设置里的构建命令（默认 `npm run build`），没有该脚本时构建阶段直接失败。
 *
 * 本脚本只做一件事：按白名单把运行时需要的文件复制到 dist/，不做任何转换，
 * 保证 dist/ 与仓库根目录的静态行为完全一致。
 *
 * 用法：node scripts/build-static.mjs   （npm run build）
 */
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');

/* 白名单：新增根级静态目录时同步加在这里，否则不会进入 dist/ */
const FILES = [
  'index.html',
  'manifest.json',
  'sw.js',
  '_headers',
  'robots.txt',
  '404.html',
];
const DIRS = ['assets', 'css', 'img', 'js', 'docs'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

let count = 0;
for (const f of FILES) {
  const src = join(root, f);
  if (!existsSync(src)) continue;
  cpSync(src, join(out, f));
  count += 1;
}
for (const d of DIRS) {
  const src = join(root, d);
  if (!existsSync(src)) continue;
  cpSync(src, join(out, d), { recursive: true });
  count += 1;
}

const bytes = (p) => {
  const s = statSync(p);
  return s.isDirectory() ? 'dir' : `${s.size}B`;
};
console.log(`build-static: ${count} entries → dist/ ${bytes(out)}`);
if (count === 0) {
  console.error('build-static: 白名单内没有任何文件，检查仓库结构');
  process.exit(1);
}
