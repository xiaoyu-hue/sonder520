'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

const okBtn = (doc) => doc.querySelector('.overlay [data-act="ok"]');
const yesBtn = (doc) => doc.querySelector('.overlay [data-act="yes"]');
const change = (h, el) => el.dispatchEvent(new h.window.Event('change', { bubbles: true }));

/* ================= 看新闻计划（news.js） ================= */

test('新闻：空状态提示与新增资讯', () => {
  const h = boot();
  h.goto('news');
  const doc = h.window.document;
  assert.ok(doc.body.textContent.includes('还没有资讯'), '空态文案');
  doc.querySelector('#nwAdd').click();
  doc.querySelector('input[data-k="title"]').value = '一篇好文章';
  doc.querySelector('input[data-k="url"]').value = 'https://example.com/a';
  doc.querySelector('input[data-k="source"]').value = '某站';
  doc.querySelector('input[data-k="tags"]').value = '前端, 周刊';
  okBtn(doc).click();
  const n = h.store.state.news[0];
  assert.equal(n.title, '一篇好文章', '标题入库');
  assert.deepEqual(n.tags, ['前端', '周刊'], '标签逗号分隔拆分');
  assert.equal(n.status, 'unread', '默认待读');
  const item = doc.querySelector('.list-item[data-id="' + n.id + '"]');
  assert.ok(item, '列表项渲染');
  assert.ok(item.querySelector('a[href="https://example.com/a"]'), '链接渲染');
  assert.ok(item.textContent.includes('待读'), '待读 pill');
});

test('新闻：标已读 / 收藏 / 取消收藏', () => {
  const h = boot();
  h.store.addNews({ title: 'A', tags: ['x'] });
  h.goto('news');
  const doc = h.window.document;
  doc.querySelector('[data-act="mark"]').click();
  assert.equal(h.store.state.news[0].status, 'read', '标已读落库');
  assert.ok(doc.body.textContent.includes('已读'), '已读 pill');
  doc.querySelector('[data-act="fav"]').click();
  assert.equal(h.store.state.news[0].status, 'favorite', '收藏落库');
  assert.ok(doc.body.textContent.includes('收藏'), '收藏 pill');
  doc.querySelector('[data-act="unfav"]').click();
  assert.equal(h.store.state.news[0].status, 'unread', '取消收藏回待读');
});

test('新闻：状态筛选 + 标签筛选 + 清除筛选', () => {
  const h = boot();
  h.store.addNews({ title: '未读新闻', tags: ['甲'] });
  h.store.addNews({ title: '已读新闻', tags: ['乙'], status: 'read' });
  h.goto('news');
  const doc = h.window.document;
  assert.equal(doc.querySelectorAll('.list-item').length, 2, '初始全量');

  const st = doc.querySelector('#nwStatus');
  st.value = 'read'; change(h, st);
  assert.equal(doc.querySelectorAll('.list-item').length, 1, '状态筛选生效');
  assert.ok(doc.body.textContent.includes('已读新闻'), '留下已读项');

  const tg = doc.querySelector('#nwTag');
  tg.value = '甲'; change(h, tg);
  assert.equal(doc.querySelectorAll('.list-item').length, 0, '标签叠加筛选后空');

  doc.querySelector('#nwClear').click();
  assert.equal(doc.querySelectorAll('.list-item').length, 2, '清除筛选恢复全量');
});

test('新闻：危险链接不外链渲染', () => {
  const h = boot();
  h.store.addNews({ title: '坏链接', url: 'javascript:alert(1)' });
  h.goto('news');
  const doc = h.window.document;
  const item = doc.querySelector('.list-item');
  assert.ok(!item.querySelector('a'), '不渲染 a 标签');
  assert.ok(item.textContent.includes('坏链接'), '标题仍文本展示');
});

test('新闻：删除需确认，确认后移除且可撤销', async () => {
  const h = boot();
  h.store.addNews({ title: '要删的' });
  h.goto('news');
  const doc = h.window.document;
  doc.querySelector('[data-act="del"]').click();
  assert.ok(yesBtn(doc), '弹出确认框');
  yesBtn(doc).click();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(h.store.state.news.length, 0, '已删除');
  const undo = doc.querySelector('.toast-act');
  assert.ok(undo, '出现撤销按钮');
  undo.click();
  assert.equal(h.store.state.news.length, 1, '撤销恢复');
});