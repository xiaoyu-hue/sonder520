'use strict';
/* 第 3 轮 UI 端到端：启用向导 / 锁屏 / 免密会话 / 停用 / 加密备份导入 */
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

const PWD = 'sonder-ui-2026';
const SEED = {
  settings: { theme: 'light', frameRate: 60, modules: { tasks: true, memo: true } },
  tasks: [{ id: 't1', title: '今日待办任务', done: false, date: '2026-08-10', priority: '高' }],
  memos: [{ id: 'm1', text: '机密备忘' }],
  version: 1
};

/* 加密操作（PBKDF2 600k 迭代）耗时随机器负载浮动，用轮询替代固定等待 */
function poll(fn, stepMs, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function tick() {
      let r = null;
      try { r = fn(); } catch (e) { return reject(e); }
      if (r) return resolve(r);
      if (Date.now() - t0 > (timeoutMs || 10000)) return reject(new Error('poll 超时'));
      setTimeout(tick, stepMs || 100);
    })();
  });
}

function snapLS(window) {
  const ls = window.localStorage;
  const out = { 'sonder_encsalt_v1': ls.getItem('sonder_encsalt_v1') };
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && k.indexOf('sonder_col_') === 0) out[k] = ls.getItem(k);
  }
  return out;
}

function bootSnap(snap, session) {
  return boot({
    rawLS: snap,
    session: session
  });
}

async function enableViaUI(window) {
  window.__sonderHooks.render('settings');
  const doc = window.document;
  doc.querySelector('#encEnable').click();
  doc.querySelector('[data-k="pwd"]').value = PWD;
  doc.querySelector('[data-k="pwd2"]').value = PWD;
  doc.querySelector('[data-act="ok"]').click();
  await poll(() => !doc.querySelector('.modal'), 100, 15000);
}

test('设置页启用向导：密码不一致保持弹窗提示，一致后启用且落盘密文', async () => {
  const { window } = boot({ seed: SEED });
  window.__sonderHooks.render('settings');
  const doc = window.document;
  doc.querySelector('#encEnable').click();
  assert.ok(doc.querySelector('.modal'), '应弹出启用向导');

  doc.querySelector('[data-k="pwd"]').value = '1234';
  doc.querySelector('[data-k="pwd2"]').value = '9999';
  doc.querySelector('[data-act="ok"]').click();
  const hint = doc.querySelector('.modal .hint');
  assert.ok(hint && hint.style.display === 'block' && /不一致/.test(hint.textContent), '应提示密码不一致且弹窗保持');
  assert.ok(doc.querySelector('.modal'), '不一致时不得关闭');

  doc.querySelector('[data-k="pwd"]').value = '123';
  doc.querySelector('[data-k="pwd2"]').value = '123';
  doc.querySelector('[data-act="ok"]').click();
  const hint2 = doc.querySelector('.modal .hint');
  assert.ok(hint2 && /至少/.test(hint2.textContent), '弱密码应被拒绝');

  doc.querySelector('[data-k="pwd"]').value = PWD;
  doc.querySelector('[data-k="pwd2"]').value = PWD;
  doc.querySelector('[data-act="ok"]').click();
  await poll(() => !doc.querySelector('.modal'), 100, 15000);

  assert.ok(/已启用 · 已解锁/.test(doc.body.textContent), '卡片应显示已启用·已解锁');
  const memosRaw = JSON.parse(doc.defaultView.localStorage.getItem('sonder_col_memos_v1'));
  assert.equal(memosRaw.e, 1, '落盘应为密文');
  assert.ok(!doc.defaultView.localStorage.getItem('sonder_col_memos_v1').includes('机密备忘'), '密文不含明文');
  assert.ok(window.__sonderHooks.store.state.tasks.length === 1, '解锁态数据仍可用');
});

test('锁屏：设置页锁定 → 错密码提示 → 对密码解锁恢复', async () => {
  const { window, $ } = boot({ seed: SEED });
  await enableViaUI(window);
  const doc = window.document;

  doc.querySelector('#encLock').click();
  assert.ok($('#lockScreen'), '应出现锁屏遮罩');
  assert.equal(window.getComputedStyle($('#lockScreen')).display, 'flex', '锁屏应显示（flex）');

  $('#lockPwd').value = '错误密码';
  $('#lockBtn').click();
  await poll(() => /密码不正确/.test($('#lockErr').textContent), 100, 10000);
  assert.equal(window.getComputedStyle($('#lockScreen')).display, 'flex', '错密码保持锁定');

  $('#lockPwd').value = PWD;
  $('#lockBtn').click();
  await poll(() => window.getComputedStyle($('#lockScreen')).display === 'none', 100, 15000);
  assert.equal(window.__sonderHooks.store.state.tasks.length, 1, '解锁后数据恢复可见');
  const raw = JSON.parse(doc.defaultView.localStorage.getItem('sonder_col_tasks_v1'));
  assert.equal(raw.e, 1, '解锁后落盘仍为密文');
});

test('重启（新实例）：自动弹锁屏，解锁前数据不可见', async () => {
  const a = boot({ seed: SEED });
  await enableViaUI(a.window);
  const snap = snapLS(a.window);
  assert.ok(snap['sonder_col_memos_v1'] && snap['sonder_encsalt_v1'], '应捕获密文快照与盐');

  const b = bootSnap(snap);
  await poll(() => b.$('#lockScreen'), 100, 10000);
  assert.equal(b.hooks.store.state.tasks.length, 0, '锁定态不得暴露数据');
});

test('免密会话：勾选免密解锁后新实例自动解锁', async () => {
  const a = boot({ seed: SEED });
  await enableViaUI(a.window);
  const snap = snapLS(a.window);

  const b = bootSnap(snap);
  await poll(() => b.$('#lockScreen'), 100, 10000);
  b.$('#lockRemember').checked = true;
  b.$('#lockPwd').value = PWD;
  b.$('#lockBtn').click();
  await poll(() => b.window.getComputedStyle(b.$('#lockScreen')).display === 'none', 100, 15000);
  assert.equal(b.window.sessionStorage.getItem('sonder_session_pwd'), PWD, '会话免密标记已写入');

  const c = bootSnap(snap, { 'sonder_session_pwd': PWD });
  await poll(() => c.hooks.store.state.tasks.length === 1, 100, 15000);
  assert.equal(c.$('#lockScreen'), null, '免密会话应自动解锁，无锁屏');
});

test('停用加密：错密码拒绝并保持密文，对密码转明文并清盐', async () => {
  const { window } = boot({ seed: SEED });
  await enableViaUI(window);
  const doc = window.document;

  doc.querySelector('#encDisable').click();
  assert.ok(doc.querySelector('.modal'), '应弹出密码验证');
  doc.querySelector('[data-k="pwd"]').value = 'wrong';
  doc.querySelector('[data-act="ok"]').click();
  await poll(() => {
    const hint = doc.querySelector('.modal .hint');
    return hint && hint.style.display === 'block' && /密码不正确/.test(hint.textContent);
  }, 100, 10000);
  assert.equal(JSON.parse(doc.defaultView.localStorage.getItem('sonder_col_memos_v1')).e, 1, '错密码后仍为密文');

  doc.querySelector('[data-k="pwd"]').value = PWD;
  doc.querySelector('[data-act="ok"]').click();
  await poll(() => !doc.querySelector('.modal'), 100, 15000);
  const after = JSON.parse(doc.defaultView.localStorage.getItem('sonder_col_memos_v1'));
  assert.equal(after.e, undefined, '停用后转为明文');
  assert.ok(Array.isArray(after), '停用后集合 key 为明文数组');
  assert.equal(doc.defaultView.localStorage.getItem('sonder_encsalt_v1'), null, '盐应清除');
  assert.ok(/未启用/.test(doc.body.textContent), '卡片状态回到未启用');
  assert.equal(window.__sonderHooks.store.state.tasks.length, 1, '数据完整');
});

test('导入加密备份：弹密码框，正确密码恢复数据', async () => {
  // 准备加密备份包
  const a = boot({ seed: SEED });
  const sa = a.hooks.store;
  await sa.enableEncryption(PWD);
  assert.equal(await sa.unlock(PWD), true);
  const pkg = await sa.exportBackup();

  // 导入到全新明文实例
  const b = boot({ seed: { settings: { theme: 'light', frameRate: 60, modules: { tasks: true } }, tasks: [{ id: 'x', title: '本地垃圾数据', done: false, date: '2026-08-10', priority: '低' }], memos: [], version: 1 } });
  b.hooks.render('settings');
  const doc = b.window.document;
  const input = doc.querySelector('#bkFile');
  const file = new b.window.File([pkg], 'enc.json', { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new b.window.Event('change'));

  const yesBtn = doc.querySelector('[data-act="yes"]');
  assert.ok(yesBtn, '应先出现覆盖确认');
  yesBtn.click();
  await poll(() => doc.querySelector('.modal'), 100, 5000);
  assert.ok(/备份密码|解密导入/.test(doc.querySelector('.modal').textContent), '弹窗应为密码输入');

  doc.querySelector('[data-k="pwd"]').value = PWD;
  doc.querySelector('[data-act="ok"]').click();
  await poll(() => !doc.querySelector('.modal'), 100, 15000);
  assert.ok(b.hooks.store.state.tasks.some(t => t.title === '今日待办任务'), '加密备份数据已恢复');
  assert.ok(b.hooks.store.state.memos.some(m => m.text.includes('机密')), '备忘已恢复');
});