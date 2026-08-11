'use strict';
/* 缺点3 契约：状态双轨——store 是唯一数据权威，页面内部 state 只允许 UI 瞬态
 * 1. 静态：页面内部 state 声明必须只含瞬态字段（新增键触发人工审查）
 * 2. 运行时：store 变更后重渲染必须反映新数据（页面不得缓存陈旧数据）
 * 3. 运行时：games 页离开再进入不得残留对局瞬态（页面切换清理） */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { boot } = require('./harness.js');

const JS_DIR = path.join(__dirname, '..', 'js');
const PAGES = ['home', 'today', 'memo', 'selfmedia', 'dev', 'consulting', 'reading', 'excerpts', 'news', 'design', 'game', 'settings'];

/* 页面内部 state 允许的瞬态键（UI 过滤/当前视图/对局进行中） */
const PAGE_STATE_WHITELIST = {
  'games.js': ['game', 'mode', 'playerStone', 'difficulty', 'mini'],
  'news.js': ['status', 'tag'],
  'selfmedia.js': ['status', 'tag', 'view']
};

test('双轨: 页面内部 state 声明有清单且键均为瞬态（禁止领域数据副本）', () => {
  const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js') && !/^store-/.test(f));
  const found = {};
  files.forEach(f => {
    const lines = fs.readFileSync(path.join(JS_DIR, f), 'utf8').split('\n');
    lines.forEach((line, i) => {
      const m = line.match(/^\s*var state\s*=\s*\{/);
      if (m) found[f] = i + 1;
    });
  });
  assert.deepEqual(Object.keys(found).sort(), Object.keys(PAGE_STATE_WHITELIST).sort(),
    '页面内部 state 声明应与清单一致；新增声明须确认瞬态性质后加入白名单');
  Object.entries(PAGE_STATE_WHITELIST).forEach(([f, keys]) => {
    const src = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
    const block = src.slice(src.indexOf('var state = {'), src.indexOf('};', src.indexOf('var state = {')) + 2);
    keys.forEach(k => {
      assert.ok(block.includes(k + ':'), f + ' 的 state 白名单键 ' + k + ' 不在声明中（清单需更新）');
    });
    assert.ok(block.length < 300, f + ' state 声明超过 300 字符，疑似混入领域数据');
  });
});

test('双轨: 逐页重渲染幂等——两次渲染 DOM 摘要一致，无双轨残留', () => {
  const { window, goto, $ } = boot({});
  PAGES.forEach(key => {
    goto(key);
    const first = $('#content').textContent;
    goto('home');
    goto(key);
    const second = $('#content').textContent;
    assert.equal(second, first, key + ' 页重渲染后 DOM 摘要变化，存在页面内部状态残留');
  });
  assert.ok(window, 'boot 正常');
});

test('双轨: store 变更后重渲染必须可见（today 任务 / home 备忘）', () => {
  const { store, goto, $ } = boot({});
  store.addTask({ title: '双轨探针任务' });
  goto('today');
  assert.ok($('#content').textContent.includes('双轨探针任务'), 'today 页渲染应反映 store 新任务');
  store.addMemo('双轨探针备忘');
  goto('home');
  assert.ok($('#content').textContent.includes('双轨探针备忘'), 'home 页渲染应反映 store 新备忘');
});

test('双轨: game 页对战记录由 store 驱动（页面不缓存记录副本）', () => {
  const { store, goto, $ } = boot({});
  goto('game');
  assert.ok($('#content').textContent.includes('暂无对局记录'), '空记录应显示空态');
  store.addGameRecord({ kind: 'tictactoe', winner: 'X' });
  goto('game');
  const text = $('#content').textContent;
  assert.ok(text.includes('对战记录'), '渲染对战记录区块');
  assert.ok(!text.includes('暂无对局记录'), '新记录后空态消失');
  store.clearGameRecords();
  goto('game');
  assert.ok($('#content').textContent.includes('暂无对局记录'), '清空后回到空态');
});

test('双轨: games 页离开再进入不残留对局瞬态（__gamesDbg 快照）', () => {
  const { window, goto } = boot({});
  goto('game');
  const snap = window.__gamesDbg();
  assert.equal(snap.game, null, '初始无对局');
  assert.equal(snap.mini, null, '初始无小游戏');
  goto('home');
  goto('game');
  const snap2 = window.__gamesDbg();
  assert.equal(snap2.game, null, '切换页面后不得残留对局');
  assert.equal(snap2.mini, null, '切换页面后不得残留小游戏');
});
