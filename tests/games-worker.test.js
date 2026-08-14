'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { boot } = require('./harness.js');
const LG = require('../js/games-logic.js');

const root = path.join(__dirname, '..');
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 沙箱：按 Worker 语义执行 game-worker.js ---------- */
function loadWorkerSandbox() {
  const posts = [];
  const ctx = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    postMessage: m => posts.push(m),
    importScripts: () => { /* games-logic 已预置 */ }
  });
  ctx.self = ctx;
  ctx.addEventListener = function (type, fn) { if (type === 'message') ctx.__msg = fn; };
  vm.runInContext(fs.readFileSync(path.join(root, 'js/games-logic.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/game-worker.js'), 'utf8'), ctx);
  return { ctx, posts, fire: d => ctx.__msg({ data: d }) };
}

test('worker：空盘五子棋返回中心位（id 回执）', () => {
  const s = loadWorkerSandbox();
  const g = LG.createGame('gomoku');
  s.fire({ id: 1, game: g, stone: 'O', diff: 'normal' });
  assert.equal(s.posts.length, 1);
  assert.deepEqual(s.posts[0], { id: 1, mv: { r: 7, c: 7 } });
});

test('worker：对手两连时优先补防', () => {
  const s = loadWorkerSandbox();
  const g = LG.createGame('gomoku');
  LG.place(g, 7, 7);      /* X */
  LG.place(g, 10, 10);    /* O */
  LG.place(g, 7, 8);      /* X → 轮到 O，X 有 (7,7)(7,8) 连二 */
  s.fire({ id: 2, game: g, stone: 'O', diff: 'normal' });
  assert.equal(s.posts.length, 1);
  const mv = s.posts[0].mv;
  assert.ok(
    (mv.r === 7 && mv.c === 6) || (mv.r === 7 && mv.c === 9),
    '应堵在连二端点，实际 ' + JSON.stringify(mv)
  );
});

test('worker：己方四连差一时优先补五获胜（胜于堵截对手）', () => {
  const s = loadWorkerSandbox();
  const g = LG.createGame('gomoku');
  LG.place(g, 0, 0);    /* X */
  LG.place(g, 7, 7);    /* O */
  LG.place(g, 0, 1);    /* X */
  LG.place(g, 8, 8);    /* O */
  LG.place(g, 0, 2);    /* X */
  LG.place(g, 9, 9);    /* O */
  LG.place(g, 0, 3);    /* X */
  LG.place(g, 10, 10);  /* O */
  LG.place(g, 1, 0);    /* X：自身也有 (0,0)(0,1)(0,2)(0,3) 四连威胁，但轮到 O */
  s.fire({ id: 3, game: g, stone: 'O', diff: 'normal' });
  assert.equal(s.posts.length, 1);
  const mv = s.posts[0].mv;
  assert.ok(
    (mv.r === 6 && mv.c === 6) || (mv.r === 11 && mv.c === 11),
    '应补己方斜四连成五，实际 ' + JSON.stringify(mv)
  );
});

test('worker：非法请求一律回 error 且不崩溃', () => {
  const s = loadWorkerSandbox();
  s.fire({ id: 4, game: { kind: 'tictactoe', size: 3, board: [[null, null, null], [null, null, null], [null, null, null]], turn: 'X', moves: [] }, stone: 'X' });
  assert.equal(s.posts[s.posts.length - 1].error, 'bad-request', '非五子棋应拒绝');
  s.fire({ id: 5, game: null, stone: 'O' });
  assert.equal(s.posts[s.posts.length - 1].error, 'bad-request', '缺 game 应拒绝');
  s.fire({});
  assert.equal(s.posts[s.posts.length - 1].id, -1, '缺 id 回执 -1');
});

/* ---------- games.js 集成：假 Worker ---------- */
class FakeWorker {
  constructor(url) {
    FakeWorker.last = this;
    this.url = url;
    this.sent = [];
  }
  postMessage(d) { this.sent.push(d); }
  fire(d) { if (this.onmessage) this.onmessage({ data: d }); }
  fail() { if (this.onerror) this.onerror(new Error('worker boom')); }
}

function gomokuStone(h) {
  return h.window.document.querySelectorAll('.cell .stone.w').length;
}
function cell(h, r, c) {
  return h.window.document.querySelector('.cell[data-r="' + r + '"][data-c="' + c + '"]');
}

test('游戏：五子棋 AI 应手改走 Worker（五子棋专用，井字棋不受影响）', async () => {
  const h = boot();
  h.window.Worker = FakeWorker;
  h.goto('game');
  h.window.document.querySelector('[data-pick="gomoku"]').click();
  cell(h, 7, 7).click();            /* 玩家落子后才触发 AI 思考 → Worker 懒创建 */
  const w = FakeWorker.last;
  assert.ok(w && w.url === 'js/game-worker.js', '应创建 js/game-worker.js Worker');
  assert.equal(w.sent.length, 1, '玩家落子后应投递一次 AI 计算');
  const req = w.sent[0];
  assert.ok(req.id >= 1, '请求应带递增序号 id，实际 ' + req.id);
  assert.equal(req.game.kind, 'gomoku');
  assert.equal(req.stone, 'O');
  assert.equal(req.diff, 'normal');
  w.fire({ id: req.id, mv: { r: 8, c: 8 } });
  await wait(30);
  assert.ok(cell(h, 8, 8).querySelector('.stone.w'), 'worker 回复后应落白子');
  assert.equal(gomokuStone(h), 1);
});

test('游戏：过期 worker 回复被丢弃（AI 思考中悔棋再落子）', async () => {
  const h = boot();
  h.window.Worker = FakeWorker;
  h.goto('game');
  h.window.document.querySelector('[data-pick="gomoku"]').click();
  cell(h, 7, 7).click();            /* X → AI 思考中 */
  const w = FakeWorker.last;
  const firstId = w.sent[0].id;
  h.window.document.querySelector('[data-act="undo"]').click();  /* 悔棋：作废在途计算 */
  assert.equal(w.sent.length, 1, '悔棋本身不产生新请求（turn 回到玩家）');
  w.fire({ id: firstId, mv: { r: 1, c: 1 } });  /* 过期回复 */
  await wait(30);
  assert.equal(gomokuStone(h), 0, '过期回复不得落子');
  assert.ok(!cell(h, 1, 1).querySelector('.stone'), '(1,1) 应为空');
  cell(h, 7, 7).click();            /* 玩家重落 → 新一轮 AI */
  assert.equal(w.sent.length, 2);
  const secondId = w.sent[1].id;
  assert.ok(secondId > firstId, '新一轮请求序号应递增');
  w.fire({ id: firstId, mv: { r: 2, c: 2 } });  /* 上一轮旧回复，仍应丢弃 */
  await wait(30);
  assert.equal(gomokuStone(h), 0, '旧轮回复不得落子');
  w.fire({ id: secondId, mv: { r: 8, c: 8 } });
  await wait(30);
  assert.ok(cell(h, 8, 8).querySelector('.stone.w'), '当前轮回复正常落子');
});

test('游戏：worker 出错时同步兜底，对局不卡死', async () => {
  const h = boot();
  h.window.Worker = FakeWorker;
  h.goto('game');
  h.window.document.querySelector('[data-pick="gomoku"]').click();
  cell(h, 7, 7).click();
  const w = FakeWorker.last;
  assert.equal(w.sent.length, 1);
  w.fail();                          /* worker 异常 → 回退同步计算 */
  const t0 = Date.now();
  while (Date.now() - t0 < 2000 && gomokuStone(h) === 0) await wait(25);
  assert.equal(gomokuStone(h), 1, '同步兜底应完成 AI 落子');
  assert.equal(h.window.__gamesDbg().worker, false, 'worker 应标记为不可用');
});

test('游戏：无 Worker 环境五子棋 AI 走同步路径（回归）', async () => {
  const h = boot();                 /* jsdom 默认无 Worker */
  h.goto('game');
  h.window.document.querySelector('[data-pick="gomoku"]').click();
  cell(h, 7, 7).click();
  const t0 = Date.now();
  while (Date.now() - t0 < 3000 && gomokuStone(h) === 0) await wait(25);
  assert.equal(gomokuStone(h), 1, '无 Worker 时 AI 应同步应手');
  assert.equal(h.window.__gamesDbg().worker, false);
});

test('游戏：worker 永不回复时超时同步兜底，对局不锁死', async () => {
  const h = boot();
  h.window.Worker = FakeWorker;
  h.goto('game');
  h.window.document.querySelector('[data-pick="gomoku"]').click();
  cell(h, 7, 7).click();            /* X → AI 思考中，worker 被创建但永不回复 */
  const w = FakeWorker.last;
  assert.equal(w.sent.length, 1, '应投递一次 AI 计算');
  const t0 = Date.now();
  while (Date.now() - t0 < 6000 && gomokuStone(h) === 0) await wait(50);
  assert.equal(gomokuStone(h), 1, 'worker 挂起应超时同步兜底落子');
  assert.equal(h.window.__gamesDbg().busy, false, '超时后 busy 必须复位，棋盘可继续操作');
  assert.equal(h.window.__gamesDbg().worker, true, '单次超时不应禁用 worker（下次仍尝试 worker）');
});

test('游戏：worker 超时兜底落子后，迟到回复被守卫丢弃', async () => {
  const h = boot();
  h.window.Worker = FakeWorker;
  h.goto('game');
  h.window.document.querySelector('[data-pick="gomoku"]').click();
  cell(h, 7, 7).click();
  const w = FakeWorker.last;
  const id = w.sent[0].id;
  const t0 = Date.now();
  while (Date.now() - t0 < 6000 && gomokuStone(h) === 0) await wait(50);
  assert.equal(gomokuStone(h), 1, '超时兜底应已完成落子');
  w.fire({ id: id, mv: { r: 1, c: 1 } });   /* 迟到的原回复 */
  await wait(50);
  assert.equal(gomokuStone(h), 1, '迟到回复不得再落子');
  assert.ok(!cell(h, 1, 1).querySelector('.stone'), '(1,1) 应仍为空');
});
