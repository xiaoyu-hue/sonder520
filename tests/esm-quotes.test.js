'use strict';
/* ESM 试验田：验证零构建下原生 ESM 模块（.mjs）可被 Node 动态 import() 加载、
 * 纯函数可测试，并与生产 UMD 实现（quotes.js）保持行为一致（双实现一致性守护）。
 * 迁移结论记录于 CHANGELOG/架构评估：浏览器侧 file:// 直开 + CSP script-src 'self' +
 * 测试 harness window.eval 注入与原生 ESM 冲突，生产链路维持 UMD；ESM 形态作为
 * 纯模块/纯逻辑的理想载体，未来按模块规模渐进采用。 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');

test('ESM 试验田: quotes-core.mjs 可经 import() 加载且导出齐备', async () => {
  const core = await import(pathToFileURL(path.join(root, 'js', 'quotes-core.mjs')).href);
  assert.ok(Array.isArray(core.QUOTES), '应导出金句数组');
  assert.equal(typeof core.pickQuote, 'function', '应导出选取函数');
  assert.equal(core.QUOTES.length, 40, '金句库 40 条');
});

test('ESM 试验田: 与生产 quotes.js（UMD）双实现一致——同日同金句、库一致', async () => {
  const core = await import(pathToFileURL(path.join(root, 'js', 'quotes-core.mjs')).href);
  const Q = require(path.join(root, 'js', 'quotes.js'));
  const store = require(path.join(root, 'js', 'store.js'));
  const hashStr = store._h.hashStr;

  assert.deepEqual(core.QUOTES, Q.quotes, '金句库必须与 quotes.js 完全一致（防迁移漂移）');
  ['2026-08-09', '2026-08-10', '1999-01-01', '2030-12-31', ''].forEach(d => {
    const a = core.pickQuote(hashStr, d);
    const b = Q.quoteOfDay(d);
    assert.equal(typeof a, 'string', 'ESM 实现应产出字符串: ' + d);
    assert.equal(a, b, '同一日期两实现必须给出同一金句: ' + d);
  });
  assert.ok(Q.quotes.includes(core.pickQuote(hashStr, '')), '取今日金句应在库内');
});