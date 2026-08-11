'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');

/* 脚本清单唯一真源 = index.html 中的 <script src="js/..."> 出现顺序 */
function parseIndexScripts() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const re = /<script src="js\/([^"]+)"><\/script>/g;
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}
const SCRIPT_ORDER = parseIndexScripts();

/* 启动一个完整 App 的 JSDOM 实例。每个实例有自己独立的 localStorage。 */
function boot(opts = {}) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://sonder.local/',
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
  const { window } = dom;

  // 注入真实 WebCrypto + TextEncoder/TextDecoder（jsdom 原生缺失）
  try {
    Object.defineProperty(window, 'crypto', {
      value: require('node:crypto').webcrypto,
      configurable: true,
      writable: true
    });
  } catch (e) { /* 忽略 */ }
  try {
    const { TextEncoder, TextDecoder } = require('node:util');
    Object.defineProperty(window, 'TextEncoder', { value: TextEncoder, configurable: true, writable: true });
    Object.defineProperty(window, 'TextDecoder', { value: TextDecoder, configurable: true, writable: true });
  } catch (e) { /* 忽略 */ }

  // 可选注入 IndexedDB（测试用 fake-indexeddb），store.js 在 window 作用域内探测
  if (opts.idb) {
    window.indexedDB = opts.idb;
    const kr = opts.idbKeyRange || (typeof globalThis.IDBKeyRange !== 'undefined' ? globalThis.IDBKeyRange : null);
    if (kr) window.IDBKeyRange = kr;
  }

  // 可选注入 sessionStorage（加密免密会话）
  if (opts.session) {
    Object.keys(opts.session).forEach(k => {
      try { window.sessionStorage.setItem(k, opts.session[k]); } catch (e) { /* 忽略 */ }
    });
  }

  // 可选注入可编程 matchMedia（opts.matchMedia=true 时启用；systemDark 初始系统深浅）
  // 暴露 window.__mm：.dark 当前值、_setDark(v) 切换系统深浅并触发 change 监听器
  if (opts.matchMedia) {
    const mm = {
      dark: !!opts.systemDark,
      listeners: [],
      get matches() { return this.dark; },
      addEventListener: function (type, fn) { if (type === 'change') this.listeners.push(fn); },
      removeEventListener: function (type, fn) {
        this.listeners = this.listeners.filter(f => f !== fn);
      },
      _setDark: function (v) {
        this.dark = !!v;
        this.listeners.forEach(fn => { try { fn({ matches: this.dark }); } catch (e) { /* 忽略 */ } });
      }
    };
    window.matchMedia = function () { return mm; };
    window.__mm = mm;
  }

  // 手工按顺序注入脚本（避免 file:// 下加载外部脚本的约束）
  SCRIPT_ORDER.forEach(f => {
    const code = fs.readFileSync(path.join(root, 'js', f), 'utf8');
    if (opts.rawLS) {
      /* rawLS: 精确注入 localStorage 快照（如密文 + 盐） */
      Object.keys(opts.rawLS).forEach(k => window.localStorage.setItem(k, opts.rawLS[k]));
    } else if (opts.seed !== undefined && f === 'store.js') {
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
module.exports.parseIndexScripts = parseIndexScripts;