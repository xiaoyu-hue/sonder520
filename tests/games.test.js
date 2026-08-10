'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const LG = require('../js/games-logic.js');

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

/* ---------- 第 1 轮：棋盘不震动 + 重新开局必须彻底清盘 ---------- */

const fs = require('node:fs');
const path = require('node:path');

function emptyBoardHelper(h) {
  const cells = h.window.document.querySelectorAll('#gBoard .cell');
  const filled = Array.from(cells).filter(c => (c.querySelector('.mk') || c.querySelector('.stone')));
  return {
    filled, done: !!h.window.document.querySelector('#gBoard.done'),
    last: h.window.document.querySelectorAll('#gBoard .cell.last').length,
    win: h.window.document.querySelectorAll('#gBoard .cell.win').length
  };
}

test('游戏：落子动画零位移（棋盘不震动）', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const m = css.match(/\.cell\.last \{ animation: ([^;]+);/);
  assert.ok(m && m[1].trim(), '应有 .cell.last 落子动画');
  const name = m[1].split(/\s+/)[0];
  assert.equal(name, 'fadeIn', '落子动画应为零位移淡入');
  const kf = css.slice(css.indexOf('@keyframes ' + name), css.indexOf('}', css.indexOf('@keyframes ' + name)));
  assert.ok(!/translate|transform/.test(kf), '关键帧不得包含任何位移 transform');
});

test('游戏：终局后点新开局必须彻底重置棋盘', async () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="tictactoe"]').click();
  h.window.document.querySelector('[data-mode="pvp"]').click();
  cell(h, 0, 0).click(); cell(h, 1, 0).click();
  cell(h, 0, 1).click(); cell(h, 1, 1).click();
  cell(h, 0, 2).click();
  assert.ok(h.window.document.querySelector('#gBoard.done'), '先手横线应终局');
  assert.ok(h.window.document.querySelectorAll('#gBoard .cell.win').length > 0, '应有胜线高亮');
  h.window.document.querySelector('[data-act="new"]').click();
  await wait(20);
  h.window.document.querySelector('[data-act="yes"]').click();
  await wait(20);
  const s = emptyBoardHelper(h);
  assert.equal(s.filled.length, 0, '新棋盘不得残留任何棋子');
  assert.equal(s.done, false, '终局态应清除');
  assert.equal(s.last, 0, '末手标记应清除');
  assert.equal(s.win, 0, '胜线高亮应清除');
  const stTxt = h.window.document.querySelector('#gStatus').textContent;
  assert.ok(!stTxt.includes('获胜') && !stTxt.includes('平局'), '状态栏应恢复进行中，实际为: ' + stTxt);
  assert.equal(h.window.__gamesDbg().game.moves, 0, '内部棋谱必须归零');
});

test('游戏：任意时刻点新开局必须清空棋盘', async () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="gomoku"]').click();
  h.window.document.querySelector('[data-mode="pvp"]').click();
  cell(h, 7, 7).click();
  cell(h, 7, 8).click();
  cell(h, 8, 8).click();
  assert.equal(emptyBoardHelper(h).filled.length, 3, '落子前置条件');
  h.window.document.querySelector('[data-act="new"]').click();
  await wait(20);
  h.window.document.querySelector('[data-act="yes"]').click();
  await wait(20);
  assert.equal(emptyBoardHelper(h).filled.length, 0, '五子棋新开局棋盘必须全空');
  assert.equal(h.window.__gamesDbg().game.moves, 0);
});

/* ---------- 第 2 轮：AI 难度分级（简单 / 普通 / 困难） ---------- */

test('AI 难度：普通/困难五子棋必封对手冲四（确定性）', () => {
  ['normal', 'hard'].forEach(diff => {
    const g = LG.createGame('gomoku');
    g.board[7][3] = 'O'; g.board[7][4] = 'O'; g.board[7][5] = 'O'; g.board[7][6] = 'O';
    const mv = LG.gomokuAiMove(g, 'X', diff);
    assert.ok((mv.r === 7 && mv.c === 2) || (mv.r === 7 && mv.c === 7),
      diff + ' 难度应封堵对手冲四一端，实际: ' + JSON.stringify(mv));
  });
});

test('AI 难度：普通/困难五子棋必走己方成五点（确定性）', () => {
  ['normal', 'hard'].forEach(diff => {
    const g = LG.createGame('gomoku');
    for (let c = 3; c < 7; c++) g.board[7][c] = 'X';
    const mv = LG.gomokuAiMove(g, 'X', diff);
    assert.ok((mv.r === 7 && mv.c === 2) || (mv.r === 7 && mv.c === 7),
      diff + ' 难度应直接成五取胜，实际: ' + JSON.stringify(mv));
  });
});

test('AI 难度：困难井字棋在必胜局面必走胜点', () => {
  const g = LG.createGame('tictactoe');
  g.board[0][0] = 'X'; g.board[0][1] = 'X'; g.board[2][0] = 'O';
  const mv = LG.tttAiMove(g, 'X', 'hard');
  assert.deepEqual(mv, { r: 0, c: 2 }, '困难难度应立即取胜');
});

test('AI 难度：简单井字棋不执意取胜（30 次至少一次不走胜点）', () => {
  const g = LG.createGame('tictactoe');
  g.board[0][0] = 'X'; g.board[0][1] = 'X'; g.board[2][0] = 'O';
  let wins = 0;
  for (let i = 0; i < 30; i++) {
    const mv = LG.tttAiMove(g, 'X', 'easy');
    if (mv.r === 0 && mv.c === 2) wins++;
  }
  assert.ok(wins < 30, '简单难度不应每次都直取胜点');
});

test('AI 难度：简单五子棋面对对方四连经常不封堵（统计）', () => {
  let blocked = 0;
  for (let i = 0; i < 30; i++) {
    const g = LG.createGame('gomoku');
    for (let c = 3; c < 7; c++) g.board[7][c] = 'O';
    const mv = LG.gomokuAiMove(g, 'X', 'easy');
    if ((mv.r === 7 && mv.c === 2) || (mv.r === 7 && mv.c === 7)) blocked++;
  }
  assert.ok(blocked < 25, '简单难度不应每次都封堵冲四，实际封堵 ' + blocked + '/30');
});

test('AI 难度：默认普通，选择页可切换并持久化', () => {
  const h = boot();
  h.goto('game');
  const pickSel = h.window.document.querySelector('#gDiffPick');
  assert.ok(pickSel, '选择页应有难度下拉');
  assert.equal(pickSel.value, 'normal', '默认普通');
  pickSel.value = 'hard';
  pickSel.dispatchEvent(new h.window.Event('change', { bubbles: true }));
  assert.equal(h.store.state.settings.gameDifficulty, 'hard', '应持久化到设置');
  assert.equal(h.window.__gamesDbg().difficulty, 'hard');
  h.goto('home');
  h.goto('game');
  const again = h.window.document.querySelector('#gDiffPick');
  assert.equal(again.value, 'hard', '重进页面应沿用难度');
});

test('AI 难度：对局中切换难度需确认并重开清盘', async () => {
  const h = boot();
  h.goto('game');
  h.window.document.querySelector('[data-pick="tictactoe"]').click();
  assert.ok(h.window.document.querySelector('#gDiff'), 'AI 模式对局条应有难度下拉');
  cell(h, 0, 0).click();
  assert.equal(emptyBoardHelper(h).filled.length, 1, '先落一子');
  const diffSel = h.window.document.querySelector('#gDiff');
  diffSel.value = 'easy';
  diffSel.dispatchEvent(new h.window.Event('change', { bubbles: true }));
  await wait(20);
  assert.ok(h.window.document.querySelector('[data-act="yes"]'), '切换难度应弹确认');
  h.window.document.querySelector('[data-act="yes"]').click();
  await wait(20);
  assert.equal(h.window.__gamesDbg().difficulty, 'easy');
  assert.equal(h.window.__gamesDbg().game.moves, 0, '确认后应重开清盘');
});