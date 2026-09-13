'use strict';
/* BookRepository 边界测试（v6.x 架构升级 · Repository 第二刀）
 * 验证：books/notes/excerpts/sessions 读写与旧 Store 行为完全一致（含进度钳制、
 * finishedAt 联动、undo、空文本拒绝），且 reading.js 不再直连 Store 子操作。 */
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

function repoOf(h) {
  const Repo = h.window.SonderBookRepository;
  assert.ok(Repo && Repo.createBookRepository, '浏览器应暴露 SonderBookRepository');
  return Repo.createBookRepository(h.store);
}

test('BookRepository：create/get/getAll，进度钳制与已读完联动与旧 Store 一致', () => {
  const h = boot();
  const repo = repoOf(h);
  const direct = h.store.addBook({ title: '直接', progress: 150 }); /* 超界钳制 */
  const via = repo.create({ title: '仓库', progress: -5 });

  assert.equal(direct.progress, 100, '直接 create 超界钳制到 100');
  assert.equal(via.progress, 0, '仓库 create 负值钳制到 0');
  assert.equal(repo.get(via.id).title, '仓库');
  assert.equal(repo.getAll().length, 2);

  const done = repo.create({ title: '读完', status: '已读完' });
  assert.ok(typeof done.finishedAt === 'string' && done.finishedAt.length > 0, '已读完应自动记录完成日期');
});

test('BookRepository：update 状态/进度联动与旧 Store 一致', () => {
  const h = boot();
  const repo = repoOf(h);
  const b = repo.create({ title: '改我', status: '想读', progress: 10 });

  repo.update(b.id, { status: '已读完' });
  assert.equal(repo.get(b.id).status, '已读完');
  assert.ok(repo.get(b.id).finishedAt, '标记已读完应写 finishedAt');

  repo.update(b.id, { progress: 200 });
  assert.equal(repo.get(b.id).progress, 100, 'progress 钳制到 100');

  repo.update(b.id, { status: '在读' });
  assert.equal(repo.get(b.id).finishedAt, null, '改回其他状态应清除 finishedAt');

  assert.equal(repo.update('no-such-id', { title: 'x' }), null);
});

test('BookRepository：remove 与 undo 恢复（books）', () => {
  const h = boot();
  const repo = repoOf(h);
  const b = repo.create({ title: '待删' });
  repo.remove(b.id);
  assert.equal(repo.get(b.id), null);
  h.store.undoRemove();
  assert.equal(repo.get(b.id).title, '待删');
});

test('BookRepository：addNote/removeNote 与 undo 恢复（嵌套笔记）', () => {
  const h = boot();
  const repo = repoOf(h);
  const b = repo.create({ title: '有笔记' });
  const n = repo.addNote(b.id, '第一条笔记');
  assert.equal(repo.get(b.id).notes.length, 1);
  assert.equal(repo.get(b.id).notes[0].text, '第一条笔记');

  repo.removeNote(b.id, n.id);
  assert.equal(repo.get(b.id).notes.length, 0);
  h.store.undoRemove();
  assert.equal(repo.get(b.id).notes.length, 1, '嵌套笔记删除应可撤销');
});

test('BookRepository：addExcerpt/removeExcerpt，空文本拒绝（与旧 Store 一致）', () => {
  const h = boot();
  const repo = repoOf(h);
  const b = repo.create({ title: '摘抄源' });
  assert.equal(repo.addExcerpt({ bookId: b.id, text: '   ' }), null, '空文本应拒绝');

  const ex = repo.addExcerpt({ bookId: b.id, text: '金句一句', page: 3 });
  assert.equal(ex.bookTitle, '摘抄源', '应回填书名');
  assert.equal(repo.getExcerpts().length, 1);

  repo.removeExcerpt(ex.id);
  assert.equal(repo.getExcerpts().length, 0);
  h.store.undoRemove();
  assert.equal(repo.getExcerpts().length, 1, '书摘删除应可撤销');
});

test('BookRepository：addReadingSession 落账与日志（与旧 Store 一致）', () => {
  const h = boot();
  const repo = repoOf(h);
  const b = repo.create({ title: '计时书' });
  const added = repo.addReadingSession(b.id, 0.5); /* 不足 1 分钟按 1 分钟 */
  assert.equal(added, 1);
  const after = repo.get(b.id);
  assert.equal(after.readingMinutes, 1);
  assert.equal(after.readingLog.length, 1);
  assert.ok(after.readingLog[0].date, '日志应有日期');
});

/* Phase 4 门禁：reading.js 的子操作必须经 BookRepository，不得回退直连 */
test('BookRepository：reading.js 已迁移至边界（不再直连 Store 子操作）', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'reading.js'), 'utf8');
  const direct = /store\.(addBook|updateBook|removeBook|addReadingSession|addBookNote|removeBookNote|addExcerpt|removeExcerpt)\(/;
  assert.ok(!direct.test(src), 'reading.js 不应直连 Store 子操作');
  assert.ok(/store\.state\.(books|excerpts)/.test(src) === false, 'reading.js 不应直读 books/excerpts');
  assert.ok(/repoOf\(/.test(src), 'reading.js 应经 BookRepository');
});
