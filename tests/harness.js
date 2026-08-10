'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const SCRIPT_ORDER = ['store.js', 'ui.js', 'search.js', 'quotes.js', 'home.js', 'today.js', 'memo.js', 'selfmedia.js',
  'dev.js', 'consulting.js', 'reading.js', 'news.js', 'design.js', 'games-logic.js', 'games.js',
  'settings.js', 'app.js'];

/* 启动一个完整 App 的 JSDOM 实例。每个实例有自己独立的 localStorage。 */
function boot(opts = {}) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://sonder.local/',
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
  const { window } = dom;
  const storeFile = path.join(root, 'js', 'store.js');

  // 可选注入 IndexedDB（测试用 fake-indexeddb），store.js 在 window 作用域内探测
  if (opts.idb) {
    window.indexedDB = opts.idb;
    const kr = opts.idbKeyRange || (typeof globalThis.IDBKeyRange !== 'undefined' ? globalThis.IDBKeyRange : null);
    if (kr) window.IDBKeyRange = kr;
  }

  // 手工按顺序注入脚本（避免 file:// 下加载外部脚本的约束）
  SCRIPT_ORDER.forEach(f => {
    const code = fs.readFileSync(path.join(root, 'js', f), 'utf8');
    if (opts.seed !== undefined && f === 'store.js') {
      /* seed: 提供初始 localStorage 内容 */
      window.localStorage.setItem('sonder_data_v1', JSON.stringify(opts.seed));
    }
    try {
      window.eval(code);
    } catch (e) {
      throw new Error('加载 ' + f + ' 出错: ' + e.message);
    }
  });

  window.dispatchEvent(new window.Event('load'));

  const hooks = window.__sonderHooks;
  const store = hooks.store;
  const $ = (sel) => window.document.querySelector(sel);
  const $$ = (sel) => Array.from(window.document.querySelectorAll(sel));

  return { dom, window, store, hooks, $, $$, goto: hooks.render };
}

module.exports = { boot: boot };
module.exports.root = root;
module.exports.SCRIPT_ORDER = SCRIPT_ORDER;