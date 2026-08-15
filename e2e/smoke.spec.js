/* e2e/smoke.spec.js - 冒烟 E2E（真实 Chromium）
 * 覆盖：零错误加载 / CSP 零违规 / 静态资源完整性 / SW 注册-控制-离线可用 / 今日任务+全局搜索 / 游戏 AI 落子 / 导出备份
 * 依赖 DOM 契约（jsdom 测试同款）：#nav button、#tplAdd、.modal[data-k]、
 * #globalSearch、#gsearchPanel .gsearch-item、.search-flash、#gBoard .cell、#gStatus、#bkExport
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const CACHE = /CACHE = '([^']+)'/.exec(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8'))[1];

function collectBreaches(page) {
  const arr = [];
  page.on('pageerror', (e) => arr.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') arr.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => arr.push('requestfailed: ' + r.url() + ' ' + ((r.failure() || {}).errorText || '')));
  page.on('response', (r) => { if (r.status() >= 400) arr.push('http' + r.status() + ': ' + r.url()); });
  return arr;
}

test('冒烟: 首页零错误、CSP 零违规、静态资源全部 200', async ({ page }) => {
  const breaches = collectBreaches(page);
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push(e.violatedDirective + ' :: ' + e.blockedURI);
    });
  });
  await page.goto('/');
  await expect(page.locator('#pageTitle')).toBeVisible();
  await expect(page.locator('#nav button')).not.toHaveCount(0);
  expect(await page.locator('#content .card').count()).toBeGreaterThan(0);
  await page.waitForTimeout(800);
  expect(breaches).toEqual([]);
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
});

test('PWA: SW 注册-控制-离线可用，缓存为当前版本 ' + CACHE, async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const keys = await page.evaluate(() => caches.keys());
  expect(keys).toContain(CACHE);
  await page.context().setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#nav button')).not.toHaveCount(0);
  await expect(page.locator('#pageTitle')).toBeVisible();
  await page.context().setOffline(false);
});

test('工作流: 今日新建任务 -> 全局搜索命中 -> 跳转高亮', async ({ page }) => {
  const title = 'E2E 测试任务' + Date.now();
  await page.goto('/');
  await page.click('#nav button:has-text("今日")');
  await expect(page.locator('#pageTitle')).toContainText('今日');
  await page.click('#tplAdd');
  await expect(page.locator('.modal input[data-k="title"]')).toBeVisible();
  await page.fill('.modal input[data-k="title"]', title);
  await page.click('.modal [data-act="ok"]');
  await expect(page.locator('#content')).toContainText(title);
  await page.fill('#globalSearch', title);
  const item = page.locator('#gsearchPanel .gsearch-item').first();
  await expect(item).toBeVisible();
  await expect(item).toContainText(title);
  await item.click();
  await expect(page.locator('.search-flash')).toBeVisible();
});

test('游戏: 井字棋开局，AI 应自动落子', async ({ page }) => {
  await page.goto('/');
  await page.click('#nav button:has-text("娱乐游戏")');
  await page.click('.lg-pick[data-pick="tictactoe"]');
  await expect(page.locator('#gBoard')).toBeVisible();
  const before = await page.locator('#gStatus').textContent();
  await page.locator('#gBoard .cell').first().click();
  await expect.poll(() => page.locator('#gStatus').textContent()).not.toBe(before);
});

test('数据: 设置页导出备份可下载 JSON 文件', async ({ page }) => {
  await page.goto('/');
  await page.click('#nav button:has-text("数据与设置")');
  const dl = page.waitForEvent('download');
  await page.click('#bkExport');
  const d = await dl;
  expect(d.suggestedFilename()).toContain('.json');
});