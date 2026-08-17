# ADR-011：试点迁移协议与 memo 入厂（标准模块工厂首个生产消费方）

- 状态：已采纳
- 背景：Sonder-Frame 渐进式改造进入 Phase 7（模块迁移）。框架层已齐备：ModuleFactory v0.1（ADR-009）+ EventBridge v0.1（ADR-010）+ TrustLayer（Phase 1/2）。本 ADR 确立**试点迁移协议**（第一原则「旧系统 + 新框架 → 迁移一个模块 → 全量测试 → 下一个」的落地细则），并记录首个试点（快速备忘 memo）的迁移决策。
- 试点选型理由：memo 为全项目最小标准模块（105 行）、数据形态最简单（text/time/archived 三字段）、行为测试安全网最厚（home-memo-ux / smoke / qa / sanitize / search / modules-smoke 等 8+ 文件锁死 DOM 与数据契约）；不选 quotes（62 行更小但带 ESM 试验田双实现一致性测试，牵扯大）。
- 决策：
  1. **迁移协议（此后每模块遵循）**：
     - 文件不改名、不换加载位置（shell.test.js 脚本序断言零改动）；页面契约（Pages.* / DOM 选择器 / 事件订阅语义）零变更——旧行为测试原样全绿是成功判据，**禁止先改测试逃避**。
     - 数据写同一 `store.state.<集合>` + 同一 save/_emitChange 路径（不改 storageKey、不搬数据、不碰加密/备份/导入/多标签写锁）；store 领域 API（如 addMemo）**保留**——其他调用方（home/app）不得因本模块迁移而改动。
     - 渲染用工厂 customRender（模块自带渲染，复用 ctx.UI 助手）；**VisualEngine 暂不进框架**——等 2-3 个模块迁移后证明重复需要（框架克制）。
     - 事件订阅改经 EVENT 表（ADR-010 纪律），unsubscribe 保存（模块销毁清理契约）。
     - 工厂缺口由"配置级小扩展"补齐（validate → normalize → freeze 三件套同步更新 + globals.d.ts 类型同步），**必须纯增量**：既有工厂测试零改动通过。
  2. **ModuleFactory v0.1.1 扩展**（迁移试点前置，纯增量）：`config.prepend`（add 最新在前，默认 append）与 `config.timeField`（集合时间戳字段名——新增写入、编辑不刷、配置后不生成默认 createdAt/updatedAt；validate 拒绝非字符串/空/保留键/与字段 key 冲突）。不配置时行为与 v0.1 完全一致。
  3. **memo 迁移形态**：`id: 'memos'` + `prepend: true` + `timeField: 'time'`，字段声明 text（textarea, required）/ archived（boolean）；模块懒初始化（首次渲染/操作时 createModule，ctx.store 注入）；工厂 renderer 与页面 render 共用同一绘制函数（路由守卫保留）；删除撤销仍走 `store.undoRemove()`（P5a 切页守卫保留）；home/app 的 `store.addMemo` 调用保持不变。
  4. **类型契约同步**：globals.d.ts `SonderModuleConfig` 补 `prepend?: boolean` / `timeField?: string`；消费方配置以 `@type {SonderModuleConfig}` 注解（首个真实消费暴露的缺口：字段 type 字面量需类型收窄，注解后 typecheck 归零）。
- 代价：memo.js 从 105 行增至 144 行（工厂接线 + 契约注释）；工厂文件增 ~20 行；globals.d.ts 增 2 个可选字段。运行期零新依赖、零行为变化（573 项测试含全部 memo 旧测试原样通过）。
- 实证（2026-08-17）：工厂扩展 4 项新契约测试（非法配置拒绝 / prepend 最前 / timeField 新增写编辑不刷 / 组合跨实例持久化），全量 573 项绿；typecheck 与 lint 零错误；Playwright E2E 5/5（含「新建→刷新→还在」路径）；sw.js 缓存 v36 → v37。
- 回滚预案：三批独立提交（11521dd 工厂扩展 / ec867e9 memo 迁移 / docs），任一阶段测试失败即停；单批 `git revert` 即可，数据无迁移动作、无需数据回滚。
