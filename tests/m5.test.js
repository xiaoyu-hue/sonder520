'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');
const S = require('../js/store.js');
const TODAY = S.todayStr();

function navTexts(h) {
  return Array.from(h.window.document.querySelectorAll('#nav button')).map(b => b.textContent);
}

test('设置：切换深色主题并持久化', () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('settings');
  doc.querySelector('input[name="theme"][value="dark"]').click();
  assert.equal(h.store.state.settings.theme, 'dark');
  assert.equal(h.window.document.documentElement.getAttribute('data-theme'), 'dark');
});

test('设置：关闭/开启模块开关影响侧边栏', () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('settings');
  assert.ok(navTexts(h).some(t => t.includes('自媒体')));
  doc.querySelector('[data-mod="selfmedia"]').click();
  assert.equal(h.store.state.settings.modules.selfmedia, false);
  assert.ok(!navTexts(h).some(t => t.includes('自媒体')), '关闭后侧边栏应隐藏自媒体');
  // 重新打开
  const cb = h.window.document.querySelector('[data-mod="selfmedia"]');
  assert.ok(cb, '设置页应保留开关');
  cb.click();
  assert.equal(h.store.state.settings.modules.selfmedia, true);
  assert.ok(navTexts(h).some(t => t.includes('自媒体')));
});

test('设置：统计与各模块数据一致', () => {
  const h = boot({ seed: {
    version: 1, settings: {},
    tasks: [{ id: 't1', title: 'a', note: '', date: TODAY, priority: '中', done: false, doneAt: null, order: 0 }],
    memos: [], posts: [{ id: 'p1', title: 'x', platform: '', account: '', note: '', tags: [], status: 'queue', publishDate: null }],
    devProjects: [], clients: [], books: [], news: [], designs: []
  } });
  h.goto('settings');
  const txt = h.window.document.body.textContent;
  assert.ok(txt.includes('今日计划'));
  assert.ok(txt.includes('自媒体'));
  assert.ok(txt.includes('0/1'), '应显示任务 0/1');
});

test('设置：导出备份生成 JSON（含全部数据）', () => {
  const h = boot();
  const store = h.store;
  h.goto('settings');
  store.addTask({ title: '备份任务' });
  store.addMemo('备份备忘');
  const json = store.exportBackup();
  const parsed = JSON.parse(json);
  assert.equal(parsed.tasks.length, 1);
  assert.equal(parsed.memos.length, 1);
  assert.ok(h.window.document.querySelector('#bkExport'), '导出按钮存在');
});

test('设置：导入恢复覆盖数据，非法文件报错', async () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('settings');
  h.store.addTask({ title: '将被覆盖' });
  const backup = JSON.stringify({ version: 1, settings: {}, tasks: [{ id: 'n1', title: '恢复的任务', note: '', date: TODAY, priority: '低', done: false, doneAt: null, order: 0 }], memos: [], posts: [], devProjects: [], clients: [], books: [], news: [], designs: [] });
  const input = doc.querySelector('#bkFile');
  const file = new h.window.File([backup], 'backup.json', { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file] });
  input.dispatchEvent(new h.window.Event('change', { bubbles: true }));
  // 确认覆盖
  await new Promise(r => setTimeout(r, 20));
  doc.querySelector('[data-act="yes"]').click();
  await new Promise(r => setTimeout(r, 80));
  assert.equal(h.store.state.tasks.length, 1);
  assert.equal(h.store.state.tasks[0].title, '恢复的任务');
});

test('设置：导入非法文件提示错误且数据不变', async () => {
  const h = boot();
  const doc = h.window.document;
  h.goto('settings');
  h.store.addTask({ title: '原有' });
  const input = doc.querySelector('#bkFile');
  const file = new h.window.File(['not-json{'], 'bad.json', { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file] });
  input.dispatchEvent(new h.window.Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 20));
  doc.querySelector('[data-act="yes"]').click();
  await new Promise(r => setTimeout(r, 80));
  assert.equal(h.store.state.tasks.length, 1, '导入失败不应清空数据');
  const toasts = Array.from(h.window.document.querySelectorAll('#toastWrap .toast'));
  assert.ok(toasts.some(t => t.classList.contains('err')), '应有错误提示');
});