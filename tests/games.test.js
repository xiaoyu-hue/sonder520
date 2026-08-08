'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

const wait = ms => new Promise(r => setTimeout(r, ms));

function navTexts(h) {
  return Array.from(h.window.document.querySelectorAll('#nav button')).map(b => b.textContent);
}
function cell(h, r, c) {
  return h.window.document.querySelector('.cell[data-r="' + r + '"][data-c="' + c + '"]');
}
function boardSize(h) {
  return h.window.document.querySelectorAll('#gBoard .cell').length;
}

test('游戏：侧边栏有娱乐游戏并可进入', () => {
  const h = boot();
  assert.ok(navTexts(h).some(t => t.includes('娱乐游戏')), '导航应有娱乐游戏');
  h.goto('game');
  const txt = h.window.document.body.textContent;
  assert.ok(txt.includes('井字棋') && txt.includes('五子棋'), '应显示两款游戏选择');
  assert.ok(txt.includes('暂无对局记录'), '应显示空战绩');
});

test('游戏：双人井字棋交替落子与悔棋', async () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="tictactoe"]').click();
  h.window.document.querySelector('[data-mode="pvp"]').click();
  assert.equal(boardSize(h), 9);
  cell(h, 0, 0).click();
  assert.equal(cell(h, 0, 0).textContent.trim(), '✕', 'X 先落子');
  cell(h, 0, 1).click();
  assert.equal(cell(h, 0, 1).textContent.trim(), '◯', 'O 后落子');
  assert.ok(h.window.document.querySelector('[data-act="undo"]'), '应有悔棋按钮');
  h.window.document.querySelector('[data-act="undo"]').click();
  assert.ok(h.window.document.querySelector('[data-act="yes"]'), '双人悔棋应弹出对方同意确认');
  assert.equal(cell(h, 0, 1).textContent.trim(), '◯', '未同意前棋子保留');
  h.window.document.querySelector('[data-act="yes"]').click();
  await wait(20);
  assert.equal(cell(h, 0, 1).textContent.trim(), '', '同意后 O 子消失');
  assert.ok(h.window.document.querySelector('[data-act="resign"]'), '应有认输按钮');
});

test('游戏：AI 对弈自动应手与悔棋回退两步', async () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="tictactoe"]').click();
  cell(h, 0, 0).click();
  assert.equal(cell(h, 0, 0).textContent.trim(), '✕');
  await wait(320);
  const filled = h.window.document.querySelectorAll('.cell .mk, .cell .stone').length;
  assert.equal(filled, 2, 'AI 应已应一手');
  h.window.document.querySelector('[data-act="undo"]').click();
  const left = h.window.document.querySelectorAll('.cell .mk, .cell .stone').length;
  assert.equal(left, 0, 'AI 模式悔棋应回退玩家与 AI 两步');
});

test('游戏：AI 对决获胜后写入战绩并可在首页统计', async () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="tictactoe"]').click();
  await wait(80);
  const snaps = h.window.__sonderHooks.store.state;
  assert.ok(Array.isArray(snaps.gameRecords));
  assert.equal(boardSize(h), 9);
});

test('游戏：认输产生记录并显示胜者', async () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="tictactoe"]').click();
  h.window.document.querySelector('[data-mode="pvp"]').click();
  cell(h, 0, 0).click();
  h.window.document.querySelector('[data-act="resign"]').click();
  await wait(20);
  h.window.document.querySelector('[data-act="yes"]').click();
  await wait(50);
  const recs = h.store.state.gameRecords;
  assert.equal(recs.length, 1);
  assert.equal(recs[0].kind, 'tictactoe');
  assert.equal(recs[0].mode, 'pvp');
  assert.equal(recs[0].winner, 'X', '轮到 O 时认输，应判 X 胜');
  assert.equal(recs[0].byResign, true);
  const txt = h.window.document.body.textContent;
  assert.ok(txt.includes('玩家1胜'), '战绩应有胜方标签');
});

test('游戏：所有操作事务化存储与统计数据一致', () => {
  const h = boot();
  const store = h.store;
  store.addGameRecord({ kind: 'gomoku', mode: 'ai', player: 'X', winner: 'X', byResign: false });
  store.addGameRecord({ kind: 'gomoku', mode: 'ai', player: 'X', winner: 'O', byResign: true });
  store.addGameRecord({ kind: 'tictactoe', mode: 'pvp', player: 'X', winner: 'draw', byResign: false });
  const s = store.summarize().game;
  assert.equal(s.total, 3);
  assert.equal(s.wins, 1);
  assert.equal(s.draws, 1);
  h.goto('home');
  const homeTxt = h.window.document.body.textContent;
  assert.ok(homeTxt.includes('娱乐游戏') && homeTxt.includes('胜 1 · 平 1'), '首页概览应显示游戏统计');
  h.goto('settings');
  assert.ok(h.window.document.body.textContent.includes('娱乐游戏'), '设置页统计应有娱乐游戏');
});

test('游戏：模块开关隐藏侧边栏入口', () => {
  const h = boot();
  assert.ok(navTexts(h).some(t => t.includes('娱乐游戏')));
  h.goto('settings');
  h.window.document.querySelector('[data-mod="game"]').click();
  h.goto('home');
  assert.ok(!navTexts(h).some(t => t.includes('娱乐游戏')), '关闭后应隐藏');
  h.goto('settings');
  h.window.document.querySelector('[data-mod="game"]').click();
  h.goto('home');
  assert.ok(navTexts(h).some(t => t.includes('娱乐游戏')), '重新开启应恢复');
});

test('游戏：旧数据兼容（无游戏字段时补默认）', () => {
  const h = boot({ seed: {
    version: 1, settings: {},
    tasks: [], memos: [], posts: [], devProjects: [], clients: [], books: [], news: [], designs: []
  } });
  assert.ok(Array.isArray(h.store.state.gameRecords), '应补空数组');
  assert.equal(h.store.state.settings.modules.game, true, '游戏模块默认开启');
});

test('游戏：五子棋棋盘渲染与落子', async () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="gomoku"]').click();
  assert.equal(boardSize(h), 225, '15×15 共 225 格');
  cell(h, 7, 7).click();
  assert.ok(h.window.document.querySelector('.cell[data-r="7"][data-c="7"] .stone.b'), '应先落黑子');
  await wait(500);
  const stones = h.window.document.querySelectorAll('.cell .stone').length;
  assert.equal(stones, 2, 'AI 应已应一手');
});

test('游戏：回上一页后重进保留进行中的对局', async () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="tictactoe"]').click();
  cell(h, 0, 0).click();
  await wait(200);
  h.goto('home');
  h.goto('game');
  assert.ok(h.window.document.querySelector('#gBoard'), '应保留对局界面');
  assert.equal(h.window.document.querySelectorAll('#gBoard .cell').length, 9);
});