/* tests/type-sync.test.js - globals.d.ts 与实现一致性守护
 * 自动校验 SonderStoreImpl 接口声明的方法与 Store.prototype 实际方法是否一致。
 * 新增 Store 方法未声明 → 测试失败（提醒同步 globals.d.ts）；
 * 声明了但实现不存在 → 测试失败（幽灵声明）。 */
'use strict';

const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');

/* ---------- 从 globals.d.ts 提取 SonderStoreImpl 声明的方法名 ---------- */
function extractDtsMethods() {
  const dts = fs.readFileSync(path.join(root, 'js', 'globals.d.ts'), 'utf8');
  /* 匹配 interface SonderStoreImpl { ... } 块 */
  const m = dts.match(/interface\s+SonderStoreImpl\s*\{([\s\S]*?)\n\}/);
  if (!m) return [];
  const block = m[1];
  const methods = [];
  /* 只匹配方法（有括号的），排除属性（如 state: any） */
  const re = /^\s+(\w+)\s*\(/gm;
  let match;
  while ((match = re.exec(block))) {
    methods.push(match[1]);
  }
  return [...new Set(methods)];
}

/* ---------- 从 Store.prototype 提取实际方法名 ---------- */
function extractStoreMethods() {
  const files = ['store.js', 'store-tasks.js', 'store-media.js', 'store-content.js', 'store-settings.js', 'store-report.js'];
  const methods = new Set();
  for (const f of files) {
    const fp = path.join(root, 'js', f);
    if (!fs.existsSync(fp)) continue;
    const src = fs.readFileSync(fp, 'utf8');
    const re = /Store\.prototype\.(\w+)\s*=/g;
    let match;
    while ((match = re.exec(src))) {
      methods.add(match[1]);
    }
  }
  return [...methods].sort();
}

describe('globals.d.ts 与 Store.prototype 一致性', () => {
  it('SonderStoreImpl 声明的方法应全部在 Store.prototype 上存在', () => {
    const dtsMethods = extractDtsMethods();
    const storeMethods = extractStoreMethods();
    const missing = dtsMethods.filter(m => !storeMethods.includes(m) && !m.startsWith('_'));
    assert.deepEqual(missing, [], 'globals.d.ts 中声明但 Store.prototype 上不存在的方法（幽灵声明）');
  });

  it('Store.prototype 公开方法应全部在 SonderStoreImpl 中声明', () => {
    const dtsMethods = extractDtsMethods();
    const storeMethods = extractStoreMethods();
    const undeclared = storeMethods.filter(m => !m.startsWith('_') && !dtsMethods.includes(m));
    assert.deepEqual(undeclared, [], 'Store.prototype 上存在但 globals.d.ts 未声明的方法（需同步）');
  });

  it('SonderStoreFactory 声明的静态方法应全部在 api 导出中存在', () => {
    const dts = fs.readFileSync(path.join(root, 'js', 'globals.d.ts'), 'utf8');
    const m = dts.match(/interface\s+SonderStoreFactory\s*\{([\s\S]*?)\n\}/);
    if (!m) return; // 接口不存在则跳过
    const block = m[1];
    const dtsStatic = [];
    const re = /^\s+(\w+)\s*[(:]/gm;
    let match;
    while ((match = re.exec(block))) {
      dtsStatic.push(match[1]);
    }

    const storeSrc = fs.readFileSync(path.join(root, 'js', 'store.js'), 'utf8');
    const apiMatch = storeSrc.match(/var api\s*=\s*\{([\s\S]*?)\n\s*\};/);
    if (!apiMatch) return;
    const apiBlock = apiMatch[1];
    const apiKeys = [];
    const apiRe = /(\w+)\s*:/g;
    let km;
    while ((km = apiRe.exec(apiBlock))) {
      apiKeys.push(km[1]);
    }

    const missing = dtsStatic.filter(m => !apiKeys.includes(m) && !m.startsWith('_'));
    assert.deepEqual(missing, [], 'SonderStoreFactory 声明但 api 导出中不存在的静态方法');
  });
});
