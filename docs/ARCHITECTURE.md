# Sonder520 技术架构（当前 · v6.x）

> 本文档描述**当前代码真实结构**（与代码同步维护）。历史决策的来龙去脉见 [adr/](./adr/README.md)，历史方案见 [plans/](./plans/README.md 对应的 v6 系列)。
> 维护约定：任何文件新增/移动/职责变化，必须同步更新本文档与 `index.html` 的脚本顺序。

---

## 1. 分层总览

```
┌─────────────────────────────────────────────────────────────┐
│ Application 应用层（10 页面 + 壳层）                           │
│   home / today / memo / selfmedia / dev / consulting /      │
│   reading / news / design / settings                        │
│   + desktop-pet（小莫灵家族）· games（六款游戏）               │
└─────────────────────────────────────────────────────────────┘
                            ↓ 页面只做「读规则结果 + 落盘」
┌─────────────────────────────────────────────────────────────┐
│ Domain 领域规则层（纯函数，无 DOM/存储）                       │
│   js/domain/task-domain.js —— 任务完成/重开语义               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Repository 数据访问边界（js/repositories/，9 个薄包装）         │
│   task / book / dev / settings / clients / games /          │
│   memos / news / design                                     │
│   统一 get/getAll/create/update/remove（委托 Store 领域方法）  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ ModuleFactory + Store 领域扩展（js/framework/ + js/）          │
│   store.js（核心构造/加密/helper）+ 10 领域文件 + store-stats   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ VisualEngine + EventBridge（ui.js 渲染/弹窗 + SonderBus 事件） │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TrustLayer 安全存储层（写锁收口 ADR-013，IDB 真源 ADR-014）     │
│   IDB 主存储 + localStorage 副本 + 可选加密（AES-GCM-256）     │
└─────────────────────────────────────────────────────────────┘
```

## 2. 数据层文件职责（js/）

| 文件 | 职责 |
| --- | --- |
| `store.js` | 核心：Store 构造、状态归一化、加密/解密与快照辅助（红线：`_storeWrite` 写锁收口、`_encSave`/`_decryptParse`）、共享 helper 与 `_h` 白名单 |
| `store-stats.js` | 纯函数统计/聚合层（任务分组、自媒体/开发/阅读统计、CSV 等，无 Store 依赖） |
| `store-report.js` | `summarize` / `buildWeeklyReport`（计算委托 store-stats） |
| `store-tasks.js` | 快速备忘 + 今日计划领域方法 |
| `store-media.js` | 自媒体 + 开发工作 + 技术笔记/代码片段 |
| `store-content.js` | 咨询 + 阅读/书摘 + 新闻 + 设计 + 游戏记录 |
| `store-settings.js` | 主题/壁纸/提醒/模块开关/难度/帧率 |
| `store-undo.js` | 删除撤销（`_undoPush`/`undoRemove`） |
| `store-persistence.js` | 持久化核心：LS/IDB 读写、`save`/`_commit`、写锁收口 `_storeWrite`（ADR-013）、`_loadColsMerge`/`_backfillCols` |
| `store-migration.js` | legacy 拆分迁移 + IDB 启动读取（`loadIdb`/`migrateToIdb`/`_splitLegacy`） |
| `store-import-export.js` | 备份导出/导入/清空（`readSnapshot`/`exportBackup`/`importBackup`/`clearAll`） |
| `encryption.js` | 可选加密核心：PBKDF2（60 万次）+ AES-GCM-256、密文分支、锁屏、串行加密链、派生密钥缓存 |
| `event-bus.js` | SonderBus 事件总线：store 变更发布 → 页面订阅自动重绘 |

> 领域文件均为 UMD 模式：Node 由 `store.js` 的 UMD 分支 `require` 注入 `(Store, _h)`；浏览器由 `index.html` 顺序加载、经 `root.SonderStore.Store` 与 `_h` 注入。**新增领域方法请写入对应领域文件，勿回 store.js。**

## 3. Repository 层（js/repositories/）

9 个薄包装，统一接口 `get / getAll / create / update / remove`（`reorder` 仅 task）：

| Repository | 委托集合 | 备注 |
| --- | --- | --- |
| `task-repository.js` | tasks | + reorder |
| `book-repository.js` | books | |
| `dev-repository.js` | devProjects/devNotes | |
| `settings-repository.js` | settings | |
| `clients-repository.js` | clients/followups/incomes | |
| `games-repository.js` | games | |
| `memo-repository.js` | memos | 工厂封装（Phase 5 提炼） |
| `news-repository.js` | news | 工厂封装（Phase 5 提炼） |
| `design-repository.js` | designs | 工厂封装（Phase 5 提炼） |

- 行为与直接调 Store 领域方法完全一致（含 commit/事件/undo），只换访问边界。
- memos/news/designs 的 `CONFIG` 留在页面单源（design 依赖页面 STAGES）。
- 浏览器入口：`index.html` 加载 `js/repositories/*.js`；Node 入口：`module.exports` 返回 `createXRepository(store, config)` 工厂。

## 4. Domain 规则层（js/domain/）

| 文件 | 规则 | 使用方 |
| --- | --- | --- |
| `task-domain.js` | `complete(task, now)`：未完成→patch；已完成→null（不可重复完成，不覆盖原 doneAt）。`reopen(task)`：已完成→patch；未完成→null | today.js（勾选/取消 → TaskDomain 裁决 → Repository 落盘） |

规则被拒时页面回滚 UI。Domain 纯函数禁止引入 DOM/存储依赖。

## 5. 页面与壳层

- **10 页面**：`home / today / memo / selfmedia / dev / consulting / reading / news / design / settings`，经 ModuleFactory 标准模块协议（memos/news/designs 走 Repository 包装）。
- **扩展**：`desktop-pet-*.js`（小莫灵家族：数据/逻辑/页面）、`games-*.js`（六款游戏：logic/shared/view/mini/battle/page）+ `game-worker.js`（五子棋 AI Worker）。
- **壳层**：`app.js`（路由/主题/帧率/警示条/离线指示）、`error-guard.js`（错误上报）、`search.js`（全局搜索）、`quotes.js`（每日金句）、`markdown.js`、`motion.js`（微动效）、`sw-register.js` + `sw.js`（PWA 离线，缓存版本 `sonder-v123`，`npm run sync-sw` 自动同步）。
- **ui.js**：弹窗/Toast/表单 + 统一 sanitize 净化（XSS 防线，`selectValues` 支持 `{value,label}` 对象选项）。

## 6. 关键加载顺序（index.html，51 个脚本）

```
encryption → event-bus → store-stats → store.js
  → ModuleFactory → store-report → store-undo → store-persistence
  → store-migration → store-import-export → store-tasks → task-repository
  → task-domain → store-media → dev-repository → store-content
  → book/clients/games-repository → store-settings → settings-repository
  → memo/news/design-repository → ui → motion → error-guard → search
  → quotes → markdown → 页面（home…settings）→ 游戏 → 桌面玩偶 → sw-register → app
```

> 依赖规则：领域 store 文件必须在 `store.js` 之后；Repository 在对应 store 之后；task-domain 在 today.js 之前；`app.js` 最后（路由就绪）。

## 7. 测试体系

- **入口**：`npm test`（jsdom + `node --test` glob 全量 + fake-indexeddb），当前 **770 项**。
- **关键契约**：`tests/harness.js` 从 `index.html` 解析脚本顺序（**加 script 无需改 harness**）；`type-sync.test.js` 校验 `globals.d.ts` 与全部 Store 领域文件方法一致（新领域文件须加入其扫描清单）；`store-write-unified.test.js` 门禁 `_idbWriteCols` 只能在 `_storeWrite` 体内（ADR-013，指向 `store-persistence.js`）；`innerhtml.test.js` 赋值点白名单（12 处，行号随页面改动同步）。
- **配套**：`npm run typecheck`（零构建 tsc）+ `npm run lint`（0 error）。

## 8. 数据与安全红线（勿动）

- **ADR-013** 写锁收口：全部写路径（save/_commit/加密/迁移/导入）必须经 `_storeWrite`（在 `store-persistence.js`）。
- **ADR-014** IDB 主快照 = 真源，LS 副本兜底；平局取 IDB。
- **加密协议**：`encryption.js` 版本化密文 bundle（`ENC_FORMAT`），未来版本原样保留不破坏；`_encSave`/`_decryptParse` 留在 `store.js`。
- **数据格式**：集合字段（`done/doneAt`、`order`、`archived` 等）为既有契约，Domain/Repository 不得改字段名（task-domain 的 completed/completedAt 仅为方案示意名）。
