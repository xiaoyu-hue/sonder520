'use strict';
/* nav-ia.test.js — 阶段 1 导航信息架构验收
 * 规则（见 docs 改造施工图 §2）：底部 5 Tab（4 页 + 更多），更多面板 7 入口，
 * 页面总数仍 11、路由不变、数据不变，仅入口位置变化。 */
const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./harness.js');

function openMore(h) {
  const doc = h.window.document;
  const moreBtn = Array.from(doc.querySelectorAll('#nav button')).find(b => (b.textContent || '').includes('更多'));
  if (moreBtn) moreBtn.click();
  return doc.getElementById('morePanel');
}

test('导航 IA：底部 5 个 Tab（4 页 + 更多），文字必现', () => {
  const h = boot();
  const doc = h.window.document;
  const navBtns = Array.from(doc.querySelectorAll('#nav button'));
  assert.equal(navBtns.length, 5, '底部导航应为 5 个 Tab');
  const labels = navBtns.map(b => (b.textContent || '').trim());
  ['首页', '今日', '备忘', '阅读', '更多'].forEach(function (l) {
    assert.ok(labels.indexOf(l) >= 0, '缺少 Tab：' + l);
  });
  /* 每个按钮都应有可见文字（禁止纯图标横滑） */
  navBtns.forEach(function (b) {
    assert.ok((b.querySelector('.lbl') || {}).textContent, 'Tab 应显示文字标签');
  });
});

test('导航 IA：更多面板含 7 个入口且均可跳转', () => {
  const h = boot();
  const panel = openMore(h);
  assert.ok(panel.classList.contains('open'), '点击更多应打开面板');
  const entries = Array.from(panel.querySelectorAll('[data-go]'));
  assert.equal(entries.length, 7, '更多面板应为 7 个入口（6 模块 + 设置）');
  const expected = ['selfmedia', 'dev', 'consulting', 'excerpts', 'news', 'design', 'settings'];
  expected.forEach(function (r) {
    assert.ok(entries.some(function (e) { return e.getAttribute('data-go') === r; }), '缺少入口：' + r);
  });
  entries.forEach(function (e) {
    const route = e.getAttribute('data-go');
    e.click();
    const cur = (h.window.location.hash || '').replace(/^#\/?/, '');
    assert.equal(cur, route, '入口 ' + route + ' 应可跳转');
  });
});

test('导航 IA：进入模块页时「更多」Tab 高亮', () => {
  const h = boot();
  h.goto('dev');
  const doc = h.window.document;
  const moreBtn = Array.from(doc.querySelectorAll('#nav button')).find(b => (b.textContent || '').includes('更多'));
  assert.ok(moreBtn.classList.contains('active'), '在模块页时「更多」应高亮');
});

test('导航 IA：页面总数仍为 11、路由 hash 解析不变', () => {
  const h = boot();
  ['home', 'today', 'memo', 'selfmedia', 'dev', 'consulting', 'reading', 'excerpts', 'news', 'design', 'settings']
    .forEach(function (r) {
      h.goto(r);
      const cur = (h.window.location.hash || '').replace(/^#\/?/, '').split('/')[0];
      assert.equal(cur, r, '路由 ' + r + ' 应正常解析');
    });
});
