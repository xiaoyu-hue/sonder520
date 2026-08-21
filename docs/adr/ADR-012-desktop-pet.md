# ADR-012: 桌面玩偶独立 Specialized 模块架构

**状态：** 已采纳
**日期：** 2026-08-20
**决策者：** Sonder 项目

## 背景

v6.0 需要为 Sonder 落地「小莫灵家族桌面玩偶」养成系统（三角色 + 任务金币 + 商店喂养 + 成就互动）。该模块与现有 ModuleFactory CRUD 模块（today/memo/dev 等）在形态上差异显著：

- **交互模式不同**：玩偶是持续运行的浮层实体（rAF 驱动动画），不是静态页面 CRUD。
- **状态结构不同**：数据是嵌套对象（coins/inventory/affection/achievements/statistics），不是扁平 records 数组。
- **UI 形态不同**：浮层 DOM（SVG 玩偶 + 气泡 + 弹窗），不是列表/表单页面。

若强行塞入 ModuleFactory，需要为它特判多种分支（非 records 数组、非 CRUD、嵌套状态），违反「工厂只处理标准模块」原则。

## 决策

**桌面玩偶采用独立 Specialized 模块架构**，与 games.js 同先例：

1. **核心 `desktop-pet.js`**（UMD/ES5/严格模式）：暴露 `window.DesktopPetCore`（配置表 + Pet/PetFamily 类）+ `window.__desktopPetFamily`（实例，由 autoInit 创建）。不依赖 ModuleFactory，只共享 SonderBus/SonderStore。
2. **页面 `desktop-pet-page.js`**（UMD）：注册 `Pages['desktop-pet']`，五分区布局（标题栏+金币、三角色卡、显示设置、商店预览、成就列表）。依赖核心模块的 PetFamily 实例。
3. **数据存 `store.state.settings.desktopPet`**：复用集合级持久化（LS 双写 + IDB + 加密 bundle + 备份），经 `store._commit('settings')` 走标准写路径。不在 ModuleFactory 注册，不创建独立集合。
4. **金币信号用结果态**：总线 `/data/tasks` 无载荷，CoinManager 订阅后遍历 `store.state.tasks` 判定完成态。避免事件载荷耦合。
5. **深合并独立函数**：`mergeDesktopPetDefaults(raw)` 独立于 `mergeSettings`（后者是白名单浅合并，会丢弃 desktopPet 嵌套字段）。
6. **模块开关**：`settings.modules['desktop-pet']` 控制导航显隐，`settings.desktopPet.enabled` 控制玩偶运行——双开关独立。

## 理由

- **避免工厂膨胀**：ModuleFactory 为标准 CRUD 模块设计（records 数组 + prepend/append + timeField），桌面玩偶的嵌套状态和持续运行实体不适配。强塞入需要 if/else 特判，增加认知负担。
- **games.js 先例已验证**：games.js 同为 Specialized 模块（独立游戏逻辑 + 页面注册），运行稳定，测试全绿。
- **共享层足够**：TrustLayer（持久化）、EventBridge（事件总线）、VisualEngine（CSS 变量）三层共享，不需要 ModuleFactory 的 CRUD 抽象。
- **数据安全无降级**：复用集合级持久化路径（settings 集合），加密/备份/迁移机制与现有模块完全一致。

## 后果

- **正面**：模块自包含，可独立开发/测试/维护；不污染 ModuleFactory 代码；数据安全继承现有机制。
- **负面**：两套模块注册路径（ModuleFactory + Pages 手动注册），新贡献者需理解两种模式。但 Sonder 已有 games 先例，且模块数量有限（仅 games + desktop-pet 两个 Specialized），复杂度可控。
- **风险**：若未来 Specialized 模块增多（>5 个），可能需要抽象公共基类。当前 2 个不构成风险。
