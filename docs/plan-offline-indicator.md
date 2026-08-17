# 方案：离线状态指示器

> 状态：**待评审**（用户过目后开工）
> 日期：2026-08-17

## 一句话

浏览器断网/恢复联网时，页脚自动切换「在线就绪」与「当前离线」提示，让用户明确知道当前能否同步、数据是否安全。

## 为什么做（背景）

- CHANGELOG v6.0 计划节列出「离线状态指示器」，是 38 项审计清单遗留的 UX 待办。
- 现状是**半成品**：页脚已有两个静态元素（`index.html:58-59` 的 `#netOnline` / `#netOffline`，离线时红色高亮样式 `style.css:393` 也已存在），`pwa.test.js:62` 已断言在线文案存在——但**全库没有任何 JS 控制这两个元素的显隐**，`navigator.onLine` 与 `online`/`offline` 事件监听均不存在。
- 因此离线提示永远不会出现，等于一个永不生效的占位。

## 改动点（全部收敛在一个文件）

| 文件 | 改动 |
|---|---|
| `js/app.js` | 新增约 20 行：`applyNetState()`（按 `navigator.onLine` 切显隐）+ `online`/`offline` 事件监听 + 启动时初始化。复用现有 `#netOnline` / `#netOffline` 元素，不新增 DOM、不新增 CSS。 |

## 行为契约

- 初始加载：按 `navigator.onLine` 显示对应元素（在线显示 `#netOnline`，离线显示 `#netOffline`）。
- 断网：`offline` 事件触发 → 隐藏在线、显示离线（红色高亮）。
- 恢复：`online` 事件触发 → 反向切换。
- 只操作 `hidden` 属性，不动其他元素；无 innerHTML、无新样式、无新事件名。

## 验证

- **新增测试** `tests/offline-indicator.test.js`：用 harness 的 `boot()` 断言
  1. 初始在线 → `#netOnline` 可见、`#netOffline` 隐藏；
  2. 派发 `offline` 事件 → 切换正确；
  3. 派发 `online` 事件 → 恢复正确；
  4. 初始离线（模拟 `navigator.onLine=false`）→ 直接显示离线提示。
- **回归**：`npm test`（583 项基线全绿，578 旧基线 + 新增 5 项）、`npm run typecheck`、`npm run lint`。
- **E2E**：`npm run test:e2e`（5 项冒烟全绿，断言 v40 缓存版本）。
- **同步**：内容指纹变化 → `npm run sync-sw`（v40 → v41），随后同步 CHANGELOG / AGENTS / ADR。

## 提交计划

- 单个提交：代码 + 测试 + 文档（本方案 + CHANGELOG/AGENTS/ADR-011 追加）。改动面小、单层（仅 app.js），不跨层。
- 推送 main 触发双站自动部署。

## 失败回滚

- 一条命令回滚该提交；`#netOnline` / `#netOffline` 回到静态占位状态，与现状一致，无数据风险。
- 不改存储、不碰加密、不涉迁移，数据层零接触。

## 备注

- 不引入「网络可达性探测」（如周期性 fetch 探活）——那是过度设计，`navigator.onLine` 已覆盖「断网/恢复」这一用户实际感知场景。
- 纯 JS 单文件改动，符合框架克制原则。
