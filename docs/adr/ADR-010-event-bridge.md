# ADR-010：跨模块事件总线契约（EventBridge v0.1）

- 状态：已采纳
- 背景：Sonder-Frame 渐进式改造（v6.0 主线）继续推进。ModuleFactory v0.1（ADR-009）已落地，但框架缺正式事件总线配套——现有 `js/event-bus.js`（SonderBus）自早期版本就承担 store 数据变更广播与页面重绘通知，功能可用但存在三处规范缺口：(1) 事件名是散落魔法字符串（`'/data/'+list` 拼接在 store.js、`'/store/yielded'` 字面量、12 个页面文件各自写死订阅路径），(2) 无 payload 契约（谁发/谁听/结构/缺字段行为未文档化），(3) 订阅清理纪律未固化（`on` 虽已返回 unsubscribe，但无契约测试与文档约束）。先补总线再迁移试点，避免迁移返工。
- 决策：
  1. **收编不重写**：`js/event-bus.js` 原地升级，导出对象新增冻结常量表 `EVENT`（`DATA_ALL: '/data/all'`、`STORE_YIELDED: '/store/yielded'`、生成器 `data(key) → '/data/<集合>'`），既有 API（`bus/matches/on/off/emit/reset`）、通配匹配规则、单订阅者异常隔离、Node `require` 路径全部不变——存量页面模块订阅照常工作，无需改动。
  2. **store.js 广播经常量表**：`_emitChange` 与 `_absorbNewer` 改经 `dataEvent()` 辅助（浏览器取 `SonderBus.EVENT`，Node 独立加载时回落等价字面量，两条路径输出恒等）。现有 `store-write-lock` 等测试断言的字面量路径不变，既有行为零变更；改表即改广播（契约可测）。
  3. **payload 契约固化**（事件名真源 + 文档化于 event-bus.js 头部）：`/data/<集合>` 由 store 集合方法持久化成功后广播、detail 恒为 undefined、订阅者只依赖 path；`/data/all` 全量变更（导入/清空/锁定解锁/加解密切换）；`/store/yielded` 多标签让位吸收、app.js 提示。
  4. **订阅纪律**：`SonderBus.on` 返回 unsubscribe 为契约（重复取消幂等）；新框架代码一律经 `EVENT` 表，禁止书写魔法字符串路径；订阅返回值必须保存、销毁时调用（destroy 完整清理）。存量页面模块维持字面量订阅（兼容），收编改造随各模块迁移逐模块进行——不属于 v0.1 范围。
  5. **类型补齐**：globals.d.ts 新增 `SonderBusEventMap` / `SonderBusInstance` / `SonderBusApi` 声明（此前经 `noImplicitAny:false` 静默通过，无类型文档）。
- 代价：store.js 增加一个 11 行辅助函数；存量字面量订阅短期内与常量表并存（双写源），以契约测试双向锁死（常量值恒等于既有断言字面量），随迁移收敛。
- 实证（2026-08-17）：8 项契约测试（常量表冻结与恒等 / data 生成器等价 / 广播经表收编生效 / Node 回落等价 / 让位经表 / detail 契约 / unsubscribe 幂等 / DATA_ALL 语义），全量 569 项绿（561 → 569）；typecheck 与 lint 零错误零警告；sw.js 缓存指纹 v35 → v36。
