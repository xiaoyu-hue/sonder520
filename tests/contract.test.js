'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./harness.js');

/* ================= 页面接口契约 =================
 * 每个注册页面必须提供 title 与 render(container, ctx)。
 * 新增页面时必须同步更新 PAGES 列表（否则测试报警）。 */

const PAGES = ['home', 'today', 'memo', 'selfmedia', 'dev', 'consulting', 'reading', 'excerpts', 'news', 'design', 'game', 'settings'];

test('契约: 所有注册页面都有 title 与 render 函数', () => {
  const { window } = boot({});
  PAGES.forEach(key => {
    const page = window.Pages[key];
    assert.ok(page, '缺少页面: ' + key);
    assert.equal(typeof page.title, 'string', key + '.title 应为字符串');
    assert.ok(page.title.length > 0, key + '.title 非空');
    assert.equal(typeof page.render, 'function', key + '.render 应为函数');
  });
});

test('契约: 页面注册表无缺失无多余（与 NAV 一致）', () => {
  const { window } = boot({});
  const registered = Object.keys(window.Pages).sort();
  assert.deepEqual(registered, [...PAGES].sort(), 'Pages 注册表应与契约列表完全一致');
});

/* ================= store 方法契约 ================= */

const STORE_METHODS = [
  /* core */
  'save', 'clearAll', 'storageUsage', 'isNearQuota', 'summarize', 'buildWeeklyReport',
  'exportBackup', 'importBackup', 'migrateToIdb', 'loadIdb', 'needsUnlock', 'unlock', 'lock',
  'enableEncryption', 'disableEncryption', 'encryptionEnabled', 'encryptionMode',
  /* tasks 领域 */
  'addTask', 'updateTask', 'removeTask', 'reorderTask', 'addMemo', 'updateMemo', 'removeMemo',
  /* media 领域 */
  'addPost', 'updatePost', 'removePost',
  'addDevProject', 'updateDevProject', 'removeDevProject',
  'addDevTask', 'updateDevTask', 'removeDevTask',
  'addDevNote', 'updateDevNote', 'removeDevNote',
  'addDevSnippet', 'updateDevSnippet', 'removeDevSnippet',
  /* content 领域 */
  'addClient', 'updateClient', 'removeClient',
  'addClientProject', 'updateClientProject', 'removeClientProject',
  'addClientFollowup', 'updateClientFollowup', 'removeClientFollowup',
  'addClientIncome', 'updateClientIncome', 'removeClientIncome',
  'addBook', 'updateBook', 'removeBook', 'addReadingSession', 'addExcerpt', 'removeExcerpt',
  'addBookNote', 'removeBookNote',
  'addNews', 'updateNews', 'removeNews',
  'addDesign', 'updateDesign', 'removeDesign',
  'addGameRecord', 'clearGameRecords',
  /* settings 领域 */
  'setTheme', 'setWallpaperOpacity', 'getCustomWallpaper', 'setCustomWallpaper', 'clearCustomWallpaper',
  'setTaskReminder', 'setModuleEnabled', 'setGameDifficulty', 'setFrameRate'
];

test('契约: store 实例具备全部公开方法', () => {
  const { store } = boot({});
  STORE_METHODS.forEach(name => {
    assert.equal(typeof store[name], 'function', 'store.' + name + ' 应为函数（缺失或类型错误）');
  });
});

test('契约: store 方法全集与 globals.d.ts 声明一致（两边都要更新）', () => {
  const { store } = boot({});
  const dts = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js', 'globals.d.ts'), 'utf8');
  const block = dts.slice(dts.indexOf('interface SonderStoreImpl {'), dts.indexOf('interface SonderStoreFactory'));
  const declared = [...block.matchAll(/^  (\w+)\([^)]*\): /gm)].map(m => m[1]);
  assert.ok(declared.length >= 30, 'd.ts 应声明至少 30 个方法，当前 ' + declared.length);
  declared.forEach(name => {
    assert.equal(typeof store[name], 'function', 'globals.d.ts 声明了 store.' + name + '，但实例上不是函数');
  });
  const missing = STORE_METHODS.filter(name => declared.indexOf(name) < 0);
  assert.deepEqual(missing, [], '以下方法未在 globals.d.ts 声明: ' + missing.join(', '));
});

/* ================= 数据记录 schema 契约 ================= */

test('契约: 各领域创建方法返回的记录带必要字段', () => {
  const { store } = boot({});
  const t = store.addTask({ title: '契约任务', date: '2026-08-11' });
  assert.ok(t.id && t.title === '契约任务' && t.priority, 'addTask 记录应有 id/title/priority');
  const m = store.addMemo('契约备忘');
  assert.ok(m.id && m.text === '契约备忘' && !m.archived, 'addMemo 记录应有 id/text/archived');
  const p = store.addPost({ title: '契约内容' });
  assert.ok(p.id && p.status && Array.isArray(p.tags), 'addPost 记录应有 id/status/tags');
  const pr = store.addDevProject({ name: '契约项目' });
  assert.ok(pr.id && Array.isArray(pr.tasks), 'addDevProject 记录应有 id/tasks');
  const c = store.addClient({ name: '契约客户' });
  assert.ok(c.id && Array.isArray(c.projects) && Array.isArray(c.followups) && Array.isArray(c.income), 'addClient 记录应有 id/projects/followups/income');
  const b = store.addBook({ title: '契约书' });
  assert.ok(b.id && b.status && b.progress >= 0, 'addBook 记录应有 id/status/progress');
  const x = store.addDesign({ title: '契约设计' });
  assert.ok(x.id && x.type === 'idea', 'addDesign 记录应有 id/type');
  const r = store.addGameRecord({ kind: 'tictactoe', winner: 'X' });
  assert.equal(r.kind, 'tictactoe');
  assert.equal(r.mode, 'ai');
  assert.equal(r.player, 'player', 'pvp 以外的对局 player 默认 player');
  assert.ok(r.id && r.date && r.time, 'addGameRecord 记录应有 id/date/time');
});

test('契约: 单人游戏记录按 solo 模式保存', () => {
  const { store } = boot({});
  const r = store.addGameRecord({ kind: 'minesweeper', winner: 'player', difficulty: 'mid' });
  assert.equal(r.mode, 'solo');
  assert.equal(r.difficulty, 'mid', '单人游戏保留自身档位');
  assert.ok(r.note === null, '无 note 时为空');
  const r2 = store.addGameRecord({ kind: 'guessnum', winner: 'player', note: '答案 42' });
  assert.equal(r2.note, '答案 42', 'note 应原样保存');
});

test('契约: summarize 返回固定形状', () => {
  const { store } = boot({});
  const s = store.summarize();
  ['date', 'tasks', 'selfmedia', 'dev', 'consulting', 'reading', 'news', 'design', 'game'].forEach(k => {
    assert.ok(k in s, 'summarize 应含 ' + k);
  });
  assert.equal(typeof s.date, 'string');
  assert.ok('total' in s.tasks && 'doneToday' in s.tasks && 'remaining' in s.tasks, 'tasks 块应有 total/doneToday/remaining');
  assert.ok('total' in s.game && 'wins' in s.game && 'draws' in s.game, 'game 块应有 total/wins/draws');
});

test('契约: exportBackup 明文模式返回 JSON 字符串，importBackup 可回读', () => {
  const { store } = boot({});
  store.addTask({ title: '备份契约' });
  const out = store.exportBackup();
  assert.equal(typeof out, 'string', '明文导出应为同步字符串');
  const parsed = JSON.parse(out);
  assert.equal(typeof parsed.version, 'number', '导出含 version');
  const { store: s2 } = boot({});
  return s2.importBackup(out).then(res => {
    assert.equal(res.ok, true);
    assert.ok(s2.state.tasks.length >= 1, '导入后数据存在');
  });
});

/* ================= 领域扩展加载契约（Node 路径） ================= */

test('契约: Node require 路径也加载了全部领域扩展', () => {
  const S = require('../js/store.js');
  const api = S.createStore({ getItem: () => null, setItem: () => { }, removeItem: () => { } });
  ['addTask', 'addPost', 'addDevProject', 'addClient', 'addBook', 'addNews', 'addDesign', 'addGameRecord', 'setTheme'].forEach(name => {
    assert.equal(typeof api[name], 'function', 'Node 端缺少领域方法: ' + name);
  });
  const r = api.addGameRecord({ kind: 'idiom', winner: 'player' });
  assert.equal(r.mode, 'solo', 'Node 端领域方法行为一致');
});

test('契约: _h 白名单提供领域文件所需 helper', () => {
  const { window } = boot({});
  const h = window.SonderStore._h;
  assert.ok(h, 'SonderStore._h 应存在');
  ['uid', 'nowISO', 'todayStr', 'find', 'idxOf', 'deepClone', 'isPlainObject', 'normalizePriority', 'clampOpacity', 'num0'].forEach(k => {
    assert.ok(h[k], '_h 缺少 ' + k);
  });
});