'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

const okBtn = (doc) => doc.querySelector('.overlay [data-act="ok"]');

/* ================= 咨询工作（consulting.js） ================= */

test('咨询：空状态提示与新建客户', () => {
  const h = boot();
  h.goto('consulting');
  const doc = h.window.document;
  assert.ok(doc.body.textContent.includes('还没有客户'), '空态文案');
  doc.querySelector('#csAdd').click();
  doc.querySelector('input[data-k="name"]').value = '甲方公司';
  okBtn(doc).click();
  assert.equal(h.store.state.clients[0].name, '甲方公司', '客户入库');
  assert.ok(doc.body.textContent.includes('客户 1 位'), '计数更新');
  const card = doc.querySelector('.card[data-client]');
  assert.ok(card && card.textContent.includes('¥0'), '收入合计初始 0');
});

test('咨询：客户卡片默认折叠，展开后显示三区块空态', () => {
  const h = boot();
  h.store.addClient({ name: '乙方' });
  h.goto('consulting');
  const doc = h.window.document;
  const details = doc.querySelector('[data-call]');
  assert.equal(details.style.display, 'none', '默认折叠');
  doc.querySelector('[data-cx]').click();
  assert.equal(doc.querySelector('[data-call]').style.display, 'block', '点击展开');
  assert.ok(doc.querySelector('[data-spwrap]'), '有项目区块');
  assert.ok(doc.querySelector('[data-fuwrap]'), '有跟进区块');
  assert.ok(doc.querySelector('[data-inwrap]'), '有收入区块');
});

test('咨询：添加项目/跟进/收入并核对落库与展示', () => {
  const h = boot();
  h.store.addClient({ name: '丙方' });
  h.goto('consulting');
  const doc = h.window.document;
  doc.querySelector('[data-cx]').click();

  doc.querySelector('[data-spadd]').click();
  doc.querySelector('input[data-k="name"]').value = '官网改版';
  okBtn(doc).click();
  const c1 = h.store.state.clients[0];
  assert.equal(c1.projects[0].name, '官网改版', '项目入库');
  assert.ok(doc.querySelector('[data-spwrap]').textContent.includes('官网改版'), '项目展示');

  doc.querySelector('[data-fuadd]').click();
  doc.querySelector('textarea[data-k="note"]').value = '等报价';
  okBtn(doc).click();
  assert.equal(h.store.state.clients[0].followups[0].note, '等报价', '跟进入库');
  assert.ok(doc.body.textContent.includes('跟进'), '跟进展示');

  doc.querySelector('[data-inadd]').click();
  doc.querySelector('input[data-k="amount"]').value = '5000';
  okBtn(doc).click();
  const c2 = h.store.state.clients[0];
  assert.equal(c2.income[0].amount, 5000, '收入入库');
  assert.ok(doc.body.textContent.includes('¥5000'), '合计更新');
});

test('咨询：收入负数被拦截', () => {
  const h = boot();
  h.store.addClient({ name: '丁方' });
  h.goto('consulting');
  const doc = h.window.document;
  doc.querySelector('[data-cx]').click();
  doc.querySelector('[data-inadd]').click();
  doc.querySelector('input[data-k="amount"]').value = '-100';
  okBtn(doc).click();
  assert.equal(h.store.state.clients[0].income.length, 0, '负数不入库');
  assert.ok(doc.querySelector('.overlay'), '弹窗不关闭');
});

test('咨询：跟进勾选完成落库', () => {
  const h = boot();
  const c = h.store.addClient({ name: '戊方' });
  h.store.addClientFollowup(c.id, { note: '回访', date: '2026-08-10' });
  h.goto('consulting');
  const doc = h.window.document;
  doc.querySelector('[data-cx]').click();
  const cb = doc.querySelector('[data-fcheck]');
  cb.checked = true;
  cb.dispatchEvent(new h.window.Event('change', { bubbles: true }));
  assert.equal(h.store.state.clients[0].followups[0].done, true, '勾选落库');
});

test('咨询：删除客户需确认，确认后移除并提示撤销', async () => {
  const h = boot();
  h.store.addClient({ name: '要删的客户' });
  h.goto('consulting');
  const doc = h.window.document;
  doc.querySelector('[data-cdel]').click();
  assert.ok(doc.querySelector('.overlay [data-act="yes"]'), '弹出确认');
  doc.querySelector('.overlay [data-act="yes"]').click();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(h.store.state.clients.length, 0, '客户已删除');
  const undo = doc.querySelector('.toast-act');
  assert.ok(undo, '出现撤销提示');
  undo.click();
  assert.equal(h.store.state.clients.length, 1, '撤销恢复');
});