# 试点迁移方案：快速备忘（memo）迁入标准模块工厂

- 状态：**待过目拍板**（未实施）
- 定位：Sonder-Frame 渐进式改造第一个真实迁移试点（v6.0 主线，Phase 7 起点）
- 依据：ADR-009（ModuleFactory v0.1）+ ADR-010（EventBridge v0.1）均已落地，框架配套齐备

---

## 一、结论先行（30 秒版）

**能开始，试点选「快速备忘」**。数据零风险、失败可单文件回滚。但工厂有两个小缺口必须先补（顺序 + 时间字段），方案分三步：**先扩工厂 → 再迁 memo → 全量验证**，任何一步测试失败即停。

---

## 二、为什么选 memo（试点选型）

| 维度 | memo 的情况 | 好处 |
|------|------------|------|
| 体量 | 全项目最小的模块（105 行） | 迁移面最小，改错好查 |
| 数据形态 | 只有 3 个字段：text / time / archived | 最简单，无嵌套 |
| 测试厚度 | home-memo-ux / smoke / qa / sanitize / search 等 8+ 个测试文件锁死它的行为 | 现成的"安全网"，迁移后全绿即证明没改坏 |
| 是标准模块 | 纯增删改查 + 列表渲染（非游戏/统计/日历等特例模块） | 正是工厂该服务的对象 |

---

## 三、现状与缺口的精确核对（预查结论）

| 项 | 现状（store.addMemo，store-tasks.js） | 工厂 v0.1 当前行为 | 差异 → 处理 |
|----|------|------|------|
| 新增位置 | **最新的在最前**（unshift） | 追加到末尾（push） | **缺口 1**：列表顺序会反转，旧测试必失败 → 工厂加 `prepend: true` 配置 |
| 时间戳字段 | 写 `time`（页面显示用它） | 生成 `createdAt/updatedAt` | **缺口 2**：旧数据全是 `time`，渲染只认 `time` → 工厂加 `timeField: 'time'` 配置 |
| 编辑时间 | 编辑**不**更新 time（显示创建时间） | update 会刷新时间戳 | 纳入缺口 2 语义：timeField 只在新增时写、编辑不刷 |
| 文本净化 | trim，不删 HTML（渲染时转义） | 同款 trim | 一致 ✓ |
| archived | 布尔，默认 false | 布尔 sanitize 天然默认 false | 一致 ✓ |
| 删除撤销 | 进撤销栈，原位置恢复 | 工厂已实现同款（ADR-009） | 一致 ✓ |
| 落盘/广播 | save + _emitChange('memos') | 工厂同款，路径经 EVENT 表 | 一致 ✓ |
| 其他调用方 | home.js / app.js 还在用 store.addMemo | — | **不动** store API，两处调用保持原样 |

---

## 四、改动清单（按层拆，三批提交）

### 第一批：工厂扩展 ModuleFactory v0.1.1（纯增量，不动既有行为）

改哪层：`js/framework/ModuleFactory.js`（框架层，Sonder-Frame ②）

1. **`prepend: true` 配置项**：add 时 `unshift` 替代 `push`（不配置则维持现状 push——既有 23 项工厂测试零改动）
2. **`timeField` 配置项**：声明本集合的时间戳字段名（memo 传 `'time'`）
   - 语义：新增时写入该字段（ISO 时间）；编辑不刷新；配置后不再生成默认的 createdAt/updatedAt
   - 不配置则完全维持现状（既有测试零改动）

为什么由工厂负责：这是"集合形状"的声明（schema 属性），属 ModuleFactory 职责；若在业务层各自实现，每个迁移模块重复造轮子——违背框架层初衷。

影响哪些：仅新增两个可选配置；现有工厂行为与全部既有测试原样通过；store.js / 其他模块零改动。

测试怎么证明：module-factory.test.js 增补 ~6 项（prepend 首条在前 / 不配置仍 append / timeField 新增写 time / 编辑不刷 time / 配置后无 createdAt / 旧契约全绿）。

失败怎么回滚：单独 `git revert` 这一批（独立 commit），其余批次不受影响。

### 第二批：迁移 memo.js（试点本体）

改哪层：`js/memo.js`（业务层改造为工厂消费方），文件**不改名、不换加载位置**

1. 内部改为 `SonderModuleFactory.createModule(store, config)`：
   - `id: 'memos'`、`prepend: true`、`timeField: 'time'`
   - 字段声明：`text`（textarea, required）、`archived`（boolean）
2. 渲染用工厂的 **customRender**（模块自带渲染函数，**复用它现在这份 105 行的渲染代码**——UI 助手 `formModal/toast/confirmBox/el/esc/emptyState` 原样保留），**暂不造 VisualEngine**：
   - 理由：框架克制原则——VisualEngine 只有等 2-3 个模块迁移后证明重复需要才进框架；customRender 是 ADR-009 已定的合法渲染挂点
3. 页面契约不动：`Pages.memo = { title, render, add }`、`#memoAdd`、`.list-item[data-id]`、归档/编辑/删除按钮、撤销含 P5a 切页守卫——8 个旧测试文件原样锁死
4. 事件订阅改经 **EVENT 表**（ADR-010 纪律：新框架代码一律走常量表）：
   - `EVENT.data('memos')` / `EVENT.data('settings')` / `EVENT.DATA_ALL` → 仍只在路由为本页时重绘
   - 保存返回值 unsubscribe（销毁契约，为将来模块销毁机制预留）

影响哪些：仅 memo 页面模块自身；store 的 addMemo/updateMemo/removeMemo 保留（home/app 还在用）；搜索/导入/加密/备份/多标签写锁全部读同一个 `state.memos` + 同一 save 路径——**零感知**。

测试怎么证明：全量回归——home-memo-ux（新建/归档/编辑/删除/撤销）、smoke、qa、sanitize（XSS 转义）、search（搜索到备忘）等旧测试**原样全绿**即证明迁移成功；另增 1-2 项契约断言（boot 后 memo 页仍可新建、数据落 `state.memos`）。

失败怎么回滚：`git revert` 第二批单文件（memo.js 回到 105 行原版），数据无任何迁移/改写动作，无需数据回滚。

### 第三批：文档同步（惯例）

- 提交 ADR-011《试点迁移协议：memo 入厂》
- CHANGELOG 新条目；README/README.en/AGENTS 基线 569 → 新数（新增测试数）
- `npm run sync-sw`：缓存 v36 → v37（memo.js / ModuleFactory.js 指纹变化）
- 三批合并推送 main，双站自动部署

---

## 五、本次明确不做（防越界）

- **不造 VisualEngine**（等重复需要；见上）
- 不迁移其他模块（试点只做 memo，下一模块另立方案）
- 不改 storageKey / 不搬数据 / 不动加密与备份路径（工厂写的就是同一个 `state.memos`）
- 不改 store-tasks.js 的 addMemo 等 API（home/app 调用方保持）
- 不动其余 11 个页面模块的字面量订阅（收编随各模块迁移进行）

---

## 六、停止条件（满足任一即停，回来复盘）

- 任一阶段测试失败（先判断真 bug / 依赖旧内部实现 / 有意行为改变，禁止先改测试逃避）
- 迁移后 E2E「新建 → 刷新 → 还在」不成立
- 工厂扩展出现大改既有行为（必须纯增量）
- storage 不一致（备份/导入/解密任一路径丢 memo 数据）

---

## 七、预算与顺序

1. 第一批（工厂扩展 + 契约测试）→ 全量回归 → Commit A
2. 第二批（memo 迁移）→ 全量回归 → Commit B
3. 第三批（sync-sw + ADR-011 + 文档）→ Commit C → push

预计全量测试耗时与现状相当（~100s/次，三批各跑一次）。

---

## 待拍板项

1. 试点选 memo 是否同意？（备选：quotes 62 行更小，但 quotes 有 ESM 试验田双实现，牵扯 quotes-core.mjs 一致性测试，选 memo 更干净）
2. timeField 语义（新增写、编辑不刷、配置后不生成默认时间字段）是否接受？
3. 三批提交拆分是否 OK？（或合并为两批：工厂+迁移一体）
