# news 迁移方案：看新闻计划迁入标准模块工厂（试点 4）

- 日期：2026-08-17
- 状态：**已完成**（迁移落地：提交 74ec1a4 news 试点四；583 项全绿、typecheck/lint 零问题、E2E 5/5；本批 002 文档同步中，缓存 v41 → v42）
- 前置：试点评估检查点（ADR-011）已确认"无新通用缺口"；本方案依据已完成的新闻选型侦查实验（news.js 全文 + store-content.js 领域 API + news-ux 测试契约逐一核对）

## 一句话

把看新闻计划（news）的唯一数据集合 `state.news` 迁入标准模块工厂——**不改工厂代码**（v0.1.2 能力已够，零扩展），只改 news.js 一个文件 + 同步测试白名单与文档；页面筛选（status/tag）是视图层派生状态，留页面不进工厂。

## 侦查结论（已确认的事实）

- news 页 = 单集合 `state.news`（131 行最小标准模块），字段：title / url / source / tags(array) / status(select) / note / time。
- 领域 API（store-content.js:192-214）：`addNews` 用 **unshift**（最新在前）+ 写 `time`；`updateNews` 无 trim 但空标题回落保留旧值；`removeNews` 进撤销栈。**消费方为只读**：search.js:43（全局搜索索引）、home.js:74（概览卡汇总）均直接读 `state.news` 集合——工厂写同一集合，读法零变更，契约兼容。
- 测试安全网：`tests/news-ux.test.js` 5 项专测（空态+新增拆标签 / 标已读-收藏-取消 / 筛选+清除 / 危险链接不外链 / 删除确认+撤销）+ `modules-smoke` / `state.test` / `search.test` 共享测试。
- **无新工厂缺口**：单集合、prepend + timeField + array + select 全在 v0.1.2 能力内，零工厂扩展 → 又一次验证"无新通用缺口"。

## 迁移形态

### 1. 单个工厂模块实例

| 集合 | id | 关键配置 | 理由 |
|---|---|---|---|
| 资讯 | news | `prepend: true` + `timeField: 'time'`；fields：title(text, required) + url(text) + source(text) + tags(array) + status(select: unread/read/favorite) + note(text) | prepend 对齐 addNews 的 unshift；timeField 对齐既有 time 字段（新增写入、编辑不刷）；tags 声明 array 做默认保底 |

### 2. 边界决策：页面筛选不进工厂

news.js 有页面级本地筛选状态 `state.status` / `state.tag`（下拉筛选 + 清除）。这是**视图层派生状态**，工厂只管理记录 CRUD——筛选保留在页面层，与 today 的 done/doneAt 页面规则、dev 的 tabState 同属"页面业务规则不进工厂"边界。

### 3. 绑定统一为委托写法（三模块收敛后首个新消费方）

news 卡内按钮（mark/fav/unfav/edit/del）当前是闭包逐个绑，改经 `data-act` 容器级委托（`delegatedBound` 门闩防监听累积），与 memo/today/dev 四模块写法收敛。DOM 契约（`data-id`/`data-act` 属性）零变更，测试原样通过为证。

### 4. 其余改动

- 渲染：整页重绘改由工厂 notify 统一驱动，提交/删除后的显式 `render(ctx)` 移除；**筛选变更的 render 保留**（非工厂操作）。
- 订阅改经 EVENT 表（ADR-010，`/data/news` 等），unsubscribe 保存。
- 模块懒初始化（ensureMod），工厂 renderer 与页面 render 共用绘制函数。
- storageKey 照例 'sonder_data_v1'（纯标识，数据仍写主快照同一集合）。
- 标签拆分预处理（onSubmit 里 tags 逗号拆分）保留在页面层。

## 行为原样保留清单（不借机修）

1. 空态文案「还没有资讯」与新建按钮。
2. 状态 pill（收藏/已读/待读）与标题链接渲染、`sanitizeUrl` 危险链接不外链。
3. 筛选下拉（status/tag）+ 清除筛选的交互语义。
4. 删除需确认 + 撤销 toast + P5a 式守卫（news 现实现为 confirmBox→remove→render→toast 撤销，等价保留）。
5. store 领域 API（addNews/updateNews/removeNews）——先例同 memo/today/dev：**保留**（若未来无调用方再考虑清理，本次不删）。

## 已识别的差异点（均无现实影响，如实记录）

- store 允许空标题回落"未命名资讯"、编辑空名保留旧值；工厂为 required 拒绝。**表单层 required 已拦截**，页面路径永远非空 → 行为等价，工厂更严（防御性，不劣化）。
- 工厂 update 对文本字段做 trim（store 原实现 url/source/note 不 trim 首尾空格）。既有测试无首尾空格断言，语义无现实差异。
- `tags` 数组：store 原实现非数组时回落 `[]`，工厂 array 类型同样回落 `[]`，形状兼容。

## 验证计划

- 全量 `npm test`：583 项（**数量不变**——工厂零扩展 → 无新契约测试；news 旧测试原样全绿为成功判据）。
- `npm run typecheck` + `npm run lint` 零错误。
- `npm run test:e2e`：既有 5 项（无 news 路径，先例同 memo/today/dev 不新增）。
- 手工：news 新增/筛选/标已读/收藏/删除撤销抽查（可省，测试已锁）。

## 提交计划（两笔，任一阶段失败即停）

1. **001 news 迁移**：`js/news.js`（工厂化 + 委托绑定 + EVENT 订阅）→ 全量回归 → E2E。
2. **002 文档同步**：`npm run sync-sw`（预期 v41 → v42）→ ADR-011 追加试点 4 记录 → CHANGELOG 一条 → AGENTS 基线（测试 583 不变、提交数 +2、缓存 v42）。

## 回滚预案

- 任一批测试失败即停；单笔 `git revert` 即可（news 数据无迁移动作、无 storage key / schema 变更——集合照旧写主快照）。
- 行为风险极低：全部改动在页面接线层，数据读写路径与渲染输出不变。
