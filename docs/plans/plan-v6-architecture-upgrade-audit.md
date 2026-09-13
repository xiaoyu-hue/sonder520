# Sonder520 当前架构审计（v6.x 架构升级 · 第一阶段）

> 基线：main @ f0b620e（2026-09-13）
> 依据：真实代码（js/ 共 39 个文件 12,747 行；tests/ 共 79 个文件 12,310 行），非 README 描述
> 方法：只读分析，未修改任何代码

---

## 1. 一句话结论

Sonder520 不是"没有架构"，而是**架构已经分层（UI → 框架 → Store → 基础设施），但业务访问数据的路径分裂成两条**：一部分模块走 ModuleFactory 的封装（半 Repository），另一部分仍然直连 Store 的领域方法。v6.x 升级的核心动作不是"重建分层"，而是**把散落在各页面的直连调用，统一收进一层清晰的数据访问边界（Repository）**。

---

## 2. 当前架构图（真实，基于代码）

```
┌─────────────────────────────────────────────────────────────┐
│  UI 层：13 个路由（app.js NAV）                              │
│  home / today / memo / selfmedia / dev / consulting /        │
│  reading / excerpts / news / design / game / desktop-pet /   │
│  settings                                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ ctx.store / ctx.UI / ctx.navigate / __sonderHooks
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  页面模块层（9 个用 SonderModule 声明，其余直写函数）          │
│  today / memo / reading / settings / selfmedia / dev /       │
│  consulting / news / design / games* / desktop-pet           │
│                                                              │
│  路径 A（封装）：memo / news / design                        │
│      ModuleFactory.createModule → 返回 add/update/remove     │
│      （模块不直接碰 store.save，已有数据访问边界）            │
│  路径 B（直连）：today / reading / settings / selfmedia /    │
│      dev / consulting / games                                │
│      直接调 store.addTask / updateBook / setTheme /         │
│      updatePost / addGameRecord …                            │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Store 层（中心）                                            │
│  store.js（1,837 行）+ 6 个领域扩展：                        │
│    store-tasks / store-settings / store-content /           │
│    store-media / store-stats / store-report                  │
│  ─ 状态容器 + normalize（14 个核心集合）                     │
│  ─ 集合注册（_registerCollection）                           │
│  ─ 写路径收口 _storeWrite（ADR-013，测试门禁防绕过）          │
│  ─ 加密入口（enableEncryption/unlock/lock…）                 │
│  ─ 迁移（_migrateLegacyIfNeeded/_splitLegacy…）              │
│  ─ Undo（_undoPush/undoRemove）                              │
│  ─ 导入导出（exportBackup/importBackup/readSnapshot）        │
│  ─ 配额诊断（storageUsage/getStorageStatus…）                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  基础设施层                                                 │
│  IndexedDB（sonder-db，主存储，ADR-014）                    │
│  localStorage（副本/回退/跨标签信号）                        │
│  SonderCrypto（encryption.js，PBKDF2 + AES-GCM）             │
│  SonderBus（event-bus.js，14 个文件订阅 /data/<集合>）        │
│  Service Worker（PWA 缓存，sync-sw 指纹门禁）                │
└─────────────────────────────────────────────────────────────┘
```

**两条数据路径是本次审计最重要的发现**：

| 路径 | 模块 | 现状 | 含义 |
|---|---|---|---|
| A：工厂封装 | memo / news / design | 经 createModule 拿 add/update/remove | **数据访问边界已存在**，可直接提炼为 Repository |
| B：Store 直连 | today / reading / settings / selfmedia / dev / consulting / games | 页面直接调 store 的领域方法 | **v6.x 主要迁移对象** |

---

## 3. Store 职责地图

store.js（1,837 行）承担以下职责。每项给出位置、调用方、迁移适宜度与风险。

| # | 职责 | 代码位置（store.js） | 调用方 | 迁移适宜度 | 风险 |
|---|---|---|---|---|---|
| 1 | 状态容器 + normalize | 状态区 + `_commit` / `save` | 全部页面 + ModuleFactory | **保留**（Store 最终定位之一） | 低 |
| 2 | 集合注册 | `_registerCollection`（:510） | ModuleFactory | 保留（配合 Repository） | 低 |
| 3 | **持久化写路径** | `_storeWrite`（:917）/ `_idbWriteCols`（:752）/ `_persistLocal`（:602）/ `flushPersist`（:738） | save / 各领域方法 | 保留（已是 Persistence 雏形，ADR-013 门禁保护） | **高，勿动** |
| 4 | IndexedDB 层 | `openIdb` / `idbReady` / `idbPut` / `idbDel` / `idbGet` / `loadIdb`（:977） | 写路径 + store-settings（壁纸） | 可下沉 `infrastructure/persistence/` | 高 |
| 5 | localStorage 层 | `_persistLocalColsSync` / `_bindStorageWatch`（:691，跨标签） / `_doLocalFlush` | 写路径 + 跨标签同步 | 可下沉 | 高 |
| 6 | 加密入口 | `enableEncryption`（:1374）/ `unlock`（:1425）/ `lock`（:1366）/ `disableEncryption`（:1457）/ `_encSave`（:864） | settings / app（锁屏） | 可下沉 TrustLayer | 高（行为不可变） |
| 7 | 迁移 | `_migrateLegacyIfNeeded`（:1009）/ `_splitLegacy`（:1027）/ `_absorbNewer`（:626）/ `_markGranular`（:1099） | loadIdb / importBackup | 可拆 `migration.js` | 中（有测试覆盖） |
| 8 | Undo | `_undoPush`（:502）/ `undoRemove`（:516） | 页面（today/reading 等） | 可拆 `undo.js` | 中 |
| 9 | 导入导出 | `exportBackup`（:1705）/ `importBackup`（:1723）/ `_importEncBackup`（:1757）/ `readSnapshot`（:1615）/ `clearAll`（:1696） | settings / 测试 | 可拆 `import-export.js` | 中 |
| 10 | 配额诊断 | `storageUsage`（:1264）/ `getStorageStatus`（:1295）/ `diagnostics`（:1328） | settings / app | 可拆 | 低 |
| 11 | **领域方法（已物理拆分）** | store-tasks（90 行）/ store-settings（146）/ store-content（289）/ store-media（137）/ store-report（106） | 各页面 | **逻辑仍属 Store**，迁移路径见 §5 | 中 |

> 结论：方案对"store.js 太聪明"的判断成立，但**拆分已经发生了一半**（职责 11 已物理拆出 6 个文件），剩余工作是"逻辑边界"而非"物理拆分"。

---

## 4. 已有的架构成果（执行时必须基于这些，不能重复做）

| 成果 | 位置 | 说明 |
|---|---|---|
| 领域扩展拆分 | store-*.js × 6 | 按领域拆方法，缩小核心体积 |
| 写路径收口 | `_storeWrite` + ADR-013 + 门禁测试 | 所有持久化必须经 `_storeWrite`，测试防绕过 |
| IDB 主存储反转 | ADR-014 | IDB primary / LS fallback 已定 |
| 模块工厂 | framework/ModuleFactory.js（305 行） | 集合级 CRUD + 校验 + 排序 + undo + 事件，**已具 Repository 雏形** |
| 事件总线 | event-bus.js（124 行）+ 14 个订阅方 | /data/<集合> 契约已稳定 |
| 统计纯函数层 | store-stats.js（235 行） | 无 Store 依赖，已是最佳实践 |
| 游戏逻辑隔离 | games-logic.js（593 行）0 次 store 调用 | 纯逻辑层 + Worker 自包含 |
| 加密独立层 | encryption.js（131 行） | SonderCrypto 契约稳定 |

---

## 5. Repository 候选分析

按"使用频率 × 业务复杂度 × Store 耦合 × 测试覆盖 × 数据访问模式"排序。**关键判据：该集合当前走路径 A（已有封装）还是路径 B（直连）**。

| 优先级 | 集合 | 当前访问方式 | 主要页面 | 数据访问模式 | 迁移难度 | 风险 |
|---|---|---|---|---|---|---|
| 1 | **tasks** | 路径 B（`addTask` / `reorderTask` / `undoRemove`，today.js） | today | 高频读写、排序、undo 介入 | **低**（store-tasks.js 已就位） | 低 |
| 2 | **books / excerpts** | 路径 B（`addBook` / `updateBook` / `removeExcerpt`，reading.js） | reading | 中频、进度更新、F-17 兜底刚加固 | 中 | 中 |
| 3 | **posts / devProjects / devNotes / devSnippets** | 路径 B（`updatePost` / `updateDevTask`，selfmedia.js / dev.js） | selfmedia / dev | 中频、内容长字段 | 中 | 中 |
| 4 | **settings** | 路径 B（`setTheme` / `setTaskReminder` / `setCustomWallpaper` 等） | settings / app | 低频、单例集合、含壁纸 IDB 单例（F-8） | 中 | 中 |
| 5 | **clients** | 路径 B（`updateClientFollowup`，consulting.js） | consulting | 低频、业务规则少 | 低 | 低 |
| 6 | **gameRecords / miniRecords** | 路径 B（`addGameRecord` / `updateMiniRecord`，games.js） | games | 低频、追加型 | 低 | 低 |
| 7 | **memos / news / designs** | **路径 A**（ModuleFactory 封装） | memo / news / design | 已有 add/update/remove 边界 | **最低**（提炼而非新建） | 低 |

> 建议：前 3 个（tasks / books / excerpts / posts 系）是"直连改收口"的收益最大区；memos/news/designs 只需把工厂返回对象正式命名为 Repository 并补边界测试。

---

## 6. Application Use Case 候选

只有"用户行为级操作"才值得建 Use Case（不是每个函数都建）：

| 候选 | 来源页面 | 现有落点 | 说明 |
|---|---|---|---|
| CompleteTask / ReopenTask | today | `store.addTask` + 页面逻辑 | 任务完成含业务规则（见 §7），第一刀验证场景 |
| ReorderTask | today | `store.reorderTask` | 排序规则 |
| AddBook / UpdateReadingProgress / RemoveExcerpt | reading | `store.addBook` / `updateBook` | 阅读进度 |
| SavePost / UpdateDevTask | selfmedia / dev | `store.updatePost` / `updateDevTask` | 内容保存 |
| ImportBackup / ExportBackup / MigrateToIdb | settings | `store.importBackup` 等 | 数据迁移用户操作 |
| AddGameRecord | games | `store.addGameRecord` | 游戏记录 |

> 注意：**不建议**为 setTheme/setWallpaper 这类"设置项"建 Use Case（直接经 SettingsRepository 即可），避免过度分层。

---

## 7. Domain 规则候选

真实业务规则目前**很少**，大部分集合是纯 CRUD。提取规则必须克制：

| 规则 | 现状 | 位置 |
|---|---|---|
| 任务完成语义（完成/重开/不可重复完成） | 页面内散落 | today.js |
| 任务排序（order 字段维护） | store-tasks.js | — |
| 阅读进度（progress 0-100 兜底） | F-17 已加固 | store-content.js |
| 咨询收入累计（income 字段兜底） | F-17 已加固 | store-content.js |
| 集合字段校验/必填 | ModuleFactory 已实现 | framework/ModuleFactory.js |

> 结论：Domain 层**不急**，等 Repository 稳定后从 tasks 开始提取 1-2 条真实规则即可。禁止创建空壳 Domain。

---

## 8. 保护清单（绝对不能动的）

1. `_storeWrite` 写路径收口 + 门禁测试（ADR-013）
2. IDB 主 / LS 副语义（ADR-014）
3. encryption.js 加密协议（PBKDF2 + AES-GCM 格式 `sonder-enc-v1` / `sonder-enc-backup-v1`）
4. ModuleFactory 的集合 CRUD 契约（已有契约测试）
5. event-bus.js 的 `/data/<集合>` 契约（14 个订阅方）
6. store-stats.js 纯函数导出键名（store.js / store-report.js 引用）
7. sync-sw 指纹门禁（scripts.test.js）
8. 测试体系（79 个文件，现有 708 用例为安全网）

---

## 9. 第一刀建议：TaskRepository

**选型依据**（§5 数据）：
- tasks 是最高频集合（today.js 是默认首页），迁移收益直观
- 当前直连调用最少且最简：`addTask` / `reorderTask` / `undoRemove`（+ 状态读）
- store-tasks.js（90 行）已承载领域方法，物理基础就位
- 测试覆盖：today 相关 + undo 契约测试齐全

**第一版形态**（保持行为不变）：

```
today.js ──► TaskRepository ──► Store（旧路径原样）──► IndexedDB
```

- `TaskRepository.get / getAll / create / update / remove / reorder`
- 内部先调旧 Store（`store.addTask` 等），**零行为变化**
- 目标：today.js 不再直接碰 store 领域方法，先建立稳定的数据访问边界
- 验证：npm test 全量（708）+ typecheck + lint 全绿，undo/事件行为不变

**明确不做**：不拆 store.js、不动 ModuleFactory、不动事件契约、不建 Domain 空壳。

---

## 10. 迁移路线图（对方案的细化）

| 阶段 | 动作 | 交付 | 停止条件 |
|---|---|---|---|
| 1（本次） | 只读审计 | 本文档 | 用户批准 |
| 2 | TaskRepository 第一版（内部调旧 Store） | 全量测试绿 | 边界测试覆盖 get/create/update/remove/reorder |
| 3 | today.js 迁移到 TaskRepository（一次一个行为） | 行为不变 | undo/事件测试绿 |
| 4 | 按 §5 顺序扩展 Repository（books → posts 系 → settings → memos 提炼） | 每集合一批 | 每批全量绿 + 新增调用方 |
| 5 | 拆 store.js 为 store-core / migration / undo / import-export | 职责边界 | 旧测试全绿 |
| 6 | 从 tasks 提取 Domain 规则 | 真实规则 1-2 条 | 有测试支撑 |

> 每阶段结束按执行方案 §25 输出汇报（目标/修改文件/兼容性/测试/风险/下一步）。

---

*本文档为架构升级第一阶段产物，只读分析，未修改任何代码。*
