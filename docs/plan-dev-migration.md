# dev 迁移方案：开发工作页迁入标准模块工厂（试点三）

- 日期：2026-08-17
- 状态：**已完成**（迁移落地：提交 b139e5b dev 试点三；578 项全绿、typecheck/lint 零问题、E2E 5/5；本批 002 文档同步中，缓存 v38 → v39）
- 前置：试点评估检查点（ADR-011）已定路径 B；dev 选型侦查已完成（本次方案依据侦查结果制定）

## 一句话

把开发工作页（dev）的三个数据集合迁入标准模块工厂——**不改工厂代码**（v0.1.2 能力已够），只改 dev.js 一个文件 + 同步测试白名单与文档；任务（嵌套数据）留在原领域 API，确立"嵌套不进工厂"边界。

## 侦查结论（已确认的事实）

- dev 页 = 三个标签（项目/技术笔记/代码片段）+ **三个集合**：`devProjects`（含嵌套任务列表）、`devNotes`、`devSnippets`。
- 领域 API 形状（store-media.js）：项目新建 **unshift**（最新在前）且生成 `tasks: []` + `createdAt`；笔记/片段含 `createdAt/updatedAt`，编辑刷新 updatedAt（置顶排序靠它）；**任务无撤销、片段删除无撤销**（历史如此）；项目/笔记删除进撤销栈。
- 测试安全网（很厚）：`tests/dev-v3.test.js` 7 项专测（标签切换 / 笔记 Markdown 渲染+编辑置顶 / 片段复制 / 新建上屏 / 数据层 CRUD）+ `modules-smoke` / `store.test` / `behavior.test`（默认形状）/ `search.test` / `smoke.test` 共享测试 + innerhtml 白名单 dev.js:109/111。
- **无新工厂缺口**：三个集合都能用现有 v0.1.2 能力描述（prepend + fields + 工厂默认时间字段），无需扩展工厂 → 验证复盘结论"无新通用缺口"。

## 迁移形态

### 1. 三个工厂模块实例（同一页面内，三份配置）

| 集合 | id | 关键配置 | 理由 |
|---|---|---|---|
| 项目 | devProjects | `prepend: true`；fields：name(text, required) + note(textarea) + tasks(array) | prepend 对齐 addDevProject 的 unshift；tasks 声明为 array 字段仅作默认保底，内部操作不碰 |
| 技术笔记 | devNotes | fields：title(text, required) + content(textarea) | 不配 timeField——工厂默认生成的 createdAt/updatedAt 与现形状一致，编辑自动刷新 updatedAt 满足"编辑后置顶" |
| 代码片段 | devSnippets | fields：title(text, required) + code(textarea, required) | 同上 |

### 2. 边界决策：嵌套任务不进工厂

任务的增删改（往某项目里加/改/删一条任务）是**内嵌数组局部操作**，工厂是整记录模型——**保留 `addDevTask/updateDevTask/removeDevTask` 领域 API**。该结论记入 ADR（嵌套集合边界）。

### 3. 绑定统一为委托写法（复盘待办第一次落地）

dev 内部按钮（项目卡/笔记卡/片段卡的编辑/删除/复制等）由闭包 onclick 改为 `data-*` 属性容器委托（今日计划模式）；编辑按钮改按 id 从 state 回查目标。行为零变化（选择器与 DOM 契约不动，测试全绿为证）。

### 4. 其余改动

- 渲染：整页重绘改由工厂 notify 统一驱动，提交/删除后的显式 `render(ctx)` 移除；**标签切换的 render 保留**（非工厂操作）。
- 订阅改经 EVENT 表（ADR-010），unsubscribe 保存。
- 模块懒初始化（ensureMod），工厂 renderer 与页面 render 共用绘制函数。
- storageKey 照例 'sonder_data_v1'（纯标识，数据仍写主快照同一集合）。
- innerhtml 白名单行号随迁（先例同 today：87→129）。

## 行为原样保留清单（不借机修）

1. 三个标签切换与 tabState 状态提升。
2. Markdown 渲染（MD.render 插 UI.el，MD 内部已 sanitize，XSS 测试锁定）与一键复制。
3. **删除撤销的不对称**：项目/笔记可撤销、任务/片段无撤销——历史行为，照旧。
4. **dev 撤销无 P5a 切页守卫**（现实现为无条件整页渲染，与 memo/today 不同）——已知小瑕疵，本次不扩散范围，如实记录。
5. store 领域 API（addDevProject 等）全部保留（测试与既有调用方在用，先例同 memo/today）。

## 已识别的差异点（均无现实影响，如实记录）

- store 允许空项目名回落"未命名项目"、编辑空名保留旧值；工厂为 required 拒绝。**表单层 required 校验已拦截**，页面路径永远非空 → 行为等价，工厂更严（防御性，不劣化）。
- 工厂 update 对文本字段做 trim（store 原实现不 trim content/note 首尾空格）。Markdown 首尾空格无渲染语义（不渲染空行），既有测试无首尾空格断言 → 语义不变。
- 实证核对：store.js:243-246 的 devProjects normalize 仅补 `tasks: []` 与空名默认值，工厂写入形状完全兼容；modules-smoke.test.js 走页面全流程（建项目→加任务→勾选进度→删除二次确认），DOM 契约（#devAdd / data-tadd / data-tcheck / data-pdel / data-act）全部保留。

## 验证计划

- 全量 `npm test`：578 项（**数量不变**——工厂无新扩展 → 无新契约测试；dev 旧测试原样全绿为成功判据）。
- `npm run typecheck` + `npm run lint` 零错误。
- `npm run test:e2e`：既有 5 项（无 dev 路径，先例同 memo/today 不新增）。
- 手工：dev 三标签新建/编辑/删除/撤销/复制/置顶抽查（可省，测试已锁）。

## 提交计划（两笔，任一阶段失败即停）

1. **001 dev 迁移**：`js/dev.js`（工厂化 + 委托绑定 + EVENT 订阅）+ `tests/innerhtml.test.js`（白名单行号随迁）→ 全量回归。
2. **002 文档同步**：`npm run sync-sw`（预期 v38 → v39）→ ADR-011 追加试点三记录（含嵌套边界决策）→ CHANGELOG 一条 → AGENTS 基线（测试 578 不变、提交数 +2、缓存 v39）。

## 回滚预案

- 任一批测试失败即停；单笔 `git revert` 即可（dev 数据无迁移动作、无 storage key / schema 变更——三个集合照旧写主快照）。
- 行为风险极低：全部改动在页面接线层，数据读写路径与渲染输出不变。