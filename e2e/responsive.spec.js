/* e2e/responsive.spec.js - 三端视口冒烟（桌面/手机/平板）
 */
const { test, expect } = require('@playwright/test');

/* ---------- 辅助 ---------- */

/** 检测 document 是否出现横向溢出滚动 */
async function hasHorizontalOverflow(page) {
  return page.evaluate(() => {
    const docEl = document.documentElement;
    return docEl.scrollWidth > docEl.clientWidth;
  });
}

/** 导航到指定模块并等待内容渲染。
 * 底部导航现为 5+1（4 页 + 更多）；设置等入口位于「更多」面板，需先开面板再点 data-go。 */
async function gotoModule(page, btnText, moreRoute) {
  if (moreRoute) {
    await page.click('#nav button:has-text("更多")');
    await page.click(`#morePanel [data-go="${moreRoute}"]`);
  } else {
    const btn = page.locator(`#nav button:has-text("${btnText}")`);
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
  }
  await page.waitForTimeout(300);
}

/* ---------- 测试 ---------- */

test('响应式：首页无横向溢出', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#pageTitle')).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);
});

test('响应式：导航栏可见且可点击', async ({ page }) => {
  await page.goto('/');
  /* 至少有一个导航按钮可见 */
  const navBtns = page.locator('#nav button');
  await expect(navBtns.first()).toBeVisible();
  const count = await navBtns.count();
  expect(count).toBeGreaterThan(0);

  /* 点击「今日计划」验证导航生效 */
  await gotoModule(page, '今日');
  await expect(page.locator('#pageTitle')).toContainText('今日');
});

test('响应式：各模块页面无横向溢出', async ({ page }) => {
  await page.goto('/');
  const modules = [
    { text: '今日' },
    { text: '备忘' },
    { more: 'settings' },
  ];
  for (const mod of modules) {
    await gotoModule(page, mod.text, mod.more);
    expect(
      await hasHorizontalOverflow(page),
      `模块「${mod.text || mod.more}」存在横向溢出`
    ).toBe(false);
  }
});

test('响应式：搜索面板在手机端全宽不出屏', async ({ page }) => {
  await page.goto('/');
  await page.fill('#globalSearch', '测试');
  const panel = page.locator('#gsearchPanel');
  /* 搜索面板出现后检查不溢出 */
  await page.waitForTimeout(300);
  const box = await panel.boundingBox();
  if (box) {
    const vp = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1); /* 1px 容差 */
  }
});

test('响应式：底部栏/侧栏导航功能完整', async ({ page }) => {
  await page.goto('/');
  /* 验证至少可以导航到 3 个不同模块（含更多面板入口）并返回 */
  const targets = [
    { text: '今日', exp: '今日' },
    { text: '备忘', exp: '备忘' },
    { more: 'settings', exp: '数据' },
  ];
  for (const t of targets) {
    await gotoModule(page, t.text, t.more);
    await expect(page.locator('#pageTitle')).toContainText(t.exp);
  }
});
