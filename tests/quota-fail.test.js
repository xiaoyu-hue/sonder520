'use strict';
/* 持久化危机兜底：localStorage 写失败（QuotaExceededError / NS_ERROR_DOM_QUOTA_REACHED / 其他）
 * 时与 IndexedDB 兜底状态联动——双失败 = 数据只存在内存（刷新即丢），UI 必须亮红色危机条
 * 引导立即导出备份（复用设置页导出流程），且不允许一键永久关闭；任一侧恢复即自动解除。 */
const { test } = require('node:test');
const assert = require('node:assert');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');
const { boot } = require('./harness.js');

const withIdb = f => ({ idb: f, idbKeyRange: IDBKeyRange });
const wait = ms => new Promise(r => setTimeout(r, ms));

function quotaErr(name, msg) {
  const e = new Error(msg || name);
  e.name = name;
  return e;
}

/* 前 times 次 setItem 抛配额错误，之后委托真实 storage（模拟"存储写满 → 清理/扩容后恢复"） */
function flaky(real, times) {
  let left = times;
  return {
    getItem: k => real.getItem(k),
    setItem: (k, v) => {
      if (left > 0) { left--; throw quotaErr('QuotaExceededError'); }
      real.setItem(k, v);
    },
    removeItem: k => real.removeItem(k)
  };
}

/* 每次 setItem 都抛指定错误（模拟持续性写入失败） */
function flakyName(real, err) {
  return {
    getItem: k => real.getItem(k),
    setItem: () => { throw err; },
    removeItem: k => real.removeItem(k)
  };
}

test('持久化危机：localStorage 写满（QuotaExceededError）且无 IDB → hasPersistIssue=true，恢复后解除', async () => {
  const h = boot(); /* 无 IDB 环境 */
  h.store._storage = flaky(h.window.localStorage, 1);
  h.store.addMemo('一条备忘'); /* 触发 save → idle flush 写失败 */
  await wait(60);
  assert.equal(h.store.hasPersistIssue(), true, 'LS 写失败且无 IDB 兜底应报危机');
  assert.ok(h.store.persistIssueDetail(), '应保留最近一次错误对象供诊断');

  h.store._storage = h.window.localStorage; /* 存储恢复（模拟清理出空间） */
  h.store.addMemo('恢复后的备忘');
  await wait(60);
  assert.equal(h.store.hasPersistIssue(), false, '再次写成功应自动解除危机');
});

test('持久化危机：LS 写失败但 IDB 兜底可用 → 不报告危机，数据可从 IDB 恢复', async () => {
  const f = new IDBFactory();
  const h = boot(withIdb(f));
  h.store._storage = flaky(h.window.localStorage, 999); /* LS 持续写失败 */
  h.store.addMemo('双写中的备忘');
  await wait(80);
  assert.equal(h.store.hasPersistIssue(), false, 'IDB 兜底成功不应报危机');

  const h2 = boot(withIdb(f)); /* 全新 localStorage，仅靠 IDB */
  await h2.hooks.idbReady;
  assert.equal(h2.store.state.memos[0].text, '双写中的备忘', 'IDB 副本应可完整恢复');
});

test('持久化危机：LS 与 IDB 同时失败 = 危机，IDB 恢复后自动解除', async () => {
  const f = new IDBFactory();
  const h = boot(withIdb(f));
  h.store._storage = flaky(h.window.localStorage, 999);
  h.store.addMemo('危险数据');
  await wait(60);
  assert.equal(h.store.hasPersistIssue(), false, '仅 LS 失败、IDB 正常时不报危机');
  h.store._idbFailed = true; /* 模拟 IDB 侧进入失败（存储分区/配额） */
  assert.equal(h.store.hasPersistIssue(), true, '双失败应报危机');

  h.store.addMemo('又一条'); /* 新写入：IDB 侧成功 → 失败标记复位 */
  await wait(60);
  assert.equal(h.store._idbFailed, false, 'IDB 写入成功后应复位失败标记');
  assert.equal(h.store.hasPersistIssue(), false, 'IDB 恢复后危机应解除');
});

test('持久化危机：Firefox 风格 NS_ERROR_DOM_QUOTA_REACHED 同样识别', async () => {
  const h = boot();
  h.store._storage = flakyName(h.window.localStorage, quotaErr('NS_ERROR_DOM_QUOTA_REACHED', 'Persistent storage maximum size reached'));
  h.store.addMemo('x');
  await wait(60);
  assert.equal(h.store.hasPersistIssue(), true, 'Firefox 配额错误同样触发危机');
});

test('警示条：写入失败显示危机提示（红色/导出优先/迁移隐藏），关闭不持久化，恢复后消失', async () => {
  const h = boot();
  h.goto('home');
  assert.equal(h.$('#quotaBar').hidden, true, '正常时应隐藏');

  h.store._storage = flaky(h.window.localStorage, 999);
  h.store.addMemo('触发失败');
  await wait(60);
  h.goto('settings'); /* 触发 app.render → quotaCheck */

  const bar = h.$('#quotaBar');
  assert.equal(bar.hidden, false, '危机时应显示警示条');
  assert.ok(bar.classList.contains('qb-fail'), '危机态应带危机样式');
  assert.equal(h.$('#qbWarn').hidden, true, '温和文案应隐藏');
  assert.equal(h.$('#qbFail').hidden, false, '应显示写入失败文案');
  assert.ok(/写入失败/.test(h.$('#qbFail').textContent), '文案应说明写入失败：' + h.$('#qbFail').textContent);
  assert.equal(h.$('#qbOr').hidden, true, '分隔词应隐藏');
  assert.equal(h.$('#qMigrate').hidden, true, 'LS 写失败时迁移按钮无意义，应隐藏');
  assert.ok(h.$('#qExport'), '导出备份入口保留（跳设置页复用导出流程）');

  h.$('#qClose').click();
  assert.equal(bar.hidden, true, '关闭后此轮隐藏');
  assert.equal(h.store.state.settings.quotaNoticeDismissed, false, '危机态关闭不应写入 dismiss（不可一键永久关闭）');
  h.goto('home');
  assert.equal(h.$('#quotaBar').hidden, false, '危机未解除时再次渲染仍显示');

  h.store._storage = h.window.localStorage; /* 存储恢复 */
  h.store.addMemo('恢复');
  await wait(60);
  h.goto('home');
  const bar2 = h.$('#quotaBar');
  assert.equal(bar2.hidden, true, '恢复后警示消失');
  assert.ok(!bar2.classList.contains('qb-fail'), '应移除危机样式');
  assert.equal(h.$('#qbWarn').hidden, false, '温和文案恢复');
  assert.equal(h.$('#qbFail').hidden, true, '失败文案隐藏');
  assert.equal(h.$('#qMigrate').hidden, false, '迁移按钮恢复');
});