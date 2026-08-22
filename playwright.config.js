/* playwright.config.js - 冒烟 E2E：三端（桌面/手机/平板）真实渲染验证 */
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'node e2e/serve.js',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120000
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } }
    },
    {
      name: 'mobile-ios',
      use: { browserName: 'webkit', viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true }
    },
    {
      name: 'tablet-ipad',
      use: { browserName: 'webkit', viewport: { width: 768, height: 1024 }, hasTouch: true }
    }
  ]
});
