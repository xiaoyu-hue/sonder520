'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { boot } = require('./harness.js');

const root = path.join(__dirname, '..');
const S = require(path.join(root, 'js', 'store.js'));
const wait = ms => new Promise(r => setTimeout(r, ms));

function cell(h, r, c) {
  return h.window.document.querySelector('.cell[data-r="' + r + '"][data-c="' + c + '"]');
}

test('QA：今日计划刷新/保存不重复渲染且不崩溃', () => {
  const h = boot();
  h.goto('today');
  h.store.addTask({ title: '任务1', date: S.todayStr() });
  const doc = h.window.document;
  for (let i = 0; i < 3; i++) {
    assert.doesNotThrow(() => doc.querySelector('#tplRefresh').click(), '刷新应不抛异常');
  }
  assert.equal(doc.querySelectorAll('#content .hbar').length, 1, '重复点击不应堆叠工具栏');
  assert.equal(doc.querySelectorAll('#tplList .list-item').length, 1, '任务列表不应重复');
  assert.ok(doc.querySelector('.list-item[data-id="' + h.store.state.tasks[0].id + '"]'), '任务应存在');
});

test('今日计划：已完成任务仍可删除', () => {
  const h = boot();
  h.store.addTask({ title: '做完的事', done: true, date: '2026-08-09' });
  h.goto('today');
  const item = h.window.document.querySelector('.list-item[data-id="' + h.store.state.tasks[0].id + '"]');
  const del = item.querySelector('[data-act="del"]');
  assert.ok(del, '已完成任务应保留删除按钮');
  del.click();
  h.window.document.querySelector('[data-act="yes"]').click();
  return wait(20).then(function () {
    assert.equal(h.store.state.tasks.length, 0, '应已删除');
  });
});

test('QA：备忘保存/归档后页面不重复叠加', () => {
  const h = boot();
  h.goto('memo');
  h.store.addMemo('第一条');
  const doc = h.window.document;
  doc.querySelector('#memoAdd').click();
  const input = doc.querySelector('.modal textarea');
  input.value = '第二条';
  doc.querySelector('.modal [data-act="ok"]').click();
  assert.equal(doc.querySelectorAll('#content .hbar').length, 1, '保存后不应堆叠工具栏');
  const archiveBtn = doc.querySelector('[data-act="archive"]');
  assert.ok(archiveBtn, '应有归档按钮');
  archiveBtn.click();
  assert.equal(doc.querySelectorAll('#content .hbar').length, 1, '归档后不应堆叠');
  assert.equal(h.store.state.memos.filter(m => m.archived).length, 1, '应已归档');
});

test('QA：咨询收入行点击行体不误删，删除需确认', async () => {
  const h = boot();
  h.goto('consulting');
  h.store.addClient({ name: '客户A' });
  h.store.addClientIncome(h.store.state.clients[0].id, { amount: 100, note: '第一笔' });
  h.goto('consulting');
  const doc = h.window.document;
  doc.querySelector('[data-cx]').click();
  const rows = doc.querySelectorAll('[data-call] .cs-item');
  const row = rows[rows.length - 1];
  assert.equal(row.querySelector('.title').textContent, '¥100', '应为收入行');
  row.querySelector('.grow').click();
  assert.equal(h.store.state.clients[0].income.length, 1, '点击行体不应删除收入');
  const delBtn = row.querySelector('[data-idel]');
  assert.ok(delBtn, '收入行应有独立删除按钮');
  delBtn.click();
  const yes = doc.querySelector('[data-act="yes"]');
  assert.ok(yes, '删除收入应弹确认框');
  yes.click();
  return wait(20).then(function () {
    assert.equal(h.store.state.clients[0].income.length, 0, '确认后应删除');
  });
});

test('QA：确认框 Esc/点背景关闭会回执 false（不挂死）', async () => {
  const h = boot();
  const doc = h.window.document;
  let resolved = false;
  h.window.UI.confirmBox('测试').then(ok => { resolved = true; assert.equal(ok, false, 'Esc 应回 false'); });
  doc.body.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(10);
  assert.equal(resolved, true, 'Esc 关闭确认框后 Promise 应被 resolve');

  let resolved2 = false;
  h.window.UI.confirmBox('测试2').then(ok => { resolved2 = true; assert.equal(ok, false, '背景点击应回 false'); });
  const ov = doc.querySelector('.overlay');
  ov.dispatchEvent(new h.window.MouseEvent('mousedown', { bubbles: true }));
  await wait(10);
  assert.equal(resolved2, true, '背景点击关闭后 Promise 应被 resolve');
  assert.equal(doc.querySelectorAll('.overlay').length, 0, '弹窗应已关闭');
});

test('QA：游戏中快速切换模式，对局状态保持合法（不重复落子）', async () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('game');
  doc.querySelector('[data-pick="tictactoe"]').click();
  const firstSel = doc.querySelector('#gFirst');
  firstSel.value = 'O';
  firstSel.dispatchEvent(new h.window.Event('change', { bubbles: true }));
  await wait(400);
  assert.equal(doc.querySelectorAll('#gBoard .mk.x').length, 1, 'AI 应已先手落子');
  cell(h, 1, 1).click();
  doc.querySelector('[data-mode="pvp"]').click();
  doc.querySelector('[data-act="yes"]').click();
  await wait(30);
  doc.querySelector('[data-mode="ai"]').click();
  await wait(500);
  const dbg = h.window.__gamesDbg();
  assert.equal(dbg.mode, 'ai', '应回到 AI 模式');
  assert.equal(dbg.game.moves, 1, '新局应只有 AI 一手');
  assert.equal(dbg.game.turn, 'O', 'AI 落子后应轮到玩家');
  assert.equal(doc.querySelectorAll('#gBoard .mk.x').length, 1, '旧 AI 定时器不应在新局叠加落子');
  assert.equal(doc.querySelectorAll('#gBoard .mk.o').length, 0, '玩家不应被 AI 抢占落子');
});

test('QA：标签选项已转义（防属性注入）', () => {
  const h = boot();
  const bad = '"><img src=x>';
  h.store.addNews({ title: '注入测试', tags: [bad], status: 'unread' });
  h.store.addPost({ title: '注入测试2', tags: [bad], status: 'draft' });
  h.goto('news');
  const opts = h.window.document.querySelectorAll('#nwTag option');
  assert.ok(opts.length >= 2, '标签选项应存在');
  assert.equal(h.window.document.querySelectorAll('#nwTag option img').length, 0, '不应有注入元素');
  assert.equal(opts[1].value, bad, '选项值应保持原义');
  h.goto('selfmedia');
  const opts2 = h.window.document.querySelectorAll('#smTag option');
  assert.equal(h.window.document.querySelectorAll('#smTag img').length, 0, '选项目标签不应注入');
  assert.equal(opts2[1].value, bad);
});

test('QA：棋盘格子在不支持 aspect-ratio 的旧浏览器有最小高度回退', () => {
  const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
  const block = css.slice(css.indexOf('.cell {'), css.indexOf('.cell:hover'));
  assert.ok(block.includes('aspect-ratio: 1/1'), '应有 aspect-ratio');
  assert.ok(block.includes('min-height'), '应有高度回退');
});

test('QA：每日金句按日期稳定、当天唯一、次日刷新', () => {
  const Q = require(path.join(root, 'js', 'quotes.js'));
  assert.ok(Q.quotes.length >= 30, '金句库应不小于 30 条');
  const a = Q.quoteOfDay('2026-08-09');
  assert.ok(Q.quotes.includes(a), '金句应来自库内');
  assert.equal(Q.quoteOfDay('2026-08-09'), a, '同一天应稳定不变');
  assert.equal(Q.quoteOfDay('2026-08-09'), Q.quoteOfDay('2026-08-09'), '幂等');
  assert.ok(Q.quoteOfDay('2026-08-10') !== undefined, '次日应有金句');
});

test('QA：首页问候语下方显示当日金句', () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('home');
  const quote = doc.querySelector('.quote');
  assert.ok(quote, '首页应有金句元素');
  const text = quote.textContent.trim();
  assert.ok(/「.+」/.test(text), '金句应为引号包裹的非空内容: ' + text);
  assert.ok(h.window.SonderQuotes.quotes.includes(text.replace(/「|」/g, '')), '内容应来自金句库');
  const t1 = doc.querySelector('.quote').textContent;
  h.goto('today');
  h.goto('home');
  assert.equal(doc.querySelector('.quote').textContent, t1, '同日刷新应保持同一句');
});

test('QA：对局结束后不能悔棋', async () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('game');
  doc.querySelector('[data-pick="tictactoe"]').click();
  doc.querySelector('[data-mode="pvp"]').click();
  cell(h, 0, 0).click(); cell(h, 1, 0).click();
  cell(h, 0, 1).click(); cell(h, 1, 1).click();
  cell(h, 0, 2).click();
  await wait(20);
  const dbg = h.window.__gamesDbg();
  assert.equal(dbg.game.over, true, '应先分出胜负');
  const movesBefore = dbg.game.moves;
  doc.querySelector('[data-act="undo"]').click();
  await wait(20);
  assert.equal(doc.querySelector('[data-act="yes"]'), null, '终局后不应弹悔棋确认');
  const after = h.window.__gamesDbg();
  assert.equal(after.game.over, true, '终局状态不应被撤销');
  assert.equal(after.game.moves, movesBefore, '终局后悔棋应无效果');
});

test('QA：双人悔棋文案由刚落子方发起，双方均可反复请求', async () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('game');
  doc.querySelector('[data-pick="tictactoe"]').click();
  doc.querySelector('[data-mode="pvp"]').click();
  cell(h, 0, 0).click(); // 玩家1 X
  cell(h, 1, 0).click(); // 玩家2 O
  doc.querySelector('[data-act="undo"]').click();
  const body = doc.querySelector('.modal .body').textContent;
  assert.ok(body.includes('玩家2'), '应由刚落子的玩家2 发起悔棋: ' + body);
  assert.ok(body.includes('玩家1'), '应向玩家1 征求同意: ' + body);
  doc.querySelector('[data-act="no"]').click();
  await wait(20);
  assert.equal(doc.querySelectorAll('#gBoard .mk').length, 2, '拒绝后保留棋子');
  cell(h, 1, 1).click(); // X
  doc.querySelector('[data-act="undo"]').click();
  const body2 = doc.querySelector('.modal .body').textContent;
  assert.ok(body2.includes('玩家1'), '本轮应轮到玩家1 发起悔棋: ' + body2);
  doc.querySelector('[data-act="yes"]').click();
  await wait(20);
  assert.equal(doc.querySelectorAll('#gBoard .mk').length, 2, '同意后撤销最后一步');
});

test('QA：执后手新开局 AI 先手落一子，棋盘其余为空；切换模式必清盘', async () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('game');
  doc.querySelector('[data-pick="gomoku"]').click();
  const first = doc.querySelector('#gFirst');
  assert.ok(first, '执后手选择器应存在');
  first.value = 'O';
  first.dispatchEvent(new h.window.Event('change', { bubbles: true }));
  await wait(500);
  let dbg = h.window.__gamesDbg();
  assert.equal(dbg.playerStone, 'O', '已切为执后手');
  assert.equal(dbg.game.moves, 1, 'AI 执先应已落一子');
  assert.equal(dbg.game.turn, 'O', '应轮到玩家');
  assert.equal(doc.querySelectorAll('#gBoard .stone').length, 1, '盘上仅 AI 一颗子，其余为空');

  doc.querySelector('[data-act="new"]').click();
  doc.querySelector('[data-act="yes"]').click();
  await wait(600);
  dbg = h.window.__gamesDbg();
  assert.equal(dbg.game.kind, 'gomoku', '新局仍是五子棋');
  assert.equal(dbg.game.over, false);

  doc.querySelector('[data-mode="pvp"]').click();
  doc.querySelector('[data-act="yes"]').click();
  await wait(50);
  dbg = h.window.__gamesDbg();
  assert.equal(dbg.mode, 'pvp', '应已切换为双人模式');
  assert.equal(dbg.game.moves, 0, '切换后应为空盘');
  doc.querySelector('[data-mode="ai"]').click();
  await wait(500);
  dbg = h.window.__gamesDbg();
  assert.equal(dbg.mode, 'ai', '应已切回 AI 模式');
  assert.equal(dbg.game.over, false);
  assert.equal(dbg.game.moves, 1, 'AI 模式新盘只有 AI 先手一子');
});

test('QA：连点新开局/悔棋不会叠出多个确认框', async () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('game');
  doc.querySelector('[data-pick="tictactoe"]').click();
  doc.querySelector('[data-mode="pvp"]').click();
  cell(h, 0, 0).click(); cell(h, 1, 0).click();
  const newBtn = doc.querySelector('[data-act="new"]');
  newBtn.click(); newBtn.click(); newBtn.click();
  await wait(20);
  assert.ok(doc.querySelectorAll('.overlay').length <= 1, '连点新开局只应弹一个确认框');
  doc.querySelector('.overlay [data-act="yes"]').click();
  await wait(20);
  const dbg = h.window.__gamesDbg();
  assert.equal(dbg.game.over, false);
  assert.equal(dbg.game.moves, 0, '确认后新局应为空盘');
  assert.equal(doc.querySelectorAll('.overlay').length, 0, '不应有残留弹窗');
  cell(h, 0, 0).click();
  const undoBtn = doc.querySelector('[data-act="undo"]');
  undoBtn.click(); undoBtn.click();
  await wait(20);
  assert.ok(doc.querySelectorAll('.overlay').length <= 1, '连点悔棋只应有一个确认框');
  doc.querySelector('.overlay [data-act="yes"]').click();
  await wait(20);
  assert.equal(doc.querySelectorAll('.overlay').length, 0, '确认后弹窗应全部关闭');
});

test('QA：AI 思考中悔棋会取消待落子并撤回一回合', async () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('game');
  doc.querySelector('[data-pick="tictactoe"]').click();
  cell(h, 0, 0).click();
  doc.querySelector('[data-act="undo"]').click();
  await wait(400);
  const dbg = h.window.__gamesDbg();
  assert.equal(dbg.busy, false);
  assert.equal(dbg.game.over, false);
  assert.equal(dbg.game.moves, 0, '思考中悔棋应撤回己方与 AI 两步');
  assert.equal(doc.querySelectorAll('#gBoard .mk').length, 0, 'AI 待落子应被取消，不再自动落子');
});

test('QA：AI 模式可连续悔棋多回合', async () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('game');
  doc.querySelector('[data-pick="tictactoe"]').click();
  cell(h, 0, 0).click();
  await wait(320);
  cell(h, 0, 1).click();
  await wait(320);
  doc.querySelector('[data-act="undo"]').click();
  await wait(20);
  assert.equal(h.window.__gamesDbg().game.moves, 2, '第一次悔棋回到上一个思考点');
  doc.querySelector('[data-act="undo"]').click();
  await wait(20);
  assert.equal(h.window.__gamesDbg().game.moves, 0, '可连续悔棋直到空盘');
});

test('QA：双人悔棋需对方同意，拒绝不撤销', async () => {  const h = boot();
  const doc = h.window.document;
  h.goto('game');
  doc.querySelector('[data-pick="tictactoe"]').click();
  doc.querySelector('[data-mode="pvp"]').click();
  cell(h, 0, 0).click();
  cell(h, 0, 1).click();
  doc.querySelector('[data-act="undo"]').click();
  const no = doc.querySelector('[data-act="no"]');
  assert.ok(no, '应弹出对方同意确认框');
  no.click();
  await wait(20);
  assert.equal(doc.querySelectorAll('#gBoard .mk').length, 2, '对方拒绝后棋子保留');
  doc.querySelector('[data-act="undo"]').click();
  const yes = doc.querySelector('[data-act="yes"]');
  assert.ok(yes, '应再次弹出确认');
  yes.click();
  await wait(20);
  assert.equal(doc.querySelectorAll('#gBoard .mk').length, 1, '对方同意后撤销一步');
});

test('QA：AI 思考期间切页不劫持当前页面，切回后自动续走', async () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('game');
  doc.querySelector('[data-pick="tictactoe"]').click();
  cell(h, 0, 0).click(); /* 玩家落子，AI 220ms 后思考 */
  h.goto('home'); /* 立即切页 */
  await wait(350); /* 越过 AI 延时窗口 */
  assert.ok(!doc.querySelector('#gStatus'), '切走的页面不得出现游戏棋盘（未被劫持）');
  assert.ok(doc.querySelector('#quickMemo') || doc.body.textContent.includes('今日'), 'home 内容保持');
  h.goto('game'); /* 切回 */
  await wait(400);
  assert.equal(doc.querySelectorAll('#gBoard .mk').length, 2, 'AI 应自动续走完成一回合');
  assert.equal(h.window.__gamesDbg().busy, false, 'AI 思考状态复位');
});