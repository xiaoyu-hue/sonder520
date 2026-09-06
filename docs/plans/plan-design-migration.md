# design 迁移方案：设计计划页迁入标准模块工厂（试点 8，Phase 7 收官最后一模块）

- 日期：2026-08-19
- 状态：**进行中**
- 前置：试点七 reading（实时状态模块压测）通过后，由用户选定本试点——**七个试点后唯一剩余的标准模块**，无嵌套集合、无独立第二集合、无计时器，为试点序列中最薄的一页（114 行），顺水推舟收官。

## 一句话

设计计划主对象（`state.designs`）迁入标准模块工厂；**type/stage 业务字段声明为 select 仅作工厂 sanitize 通道**，分节渲染/表单/删除确认/撤销全留页面层——工厂零扩展。只改 design.js 一个文件；innerhtml 白名单无 design.js 条目（渲染全经 UI.el + esc），零随迁。

## 侦查结论（已确认的事实）

- design 页 = 单集合 `state.designs`（114 行，字段 type/title/link/category/note/stage/time），type ∈ {idea, project} 同一集合两类记录分节展示。
- 领域 API（store-content.js:217-239）：
  - `addDesign`：unshift（最新在前）+ `type` 归一（非 'project' 一律 'idea'）+ title trim 空回落'未命名' + link/category/note String 化 + stage 默认'构想' + `time: h.nowISO()`。
  - `updateDesign`：title trim 空**保留旧值**；type 归一；category/link/note/stage 字符串 patch；**不刷 time**。
  - `removeDesign`：`_undoPush({list:'designs', at, data: 整记录})` 整记录撤销。
- 工厂 v0.1.2 能力核对（ModuleFactory.js 源码级确认）：
  - **add 对所有声明字段无条件 sanitize**（未提供值也走）→ **type 必须声明**（未声明字段 add 时不写入记录，type 会丢）；type 声明 select `['idea','project']` → 白名单外回落 options[0]='idea'，**逐字段对齐 addDesign 的"非 project 归一 idea"**；stage 声明 select `['构想','进行','定稿']` → 默认首项'构想'，对齐 addDesign 默认。
  - **update 只写 patch 中含的字段**（hasOwnProperty 门，ModuleFactory.js:229-238）→ 编辑不会碰掉 type/time。
  - remove 整记录 `_undoPush({list, at, data})` 与 removeDesign 一致 ✓。
  - prepend 对齐 unshift ✓；`timeField: 'time'` → 新增写 time、编辑不刷、不生成默认时间字段，**对齐 addDesign/updateDesign 语义**（timeField 不可同时声明于 fields，validate 拒绝）。
  - `_registerCollection('designs')` 进 normalize 白名单（contract.test.js:117 集合清单已有 designs，注册幂等）✓。
- 测试安全网：`design-ux.test.js` 6 项（空态/分节展示/阶段自动保存/编辑预填/链接渲染/删除确认+撤销）；`modules-smoke.test.js:132`（页面流：收集灵感 → 新建项目 → 编辑推进到定稿）；`store.test.js:184-190`（直调 addDesign/updateDesign 验证 type 归一与 stage）；`sanitize.test.js:76/103/111`（灵感卡链接注入净化 + XSS）；`search.test.js`（搜索索引读 designs）；`event-bus.test.js:79`（'/data/designs' 广播路径）——**领域 API 保留 + 渲染不动 → 全过**。
- 契约锁定项：shell.test.js 脚本序断言（文件不改名不换位）；`Pages.design.add` 入口（home 快捷入口调用，保留）。
- **工厂缺口结论：无**——type 归一与 stage 默认均可由 select 白名单等价覆盖，time 由 timeField 对齐，无新通用缺口（延续七试点零扩展轨迹）。

## 迁移形态

### 1. 单个工厂模块实例

| 集合 | id | 关键配置 | 理由 |
|---|---|---|---|
| 设计计划 | designs | `prepend: true` + `timeField: 'time'`；fields：type(select: `['idea','project']`) + title(text, required) + category(text) + link(text) + note(textarea) + stage(select: `['构想','进行','定稿']`) | prepend 对齐 unshift；timeField 对齐既有 time 字段（新增写、编辑不刷，news 先例）；type/stage 声明为 select 走白名单净化，非法值回落即等价领域归一 |

### 2. 边界决策：分节/表单/确认/撤销全留页面层（本试点无新增边界）

- **type 分节渲染**（ideas/projects 双节 + 计数）、**阶段 pill**、空态、链接渲染全留页面层（视图层派生，today done/doneAt、news status/tag 同边界）。
- **删除确认二次弹窗**（confirmBox + data-act="yes"）保留（consulting 先例）。
- **删除撤销**走工厂 `_undoPush` 整记录 + `store.undoRemove()`（现有行为零变更）。

### 3. CRUD 走工厂（ensureMod）

- 新增/编辑：`ensureMod(ctx).add(v)` / `.update(id, v)`（onSubmit 内，v.type = type 由页面赋值，select 白名单保留）；
- 删除：`ensureMod(ctx).remove(id)` + toast 撤销 `store.undoRemove()`。

### 4. 绑定统一为委托写法（第八个消费方）

卡内 2 类按钮（data-act="edit"/"del"）onclick 闭包逐个绑 → 改经**容器级 click 委托**（回查 `store.state.designs` 最新对象 + `delegatedBound` 门闩）：edit → openDesign(ctx, rec.type, rec)、del → 确认+工厂 remove+撤销。**data-dadd 两个 hbar 按钮维持节点级绑定**（非行内按钮，memo #memoAdd / dev #devAdd / reading #rdAdd 先例）。DOM 契约（data-id / data-act / data-dadd）零变更。

### 5. 其余改动

- 订阅收敛（reading 试点七写法）：`bus.on` 返回 off 全部存 `unsubs` 数组——`['/data/designs', '/data/settings', '/data/all']`（/data/designs 保留：领域 API addDesign/updateDesign/removeDesign 仍可能被外部调用方写入，bus 兜底重绘，双写路径并存）；路由守卫（routeIs('design')）保留。
- storageKey 照例 'sonder_data_v1'；`store._registerCollection('designs')` 幂等。
- innerhtml 白名单：**零随迁**（无 design.js 条目——渲染全经 UI.el + esc/sanitizeUrl，迁移保持该写法即可）。

## 行为原样保留清单（不借机修）

1. 双节分栏（灵感/项目 + 计数）与空态。
2. 收集灵感/新建项目双入口（hbar 按钮 + emptyState 按钮 + Pages.design.add）。
3. 项目阶段默认'构想'与 pill 展示（构想/进行 = mid、定稿 = lo）。
4. 删除确认弹窗 + toast 撤销；编辑预填全字段（title/category/link/note/stage）。
5. 链接渲染（sanitizeUrl + target="_blank" rel="noopener"）。
6. store 领域 API 全量保留（store.test.js:184-190 直调契约 + 搜索/周报消费方）。

## 已识别的差异点（均消化为无现实影响，如实记录）

- 工厂 update 对 category/link/note trim 首尾空格（store 原实现不 trim）——news/consulting 先例同，无现实差异（link 为 URL 场景 trim 反而正确）。
- 工厂 add 额外生成 updatedAt（store 原只写 time；旧记录无该字段）——UI/搜索/周报均不读 updatedAt，无现实差异。
- 工厂 add/update 的 title 空串由 required 拒绝（表单层 required 已拦，页面路径不可达空名）；领域 API「未命名」兜底保留在 store-content.js。
- 工厂 select 对 type 非法值回落 'idea'（store 原"非 project 归一 idea"等价）；stage 非法值回落'构想'（store 原 `d.stage || '构想'` 对任意字符串照存——表单 select 白名单已限，页面路径不可达非法值）。

## 验证计划（✅ 已完成，2026-08-19）

- 全量 `npm test`：584 项（**数量不变**——工厂零扩展 → 无新契约测试；design-ux 6 项 + modules-smoke 1 项 + store 2 项旧测试原样全绿为成功判据）。✅
- `npm run typecheck` + `npm run lint` 零错误。✅
- `npm run test:e2e`：既有 5 项（无 design 路径，先例同）；E2E **断言缓存 v46**（sync-sw 前）。✅
- 浏览器冒烟（试点六/七同款临时脚本，跑完即删）：真实 Chromium 走 收集灵感 → 新建项目 → 编辑推进阶段 → 链接渲染 → 删除确认 → 撤销 → **刷新持久化**，全程零报错。✅ 9/9 全过。

## 提交计划（两笔，任一阶段失败即停）— ✅ 已完成

1. **001 design 迁移**：`js/design.js`（CRUD 工厂化 + 委托绑定 + 领域 API 保留 + 订阅收敛）→ 全量回归 → typecheck/lint → E2E（断言 v46）→ 浏览器冒烟。✅ `9c8c73d`
2. **002 文档同步**：`npm run sync-sw`（v46 → v47，ASSET_SIG 61af91a9962e → 4f44c601ae33，ASSETS 40 项不变）→ ADR-011 追加试点 8 记录（Phase 7 标准模块收官结论）→ CHANGELOG 一条 → AGENTS 基线（测试 584 不变、提交数 → 194、缓存 v47）→ PRD 缓存描述 v46 → v47。✅
3. 复核 `git rev-list --count HEAD` 并同步 AGENTS 提交数。✅

## 回滚预案

- 任一批测试失败即停；单笔 `git revert` 即可（designs 数据无迁移动作、无 storage key / schema 变更——集合照旧写主快照）。
- 行为风险低：改动集中在页面接线层（CRUD 改走工厂 + 按钮委托化），存储路径零改动；innerhtml 白名单零条目 → 无行号随迁风险。
