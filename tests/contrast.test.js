'use strict';
/* P4a 对比度契约：浅色/暗色主题文字色对背景须达 WCAG AA 普通文本 ≥4.5:1
 * 读取 css/style.css 中的变量定义与关键硬编码色，用标准相对亮度公式计算 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');

function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  assert.ok(m, '无效色值 ' + hex);
  return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
}

function rgbToCss(rgb) {
  return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
}

function mixRgba(fg, bg) {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/.exec(fg);
  assert.ok(m, '无效 rgba ' + fg);
  const a = m[4] === undefined ? 1 : parseFloat(m[4]);
  return [0, 1, 2].map(i => Math.round(parseFloat(m[i + 1]) * a + hexToRgb(bg)[i] * (1 - a)));
}

function linear(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(rgb) {
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
}

function contrast(fg, bg) {
  const l1 = luminance(hexToRgb(fg));
  const l2 = luminance(typeof bg === 'string' ? hexToRgb(bg) : bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function blockVars(selector) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, '找不到 ' + selector);
  const body = css.slice(start);
  const open = body.indexOf('{');
  let depth = 0;
  for (let i = open; i < body.length; i++) {
    if (body[i] === '{') depth++;
    else if (body[i] === '}') {
      depth--;
      if (depth === 0) return body.slice(open + 1, i);
    }
  }
  throw new Error('块未闭合 ' + selector);
}

function varValue(block, name) {
  const m = new RegExp('--' + name + ':\\s*([^;]+);').exec(block);
  assert.ok(m, '变量 --' + name + ' 缺失');
  return m[1].trim();
}

const light = blockVars(':root');
const dark = blockVars('[data-theme="dark"]');

function assertAA(fg, bg, label, min = 4.5) {
  const r = contrast(fg, bg);
  assert.ok(r >= min, `${label} 对比度 ${r.toFixed(2)}:1 低于 ${min}:1`);
}

test('P4a：浅色主题 muted 文字对背景 ≥4.5:1', () => {
  assertAA(varValue(light, 'muted'), varValue(light, 'bg'), '浅色 muted');
});

test('P4a：暗色主题 muted 文字对背景 ≥4.5:1', () => {
  assertAA(varValue(dark, 'muted'), varValue(dark, 'bg'), '暗色 muted');
});

test('P4a：主文字色两主题均 ≥4.5:1', () => {
  assertAA(varValue(light, 'text'), varValue(light, 'bg'), '浅色 text');
  assertAA(varValue(dark, 'text'), varValue(dark, 'bg'), '暗色 text');
});

test('P4a：优先级徽标浅色（带底色混入）≥4.5:1', () => {
  const base = varValue(light, 'bg');
  assertAA('#7d5316', rgbToCss(mixRgba('rgba(176, 114, 63, 0.12)', base)), 'pill.mid');
  assertAA('#23634f', rgbToCss(mixRgba('rgba(46, 125, 99, 0.12)', base)), 'pill.lo');
  assertAA('#b32a1f', rgbToCss(mixRgba('rgba(194, 59, 46, 0.12)', base)), 'pill.hi');
});

test('P4a：优先级徽标暗色主题（带底色混入）≥4.5:1', () => {
  const base = varValue(dark, 'bg');
  assertAA('#e0b47e', rgbToCss(mixRgba('rgba(176, 114, 63, 0.12)', base)), 'pill.mid(dark)');
  assertAA('#8fc9b2', rgbToCss(mixRgba('rgba(46, 125, 99, 0.12)', base)), 'pill.lo(dark)');
  assertAA('#e08a7d', rgbToCss(mixRgba('rgba(194, 59, 46, 0.12)', base)), 'pill.hi(dark)');
});

test('P4a：配额条链接与配额条文字 ≥4.5:1', () => {
  assertAA('#8a4a1e', '#f9e7b8', 'qb-link');
  assertAA('#6b4d13', '#f9e7b8', 'quota-bar 文字');
});

test('P4a：主按钮/强调色白字 ≥4.5:1（与亮态背景合算）', () => {
  assertAA('#ffffff', '#c23b2e', 'accent 白字', 4.5);
});

test('P4a 续：状态文本色（warn/ok/accent 文本）两主题 ≥4.5:1', () => {
  assertAA(varValue(light, 'warn-text'), varValue(light, 'bg'), '浅色 warn-text');
  assertAA(varValue(light, 'ok-text'), varValue(light, 'bg'), '浅色 ok-text');
  assertAA(varValue(light, 'accent-text'), varValue(light, 'bg'), '浅色 accent-text');
  assertAA(varValue(dark, 'warn-text'), varValue(dark, 'bg'), '暗色 warn-text');
  assertAA(varValue(dark, 'ok-text'), varValue(dark, 'bg'), '暗色 ok-text');
  assertAA(varValue(dark, 'accent-text'), varValue(dark, 'bg'), '暗色 accent-text');
});

test('P4a 续：扫雷数字浅色主题 ≥4.5:1（对照已翻开格子底 #e2dcc9 更严）', () => {
  const cellBg = '#e2dcc9';
  assertAA('#1e4e9e', cellBg, '扫雷 n1');
  assertAA(varValue(light, 'ok-text'), cellBg, '扫雷 n2');
  assertAA(varValue(light, 'accent-text'), cellBg, '扫雷 n3');
  assertAA(varValue(light, 'warn-text'), cellBg, '扫雷 n4-n8');
});
