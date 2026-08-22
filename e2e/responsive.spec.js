/* e2e/responsive.spec.js - 三端视口冒烟（桌面/手机/平板）
 * 断言：无横向溢出滚动（游戏容器内滚动除外）、导航可见可点、弹窗不出屏
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

/** 导航到指定模块并等待内容渲染 */
async function gotoModule(page, btnText) {
  /* 手机/平板：底部导航可能需要滚动才能看到按钮 */
  const btn = page.locator(`#nav button:has-text("${btnText}")`);
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
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
  const modules = ['今日', '快速备忘', '数据与设置'];
  for (const mod of modules) {
    await gotoModule(page, mod);
    expect(
      await hasHorizontalOverflow(page),
      `模块「${mod}」存在横向溢出`
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
  /* 验证至少可以导航到 3 个不同模块并返回 */
  const targets = ['今日', '快速备忘', '数据与设置'];
  for (const t of targets) {
    await gotoModule(page, t);
    await expect(page.locator('#pageTitle')).toContainText(t.replace('数据与设置', '数据'));
  }
});
