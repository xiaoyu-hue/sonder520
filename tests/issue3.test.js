'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const S = require('../js/store.js');

function memStorage() { const m = {}; return { getItem: k => k in m ? m[k] : null, setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } }; }

function seed() {
  return {
    version: 1, settings: {},
    tasks: [], memos: [],
    posts: [
      { id: 'p1', title: '视频A', platform: 'B站', account: '', note: '', tags: [], status: 'draft', publishDate: null, views: 0, likes: 0, comments: 0, favorites: 0, progress: 10 }
    ],
    devProjects: [], clients: [], books: [], news: [], designs: []
  };
}

test('进度字段：默认 0、更新夹紧到 0-100', () => {
  const s = S.createStore(memStorage());
  const p = s.addPost({ title: 'N' });
  assert.equal(p.progress, 0);
  s.updatePost(p.id, { progress: '40' });
  assert.equal(s.state.posts[0].progress, 40);
  s.updatePost(p.id, { progress: 300 });
  assert.equal(s.state.posts[0].progress, 100, '超上限夹到 100');
  s.updatePost(p.id, { progress: -5 });
  assert.equal(s.state.posts[0].progress, 0, '负数夹到 0');
});

test('UI：拖拽进度条更新数据与显示', () => {
  const h = boot({ seed: seed() });
  const doc = h.window.document;
  h.goto('selfmedia');
  const range = doc.querySelector('[data-prog]');
  assert.ok(range, '应有拖拽进度条');
  assert.equal(range.value, '10');
  const label = doc.querySelector('[data-proglabel]');
  assert.equal(label.textContent, '10%');
  range.value = '60';
  range.dispatchEvent(new h.window.Event('change', { bubbles: true }));
  assert.equal(h.store.state.posts.find(x => x.id === 'p1').progress, 60);
  assert.equal(label.textContent, '60%', '标签应同步更新');
});

test('UI：每条内容都有独立的进度条', () => {
  const h = boot({ seed: {
    version: 1, settings: {}, tasks: [], memos: [],
    posts: [
      { id: 'p1', title: 'A', platform: '', account: '', note: '', tags: [], status: 'draft', publishDate: null, views: 0, likes: 0, comments: 0, favorites: 0, progress: 10 },
      { id: 'p2', title: 'B', platform: '', account: '', note: '', tags: [], status: 'draft', publishDate: null, views: 0, likes: 0, comments: 0, favorites: 0, progress: 80 }
    ],
    devProjects: [], clients: [], books: [], news: [], designs: []
  } });
  h.goto('selfmedia');
  assert.equal(h.window.document.querySelectorAll('[data-prog]').length, 2);
});