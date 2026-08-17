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

### 试点 2：today（今日计划）——2026-08-17

- **选型**：today 为第二个标准模块消费方（251 行，集合 `state.tasks`，行为测试安全网 today-v3 / today-home-ux + 共享测试），排序语义（`order` 键）验证工厂对「带顺序的 CRUD」的通用性。quotes 经验证为纯函数工具（无 records 集合/无 CRUD），**不是**迁移候选，划出试点池。
- **决策**：
  1. **ModuleFactory v0.1.2 扩展（纯增量）**：`config.orderField`（启用保留键 `order`——add 自动分配 `collection().length`、编辑不刷；validate 仅允许 `'order'` 且与 `prepend: true` 互斥，非法配置立即失败）+ 新 API `move(id, dir)`（'up'/'down' 交换相邻并重写全集合 order 保连续；越界/未知 id 返回 false 无副作用；未配置 orderField 时抛 TypeError）。语义对齐既有 `store.reorderTask`。不配置时与 v0.1.1 行为完全一致（既有工厂测试零改动通过）。globals.d.ts 同步 `orderField?: 'order'` 与 `move(id, dir): boolean`。
  2. **today 迁移形态**：`id: 'tasks'` + `orderField: 'order'`，字段声明 title（text, required）/ note（textarea）/ date（date）/ priority（select p1-p4）/ done（boolean）/ doneAt（text，仅作 update patch 通道）；模块懒初始化；工厂 renderer 与页面 render 共用函数（路由守卫保留）；**done/doneAt 联动为页面层业务规则**（勾选写时间戳、取消置空——工厂不加钩子，框架克制）；home 的 `store.updateTask` 勾选路径与 `store.addTask` 等保留不动（共享同一 `state.tasks`，双写路径并存）；🍅 专注计时器为页面级瞬态（悬浮窗/通知/测试钩子），不进框架；删除撤销仍走 `store.undoRemove()`（P5a 切页守卫保留）。
  3. **XSS 白名单随迁**：innerhtml.test.js 人工审查白名单行号 87 → 129（同一赋值点 `listEl.innerHTML = html` 因文件重排位移，赋值点集合与插值安全性语义零变化——非新增赋值点，无需重审）。
- 实证：工厂扩展 5 项新契约测试（orderField 非法/互斥 / add 自动分配 / move 交换与边界 / 未配置抛错 / 跨实例持久化），全量 578 项绿（含全部 today 旧测试原样通过）；typecheck 与 lint 零错误；Playwright E2E 5/5（含「今日新建任务 → 全局搜索命中 → 跳转高亮」路径）；sw.js 缓存 v37 → v38。
- 回滚预案：本批两笔独立提交（92933b4 工厂扩展 / f03b984 today 迁移），任一阶段测试失败即停；单批 `git revert` 即可，数据无迁移动作、无需数据回滚（today 记录仍写同一 `state.tasks`，无 storage key / schema 变更）。

### 试点评估检查点（2026-08-17，memo + today 迁移后）

依据 docs/plan-framework-review.md 四查结论（只读评估，无代码变更）：

1. **工厂健康 ✅**：无按模块分叉的特判，v0.1.1/v0.1.2 扩展全部配置化（单开关字段），文件 305 行无失控膨胀；新行为均有契约测试锁定。
2. **能力使用率 ✅**：add/update/remove/render/prepend/timeField/orderField/move 全部有真实消费方；`query`/`getById`/`destroy`/`unsubs` 为"契约待消费"（页面模块与应用同生命周期，无销毁场景）——契约测试锁定，保留不删。
3. **渲染重复度不显著 → VisualEngine 未达进框架阈值**：memo/today 为"风格相似"（共用 UI 类名与 UI.el/esc 助手）而非逐字复制；共享原语已在 UI 层沉淀（如 emptyState）。**待办：绑定模式收敛**——memo（按钮闭包逐个绑）与 today（容器委托）两套写法并存，dev 迁移时强制采用委托写法，三模块对比后委托胜出则回头统一 memo（触发条件：dev 迁移完成；该待办为"代码漂亮"级，优先级最低，行为不变、测试全绿即可）。
4. **缺口分类：无新通用缺口**；删除+撤销流程（confirmBox→remove→toast+撤销→P5a 守卫）两次出现，属页面层业务流程非渲染，第 3 个模块再出现才考虑抽取。

**决策**：走路径 B——试点三候选 dev（速查手册，页面薄、风险小；其嵌套结构「项目分组→任务」可验证工厂对嵌套集合的边界，正式迁移前须先做选型侦查）。
- 回滚预案：三批独立提交（11521dd 工厂扩展 / ec867e9 memo 迁移 / docs），任一阶段测试失败即停；单批 `git revert` 即可，数据无迁移动作、无需数据回滚。
