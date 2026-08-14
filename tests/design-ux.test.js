'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

const okBtn = (doc) => doc.querySelector('.overlay [data-act="ok"]');
const yesBtn = (doc) => doc.querySelector('.overlay [data-act="yes"]');

/* ================= 设计计划（design.js） ================= */

test('设计：空状态提示', () => {
  const h = boot();
  h.goto('design');
  const doc = h.window.document;
  assert.ok(doc.body.textContent.includes('还没有设计灵感或项目'), '空态文案');
  assert.ok(doc.querySelector('[data-dadd="idea"]'), '有收集灵感按钮');
  assert.ok(doc.querySelector('[data-dadd="project"]'), '有新建项目按钮');
});

test('设计：收集灵感与新建项目分节展示', () => {
  const h = boot();
  h.goto('design');
  const doc = h.window.document;

  doc.querySelector('[data-dadd="idea"]').click();
  doc.querySelector('input[data-k="title"]').value = '配色灵感';
  okBtn(doc).click();
  assert.equal(h.store.state.designs[0].type, 'idea', '灵感入库');
  assert.ok(doc.body.textContent.includes('灵感 1'), '灵感分节计数');

  doc.querySelector('[data-dadd="project"]').click();
  doc.querySelector('input[data-k="title"]').value = '官网改版';
  okBtn(doc).click();
  assert.equal(h.store.state.designs[0].type, 'project', '项目入库');
  assert.ok(doc.body.textContent.includes('项目 1'), '项目分节计数');

  const idea = doc.querySelector('.list-item[data-id="' + h.store.state.designs[1].id + '"]');
  const proj = doc.querySelector('.list-item[data-id="' + h.store.state.designs[0].id + '"]');
  assert.ok(idea && !idea.textContent.includes('构想'), '灵感卡无阶段 pill');
  assert.ok(proj && proj.textContent.includes('构想'), '项目卡默认阶段 pill');
});

test('设计：项目阶段自动保存与 pill 更新', () => {
  const h = boot();
  h.store.addDesign({ type: 'project', title: 'P', stage: '构想' });
  h.goto('design');
  const doc = h.window.document;
  assert.ok(doc.body.textContent.includes('构想'), '阶段展示');
  assert.equal(h.store.state.designs[0].pill, undefined, '无多余字段');
  h.store.updateDesign(h.store.state.designs[0].id, { stage: '定稿' });
  h.goto('design');
  assert.ok(doc.body.textContent.includes('定稿'), '阶段更新后展示');
});

test('设计：编辑预填并保存', () => {
  const h = boot();
  h.store.addDesign({ type: 'idea', title: '旧灵感', category: '插画' });
  h.goto('design');
  const doc = h.window.document;
  doc.querySelector('[data-act="edit"]').click();
  const ti = doc.querySelector('input[data-k="title"]');
  assert.equal(ti.value, '旧灵感', '编辑框预填标题');
  assert.equal(doc.querySelector('input[data-k="category"]').value, '插画', '预填分类');
  ti.value = '新灵感';
  okBtn(doc).click();
  assert.equal(h.store.state.designs[0].title, '新灵感', '更新入库');
});

test('设计：资料页码及链接更新', () => {
  const h = boot();
  h.store.addDesign({ type: 'project', title: '有链接的项目', link: 'https://dribbble.com/shot' });
  h.goto('design');
  const doc = h.window.document;
  assert.ok(doc.querySelector('.list-item a[href="https://dribbble.com/shot"]'), '链接渲染');
});

test('设计：删除需确认，确认后移除且可撤销', async () => {
  const h = boot();
  h.store.addDesign({ type: 'project', title: '要删的项目' });
  h.goto('design');
  const doc = h.window.document;
  doc.querySelector('[data-act="del"]').click();
  assert.ok(yesBtn(doc), '弹出确认框');
  yesBtn(doc).click();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(h.store.state.designs.length, 0, '已删除');
  const undo = doc.querySelector('.toast-act');
  assert.ok(undo, '出现撤销按钮');
  undo.click();
  assert.equal(h.store.state.designs.length, 1, '撤销恢复');
});