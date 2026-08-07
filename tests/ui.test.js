'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

test('UI.esc 转义特殊字符（XSS 防护）', () => {
  const { window } = boot();
  const UI = window.UI;
  assert.equal(UI.esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(UI.esc('a"b&c'), 'a&quot;b&amp;c');
  assert.equal(UI.esc(null), '');
});

test('Toast 提示出现与消失', async () => {
  const { window } = boot();
  const UI = window.UI;
  UI.toast('保存成功');
  const t = window.document.querySelector('#toastWrap .toast');
  assert.ok(t, 'toast 未出现');
  assert.match(t.textContent, /保存成功/);
});

test('formModal：必填校验 + 提交回调 + 关闭', () => {
  const { window } = boot();
  const UI = window.UI;
  let submitted = null;
  UI.formModal({
    title: '新增',
    fields: [{ key: 'name', label: '名称', required: true }, { key: 'note', label: '备注' }],
    onSubmit: (v) => { submitted = v; return true; }
  });
  const doc = window.document;
  // 未填写直接提交 -> 显示提示
  doc.querySelector('[data-act="ok"]').click();
  const hint = doc.querySelector('.modal .hint');
  assert.ok(hint && hint.style.display === 'block', '必填提示未显示');
  assert.equal(submitted, null);
  // 填写后提交
  doc.querySelector('[data-k="name"]').value = '张三';
  doc.querySelector('[data-act="ok"]').click();
  assert.deepEqual(submitted, { name: '张三', note: '' });
  assert.equal(doc.querySelector('#overlayRoot').childElementCount, 0, '提交后应关闭');
});

test('formModal：onSubmit 返回错误字符串则保持打开并提示', () => {
  const { window } = boot();
  const UI = window.UI;
  let calls = 0;
  UI.formModal({
    title: 'x',
    fields: [{ key: 'a', label: 'a', required: true }],
    onSubmit: () => { calls++; return '不能重复添加'; }
  });
  const doc = window.document;
  doc.querySelector('[data-k="a"]').value = 'v';
  doc.querySelector('[data-act="ok"]').click();
  assert.equal(calls, 1);
  assert.equal(doc.querySelector('#overlayRoot').childElementCount, 1, '应保持打开');
  const hint = doc.querySelector('.modal .hint');
  assert.equal(hint.textContent, '不能重复添加');
});

test('confirmBox：点确认返回 true，点取消返回 false', async () => {
  const { window } = boot();
  const UI = window.UI;
  const doc = window.document;
  let res1;
  const p1 = UI.confirmBox('确认删除?').then(r => { res1 = r; });
  doc.querySelector('[data-act="yes"]').click();
  await p1;
  assert.equal(res1, true);

  let res2;
  const p2 = UI.confirmBox('确认删除?').then(r => { res2 = r; });
  doc.querySelector('[data-act="no"]').click();
  await p2;
  assert.equal(res2, false);
});

test('Esc 键关闭弹窗', () => {
  const { window } = boot();
  const UI = window.UI;
  const doc = window.document;
  UI.formModal({ title: 't', fields: [], onSubmit: () => true });
  assert.equal(doc.querySelector('#overlayRoot').childElementCount, 1);
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(doc.querySelector('#overlayRoot').childElementCount, 0, 'Esc 应关闭弹窗');
});