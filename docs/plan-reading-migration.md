# reading 迁移方案：阅读计划页迁入标准模块工厂（试点 7，计时/书摘边界压测）

- 日期：2026-08-18
- 状态：**已完成**（迁移落地：提交 346259c reading 试点七；584 项全绿、typecheck/lint 零问题、E2E 5/5 断言 v44、真实 Chromium 冒烟 9/9；本批 002 文档同步中，缓存 v44 → v45）
- 前置：试点六 consulting（嵌套边界压测）通过后由用户选定——本试点压测工厂剩余两块未验证的硬骨头：**计时器全局单例**（跨页保留的页面级状态）与**双页双集合**（Pages.reading + Pages.excerpts 同文件、books + excerpts 两个集合）。这是试点序列中最后一个含独立第二集合与计时状态机的模块，通过后仅剩 design。

## 一句话

书单主对象（`state.books`）迁入标准模块工厂；**阅读计时（addReadingSession）、嵌套笔记（addBookNote/removeBookNote）、书摘集合（state.excerpts）全部留领域 API**，统计区/时钟/切页恢复留页面层——工厂零扩展。只改 reading.js 一个文件；**innerhtml 白名单无 reading.js 条目（渲染全经 UI.el + 插值全 esc），本次零随迁**。

## 侦查结论（已确认的事实）

- reading 页 = 单集合 `state.books`（313 行，字段 title/author/status/progress/notes[]/readingMinutes/readingLog[]/finishedAt/createdAt）+ **独立顶层集合 `state.excerpts`**（书摘）；同文件注册两个页面 `Pages.reading` + `Pages.excerpts`（书摘页）。
- 领域 API（store-content.js:113-189）：
  - `addBook`：unshift（最新在前）+ createdAt + progress **clamp 0-100** + title trim 空回落'未命名书籍' + status 默认'想读' + **新建即已读完 → finishedAt = todayStr()** + 初始化 `notes: [] / readingMinutes: 0 / readingLog: [] / finishedAt: null`。
  - `updateBook`：title trim 空**保留旧值**；**status 联动 finishedAt**（变'已读完' → 写 todayStr（已有则保留）；改回其他状态 → 置 null）；progress clamp 0-100；不刷 updatedAt。
  - `removeBook`：`_undoPush({list:'books', at, data: 整记录})` 整记录撤销。
  - `addReadingSession`（计时落账）：minutes 浮点 → `Math.ceil + Math.max(1)`（不足 1 分钟按 1 分钟）；`readingMinutes` 累加 + `readingLog.push({date, minutes})`（供周报）。
  - `addBookNote`/`removeBookNote`：嵌套 notes + **remove 用 `_undoPush({restore: 闭包})` 按索引恢复**（P4c 语义）。
  - `addExcerpt`：text trim 空 → 返回 null（页面拦截'句子不能为空'）；unshift 进 excerpts + bookTitle 冗余快照；`removeExcerpt`：`_undoPush({list:'excerpts', at, data})` 整记录撤销。
- 工厂 v0.1.2 能力核对（ModuleFactory.js:143-161/203-256，源码级确认）：
  - **add 对所有声明字段无条件 sanitize**（未提供值也走 `data[key] === undefined`）：number → NaN 归 0、array → `[]`、select → 白名单外回落 **options[0]**、date → 空串、text → 空串 → **新增书自动补齐 `readingMinutes: 0 / readingLog: [] / notes: [] / progress: 0 / status: '想读'`，逐字段对齐 addBook 默认值**（finishedAt '' vs null，falsy 等价，UI 判定 `b.finishedAt ?` 不受影响）；
  - **update 只写 patch 中含的字段**（hasOwnProperty 门，ModuleFactory.js:229-238）→ 编辑书**不会碰掉计时数据** readingMinutes/readingLog；
  - remove 整记录 `_undoPush({list, at, data})` 与 removeBook 一致 ✓；
  - prepend 对齐 unshift ✓；不配 timeField → 工厂默认生成 createdAt ✓（UI/搜索/周报均不读 createdAt）；
  - `_registerCollection('books')` 进 normalize 白名单（contract.test.js:117 集合清单已有 books，注册幂等）✓。
- 测试安全网：`reading-v3.test.js` 7 项（计时会话落账/旧数据 normalize 补默认/UI 计时按钮与分钟/切页恢复时钟/摘抄弹窗入库）；`reading-stats.test.js` 4 项（统计纯函数 + 统计区 UI）；`store.test.js:152/158`（**直调 addBook/updateBook 验证 progress clamp**）；`modules-smoke.test.js:94`（页面流：新增书 → 改状态进度 → 加笔记）；`sanitize.test.js:64`（阅读列表注入净化）；`search.test.js` 3 项（索引读 title/author/status）；`settings-weekly.test.js`（周报读 readingLog）——**领域 API 保留 + 只读函数不动 → 全过**。
- 契约锁定项：shell.test.js 脚本序断言（文件不改名不换位）；`__readingDbg` 测试钩子（timerOn/elapsedSecs/startTimer/stopTimer，reading-v3 计时测试依赖，保留）。
- **工厂缺口结论：无**——计时落账是「嵌套字段累计业务规则」（ceil/max(1)/日志 push），工厂 update 的整记录补丁模型天然不适合（且会被编辑路径误伤，需 hasOwnProperty 门才能避开）；嵌套笔记删除是「restore 闭包撤销」（consulting 试点六已收口：**嵌套集合局部操作不进工厂**）；excerpts 是独立平级集合但**不在本试点范围**（reading 页表单 + 书摘页删除均领域 API 直连，无工厂收益，留待 design 后统一评估）。三者均零扩展即可覆盖。

## 迁移形态

### 1. 单个工厂模块实例（书单主对象）

| 集合 | id | 关键配置 | 理由 |
|---|---|---|---|
| 书单 | books | `prepend: true`（不配 timeField——createdAt 工厂默认生成）；fields：title(text, required) + author(text) + status(select: `['想读','在读','已读完']`) + progress(number) + finishedAt(date) + **notes(array) + readingMinutes(number) + readingLog(array)** | prepend 对齐 addBook 的 unshift；工厂 add 自动补齐 `notes:[]/readingMinutes:0/readingLog:[]`（源码级确认 sanitize 未提供值，对齐 addBook 默认）；status select 默认首项恰为'想读'；finishedAt date 类型空值落 ''（falsy 等价 null） |

### 2. 边界决策：计时器、嵌套笔记、书摘全部不进工厂（本试点核心结论）

- **阅读计时（addReadingSession）**：计时状态机（timer 单例/startTimer/stopTimer/clockTick 时钟循环/切页恢复）是**页面级全局单例状态**，跨页保留（切走仍在走秒）——工厂模型不涉及；落账继续走 `store.addReadingSession(bookId, minutes)`（ceil/max(1)/日志 push 业务规则 + emit /data/books 总线兜底重绘）。
- **嵌套笔记（addBookNote/removeBookNote）**：consulting 试点六边界直接复用——子项 remove 的 restore 闭包撤销工厂不提供，走领域 API 撤销行为 100% 保留。
- **书摘（state.excerpts + Pages.excerpts）**：独立集合不进工厂（本试点范围外，理由见侦查结论）；`renderExcerpts` 原样保留，P5a 切页守卫（撤销后仍在书摘页才重渲染）保留。
- **统计区 statsSection**（汇总 pills/环形图 conic-gradient/进度分布条形图）与 `booksByStatus/readingStats/excerptsByBook` 只读纯函数原样（selfmedia 统计同边界）。

### 3. 书 CRUD 走工厂（ensureMod）

- 新增/编辑书：`ensureMod(ctx).add(v)` / `.update(id, v)`（onSubmit 内，news/selfmedia 先例）；
- 删除书：`ensureMod(ctx).remove(b.id)` + toast 撤销 `store.undoRemove()` —— 工厂 `_undoPush` 整记录（含嵌套笔记/计时数据），撤销恢复与 removeBook 语义一致；
- 三状态分组（booksByStatus）、进度条展示、空态全部留页面层。

### 4. 绑定统一为委托写法（第七个消费方）

书卡内 5 类按钮（data-act="edit"/"note"/"del" + data-excerpt + data-timerbtn）+ 笔记删除（data-note="del"）当前为 onclick 闭包逐个绑 → 改经**容器级 click 委托**（回查 `store.state.books` 最新对象 + `delegatedBound` 门闩）：edit → openBook、note → openNote、del → 确认+工厂 remove、excerpt → openExcerpt、timerbtn → 页面计时函数（timerOn 判分支）、note del → closest('[data-noteitem]').dataset.id 回查。**#rdAdd 维持节点级绑定**（非行内按钮，memo #memoAdd / dev #devAdd / consulting 先例）。DOM 契约（data-id / data-timerbtn / data-clock / data-minutes / data-noteitem / data-exid 等）零变更。

### 5. finishedAt 联动移 onSubmit（页面层业务规则，带 target 判断精确对齐 updateBook）

```js
onSubmit: function (v) {
  if (v.progress !== null && (v.progress < 0 || v.progress > 100)) return '进度需在 0~100 之间'; /* 原校验保留 */
  if (v.status === '已读完') v.finishedAt = (target && target.finishedAt) || S.todayStr();   /* 新建已读完 / 编辑保持：写或保留完成日期 */
  else if (target && target.finishedAt && v.status !== target.status) v.finishedAt = null;     /* 从已读完改回：清除（date 类型空值落 ''，falsy） */
  if (target) ensureMod(ctx).update(target.id, v);
  else ensureMod(ctx).add(v);
  ...
}
```

### 6. 其余改动

- 订阅收敛（news 试点四写法）：两组 `bus.on` 返回 off 全部存 `unsubs` 数组——reading 页 `['/data/books', '/data/settings', '/data/all']`（books 领域 API 双写路径兜底）+ excerpts 页 `['/data/excerpts', '/data/settings', '/data/all']`；路由守卫（routeIs）保留。
- `__readingDbg` 测试钩子原样保留（reading-v3 计时测试依赖）。
- storageKey 照例 'sonder_data_v1'；`store._registerCollection('books')` 幂等。
- innerhtml 白名单：**零随迁**（无 reading.js 条目——渲染全经 UI.el（ui.js:38 框架入口白名单）+ 插值全 esc，迁移保持该写法即可）。

## 行为原样保留清单（不借机修）

1. 阅读计时全流程：开始/停止按钮态、时钟走秒（单链自愈）、**切页再切回时钟恢复走动并显示真实流逝**、已有计时中再开提示、会话落账（不足 1 分钟按 1 分钟）+ 分钟显示。
2. 统计区（汇总 pills/环形图/分布条）与三状态分组渲染。
3. 嵌套笔记：添加/删除 + 闭包撤销 + 书卡内展示。
4. 摘抄金句（空句拦截'句子不能为空'）+ 书摘页（按书分组/删除撤销 + P5a 切页守卫）。
5. 书籍删除确认弹窗 + toast 撤销；进度校验（0~100 拦截）。
6. store 领域 API 全量保留（store.test.js:152/158 直调 clamp 契约 + 周报/搜索/统计消费方）。

## 已识别的差异点（均消化为无现实影响，如实记录）

- 工厂 update 对 author trim 首尾空格（store 原实现不 trim）——无现实差异（news/consulting 先例同）。
- 工厂 add 额外生成 updatedAt（store 原只写 createdAt；旧记录无该字段）——UI/搜索/周报均不读 updatedAt，无现实差异。
- 工厂 add 的 title 空串由 required 拒绝（表单层已拦），领域 API「未命名书籍」兜底保留——页面路径不可达空名。
- 工厂 add/update 的 progress 不夹 0-100（store 原 clamp）——表单 min/max + 原校验串已拦，页面路径永远合法；store.test.js:152/158 直调领域 API，clamp 语义仍在。
- 工厂 date 类型空值落 ''（原 addBook 落 null）——falsy 等价，UI 判定 `b.finishedAt ?` 不受影响。

## 验证计划

- 全量 `npm test`：583 项（**数量不变**——工厂零扩展 → 无新契约测试；reading-v3 7 项 + reading-stats 4 项 + store 2 项旧测试原样全绿为成功判据，含计时/切页恢复/摘抄/统计全套）。
- `npm run typecheck` + `npm run lint` 零错误。
- `npm run test:e2e`：既有 5 项（无 reading 路径，先例同）；E2E **断言缓存 v44**（sync-sw 前）。
- 浏览器冒烟（试点六同款临时脚本，跑完即删）：真实 Chromium 走 新建书（已读完状态自动记完成日期）→ 计时 → 停止落账 → 切页恢复 → 编辑 → 加笔记 → 删笔记撤销 → 摘抄 → 书摘页删除撤销 → 删除书撤销 → **刷新持久化**，全程零报错。

## 提交计划（两笔，任一阶段失败即停）

1. **001 reading 迁移**：`js/reading.js`（书 CRUD 工厂化 + finishedAt 联动移 onSubmit + 委托绑定 + 领域 API 保留 + 双组订阅收敛）→ 全量回归 → typecheck/lint → E2E（断言 v44）→ 浏览器冒烟。
2. **002 文档同步**：`npm run sync-sw`（预期 v44 → v45）→ ADR-011 追加试点 7 记录（含「计时/书摘边界结论」）→ CHANGELOG 一条 → AGENTS 基线（测试 583 不变、提交数 +2、缓存 v45）→ PRD 缓存描述 v44 → v45。
3. 复核 `git rev-list --count HEAD` 并同步 AGENTS 提交数。

## 回滚预案

- 任一批测试失败即停；单笔 `git revert` 即可（books/excerpts 数据无迁移动作、无 storage key / schema 变更——集合照旧写主快照，嵌套结构与计时数据原样）。
- 行为风险低：改动集中在页面接线层（书 CRUD 改走工厂 + 按钮委托化 + finishedAt 联动上移），计时器/笔记/书摘/存储路径零改动；innerhtml 白名单零条目 → 无行号随迁风险，若迁移引入未转义赋值点测试立即失败。
