# selfmedia 迁移方案：自媒体页迁入标准模块工厂（试点 5，最大模块压测）

- 日期：2026-08-18
- 状态：**待评审**
- 前置：试点四 news 交付后由用户选定——本试点为全项目最大标准模块（383 行），验证「复杂业务模块迁入工厂是否失控」，是最后一块硬骨头；通过后 consulting/reading/design 均为顺水推舟。

## 一句话

把自媒体页的唯一数据集合 `state.posts` 迁入标准模块工厂——**不改工厂代码**（v0.1.2 能力全够，零扩展），只改 selfmedia.js 一个文件 + 同步 innerhtml 白名单行号与文档；月历拖拽、统计图表、CSV 导出、筛选、进度条、数字反馈输入全部是页面层能力，不进工厂。

## 侦查结论（已确认的事实）

- selfmedia 页 = 单集合 `state.posts`（383 行最大标准模块），字段：title / platform / account / tags(array) / status(select) / publishDate / views / likes / comments / favorites / note / progress，时间字段 createdAt。
- 领域 API（store-media.js:13-50）：`addPost` 用 **unshift**（最新在前）+ 写 createdAt；`updatePost` 字符串字段直接赋值**不 trim**、数字字段 `num0`（**clamp 非负**）progress clamp ≤100；`removePost` 进撤销栈。消费方只读：search.js:28（索引）、store-report.js（周报 summarize）均读同一集合——工厂写同一集合，读法零变更。
- 测试安全网：`selfmedia-v3.test.js` 8 项（统计纯函数 recentPublished / 视图切换+月历渲染+月份导航+chip+拖拽落账 / 渠道下拉 / 数字反馈入库+未发布无输入框 / 折线图）+ `selfmedia-stats.test.js` + modules-smoke / contract / smoke / qa / accept / style / state / shell / settings-ux 等共享测试。
- **契约锁定项**：contract.test.js:117 断言 store.addPost 等 API 存在（保留领域 API 即过）；state.test.js:19 断言 selfmedia.js 源码含 `status/tag/view` 状态（页面层派生状态保留即过）；style.test.js:64 断言源码含 METRICS 色值常量（统计区不动即过）；shell.test.js 脚本序断言（文件不改名不换位即过）。
- **无新工厂缺口**：prepend + select（含空值选项）+ number + array + date 全在 v0.1.2 能力内；时分字段 createdAt 恰为工厂默认生成字段（**不需要 timeField 配置**——默认即写 createdAt/updatedAt），零扩展一次再验证「无新通用缺口」。

## 迁移形态

### 1. 单个工厂模块实例

| 集合 | id | 关键配置 | 理由 |
|---|---|---|---|
| 内容 | posts | `prepend: true`（不配 timeField——工厂默认生成 createdAt 对齐 postFactory）；fields：title(text, required) + platform(select: `['', '公众号','小红书','B站','抖音']` ——空值对齐「未设置平台」) + account(text) + tags(array) + status(select: draft/queue/published) + publishDate(date) + views/likes/comments/favorites(number) + note(textarea) + progress(number) | prepend 对齐 addPost 的 unshift；createdAt 由工厂生成字段天然对齐；platform 空字符串为首项保证「未设置」语义不被 normalize 强改 |

### 2. 边界决策：页面层能力全部不进工厂

月历视图（renderCalendar + 桌面拖拽 DnD + 移动端长按拖拽 + touchcancel 清理）、统计区（statsSection + miniLine SVG 折线）、CSV 导出、筛选/视图状态（`state.status/tag/view`）、日历状态（`cal`）、数字反馈输入框（data-fb）与进度条（data-prog/rangelabel）为页面级交互与派生渲染——工厂只管理记录 CRUD。与 today 的 done/doneAt、dev 的 tabState、news 的 status/tag 同属「页面业务规则不进工厂」边界。

### 3. 绑定统一为委托写法（第五个消费方，四模块收敛模板照搬）

卡内按钮 edit/del 当前为 onclick 闭包逐个绑 → 改经容器级委托（`data-act` 回查 `store.state.posts` 最新对象 + `delegatedBound` 门闩），与 memo/today/dev/news 写法收敛。**数字反馈输入框（data-fb）与进度条（data-prog）为控件而非行内按钮，维持节点级绑定**（先例：memo #memoAdd、dev #devAdd、news 无控件）。DOM 契约（data-id/data-act/data-fb/data-prog）零变更。

### 4. 其余改动

- 订阅：工厂 notify 与页面 render 共用绘制函数（路由守卫保留）；**`/data/posts` 订阅保留**（store.addPost 等领域 API 仍可能被 home/其他调用方走旧路径写入 → emit /data/posts → bus 兜底重绘，双写路径并存，news 先例）；`/data/settings`、`/data/all` 订阅保留原样。
- onSubmit 预处理保留并强化（页面层，news 先例）：
  1. tags 逗号拆分（`/[,，]/`）不变；
  2. publishDate 空 → `null`（对齐 postFactory `d.publishDate || null`，工厂 date 类型会将空串存为 `''`，预处理保证 null 语义）；
  3. **新增**：views/likes/comments/favorites 用 `S._h.num0` 夹非负、progress 夹 0-100（对齐 store 原语义——工厂 number 类型仅 Number() 转义不夹负，预处理后行为等价，差异点消失）。
- 编辑的 `update(target.id, v)` / 新增的 `add(v)` 改走工厂（ensureMod），删除改走工厂 remove + toast 撤销 `store.undoRemove()`。
- innerhtml 白名单行号随迁：当前 `'selfmedia.js:250'`（statsSection `wrap.innerHTML` 赋值点，250 → 迁移后行号变化，赋值点集与插值安全性语义零变化，非新增赋值点）。
- storageKey 照例 'sonder_data_v1'；`store._registerCollection('posts')` 幂等（posts 本就在 store 初始 state 与 normalize 白名单，store.js:153/234）。

## 行为原样保留清单（不借机修）

1. 月历视图全部交互（切月/回本月/拖拽排期/移动端长按）。
2. 统计区（发布数据统计 + 折线图 + 色值常量）。
3. CSV 导出（带筛选）。
4. 筛选下拉（status/tag）+ 视图切换 + 清除筛选。
5. 已发布卡片数字反馈输入框、进度条即时更新。
6. 「未设置平台」显示语义（platform 空值）。
7. 删除确认 + 撤销 toast 原样（P5a 守卫体系中 selfmedia 无切页守卫，与 news 一致）。
8. store 领域 API（addPost/updatePost/removePost）保留（search/home/测试契约调用方）。

## 已识别的差异点（均消化为无现实影响，如实记录）

- 工厂 update 对文本字段 trim 首尾空格（store 原实现不 trim）——既有测试无首尾空格断言，语义无现实差异（news 先例同）。
- 工厂 add 为 posts 记录**额外生成 updatedAt**（store 原只写 createdAt；既有旧记录无 updatedAt 字段）——UI/搜索/周报均不读 updatedAt，无现实差异。
- 数字字段 clamp 由 onSubmit 页面层预处理承担（上述第 4.3 条）——工厂 number 类型本身不夹，表单负数输入在预处理处被夹回，与原 store 语义等价。

## 验证计划

- 全量 `npm test`：583 项（**数量不变**——工厂零扩展 → 无新契约测试；selfmedia 旧测试原样全绿为成功判据，含拖拽/统计/图表/筛选全套）。
- `npm run typecheck` + `npm run lint` 零错误。
- `npm run test:e2e`：既有 5 项（无 selfmedia 路径，先例同 news 不新增）；E2E **断言缓存 v42**（sync-sw 前）。
- 手工：月历拖拽排期、CSV 导出抽查（可省，测试已锁拖拽与统计）。

## 提交计划（两笔，任一阶段失败即停）

1. **001 selfmedia 迁移**：`js/selfmedia.js`（工厂化 + 委托绑定 + onSubmit 预处理 + 订阅保留）→ 全量回归 → typecheck/lint → E2E（断言 v42）。
2. **002 文档同步**：innerhtml 白名单行号随迁（已含在 001 同批提交内亦可）→ `npm run sync-sw`（预期 v42 → v43）→ ADR-011 追加试点 5 记录（含「最大模块压测结论」）→ CHANGELOG 一条 → AGENTS 基线（测试 583 不变、提交数 +2、缓存 v43）。
3. 复核 `git rev-list --count HEAD` 并同步 AGENTS 提交数。

## 回滚预案

- 任一批测试失败即停；单笔 `git revert` 即可（posts 数据无迁移动作、无 storage key / schema 变更——集合照旧写主快照）。
- 行为风险低：改动集中在页面接线层（工厂 add/update/remove 替代 store 领域调用 + 按钮委托化），数据读写路径与渲染输出不变；唯一白名单行号随迁项有 innerhtml.test.js 失败即显形。