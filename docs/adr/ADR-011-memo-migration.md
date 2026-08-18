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

### 试点 3：dev（开发工作页）——2026-08-17

- **选型侦查结论**：dev 页为三个集合复合页（`devProjects` 含嵌套任务 / `devNotes` / `devSnippets`）；领域 API 项目新建用 unshift（最新在前）、笔记/片段编辑刷新 updatedAt 驱动置顶排序；测试安全网 dev-v3 7 项 + modules-smoke + store/behavior/search 共享测试；**无新工厂缺口**（v0.1.2 能力均可配置描述）。
- **决策**：
  1. **无工厂扩展**：三个集合全部用 v0.1.2 既有能力（本次迁移实证「无新通用缺口」结论——首批消费方覆盖 add/update/remove/render/prepend，扩展线收敛）。
  2. **dev 迁移形态**：同一页面三实例模块——`devProjects`（`prepend: true` 对齐 unshift 最新在前 + name 必填 + note + `tasks` 声明 array 仅作默认保底）、`devNotes`/`devSnippets`（title/内容必填；不配 timeField，靠工厂默认 createdAt/updatedAt——编辑自动刷新 updatedAt 出场即满足置顶排序，无需扩展）。
  3. **嵌套集合边界（本试点核心结论）**：嵌套任务（`tasks` 内嵌数组的增删改）属内嵌数据局部操作，工厂为整记录模型（add/update/remove 以记录为单位），**不进工厂**——保留 `addDevTask/updateDevTask/removeDevTask` 领域 API，其变更经 store emitChange → EVENT 订阅兜底重绘。确立规则：**嵌套集合一律留在 store/页面层，工厂只管顶层记录集合**。
  4. **绑定委托化落地（试点2检查点待办首次执行）**：dev 卡内按钮（项目设置/删除、任务编辑/删除/勾选、笔记编辑/删除、片段复制/编辑/删除）由闭包逐个绑改为**容器级委托**（`data-*` 属性 → 点击回查 state 最新对象；`delegatedBound` 门闩防常驻容器监听累积）。对比结果：委托 2:1 胜出（dev + today）→ **memo 闭包绑定统一为委托列为下一轮回溯任务**（触发条件已达成，行为不变、测试全绿）。
  5. **行为保留**：三个标签 tabState、Markdown 渲染与一键复制、删除撤销不对称（项目/笔记可撤销、任务/片段无撤销）原样；dev 撤销无 P5a 切页守卫的历史小瑕疵本批不扩散（如实记录）。工厂 `required` 校验替代 store 的"空名回落'未命名项目'"——表单层必填已拦截，页面路径等价、工厂更严（防御性，不劣化）。文本字段工厂 trim（Markdown 首尾空格/空行无渲染语义，无影响）。
  6. **XSS 白名单随迁**：innerhtml.test.js 白名单行号 109/111 → 258/260（同一赋值点 `wrap.innerHTML` 因 file 重排位移，语义零变化）。
- 实证：**578 项全绿**（工厂无扩展 → 无新契约测试；dev 旧测试原样通过为成功判据）；typecheck 与 lint 零问题（含清理 2 处迁移残留未用变量）；Playwright E2E 5/5；sw.js 缓存 v38 → v39。提交 b139e5b（代码）+ 文档批次。
- 回滚预案：本批两笔独立提交（b139e5b dev 迁移 / docs 批次），任一阶段测试失败即停；单笔 `git revert` 即可，数据无迁移动作、无 storage key / schema 变更（三集合照旧写主快照）。

### 绑定收敛回溯：memo 闭包 → 容器委托（2026-08-17）

- 背景：试点评估检查点（本节第 35 行）待办「绑定模式收敛」触发条件（dev 迁移完成）已达成——dev 迁移强制委托写法，三模块对比后委托胜出（dev + today vs memo 闭包）。本次为待办收尾：memo 卡内按钮统一为委托写法。
- **决策**：
  1. **memo 绑定委托化**：itemEl 移除三处闭包逐个绑（archive/edit/del），改经 `bindDelegated` 容器级委托（`data-act` 回查 `store.state.memos` 最新对象，`delegatedBound` 门闩防常驻容器监听累积）。DOM 契约零变更（`data-id`/`data-act` 属性不变），`#memoAdd` 与空状态新建按钮保持节点级绑定（与 dev `#devAdd` 一致——委托化范围限定"卡内行按钮"）。
  2. **顺带消除 stale-closure 竞态**：原闭包捕获绘制时刻的 `isArchived`，双标签场景另一页改状态后本页点归档会以旧值覆盖；委托回查 state 最新对象后取反，以最新态为准。
  3. **行为保留**：归档/取消归档文案、编辑预填、删除需确认 + 撤销 toast + P5a 切页守卫原样。
- 实证：**578 项全绿**（memo 旧测试原样通过为成功判据，home-memo-ux / smoke / modules-smoke / 快速备忘等未改动）；typecheck 与 lint 零问题；Playwright E2E 5/5；sw.js 缓存 v39 → v40。
- 结论：绑定写法三模块（memo/today/dev）收敛完成，本轮待办关闭；无新待办引入（行为不变、测试全绿，符合「代码漂亮」级收尾标准）。
- 回滚预案：单文件单提交，`git revert` 即回闭包写法；无数据动作。

### 离线状态指示器（2026-08-17）

- 背景：CHANGELOG v6.0 计划节 UX backlog 项。查证发现页脚 `#netOnline` / `#netOffline` 骨架与红色高亮样式（style.css `.net-offline`）早已就位，但全库无任何 JS 控制显隐（无 `navigator.onLine`、无 online/offline 监听）——属「骨架已备、逻辑缺失」半成品。
- **决策**：
  1. **app.js 补齐逻辑**：新增 `applyNetState()`（按 `navigator.onLine` 切换两个元素 `hidden`）+ `window` 上 `online`/`offline` 事件监听 + 启动初始化。只动 hidden 属性，不新增 DOM/CSS/事件名，不引入网络探活（fetch 周期检测属过度设计，`navigator.onLine` 已覆盖用户感知的断网/恢复场景）。
  2. **测试注入**：harness `boot()` 支持 `opts.online` 覆盖初始 `navigator.onLine`（初始离线场景）；测试按浏览器真实语义先置 `onLine` 再派发对应事件。
- 实证：**583 项全绿**（基线 578 + 新增 `tests/offline-indicator.test.js` 5 项，既有 pwa/shell 测试原样通过）；typecheck 与 lint 零问题；Playwright E2E 5/5（断言 v40）；sw.js 缓存 v40 → v41。
- 结论：CHANGELOG「离线状态指示器」计划关闭；无新待办引入。
- 回滚预案：单提交（app.js + 测试 + harness + 文档），`git revert` 即回静态占位状态；无数据动作。

### 试点 4：news（看新闻计划）——2026-08-17

- **选型侦查**：news 为全项目第二个最小标准模块（131 行，单集合 `state.news`），字段 title/url/source/tags/status/note/time；领域 API（addNews/updateNews/removeNews）消费方均为只读（search.js 全局搜索索引、home.js 概览卡汇总直接读 `state.news`——工厂写同一集合，读法零变更）。测试安全网 news-ux 5 项 + modules-smoke + state/search 共享测试。**无新工厂缺口**（v0.1.2 能力均可配置描述）——零工厂扩展，再次实证「无新通用缺口」。
- **决策**：
  1. **零工厂扩展**：单实例 `id: 'news'`，`prepend: true` 对齐 addNews 的 unshift + `timeField: 'time'` 对齐既有 time 字段（新增写入、编辑不刷）；字段声明 title（text, required）/ url / source / tags（array 默认保底）/ status（select unread-read-favorite）/ note。
  2. **筛选状态不进工厂**：页面本地筛选 `state.status`/`state.tag`（下拉筛选+清除）是**视图层派生状态**，留页面层——与 today 的 done/doneAt 页面规则、dev 的 tabState 同属「页面业务规则不进工厂」边界。
  3. **绑定委托化（试点 3 写法收敛后首个新消费方）**：卡内按钮（mark/fav/unfav/edit/del）由闭包逐个绑改为容器级委托（`data-act` 回查 `store.state.news` 最新对象 + `delegatedBound` 门闩防监听累积），与 memo/today/dev 四模块写法收敛。
  4. **行为保留**：空态文案、状态 pill（收藏/已读/待读）、危险链接 sanitizeUrl 不外链、筛选交互、删除需确认 + 撤销 toast 原样；onSubmit 标签逗号拆分预处理留页面层。
  5. **领域 API 保留**：addNews/updateNews/removeNews 不删（先例同 memo/today/dev；无调用方改写，留作兼容）。
- 实证：**583 项全绿**（数量不变——工厂零扩展 → 无新契约测试；news 旧测试原样通过为成功判据）；typecheck 与 lint 零问题；Playwright E2E 5/5（断言 v41）；sw.js 缓存 v41 → v42。innerhtml 无新增赋值点（news 原唯一赋值为清空 `innerHTML=''`，白名单不动）。
- 结论：四模块（memo/today/dev/news）工厂化完成，零扩展轨迹延续；筛选状态留页面的边界决策首次落账。无新待办引入。
- 回滚预案：两笔独立提交（74ec1a4 news 迁移 / docs 批次），任一阶段测试失败即停；单笔 `git revert` 即可，数据无迁移动作、无 storage key / schema 变更。

### 试点 5：selfmedia（自媒体）——2026-08-18

- **选型**：selfmedia 为全项目最大标准模块（383 行，单集合 `state.posts`），字段 title/platform/account/tags/status/publishDate/views/likes/comments/favorites/note/progress，时间字段 createdAt——作为复杂业务模块的压测：月历拖拽排期（桌面 DnD + 移动端长按）、统计区（publishedStats + SVG 折线图）、CSV 导出、筛选、数字反馈输入、进度条等页面级能力在工厂模型下的边界验证。领域 API（addPost/updatePost/removePost）消费方只读（search.js 索引、store-report.js 周报 summarize——工厂写同一集合，读法零变更）。
- **决策**：
  1. **零工厂扩展**：单实例 `id: 'posts'`，`prepend: true` 对齐 addPost 的 unshift（最新在前）；**不配 timeField**——工厂默认生成 createdAt/updatedAt 恰对齐 postFactory 的 createdAt 语义（edited 不刷 createdAt，工厂 update 刷 updatedAt，UI/搜索/周报均不读 updatedAt，无现实差异）。platform select options `['', '公众号', '小红书', 'B站', '抖音']` 空串首项——保住「未设置平台」显示语义不被 normalize 强改（空值经 sanitize 匹配首项原样保存）。
  2. **页面级能力不进工厂（本试点核心结论）**：月历视图（renderCalendar + 拖拽 DnD + 移动端长按/触摸清理）、统计区（statsSection + miniLine SVG）、CSV 导出（带筛选）、筛选/视图状态（`state.status/tag/view`）、日历状态（`cal`）、数字反馈输入框（data-fb）与进度条（data-prog）全部留页面层——与 today done/doneAt、dev tabState、news status/tag 同属「页面业务规则不进工厂」边界；`progress` 声明为 number 字段仅作正常化通道，进度条更新仍经工厂 update。
  3. **绑定委托化**：卡内按钮（edit/del）改容器级委托（`data-act` 回查 `store.state.posts` 最新对象 + `delegatedBound` 门闩），四模块写法收敛；**数字反馈输入框与进度条为控件，维持节点级绑定**（非行内按钮，不进委托，先例 memo #memoAdd / dev #devAdd）。
  4. **数字字段 clamp 由页面层预处理承担**：onSubmit（表单）与 data-fb change（反馈输入）经 `S._h.num0` 夹非负、progress 夹 0-100——对齐 store.updatePost 的 num0 语义（工厂 number 类型仅 Number() 转义不夹负/不夹百，差异在提交前收敛，行为等价）。进度条 range 天然 0-100 无需夹。
  5. **publishDate null 语义保留**：onSubmit `!v.publishDate → null` 预处理（工厂 date 类型会将空串存 `''`，预处理保 null）；拖拽落账 `update(id, { publishDate: dateStr })` 走工厂。
  6. **行为保留**：月历全交互（切月/本月/拖拽/移动端长按/touchcancel 清理）、统计+折线图+色值常量、CSV 导出、筛选+视图切换+清除、已发布卡反馈输入/进度条即时更新、「未设置平台」显示语义、删除确认+撤销 toast 原样（selfmedia 无 P5a 切页守卫，与 news 一致）。
  7. **XSS 白名单随迁**：innerhtml.test.js 白名单行号 250 → 307（同一赋值点 statsSection `wrap.innerHTML` 因文件重排位移，赋值点集合与插值安全性语义零变化——非新增赋值点）。
- 实证：**583 项全绿**（数量不变——工厂零扩展 → 无新契约测试；selfmedia-v3 8 项 + selfmedia-stats 4 项旧测试原样通过为成功判据，含拖拽/统计/图表/筛选全套）；typecheck 与 lint 零问题（清理 1 处迁移残留未用变量）；Playwright E2E 5/5（断言 v42）；sw.js 缓存 v42 → v43（ASSET_SIG f3e431c123e3 → 726dcd387e91，ASSETS 40 项不变）。
- 结论：最大标准模块（383 行）压测通过——工厂模型对复杂业务模块无失控（统计/月历/CSV/反馈控件全部自然留在页面层，工厂仅管理记录 CRUD）；零扩展轨迹延续五试点。剩余候选 consulting/reading/design 均为顺水推舟。无新待办引入。
- 回滚预案：两笔独立提交（001 selfmedia 迁移 / 002 文档批次），任一阶段测试失败即停；单笔 `git revert` 即可，数据无迁移动作、无 storage key / schema 变更（posts 集合照旧写主快照）。

### 试点 6：consulting（咨询工作）——2026-08-18

- **选型**：consulting 是唯一「主记录 + 三个嵌套子集合」的标准模块（`state.clients`，每客户内嵌 projects/followups/income 数组）——作为嵌套边界压测：工厂整记录模型与局部子集合操作（增删改/勾选/删除撤销）的边界验证。领域 API（addClient/updateClient/removeClient + 子集合各三对）消费方只读（search.js:37-38 索引读 `c.name` + `c.note`，工厂写同一集合，读法零变更）。
- **决策**：
  1. **零工厂扩展**：单实例 `id: 'clients'`，`prepend: true` 对齐 addClient 的 unshift（最新在前）；**不配 timeField**——工厂默认生成 createdAt/updatedAt 对齐 addClient 的 createdAt 语义（UI 不读时间字段，无现实差异）。fields：name(text, required) + contact(text) + note(textarea) + projects/followups/income（array 仅声明默认保底 `[]`，形状由领域 API 维护）。
  2. **嵌套集合边界收口（本试点核心结论）**：客户记录进出工厂（`ensureMod(ctx).add/update/remove`，删除走 `_undoPush` 整记录撤销）；**三个嵌套子集合继续走领域 API**（addClientProject/updateClientProject/removeClientProject、addClientFollowup/updateClientFollowup/removeClientFollowup、addClientIncome/updateClientIncome/removeClientIncome）——子项 remove 的 restore 闭包撤销工厂不提供，嵌套边界留领域层，与 dev 试点「任务不进工厂」同边界；语义一致：整记录删除可整体撤销（toast undoRemove），子项删除靠闭包局部恢复（toast undoRemove 调闭包）。嵌套写入经领域 API 的 save + emitChange → /data/clients 总线兜底重绘（双写路径先例）。
  3. **绑定委托化**：卡内 12 种按钮（data-cx 展开/data-cedit/data-cdel 客户、data-spadd/data-pe/data-pd 项目、data-fuadd/data-fe/data-fd 跟进、data-inadd/data-ie/data-idel 收入）统一容器级 click 委托（回查 `store.state.clients` 最新对象 + `delegatedBound` 门闩，常驻容器只绑一次）；跟进勾选（data-fcheck）走 change 委托 → `updateClientFollowup(c.id, id, {done: b.checked})`；展开折叠状态（expanded 缓存）与编辑对话框均在委托内取最新数据。
  4. **页面层规则保留**：收入合计 `sum.reduce` + `Math.round`、新增/编辑金额负数拦截（`amount >= 0`，formModal 返回校验串）、客户/子项删除二次确认（confirmBox + data-act="yes"）、子项新增默认日期（S.todayStr）全部留页面层——工厂只管记录 CRUD，与各试点「页面业务规则不进工厂」边界一致。
  5. **订阅收敛**：`var unsubs = []` + `unsubs.push(off)` 收集，订阅 `/data/clients`（领域 API 双写路径兜底重绘）+ `/data/settings` + `/data/all`（同 news/selfmedia）；`mod.render` 回调与 `Pages.consulting.render` 均经 `routeIs()` 守卫。
  6. **XSS 白名单随迁**：innerhtml.test.js 白名单行号 79/113/153 → 105/118/131（同一赋值点 clientCard/renderProjects/renderIncomes 的 innerHTML 因文件重排位移，赋值点集合与插值安全性语义零变化）。
- 实证：**583 项全绿**（数量不变——工厂零扩展 → 无新契约测试；consulting-ux 6 项旧测试原样通过为成功判据）；typecheck 与 lint 零问题；Playwright E2E 5/5（断言 v43）；真实 Chromium 冒烟 15/15（空态/新建/展开/子项落库/收入合计/负数拦截/勾选/改名/删除+撤销/刷新持久化/零页面错误——window.SonderStore 无实例 state，断言全走 DOM）；sw.js 缓存 v43 → v44（ASSET_SIG 726dcd387e91 → 02795342269f，ASSETS 40 项不变）。
- 结论：嵌套边界压测通过——dev「任务不进工厂」在 consulting 三嵌套数组上复证并收口为规则（**嵌套集合局部操作不进工厂，整记录 CRUD 进工厂**），嵌套删除撤销两侧语义自洽（整记录整体撤销 vs 子项闭包局部撤销）；零扩展轨迹延续六试点，factory 能力边界冻结于 v0.1.2。无新待办引入。
- 回滚预案：两笔独立提交（001 consulting 迁移 / 002 文档批次），任一阶段测试失败即停；单笔 `git revert` 即可，数据无迁移动作、无 storage key / schema 变更（clients 集合照旧写主快照）。
