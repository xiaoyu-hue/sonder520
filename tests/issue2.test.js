'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const S = require('../js/store.js');

function seed() {
  return {
    version: 1, settings: {},
    tasks: [], memos: [], posts: [], devProjects: [], clients: [], news: [], designs: [],
    books: [
      { id: 'b1', title: '在读书', author: '', status: '在读', progress: 30, notes: [] },
      { id: 'b2', title: '读完的书', author: '', status: '已读完', progress: 100, notes: [] },
      { id: 'b3', title: '想读的书', author: '', status: '想读', progress: 0, notes: [] },
      { id: 'b4', title: '中期书', author: '', status: '在读', progress: 50, notes: [] }
    ]
  };
}

test('readingStats：数量/状态/平均进度/区间分布正确', () => {
  const stats = S.readingStats(seed().books);
  assert.equal(stats.total, 4);
  assert.equal(stats.want, 1);
  assert.equal(stats.reading, 2);
  assert.equal(stats.finished, 1);
  assert.equal(stats.avgReading, 40); // (30+50)/2
  assert.equal(stats.avgAll, 45); // (30+100+0+50)/4
  const bucket = label => stats.buckets.find(b => b.label === label).count;
  assert.equal(bucket('未开始'), 1);
  assert.equal(bucket('前期 1-33%'), 1);
  assert.equal(bucket('中期 34-66%'), 1);
  assert.equal(bucket('已完成 100%'), 1);
});

test('readingStats：空书单不报错', () => {
  const stats = S.readingStats([]);
  assert.equal(stats.total, 0);
  assert.equal(stats.avgReading, 0);
  assert.equal(stats.byStatus.length, 0);
});

test('UI：阅读页渲染统计区（汇总/环形图/进度分布）', () => {
  const h = boot({ seed: seed() });
  h.goto('reading');
  const doc = h.window.document;
  const txt = doc.body.textContent;
  assert.ok(txt.includes('阅读统计'), '应有统计区');
  assert.ok(txt.includes('书籍总数'), '应显示总数');
  assert.ok(txt.includes('在读平均进度'), '应显示平均进度');
  const donut = doc.querySelector('.rd-donut');
  assert.ok(donut && /conic-gradient\(/.test(donut.style.background), '应有环形图');
  assert.ok(doc.querySelectorAll('.rd-brow').length === 5, '应有5个进度区间行');
  assert.ok(doc.body.textContent.includes('按阅读进度分布'));
});

test('UI：新增一本书后统计数字随之更新', () => {
  const h = boot({ seed: seed() });
  const doc = h.window.document;
  h.goto('reading');
  doc.querySelector('#rdAdd').click();
  doc.querySelector('[data-k="title"]').value = '新书';
  doc.querySelector('[data-k="status"]').value = '想读';
  doc.querySelector('[data-k="progress"]').value = '0';
  doc.querySelector('[data-act="ok"]').click();
  assert.equal(h.store.state.books.length, 5);
  assert.ok(doc.body.textContent.includes('书籍总数'));
  assert.ok(doc.body.textContent.includes('5'), '总数应变为 5');
});