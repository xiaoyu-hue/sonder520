# consulting 迁移方案：咨询工作页迁入标准模块工厂（试点 6，嵌套边界压测）

- 日期：2026-08-18
- 状态：**已完成**（迁移落地：提交 77bdeb9 consulting 试点六；583 项全绿、typecheck/lint 零问题、E2E 5/5 断言 v43、真实 Chromium 冒烟 15/15；本批 002 文档同步中，缓存 v43 → v44）
- 前置：试点五 selfmedia（最大模块压测）通过后由用户选定——本试点压测工厂**最后一块未验证的硬骨头：四层嵌套子集合**（客户 → 项目/跟进/收入）。这是试点一 memo 时就标注的「嵌套边界」遗留项：嵌套子记录是否需要工厂扩展、级联/撤销语义如何保住，答案将决定后续 reading/design 的迁移形态。

## 一句话

客户主对象（`state.clients`）迁入标准模块工厂；**三个嵌套子集合（项目/跟进/收入）不建独立模块、不改数据结构，继续走领域 API**——嵌套边界留领域层，工厂零扩展。只改 consulting.js 一个文件 + 同步 innerhtml 白名单行号与文档。

## 侦查结论（已确认的事实）

- consulting 页 = 单集合 `state.clients`（262 行），每条客户**内嵌** `projects[] / followups[] / income[]` 三个子数组（非独立顶层集合）；字段：name / contact / note + 三子数组 + createdAt。
- 领域 API（store-content.js:11-110）：
  - `addClient`：unshift（最新在前）+ createdAt + **初始化三个空数组**；`updateClient`：name 空串保留原值，contact/note 直接赋值；`removeClient`：`_undoPush({list:'clients', at, data: 整客户含子项})` —— 删除客户即随记录级联移除子项，撤销整记录恢复。
  - 子项 `addClientProject/addClientFollowup/addClientIncome`（push 追加）+ update + remove：**remove 用 `_undoPush({restore: 闭包})` 按索引恢复子项**（P4c 语义，与整记录撤销不同的恢复粒度）。
- 工厂 v0.1.2 能力核对（ModuleFactory.js:143-161/203-256）：
  - `array` 类型 sanitize 空值保底 `[]` ✓ —— 工厂 add 若声明三个 array 字段，**自动生成三个空数组，对齐 addClient 契约**；
  - `update` 只写声明字段（其余字段原样保留）✓；
  - `remove` 整记录 `_undoPush({list, at, data})`，与 removeClient 一致 ✓；
  - `prepend` 对齐 unshift ✓；`_registerCollection('clients')` 进 normalize 白名单（导入/解密/清空路径保数据）✓。
- 测试安全网：`consulting-ux.test.js` 6 项（空态+新建、折叠展开、三区块子项落库展示、负数收入拦截、跟进勾选、删除确认+撤销）；`contract.test.js:45-48`（领域 API 存在清单）、`:91-92`（**addClient 记录必须有 id + 三空数组**）、`:144`（领域 API 可调用）；store/behavior/event-bus/qa 共享测试全部直走领域 API——store-content.js 不动即全过。
- **契约锁定项**：shell.test.js 脚本序断言（文件不改名不换位）；innerhtml.test.js 白名单 `consulting.js:79/113/153` 三条已在内（renderProjects/renderFollowups/renderIncomes 的 wrap.innerHTML 插值点，迁移后行号随迁，插值安全性语义零变化）。
- **工厂缺口结论：无**——嵌套子集合不是独立集合，工厂 CRUD 模型（整集合 add/update/remove）天然不适用于子项；子项操作本质是「整客户记录的嵌套字段更新」，领域 API 已是干净封装。强行把子项塞进工厂需要「路径集合」能力（id 指向嵌套位置），属结构性扩展，违背「只进 2-3 个模块重复需要的通用能力」与「Specialized 不强行通用化」原则——**本试点结论预判：嵌套边界留领域层，工厂零扩展**。

## 迁移形态

### 1. 单个工厂模块实例（客户主对象）

| 集合 | id | 关键配置 | 理由 |
|---|---|---|---|
| 客户 | clients | `prepend: true`（不配 timeField——createdAt 工厂默认生成）；fields：name(text, required) + contact(text) + note(textarea) + **projects(array) + followups(array) + income(array)** | prepend 对齐 addClient 的 unshift；三个 array 字段声明后工厂 add 自动补 `[]`（对齐 contract.test.js:92 契约，页面无需手动初始化）；name required 与页面表单 required 双保险（领域 API「未命名客户」兜底保留在 store-content.js，测试无空名用例） |

### 2. 边界决策：嵌套子集合不进工厂（本试点核心结论）

项目/跟进/收入三组 add/update/remove **继续走领域 API**（store.addClientProject 等）：
- 子项 remove 的「restore 闭包撤销」语义工厂不提供（工厂仅整记录撤销）——走领域 API 撤销行为 100% 保留；
- 子项增删改后页面显式 render(ctx)（现状如此，不依赖工厂 notify）；
- 数据形状零变化：clients 仍为嵌套数组，search.js:38 / 周报 / store-report 读法零变更。

### 3. 客户主对象走工厂（ensureMod）

- 新增/编辑客户：`ensureMod(ctx).add(v)` / `.update(id, v)`（onSubmit 内，news/selfmedia 先例）；
- 删除客户：`ensureMod(ctx).remove(c.id)` + toast 撤销 `store.undoRemove()` —— 工厂 `_undoPush` 整记录（含子项），撤销恢复与 removeClient 语义一致；
- 折叠状态 `expanded`、收入合计（round 2 位）、计数徽标、空态全部留页面层（selfmedia 统计/日历同原则）。

### 4. 绑定统一为委托写法（第六个消费方，四/五模块收敛模板照搬）

客户卡内 12 类按钮（data-cx 折叠 / data-cedit / data-cdel / data-spadd / data-pe / data-pd / data-fuadd / data-fe / data-fd / data-inadd / data-ie / data-idel）当前为 onclick 闭包逐个绑 → 改经**容器级委托**（`data-act` 语义保留原 data-* 名，回查 state.clients 最新对象 + `delegatedBound` 门闩）；**跟进 checkbox（data-fcheck）为 change 事件控件，委托容器补一个 change 监听**（click/change 双委托，一次绑定）。DOM 契约（data-client / data-id / 区块 data-spwrap 等）零变更。

### 5. 其余改动

- 订阅收敛（news 试点四写法）：`bus.on` 返回 off 存 `unsubs` 数组；保留 `['/data/clients', '/data/settings', '/data/all']`。
- onSubmit 预处理：**收入金额负数拦截保留**（`return '金额需为非负数字'`，工厂 number 类型不夹负，现状页面拦截不可丢）；name/contact/note 的 trim 由工厂 text 类型承担。
- innerhtml 白名单行号随迁：`consulting.js:79/113/153` 三条（renderProjects/renderFollowups/renderIncomes 的 wrap.innerHTML 插值点，行号随迁移位移；赋值点集与插值安全性语义零变化，非新增赋值点）。
- storageKey 照例 'sonder_data_v1'；`store._registerCollection('clients')` 幂等。

## 行为原样保留清单（不借机修）

1. 客户卡折叠/展开（expanded 记忆）、客户编辑/删除确认弹窗 + toast 撤销。
2. 三区块子项全部交互：添加/编辑/删除 + 跟进 checkbox 勾选落库 + 子项删除的闭包撤销。
3. 收入合计（两位小数 round）、「客户 N 位」计数、空态引导。
4. 收入金额负数拦截（弹窗不关闭 + 错误提示）。
5. store 领域 API 全量保留（contract.test.js:45-48 契约 + search/周报/测试调用方）。

## 已识别的差异点（均消化为无现实影响，如实记录）

- 工厂 update 对 contact/note trim 首尾空格（store 原实现不 trim）——页面表单输入无首尾空格依赖，无现实差异（news 先例同）。
- 工厂 add 为客户记录**额外生成 updatedAt**（store 原只写 createdAt；旧记录无该字段）——UI/搜索/周报均不读 updatedAt，无现实差异。
- 工厂 add 的 name 空串（required 拦截在表单层与工厂层双保险）与领域 API「未命名客户」兜底并存——页面路径不可达空名，编程调用走领域 API 不变。

## 验证计划

- 全量 `npm test`：583 项（**数量不变**——工厂零扩展 → 无新契约测试；consulting-ux 6 项旧测试原样全绿为成功判据，含嵌套子项/折叠/撤销全套）。
- `npm run typecheck` + `npm run lint` 零错误。
- `npm run test:e2e`：既有 5 项（无 consulting 路径，先例同 news 不新增）；E2E **断言缓存 v43**（sync-sw 前）。
- 浏览器冒烟（试点五同款临时脚本，跑完即删）：真实 Chromium 走 新建客户 → 展开 → 添加项目/跟进/收入 → 负数拦截 → 勾选跟进 → 编辑客户 → 删除客户确认 → 撤销恢复 → **刷新持久化**，全程零报错。

## 提交计划（两笔，任一阶段失败即停）

1. **001 consulting 迁移**：`js/consulting.js`（工厂化主对象 + 委托绑定 + 子项走领域 API + 订阅收敛）→ 全量回归 → typecheck/lint → E2E（断言 v43）→ 浏览器冒烟。
2. **002 文档同步**：innerhtml 白名单行号随迁（已含在 001 同批提交内亦可）→ `npm run sync-sw`（预期 v43 → v44）→ ADR-011 追加试点 6 记录（含「嵌套边界结论」）→ CHANGELOG 一条 → AGENTS 基线（测试 583 不变、提交数 +2、缓存 v44）→ PRD 缓存描述 v43 → v44。
3. 复核 `git rev-list --count HEAD` 并同步 AGENTS 提交数。

## 回滚预案

- 任一批测试失败即停；单笔 `git revert` 即可（clients 数据无迁移动作、无 storage key / schema 变更——集合照旧写主快照，嵌套结构原样）。
- 行为风险低：改动集中在页面接线层（客户主对象改走工厂 + 按钮委托化），子项与存储路径零改动；innerhtml 白名单行号随迁有测试失败即显形。
