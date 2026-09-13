'use strict';
/* GamesRepository 边界测试（v6.x 架构升级 · Repository 第六刀）
 * 验证：gameRecords/miniRecords 读写与旧 Store 行为完全一致
 * （kind/mode/difficulty 规范化、getMiniRecord 深拷贝、per-kind 合并），
 * 且 games-mini / games-battle 不再直连 Store。 */
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

function repoOf(h) {
  const Repo = h.window.SonderGamesRepository;
  assert.ok(Repo && Repo.createGamesRepository, '浏览器应暴露 SonderGamesRepository');
  return Repo.createGamesRepository(h.store);
}

test('GamesRepository：addRecord kind/mode/difficulty 规范化与旧 Store 一致', () => {
  const h = boot();
  const repo = repoOf(h);
  const direct = h.store.addGameRecord({ kind: 'gomoku', mode: 'ai', winner: 'X', difficulty: 'insane' });
  const via = repo.addRecord({ kind: 'unknown-game', mode: 'pvp', winner: 'draw' });

  assert.equal(direct.kind, 'gomoku');
  assert.equal(direct.difficulty, 'normal', 'AI 对局非法难度回落 normal');
  assert.equal(via.kind, 'tictactoe', '未知 kind 回落 tictactoe');
  assert.equal(via.mode, 'pvp', 'pvp 保留');
  assert.equal(via.winner, 'draw');
  assert.equal(via.byResign, false);
  assert.equal(repo.addRecord({ kind: 'idiom', mode: 'x', winner: 'player' }).mode, 'solo', '单人游戏 mode 规范化为 solo');
  assert.equal(h.store.state.gameRecords.length, 3);
});

test('GamesRepository：clearRecords 清空战绩', () => {
  const h = boot();
  const repo = repoOf(h);
  repo.addRecord({ kind: 'tictactoe', winner: 'X' });
  repo.clearRecords();
  assert.equal(h.store.state.gameRecords.length, 0);
});

test('GamesRepository：getMiniRecord 返回深拷贝（改返回对象不影响 state）', () => {
  const h = boot();
  const repo = repoOf(h);
  repo.updateMiniRecord('guessnum', { best: 5, wins: 2 });
  const o = repo.getMiniRecord('guessnum');
  o.best = 999;
  assert.equal(repo.getMiniRecord('guessnum').best, 5, '深拷贝：外部修改不落库');
  assert.deepEqual(repo.getMiniRecord('no-such-kind'), {}, '缺 kind 返回空对象');
});

test('GamesRepository：updateMiniRecord per-kind 合并（与旧 Store 一致）', () => {
  const h = boot();
  const repo = repoOf(h);
  repo.updateMiniRecord('minesweeper', { best: 30 });
  repo.updateMiniRecord('minesweeper', { wins: 1 });
  const o = repo.getMiniRecord('minesweeper');
  assert.equal(o.best, 30, '跨次更新保留既有字段');
  assert.equal(o.wins, 1);
});

/* Phase 4 续门禁：games 域不得回退直连 Store 战绩/纪录 */
test('GamesRepository：games-mini / games-battle 已迁移至边界', () => {
  const mini = fs.readFileSync(path.join(__dirname, '..', 'js', 'games-mini.js'), 'utf8');
  assert.ok(!/ctx\.store\.addGameRecord\(/.test(mini), 'games-mini 不应直连 addGameRecord');
  assert.ok(!/\.store\.(get|update)MiniRecord\(/.test(mini), 'games-mini 不应直连 miniRecords');
  const battle = fs.readFileSync(path.join(__dirname, '..', 'js', 'games-battle.js'), 'utf8');
  assert.ok(!/ctx\.store\.addGameRecord\(/.test(battle), 'games-battle 不应直连 addGameRecord');
});
