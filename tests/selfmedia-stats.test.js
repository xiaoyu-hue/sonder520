'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const S = require('../js/store.js');

function memStorage() {
  const m = {};
  return { getItem: k => k in m ? m[k] : null, setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } };
}
function seed() {
  return {
    version: 1, settings: {},
    tasks: [], memos: [],
    posts: [
      { id: 'p1', title: '视频A', platform: 'B站', account: '', note: '', tags: ['AI'], status: 'published', publishDate: '2026-01-01', views: 1000, likes: 80, comments: 10, favorites: 30 },
      { id: 'p2', title: '视频B', platform: 'B站', account: '', note: '', tags: [], status: 'published', publishDate: null, views: 2500, likes: 200, comments: 50, favorites: 90 },
      { id: 'p3', title: '草稿中', platform: '', account: '', note: '', tags: [], status: 'draft', publishDate: null, views: 999, likes: 1, comments: 1, favorites: 1 }
    ],
    devProjects: [], clients: [], books: [], news: [], designs: []
  };
}

test('publishedStats：只统计已发布、汇总与排序正确', () => {
  const stats = S.publishedStats(seed().posts);
  assert.equal(stats.count, 2);
  assert.equal(stats.sums.views, 3500);
  assert.equal(stats.sums.likes, 280);
  assert.equal(stats.sums.comments, 60);
  assert.equal(stats.sums.favorites, 120);
  assert.equal(stats.max.views, 2500);
  assert.equal(stats.posts[0].id, 'p2', '应按播放量降序');
  assert.equal(stats.posts[1].id, 'p1');
});

test('发布数据字段：默认 0、可更新、负数夹紧为 0', () => {
  const s = S.createStore(memStorage());
  const p = s.addPost({ title: 'N', status: 'published' });
  assert.deepEqual([p.views, p.likes, p.comments, p.favorites], [0, 0, 0, 0]);
  s.updatePost(p.id, { views: '500', likes: -3, comments: '12' });
  const after = s.state.posts[0];
  assert.equal(after.views, 500);
  assert.equal(after.likes, 0, '负数应夹到 0');
  assert.equal(after.comments, 12);
});

test('UI：自媒体页发布数据统计图渲染（汇总+分组条形行）', () => {
  const h = boot({ seed: seed() });
  h.goto('selfmedia');
  const doc = h.window.document;
  const statsEl = doc.querySelector('#smStats');
  assert.ok(statsEl, '应收发布统计数据区');
  const txt = statsEl.textContent;
  assert.ok(txt.includes('总播放'), '应显示汇总');
  assert.ok(txt.includes('3500'), '总播放 3500');
  assert.ok(txt.includes('视频A'));
  assert.ok(txt.includes('视频B'));
  assert.ok(!txt.includes('草稿'), '草稿不应进入图表');
});

test('UI：编辑已发布内容可录入统计数据并反映到汇总', () => {
  const h = boot({ seed: seed() });
  const doc = h.window.document;
  h.goto('selfmedia');
  const item = doc.querySelector('.list-item[data-id="p1"]');
  assert.ok(item, '应渲染视频A行');
  item.querySelector('[data-act="edit"]').click();
  const v = doc.querySelector('[data-k="views"]');
  assert.ok(v, '编辑表单应有播放量字段');
  v.value = '8000';
  doc.querySelector('[data-act="ok"]').click();
  assert.equal(h.store.state.posts.find(x => x.id === 'p1').views, 8000);
  assert.ok(doc.querySelector('#smStats').textContent.includes('总播放'));
});