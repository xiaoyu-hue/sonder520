'use strict';
/* 缺点1 契约：innerHTML 赋值点安全审计
 * 规则：
 * 1. 清空赋值（innerHTML = ''）自动安全
 * 2. 赋值行内含 esc( 调用自动安全（插值已转义）
 * 3. 其余赋值点必须在 MANUAL_REVIEW 白名单中（人工确认所有插值均过 esc，
 *    或为纯字面量/系统生成 id/数值）
 * 4. 白名单条目必须仍是 innerHTML 赋值行（行号漂移/已修复需同步更新）
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const JS_DIR = path.join(__dirname, '..', 'js');

/* 文件:行号 -> 人工审查结论（插值安全性说明） */
const MANUAL_REVIEW = {
  'consulting.js:79': 'renderProjects：pr.name/note/stage 均过 UI.esc，pr.id 为 uid() 生成',
  'consulting.js:113': 'renderFollowups：f.note/date 均过 UI.esc，f.id 为 uid() 生成',
  'consulting.js:153': 'renderIncomes：amount 经 Number()||0 归一为数字，i.date/note 过 UI.esc，i.id 为 uid() 生成',
  'dev.js:258': '纯字面量（暂无任务占位）',
  'dev.js:260': 'projectCard 任务列表：t.title 过 UI.esc（同类行内），t.id 为 uid() 生成',
  'home.js:49': '多行数组拼接：greeting()/lastMemo/quoteHtml/rankCard 插值均过 UI.esc，汇总数字为数值型',
  'search.js:129': 'html 变量在 renderGroup 内构建：label/text/sub 均过 UI.esc，module 为内部注册表常量',
  'selfmedia.js:250': '多行拼接：p.title 过 UI.esc，pills/legend/rows 均为数值与常量色值，miniLine 只输出数字',
  'today.js:129': 'html 由 section() 构建：t.title/note/priority 与 pr.label 均过 esc，t.id 为 uid() 生成',
  'ui.js:38': 'UI.el 框架入口（innerHTML 接收调用方已转义字符串），调用方由本清单约束'
};

test('innerHTML 契约：全部赋值点清空或已转义，其余在人工审查白名单内', () => {
  const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js'));
  assert.ok(files.length > 10, '应扫描到全部 js 文件');
  const found = [];
  files.forEach(f => {
    const lines = fs.readFileSync(path.join(JS_DIR, f), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!/innerHTML\s*=/.test(line)) return;
      const isClear = /innerHTML\s*=\s*['"]\s*['"]/.test(line);
      const hasEsc = /(?:UI\.esc|\.esc|\besc)\(/.test(line);
      if (isClear || hasEsc) return;
      found.push(f + ':' + (i + 1));
    });
  });
  assert.deepEqual(found.sort(), Object.keys(MANUAL_REVIEW).sort(),
    '非转义赋值点集合必须与人工审查白名单一致；新增赋值点须人工确认转义后加入 MANUAL_REVIEW');
});

test('innerHTML 契约：白名单无幽灵条目（条目行号必须仍是赋值点）', () => {
  Object.entries(MANUAL_REVIEW).forEach(([key]) => {
    const [f, n] = key.split(':');
    const file = path.join(JS_DIR, f);
    assert.ok(fs.existsSync(file), '白名单文件存在：' + f);
    const line = fs.readFileSync(file, 'utf8').split('\n')[Number(n) - 1];
    assert.ok(/innerHTML\s*=/.test(line), '白名单条目 ' + key + ' 不再是 innerHTML 赋值行，需更新行号或删除');
  });
});
